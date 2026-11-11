import { CHECKLIST_SECTIONS, parseChecklist } from './checklist.js';

export const KPI_RULES = [
  ['Ketepatan Pengiriman', 'Persentase pengiriman yang tiba sesuai jadwal', 25, 95],
  ['Penyelesaian Tugas', 'Persentase tugas pengiriman yang diselesaikan dari seluruh tugas yang diberikan', 20, 100],
  ['Kepatuhan Rute', 'Persentase perjalanan yang sesuai dengan rute yang ditetapkan dalam aplikasi', 15, 95],
  ['Inspeksi Kendaraan', 'Persentase penyelesaian checklist inspeksi kendaraan sebelum keberangkatan', 15, 100],
  ['Bukti Pengiriman', 'Persentase pengiriman yang dilengkapi bukti serah terima melalui aplikasi', 10, 100],
  ['Pemeriksaan Kondisi Sopir', 'Persentase pemeriksaan kondisi fisik dan tingkat kelelahan sebelum keberangkatan', 15, 100]
];
const percent = (n, total) => total ? n / total * 100 : 0;
const round = n => Math.round(n * 100) / 100;

export function scheduledStops(routes, date) {
  return routes.filter(r => r.urutan > 0).sort((a,b) => a.urutan-b.urutan || a.id-b.id).map((r, i) => {
    // Fixed one-hour slots from 09:00 WITA, including a possible next-day rollover.
    const deadline = new Date(Date.parse(`${date}T09:00:00+08:00`) + i * 3600000);
    return { ...r, deadline_at: deadline.toISOString(), estimasi_waktu_tiba: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).format(deadline) };
  });
}

export function deliveryFor(stop, deliveries) {
  return deliveries.filter(p => p.pangkalan_nama === stop.pangkalan_nama ||
    (p.latitude != null && p.longitude != null && Math.abs(Number(p.latitude)-Number(stop.latitude)) < 0.000001 && Math.abs(Number(p.longitude)-Number(stop.longitude)) < 0.000001))
    .sort((a,b) => new Date(a.created_at)-new Date(b.created_at))[0];
}

export function calculatePerformance({ routes, deliveries, inspection, samples = [], date, now = Date.now() }) {
  const stops = scheduledStops(routes, date);
  const completed = stops.map(r => ({ stop: r, delivery: deliveryFor(r, deliveries) })).filter(p => p.delivery);
  const onTime = completed.filter(p => Date.parse(p.delivery.created_at) <= Date.parse(p.stop.deadline_at)).length;
  const firstDelivery = Math.min(...deliveries.map(p => Date.parse(p.created_at)), now);
  const beforeDeparture = inspection && Date.parse(inspection.created_at) <= firstDelivery;
  const checklist = beforeDeparture ? parseChecklist(inspection) || [] : [];
  const expected = CHECKLIST_SECTIONS.filter(s => s.id !== 10).flatMap(s => s.items.map(item => ({ section: s.id, item })));
  const answered = expected.filter(item => checklist.some(c => c.section === item.section && c.item === item.item && ['BAIK', 'TIDAK'].includes(c.status))).length;
  const withProof = completed.filter(p => ['foto_sebelum','foto_proses','foto_sesudah','penerima_nama'].every(k => p.delivery[k])).length;
  const realizations = [percent(onTime, stops.length), percent(completed.length, stops.length), percent(samples.filter(s => s.on_route).length, samples.length), percent(answered, expected.length), percent(withProof, completed.length), beforeDeparture ? percent(Number(inspection.physical_checked) + Number(inspection.fatigue_checked), 2) : 0];
  const items = KPI_RULES.map(([area, indicator, weight, target], i) => {
    const score = realizations[i] / target * 100;
    return { no: i+1, area, indicator, weight, target, realization: round(realizations[i]), score: round(score), finalScore: round(score * weight / 100) };
  });
  const overdue = stops.filter(r => !deliveryFor(r, deliveries) && now > Date.parse(r.deadline_at));
  return { items, total: round(items.reduce((sum, item) => sum + item.finalScore, 0)), overdue, completed: completed.length, assigned: stops.length, gpsSamples: samples.length };
}

export async function loadPerformance(queryAll, date) {
  const [drivers, routes, deliveries, inspections, samples] = await Promise.all([
    queryAll('SELECT id, nama FROM sopir ORDER BY nama'),
    queryAll('SELECT * FROM rute_harian WHERE tanggal = ? ORDER BY sopir_id, urutan', [date]),
    queryAll('SELECT * FROM pengiriman WHERE tanggal = ?', [date]),
    queryAll('SELECT * FROM inspeksi_pagi WHERE tanggal = ?', [date]),
    queryAll("SELECT sopir_id, on_route FROM route_tracking_samples WHERE captured_at >= (?::date::timestamp AT TIME ZONE 'Asia/Makassar') AND captured_at < ((?::date + 1)::timestamp AT TIME ZONE 'Asia/Makassar')", [date,date])
  ]);
  return drivers.map(s => ({ sopirId: s.id, sopir_id: s.id, nama: s.nama, ...calculatePerformance({ date, routes: routes.filter(r => r.sopir_id === s.id), deliveries: deliveries.filter(p => p.sopir_id === s.id), inspection: inspections.find(p => p.sopir_id === s.id), samples: samples.filter(p => p.sopir_id === s.id) }) })).map(p => ({ ...p, nilai: p.total, rekomendasiNilai: p.total, catatanOtomatis: `${p.completed}/${p.assigned} tujuan selesai; ${p.overdue.length} tujuan melewati deadline; ${p.gpsSamples} sampel GPS.` }));
}
