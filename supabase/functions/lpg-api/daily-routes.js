import { optimizeRoute } from './route-optimizer.js';
    const pangkalan = [
      { id: 1, nama: 'Jember Maju Jaya', alamat: 'Jl. Ahmad Yani No. 45', lat: -8.1715, lng: 113.6971, permintaan_ton: 9, zona: 'A' },
      { id: 2, nama: 'Banyu Uwir Sejahtera', alamat: 'Jl. Raya Banyu Uwir', lat: -8.1805, lng: 113.7085, permintaan_ton: 8, zona: 'B' },
      { id: 3, nama: 'Sumber Sejahtera LPG', alamat: 'Jl. Sumber Raya No. 12', lat: -8.1658, lng: 113.6845, permintaan_ton: 10, zona: 'A' },
      { id: 4, nama: 'Mitra Energi Berkah', alamat: 'Jl. Industri Blok C', lat: -8.1925, lng: 113.7215, permintaan_ton: 7, zona: 'B' },
      { id: 5, nama: 'Pusat Distribusi Jember', alamat: 'Jl. Gatot Subroto No. 99', lat: -8.1642, lng: 113.7102, permintaan_ton: 11, zona: 'A' },
      { id: 6, nama: 'Agen LPG Terpadu', alamat: 'Jl. Tanjungsari No. 56', lat: -8.1780, lng: 113.6950, permintaan_ton: 8, zona: 'B' },
      { id: 7, nama: 'Pangkalan Makmur', alamat: 'Jl. Raya Utama No. 23', lat: -8.1567, lng: 113.7289, permintaan_ton: 9, zona: 'A' },
      { id: 8, nama: 'CV Energi Maju', alamat: 'Jl. Pendidikan No. 78', lat: -8.1895, lng: 113.6978, permintaan_ton: 6, zona: 'B' },
      { id: 9, nama: 'Distributor Sentosa', alamat: 'Jl. Teratai No. 34', lat: -8.1701, lng: 113.7167, permintaan_ton: 10, zona: 'A' },
      { id: 10, nama: 'Agen Jaya Makmur', alamat: 'Jl. Merdeka No. 67', lat: -8.1625, lng: 113.7045, permintaan_ton: 7, zona: 'B' }
    ];


async function ensureDateRoutes(database, today) {
  const optimized = ['A', 'B'].flatMap((zone, index) => optimizeRoute(pangkalan.filter(p => p.zona === zone), true).pangkalanOrdered.map((p, i) => ({ driver: index + 1, p, order: i + 1 })));
  await database.begin(async tx => {
    await tx.unsafe("SELECT pg_advisory_xact_lock(hashtext('lpg-route:' || $1))", [today]);
    const rows = await tx.unsafe('SELECT DISTINCT sopir_id FROM rute_harian WHERE tanggal = $1', [today]);
    const assigned = new Set(rows.map(row => row.sopir_id));
    for (const { driver, p, order } of optimized.filter(item => !assigned.has(item.driver))) await tx.unsafe(`INSERT INTO rute_harian
      (tanggal, sopir_id, kendaraan_id, urutan, pangkalan_id, pangkalan_nama, latitude, longitude, permintaan_ton, estimasi_waktu_tiba)
      VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, '06:30')`, [today, driver, order, p.id, p.nama, p.lat, p.lng, p.permintaan_ton]);
  });
}

export async function ensureDailyRoutes(database, today) {
  const shift = (date, days) => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  };
  const [existing] = await database.unsafe('SELECT count(DISTINCT sopir_id)::int AS count FROM rute_harian WHERE tanggal = $1 AND sopir_id IN (1, 2)', [today]);
  if (existing.count === 2) return;
  const [first] = await database.unsafe('SELECT min(tanggal)::text AS tanggal FROM rute_harian');
  const oldest = shift(today, -13);
  let date = first?.tanggal && first.tanggal > oldest ? first.tanggal : oldest;
  if (!first?.tanggal) date = today;
  for (let count = 0; date <= today && count < 14; count++, date = shift(date, 1)) await ensureDateRoutes(database, date);
}
