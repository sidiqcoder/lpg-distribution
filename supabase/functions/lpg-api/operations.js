import { formatDate } from './format.js';
import { loadPerformance, scheduledStops, deliveryFor } from './performance.js';
import { LOCATIONS, locationAt } from './locations.js';
import { activePlan, ensureDailyRoutes } from './daily-routes.js';
import { googleMatrix, planRoutes, inventoryMetrics } from './logistics.js';
const invalid = message => Object.assign(new Error(message), { status: 400 });
const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;

export function registerOperations(app, { queryAll, database, googleKey = () => '' }) {
  app.get('/api/manager/demands', async (req,res) => {
    const date = req.query.date || formatDate();
    if (!validDate(date)) throw invalid('Tanggal tidak valid.');
    if (date >= formatDate()) await ensureDailyRoutes(database,date);
    const [rows, demands] = await Promise.all([
      queryAll('SELECT r.*, s.nama AS sopir_nama FROM rute_harian r JOIN sopir s ON s.id=r.sopir_id WHERE r.tanggal=? AND r.urutan>0 ORDER BY s.nama, r.urutan', [date]),
      queryAll('SELECT * FROM location_demands WHERE tanggal=?', [date])
    ]);
    const scheduled = [...new Set(rows.map(r=>r.sopir_id))].flatMap(id=>scheduledStops(rows.filter(r=>r.sopir_id===id),date));
    res.json({ date, routes: LOCATIONS.map(p=>{
      const route=scheduled.find(r=>locationAt(r.latitude,r.longitude)?.no===p.no);
      const demand=demands.find(d=>d.location_no===p.no);
      return {...route,id:route?.id??-p.no,location_no:p.no,pangkalan_nama:p.nama,alamat:p.alamat,
        permintaan_tabung:demand?.quantity??route?.permintaan_tabung??0,entered:!!demand,updated_at:demand?.updated_at,
        sopir_nama:route?.sopir_nama||'Belum ditugaskan'};
    }) });
  });
  app.post('/api/manager/demands', async (req,res) => {
    const { date, entries } = req.body;
    if (!validDate(date) || date < formatDate() || !Array.isArray(entries) || !entries.length || entries.length > 20 ||
      new Set(entries.map(e => e.location_no??e.id)).size !== entries.length || entries.some(e =>
        !(Number.isSafeInteger(e.location_no) && e.location_no>=1 && e.location_no<=20 || e.location_no==null && Number.isSafeInteger(e.id)) ||
        !Number.isSafeInteger(e.quantity) || e.quantity < 0 || e.quantity > 100000)) throw invalid('Tanggal dan jumlah permintaan tabung tidak valid.');
    await database.begin(async tx => {
      await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext('lpg-route:' || $1))", [date]);
      for (const entry of entries) {
        let no=entry.location_no;
        if(no==null) {
          const [route]=await tx.unsafe('SELECT latitude,longitude FROM rute_harian WHERE id=$1 AND tanggal=$2 AND urutan>0',[entry.id,date]);
          no=route && locationAt(route.latitude,route.longitude)?.no;
        }
        const location=LOCATIONS.find(p=>p.no===no);
        if(!location) throw invalid('Lokasi berubah. Muat ulang daftar permintaan.');
        await tx.unsafe(`INSERT INTO location_demands (tanggal,location_no,quantity,updated_by) VALUES ($1,$2,$3,$4)
          ON CONFLICT (tanggal,location_no) DO UPDATE SET quantity=excluded.quantity,updated_by=excluded.updated_by,updated_at=now()`,[date,no,entry.quantity,req.user.nama]);
        await tx.unsafe(`UPDATE rute_harian SET permintaan_tabung=$1 WHERE tanggal=$2 AND urutan>0
          AND abs(latitude-$3)<0.000001 AND abs(longitude-$4)<0.000001`,[entry.quantity,date,location.latitude,location.longitude]);
      }
    });
    res.json({ ok: true });
  });
  app.get('/api/manager/inventory-planning',async(req,res)=>{
    const date=req.query.date||formatDate();
    if(!validDate(date)) throw invalid('Tanggal tidak valid.');
    const [days,stocks]=await Promise.all([
      queryAll(`SELECT tanggal,count(*)::int AS locations,sum(quantity)::int AS total FROM location_demands
        WHERE tanggal<=? GROUP BY tanggal HAVING count(*)=20 ORDER BY tanggal DESC LIMIT 6`,[date]),
      queryAll('SELECT jumlah FROM persediaan_lpg WHERE id=1')
    ]);
    res.json(inventoryMetrics(days,stocks[0]?.jumlah??0));
  });
  app.get('/api/manager/route-planning',async(req,res)=>{
    const date=req.query.date||formatDate();
    if(!validDate(date)) throw invalid('Tanggal tidak valid.');
    res.json({...await activePlan(database,date),locations:LOCATIONS,googleConfigured:!!googleKey()});
  });
  app.post('/api/manager/route-planning',async(req,res)=>{
    const date=req.body.date||formatDate();
    if(!validDate(date)||date<formatDate()) throw invalid('Pilih tanggal hari ini atau berikutnya.');
    const matrix=await googleMatrix(googleKey());
    const plan={...planRoutes(matrix),source:'google-routes',source_label:'Google Routes API (jarak jalan saat perhitungan)',calculated_at:new Date().toISOString()};
    await database.begin(async tx=>{
      await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext('lpg-route:' || $1))",[date]);
      const [started]=await tx.unsafe(`SELECT EXISTS(SELECT 1 FROM pengiriman WHERE tanggal=$1
        UNION ALL SELECT 1 FROM permintaan_lpg WHERE tanggal=$1 AND status='DISETUJUI') AS value`,[date]);
      if(started.value) throw Object.assign(new Error('Rute sudah digunakan. Pilih tanggal berikutnya.'),{status:409});
      await tx.unsafe('INSERT INTO lpg_private.route_plans (effective_from,plan) VALUES ($1,$2::jsonb)',[date,JSON.stringify(plan)]);
    });
    await ensureDailyRoutes(database,date);
    res.json({ok:true});
  });
  app.get('/api/driver/:id/announcements', async (req,res) => {
    const date = formatDate();
    const [routes, deliveries] = await Promise.all([
      queryAll('SELECT * FROM rute_harian WHERE sopir_id=? AND tanggal=? ORDER BY urutan', [req.user.id,date]),
      queryAll('SELECT * FROM pengiriman WHERE sopir_id=? AND tanggal=?', [req.user.id,date])
    ]);
    const overdue = scheduledStops(routes,date).filter(r => !deliveryFor(r,deliveries) && Date.now() > Date.parse(r.deadline_at));
    res.json({ overdue });
  });
  app.get('/api/manager/performance', async (req,res) => {
    const date = req.query.date || formatDate();
    if (!validDate(date)) throw invalid('Tanggal tidak valid.');
    res.json({ date, drivers: await loadPerformance(queryAll,date) });
  });
}
