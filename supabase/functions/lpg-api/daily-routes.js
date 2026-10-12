import { PRESCRIBED_ROUTES, ROUTE_ORIGIN, ROUTE_SOURCE } from './prescribed-routes.js';

// Append today's document stops without altering existing routes or delivery history.
// Future days preserve the PDF order and do not backfill historical assignments.
export async function ensureDailyRoutes(database, today) {
  if (today < '2026-10-12') return;
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
        await tx.unsafe(`INSERT INTO rute_harian
          (tanggal,sopir_id,kendaraan_id,urutan,pangkalan_id,pangkalan_nama,latitude,longitude,permintaan_ton,estimasi_waktu_tiba,sumber,urutan_dokumen)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,NULL,$9,$10)`,
          [today, driver.id, driver.kendaraan_id, origin ? 0 : ++order,
            driver.id * 1000 + documentOrder, origin ? 'Pangkalan (Titik awal berangkat)' : `Tujuan ${driver.username.toLowerCase() === 'budi' ? 'Budi' : 'Ahmad'} ${documentOrder}`,
            ...coordinates, ROUTE_SOURCE, documentOrder]);
      }
    }
  });
}
