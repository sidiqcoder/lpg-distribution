import { LOCATIONS, locationAt } from './locations.js';
import { documentPlan } from './logistics.js';
import { PRESCRIBED_ROUTES, ROUTE_ORIGIN, ROUTE_SOURCE } from './prescribed-routes.js';

// Append today's document stops without altering existing routes or delivery history.
// Future days preserve the PDF order and do not backfill historical assignments.
export async function ensureDailyRoutes(database, today) {
  if (today < '2026-10-12') return;
  if (today >= '2026-11-14') return ensureOptimizedRoutes(database, today);
  await database.begin(async tx => {
    await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext('lpg-route:' || $1))", [today]);
    const drivers = await tx.unsafe(`SELECT s.id, s.username,
      COALESCE((SELECT kendaraan_id FROM inspeksi_pagi WHERE sopir_id=s.id AND tanggal=$1),
        (SELECT id FROM kendaraan WHERE id=s.id)) AS kendaraan_id
      FROM sopir s WHERE lower(s.username) IN ('budi', 'ahmad')`, [today]);
    for (const driver of drivers) {
      const stops = PRESCRIBED_ROUTES[driver.username.toLowerCase()];
      const existing = await tx.unsafe('SELECT urutan, urutan_dokumen FROM rute_harian WHERE tanggal=$1 AND sopir_id=$2 AND sumber=$3', [today, driver.id, ROUTE_SOURCE]);
      const assigned = new Set(existing.map(row => row.urutan_dokumen));
      if (assigned.size === stops.length + 1) continue;
      const [max] = await tx.unsafe('SELECT COALESCE(max(urutan),0)::int AS urutan FROM rute_harian WHERE tanggal=$1 AND sopir_id=$2', [today, driver.id]);
      let order = max.urutan;
      for (const [documentOrder, coordinates] of [ROUTE_ORIGIN, ...stops].entries()) {
        if (assigned.has(documentOrder)) continue;
        const origin = documentOrder === 0;
        const location = locationAt(...coordinates);
        const revised = today >= '2026-11-04';
        await tx.unsafe(`INSERT INTO rute_harian
          (tanggal,sopir_id,kendaraan_id,urutan,pangkalan_id,pangkalan_nama,latitude,longitude,permintaan_ton,estimasi_waktu_tiba,sumber,urutan_dokumen,permintaan_tabung)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$11,$9,$10,$12)`,
          [today, driver.id, driver.kendaraan_id, origin ? 0 : ++order,
            driver.id * 1000 + documentOrder, origin ? 'Gudang (Titik awal berangkat)' : revised && location ? location.nama : `Tujuan ${driver.username.toLowerCase() === 'budi' ? 'Budi' : 'Ahmad'} ${documentOrder}`,
            ...coordinates, ROUTE_SOURCE, documentOrder, revised && !origin ? `${String(8 + documentOrder).padStart(2, '0')}:00:00` : null, revised && !origin ? location?.permintaan_tabung ?? 56 : 0]);
      }
    }
  });
}

export async function activePlan(database, date) {
  const [saved] = await database.unsafe('SELECT id,plan FROM lpg_private.route_plans WHERE effective_from <= $1 ORDER BY effective_from DESC,id DESC LIMIT 1', [date]);
  return saved ? { ...saved.plan, version: `saving-nn-v2-${saved.id}` } : documentPlan();
}

export async function ensureOptimizedRoutes(database, today) {
  await database.begin(async tx => {
    await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext('lpg-route:' || $1))", [today]);
    const plan = await activePlan(tx, today);
    const drivers = await tx.unsafe(`SELECT s.id,s.username,
      COALESCE((SELECT kendaraan_id FROM inspeksi_pagi WHERE sopir_id=s.id AND tanggal=$1),
      (SELECT id FROM kendaraan WHERE id=s.id)) AS kendaraan_id
      FROM sopir s WHERE lower(s.username) IN ('budi','ahmad')`, [today]);
    if (drivers.length !== 2) throw new Error('Akun Budi dan Ahmad diperlukan untuk pembagian rute.');
    const existing = await tx.unsafe('SELECT * FROM rute_harian WHERE tanggal=$1 AND sopir_id=ANY($2::int[])', [today,drivers.map(d=>d.id)]);
    if (existing.length===22 && existing.every(r=>r.sumber===plan.version)) return;
    const [started] = await tx.unsafe(`SELECT EXISTS(SELECT 1 FROM pengiriman WHERE tanggal=$1
      UNION ALL SELECT 1 FROM permintaan_lpg WHERE tanggal=$1 AND status='DISETUJUI') AS value`, [today]);
    // Existing work is frozen. The next day automatically uses the new plan.
    if (started.value) return;
    const demands = await tx.unsafe('SELECT location_no,quantity FROM location_demands WHERE tanggal=$1', [today]);
    await tx.unsafe('DELETE FROM rute_harian WHERE tanggal=$1 AND sopir_id=ANY($2::int[])', [today,drivers.map(d=>d.id)]);
    for (const driver of drivers) {
      const route=plan.routes.find(r=>r.driver===driver.username.toLowerCase());
      for (const [order,no] of [0,...route.sequence].entries()) {
        const location=LOCATIONS.find(p=>p.no===no);
        const previous=existing.find(r=>location && Math.abs(r.latitude-location.latitude)<.000001 && Math.abs(r.longitude-location.longitude)<.000001);
        const quantity=no===0?0:demands.find(d=>d.location_no===no)?.quantity ?? previous?.permintaan_tabung ?? 0;
        await tx.unsafe(`INSERT INTO rute_harian
          (tanggal,sopir_id,kendaraan_id,urutan,pangkalan_id,pangkalan_nama,latitude,longitude,permintaan_ton,estimasi_waktu_tiba,sumber,urutan_dokumen,permintaan_tabung)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12)`,
          [today,driver.id,driver.kendaraan_id,order,no||driver.id*1000,no?location.nama:'Gudang (Titik awal berangkat)',
          no?location.latitude:ROUTE_ORIGIN[0],no?location.longitude:ROUTE_ORIGIN[1],order?`${String(8+order).padStart(2,'0')}:00:00`:null,plan.version,no,quantity]);
      }
    }
  });
}
