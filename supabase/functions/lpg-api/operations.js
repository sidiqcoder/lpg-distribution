import { formatDate } from './format.js';
import { loadPerformance, scheduledStops, deliveryFor } from './performance.js';
const invalid = message => Object.assign(new Error(message), { status: 400 });
const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;

export function registerOperations(app, { queryAll, database }) {
  app.get('/api/manager/demands', async (req,res) => {
    const date = req.query.date || formatDate();
    if (!validDate(date)) throw invalid('Tanggal tidak valid.');
    const rows = await queryAll('SELECT r.*, s.nama AS sopir_nama FROM rute_harian r JOIN sopir s ON s.id=r.sopir_id WHERE r.tanggal=? AND r.urutan>0 ORDER BY s.nama, r.urutan', [date]);
    res.json({ routes: [...new Set(rows.map(r => r.sopir_id))].flatMap(id => scheduledStops(rows.filter(r => r.sopir_id === id), date)) });
  });
  app.post('/api/manager/demands', async (req,res) => {
    const { date, entries } = req.body;
    if (!validDate(date) || date < formatDate() || !Array.isArray(entries) || !entries.length || entries.length > 200 ||
      new Set(entries.map(e => e.id)).size !== entries.length || entries.some(e => !Number.isSafeInteger(e.id) || !Number.isSafeInteger(e.quantity) || e.quantity < 0 || e.quantity > 100000)) throw invalid('Tanggal dan jumlah permintaan tabung tidak valid.');
    await database.begin(async tx => {
      for (const entry of entries) {
        const updated = await tx.unsafe('UPDATE rute_harian SET permintaan_tabung=$1 WHERE id=$2 AND tanggal=$3 AND urutan>0 RETURNING id', [entry.quantity, entry.id, date]);
        if (!updated.length) throw invalid('Penugasan lokasi berubah. Muat ulang daftar permintaan.');
      }
    });
    res.json({ ok: true });
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
