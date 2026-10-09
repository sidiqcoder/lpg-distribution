import ExcelJS from 'npm:exceljs@4.4.0';
import { Buffer } from 'node:buffer';
import { formatDate, formatWaktu, formatWaktuLengkap } from './format.js';
import { CHECKLIST_SECTIONS, CHECKLIST_TOTAL_ITEMS, parseChecklist, parseLampiran, countLolos } from './checklist.js';

export function registerRoutes(app, dependencies) {
const { queryAll, queryOne, run, database, saveUploadedFile, upload } = dependencies;
const MAX_LPG_TABUNG = 543;
// Online status is persisted in lokasi_sopir; no process-local sessions are needed.
function safeNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
app.get('/api/meta', (req, res) => {
  res.json({ maxTabung: MAX_LPG_TABUNG, sections: CHECKLIST_SECTIONS, totalItems: CHECKLIST_TOTAL_ITEMS });
});

app.get('/api/kendaraan', async (req, res) => {
  try { res.json({ kendaraan: await queryAll('SELECT * FROM kendaraan ORDER BY plat_nomor') }); }
  catch (err) { res.status(500).json({ error: 'Gagal membaca kendaraan.' }); }
});

// ---------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------
app.get('/api/tracking', async (req, res) => {
  try {
    const rows = await queryAll(`
      SELECT l.*, s.nama, s.nomor_hp FROM lokasi_sopir l JOIN sopir s ON s.id = l.sopir_id
      WHERE (?::int IS NULL OR l.sopir_id = ?) ORDER BY s.nama
    `, [req.user.role === 'driver' ? req.user.id : null, req.user.role === 'driver' ? req.user.id : null]);
    const routes = await queryAll(`
      SELECT sopir_id, urutan, latitude, longitude, pangkalan_nama FROM rute_harian WHERE tanggal = ? ORDER BY sopir_id, urutan
    `, [formatDate()]);
    const now = Date.now();
    const routeMap = new Map();
    routes.forEach((r) => { if (!routeMap.has(r.sopir_id)) routeMap.set(r.sopir_id, []); routeMap.get(r.sopir_id).push(r); });
    res.json(rows
      .filter((row) => {
        if (row.updated_at) {
          const updated = new Date(row.updated_at).getTime();
          return (now - updated) <= 35000;
        }
        return false;
      })
      .map((row) => ({ ...row, route: routeMap.get(row.sopir_id) || [] })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lokasi gagal dibaca' });
  }
});

app.post('/api/tracking', async (req, res) => {
  const { sopir_id, latitude, longitude, accuracy } = req.body || {};
  if (!sopir_id || Number.isNaN(Number(latitude)) || Number.isNaN(Number(longitude))) {
    return res.status(400).json({ error: 'Data lokasi tidak valid' });
  }
  try {
    await run(`
      INSERT INTO lokasi_sopir (sopir_id, latitude, longitude, accuracy, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(sopir_id) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude, accuracy = excluded.accuracy, updated_at = CURRENT_TIMESTAMP
    `, [Number(sopir_id), Number(latitude), Number(longitude), Number(accuracy) || 0]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Lokasi gagal disimpan' });
  }
});

// ---------------------------------------------------------------------
// Sopir
// ---------------------------------------------------------------------
app.get('/api/driver/:id/summary', async (req, res) => {
  const id = Number(req.params.id);
  const today = formatDate();
  try {
    const sopir = await queryOne('SELECT id, username, nama, lisensi_expiry, k3_expiry, sertifikat_k3, nomor_hp FROM sopir WHERE id = ?', [id]);
    if (!sopir) return res.status(404).json({ error: 'Sopir tidak ditemukan' });
    const inspection = await queryOne('SELECT * FROM inspeksi_pagi WHERE sopir_id = ? AND tanggal = ? ORDER BY created_at DESC LIMIT 1', [id, today]);
    const lpg = await queryOne('SELECT * FROM permintaan_lpg WHERE sopir_id = ? AND tanggal = ? ORDER BY created_at DESC LIMIT 1', [id, today]);
    const stok = await queryOne('SELECT jumlah FROM persediaan_lpg WHERE id = 1', []);
    const siapBerangkat = !!(inspection && inspection.status_validasi === 'AMAN' && lpg && lpg.status === 'DISETUJUI');
    const progress = inspection ? countLolos(inspection) : null;
    res.json({ sopir, inspection: inspection || null, lpg: lpg || null, siapBerangkat, progress, maxTabung: MAX_LPG_TABUNG, stok: stok ? stok.jumlah : 0, today });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membaca ringkasan sopir.' });
  }
});

app.get('/api/driver/:id/profile', async (req, res) => {
  try {
    const sopir = await queryOne('SELECT id, username, nama, lisensi_expiry, k3_expiry, sertifikat_k3, nomor_hp FROM sopir WHERE id = ?', [Number(req.params.id)]);
    if (!sopir) return res.status(404).json({ error: 'Sopir tidak ditemukan' });
    res.json({ sopir });
  } catch (err) { res.status(500).json({ error: 'Gagal membaca profil.' }); }
});

app.get('/api/driver/:id/routes', async (req, res) => {
  const id = Number(req.params.id);
  const today = formatDate();
  try {
    const rute = await queryAll('SELECT * FROM rute_harian WHERE sopir_id = ? AND tanggal = ? ORDER BY urutan ASC', [id, today]);
    const deliveredRows = await queryAll('SELECT DISTINCT pangkalan_nama FROM pengiriman WHERE sopir_id = ? AND tanggal = ?', [id, today]);
    res.json({ rute, delivered: deliveredRows.map((r) => r.pangkalan_nama) });
  } catch (err) { res.status(500).json({ error: 'Gagal membaca rute.' }); }
});

app.post('/api/driver/inspection', upload.fields(
  CHECKLIST_SECTIONS.flatMap((s) => ([{ name: `foto_section_${s.id}`, maxCount: 1 }, { name: `video_section_${s.id}`, maxCount: 1 }]))
), async (req, res) => {
  const body = req.body;
  const files = req.files || {};
  const fileName = (name) => (files[name] && files[name][0] ? files[name][0].filename : null);
  try {
    const checklist = [];
    CHECKLIST_SECTIONS.forEach((section) => {
      section.items.forEach((item, idx) => {
        const raw = body[`status_${section.id}_${idx}`];
        checklist.push({
          section: section.id,
          sectionNama: section.nama,
          item,
          status: (raw === 'BAIK' || raw === 'TIDAK') ? raw : 'BELUM_DICENTANG',
          keterangan: body[`ket_${section.id}_${idx}`] || ''
        });
      });
    });
    const lampiran = [];
    for (const section of CHECKLIST_SECTIONS) {
      const fotoFile = files[`foto_section_${section.id}`]?.[0];
      const videoFile = files[`video_section_${section.id}`]?.[0];
      const foto = fotoFile ? await saveUploadedFile(fotoFile) : null;
      const video = videoFile ? await saveUploadedFile(videoFile) : null;
      lampiran.push({
        section: section.id,
        sectionNama: section.nama,
        foto,
        video
      });
    }

    await run(`
      INSERT INTO inspeksi_pagi (tanggal, sopir_id, kendaraan_id, checklist_json, lampiran_json, catatan, status_sopir, status_validasi)
      VALUES (?, ?, ?, ?, ?, ?, 'MENUNGGU_REVIEW', 'MENUNGGU')
      ON CONFLICT(sopir_id, tanggal) DO UPDATE SET
        kendaraan_id = excluded.kendaraan_id,
        checklist_json = excluded.checklist_json,
        lampiran_json = excluded.lampiran_json,
        catatan = excluded.catatan,
        status_sopir = 'MENUNGGU_REVIEW',
        status_validasi = 'MENUNGGU',
        validasi_oleh = NULL,
        validasi_waktu = NULL,
        created_at = CURRENT_TIMESTAMP
    `, [formatDate(), body.sopir_id, body.kendaraan_id, JSON.stringify(checklist), JSON.stringify(lampiran), body.catatan || '']);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan inspeksi.' });
  }
});

app.post('/api/driver/lpg', async (req, res) => {
  const { sopir_id, kendaraan_id, catatan } = req.body;
  const jumlah = Number(req.body.jumlah_diminta);
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > MAX_LPG_TABUNG) return res.status(400).json({ error: 'Jumlah LPG harus bilangan bulat antara 1 dan 543 tabung.' });
  await database.begin(async (tx) => {
    await tx.unsafe('SELECT pg_advisory_xact_lock($1)', [Number(sopir_id)]);
    const [existing] = await tx.unsafe('SELECT * FROM permintaan_lpg WHERE sopir_id = $1 AND tanggal = $2 FOR UPDATE', [Number(sopir_id), formatDate()]);
    if (existing?.status === 'DISETUJUI') await tx.unsafe('UPDATE persediaan_lpg SET jumlah = jumlah + $1, updated_at = now() WHERE id = 1', [existing.jumlah_diminta]);
    await tx.unsafe(`INSERT INTO permintaan_lpg (tanggal, sopir_id, kendaraan_id, jumlah_diminta, catatan, status)
      VALUES ($1, $2, $3, $4, $5, 'MENUNGGU') ON CONFLICT(sopir_id, tanggal) DO UPDATE SET
      kendaraan_id = excluded.kendaraan_id, jumlah_diminta = excluded.jumlah_diminta, catatan = excluded.catatan,
      status = 'MENUNGGU', disetujui_oleh = NULL, waktu_disetujui = NULL, created_at = now()`,
      [formatDate(), Number(sopir_id), Number(kendaraan_id), jumlah, catatan || '']);
  });
  res.json({ ok: true });
});

app.post('/api/driver/delivery', upload.fields([
  { name: 'foto_sebelum', maxCount: 1 }, { name: 'foto_proses', maxCount: 1 }, { name: 'foto_sesudah', maxCount: 1 }
]), async (req, res) => {
  const body = req.body;
  const files = req.files || {};
  try {
    const fotoSebelum = files['foto_sebelum']?.[0] ? await saveUploadedFile(files['foto_sebelum'][0]) : null;
    const fotoProses = files['foto_proses']?.[0] ? await saveUploadedFile(files['foto_proses'][0]) : null;
    const fotoSesudah = files['foto_sesudah']?.[0] ? await saveUploadedFile(files['foto_sesudah'][0]) : null;
    await run(`
      INSERT INTO pengiriman (
        tanggal, sopir_id, kendaraan_id, pangkalan_nama, latitude, longitude,
        jumlah_dikirim_kg, penerima_nama, penerima_hp, waktu_tiba, waktu_selesai,
        kondisi_pengiriman, foto_sebelum, foto_proses, foto_sesudah, catatan
      ) VALUES (date('now'), ?, ?, ?, ?, ?, ?, ?, ?, time('now'), time(datetime('now', '+30 minutes')), ?, ?, ?, ?, ?)
    `, [
      body.sopir_id, req.assignment.kendaraan_id, body.pangkalan_nama || '-', req.assignment.latitude, req.assignment.longitude,
      safeNumber(body.jumlah_dikirim_tabung), body.penerima_nama || '-', body.penerima_hp || '-',
      body.kondisi_pengiriman || 'OK', fotoSebelum, fotoProses, fotoSesudah, body.catatan || ''
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan pengiriman.' });
  }
});

app.post('/api/driver/hazard', upload.single('foto_bukti'), async (req, res) => {
  const { sopir_id, jenis_bahaya, deskripsi, latitude, longitude } = req.body;
  try {
    const fotoBukti = req.file ? await saveUploadedFile(req.file) : null;
    await run(`
      INSERT INTO laporan_bahaya (tanggal, sopir_id, kendaraan_id, latitude, longitude, jenis_bahaya, deskripsi, foto_bukti, status)
      VALUES (date('now'), ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `, [sopir_id, req.assignment.kendaraan_id, Number(latitude || -8.17), Number(longitude || 113.70), jenis_bahaya, deskripsi, fotoBukti]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan laporan bahaya.' });
  }
});

app.post('/api/driver/:id/certificate', upload.single('sertifikat_k3'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File sertifikat tidak ditemukan.' });
  try {
    const filename = await saveUploadedFile(req.file);
    await run('UPDATE sopir SET sertifikat_k3 = ? WHERE id = ?', [filename, Number(req.params.id)]);
    res.json({ ok: true, filename });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan sertifikat.' });
  }
});

// ---------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------
app.get('/api/manager/summary', async (req, res) => {
  const date = req.query.date || formatDate();
  try {
    const [inspeksiRows, pengiriman, positions, laporanBahaya, kpiData, stok, permintaanLpg, semuaSopir] = await Promise.all([
      queryAll(`SELECT i.*, s.nama AS sopir_nama, k.plat_nomor FROM inspeksi_pagi i JOIN sopir s ON i.sopir_id = s.id JOIN kendaraan k ON i.kendaraan_id = k.id WHERE i.tanggal = ? ORDER BY i.created_at DESC`, [date]),
      queryAll(`SELECT p.*, s.nama AS sopir_nama FROM pengiriman p JOIN sopir s ON p.sopir_id = s.id WHERE p.tanggal = ? ORDER BY p.created_at DESC`, [date]),
      queryAll(`SELECT l.*, s.nama AS sopir_nama, s.nomor_hp, k.plat_nomor FROM lokasi_sopir l JOIN sopir s ON s.id = l.sopir_id LEFT JOIN kendaraan k ON k.id = CASE l.sopir_id WHEN 1 THEN 1 WHEN 2 THEN 2 END ORDER BY s.nama`),
      queryAll(`SELECT b.*, s.nama AS sopir_nama FROM laporan_bahaya b JOIN sopir s ON b.sopir_id = s.id WHERE b.tanggal = ? ORDER BY b.created_at DESC`, [date]),
      queryAll(`SELECT * FROM kpi_sopir WHERE tanggal = ? ORDER BY sopir_id`, [date]),
      queryOne(`SELECT jumlah FROM persediaan_lpg WHERE id = 1`),
      queryAll(`SELECT r.*, s.nama AS sopir_nama, k.plat_nomor FROM permintaan_lpg r JOIN sopir s ON r.sopir_id = s.id JOIN kendaraan k ON r.kendaraan_id = k.id WHERE r.tanggal = ? ORDER BY r.created_at DESC`, [date]),
      queryAll('SELECT id, username, nama, lisensi_expiry, k3_expiry, sertifikat_k3, nomor_hp FROM sopir ORDER BY nama')
    ]);

    const inspeksi = inspeksiRows.map((i) => { const c = countLolos(i); return { ...i, lolos: c.lolos, total: c.total, tidakBaik: c.tidakBaik, belumDicentang: c.belumDicentang }; });
    const inspeksiLolos = inspeksi.filter((i) => i.status_validasi === 'AMAN').length;
    const inspeksiGagal = inspeksi.filter((i) => i.status_validasi === 'TIDAK_AMAN').length;
    const inspeksiMenunggu = Math.max(0, inspeksi.length - inspeksiLolos - inspeksiGagal);
    const totalTabung = pengiriman.reduce((sum, p) => sum + safeNumber(p.jumlah_dikirim_kg), 0);
    const maxPengirimanSopir = Math.max(1, ...semuaSopir.map((d) => pengiriman.filter((p) => p.sopir_id === d.id).length));
    const now = Date.now();
    const currentPositions = positions.filter((p) => {
      if (p.updated_at) {
        const updated = new Date(p.updated_at).getTime();
        return (now - updated) <= 35000;
      }
      return false;
    });

    res.json({
      date,
      stats: { totalInspeksi: inspeksi.length, inspeksiLolos, inspeksiGagal, inspeksiMenunggu, totalPengiriman: pengiriman.length, totalTabung, maxPengirimanSopir },
      inspeksi,
      pengiriman,
      laporanBahaya,
      kpiData,
      permintaanLpg,
      semuaSopir,
      currentPositions,
      persediaanLpg: stok ? stok.jumlah : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membaca data dashboard.' });
  }
});

app.get('/api/manager/inspection/:id', async (req, res) => {
  try {
    const row = await queryOne(`
      SELECT i.*, s.nama AS sopir_nama, s.id AS sopir_id, k.plat_nomor
      FROM inspeksi_pagi i JOIN sopir s ON i.sopir_id = s.id JOIN kendaraan k ON i.kendaraan_id = k.id WHERE i.id = ?
    `, [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Inspeksi tidak ditemukan' });
    res.json({ inspection: row, checklist: parseChecklist(row), lampiran: parseLampiran(row), counts: countLolos(row) });
  } catch (err) { res.status(500).json({ error: 'Gagal membaca inspeksi.' }); }
});

app.post('/api/manager/validate', async (req, res) => {
  const { inspeksi_id, status_validasi, catatan_validasi } = req.body || {};
  try {
    const current = await queryOne('SELECT catatan FROM inspeksi_pagi WHERE id = ?', [inspeksi_id]);
    const sopirCatatan = current ? current.catatan : '';
    const feedback = sopirCatatan
      ? sopirCatatan + '\n\n--- FEEDBACK MANAGER ---\n' + catatan_validasi
      : '--- FEEDBACK MANAGER ---\n' + catatan_validasi;
    await run(`UPDATE inspeksi_pagi SET status_validasi = ?, validasi_oleh = 'manager', validasi_waktu = datetime('now'), catatan = ? WHERE id = ?`, [status_validasi, feedback, inspeksi_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memvalidasi inspeksi.' });
  }
});

app.post('/api/manager/lpg/:id/decision', async (req, res) => {
  const status = req.body?.status;
  if (!['DISETUJUI', 'DITOLAK'].includes(status)) return res.status(400).json({ error: 'Status keputusan tidak valid.' });
  const result = await database.begin(async (tx) => {
    const [request] = await tx.unsafe('SELECT * FROM permintaan_lpg WHERE id = $1 FOR UPDATE', [Number(req.params.id)]);
    if (!request) return { status: 404, error: 'Permintaan LPG tidak ditemukan' };
    if (request.status === status) return { status: 200 };
    const [stock] = await tx.unsafe('SELECT jumlah FROM persediaan_lpg WHERE id = 1 FOR UPDATE');
    const difference = (status === 'DISETUJUI' ? request.jumlah_diminta : 0) - (request.status === 'DISETUJUI' ? request.jumlah_diminta : 0);
    if (difference > stock.jumlah) return { status: 409, error: 'Persediaan LPG tidak mencukupi.' };
    await tx.unsafe('UPDATE persediaan_lpg SET jumlah = jumlah - $1, updated_at = now() WHERE id = 1', [difference]);
    await tx.unsafe("UPDATE permintaan_lpg SET status = $1, disetujui_oleh = 'manager', waktu_disetujui = now() WHERE id = $2", [status, request.id]);
    return { status: 200 };
  });
  return res.status(result.status).json(result.error ? { error: result.error } : { ok: true });
});

app.post('/api/manager/stock', async (req, res) => {
  const jumlah = Number(req.body?.jumlah);
  if (!Number.isInteger(jumlah) || jumlah < 0) return res.status(400).json({ error: 'Jumlah persediaan tidak valid.' });
  try {
    await run(`UPDATE persediaan_lpg SET jumlah = ?, updated_at = datetime('now') WHERE id = 1`, [jumlah]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Gagal memperbarui persediaan.' }); }
});

app.post('/api/manager/kpi', async (req, res) => {
  const tanggal = req.body?.tanggal || formatDate();
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  try {
    if (entries.some(e => e.nilai !== '' && e.nilai != null && (!Number.isInteger(Number(e.nilai)) || Number(e.nilai) < 0 || Number(e.nilai) > 100))) return res.status(400).json({ error: 'Nilai KPI harus antara 0 dan 100.' });
    await database.begin(async (tx) => {
      await tx.unsafe('DELETE FROM kpi_sopir WHERE tanggal = $1', [tanggal]);
      for (const entry of entries) {
        if (entry.nilai === '' || entry.nilai == null) continue;
        await tx.unsafe("INSERT INTO kpi_sopir (tanggal, sopir_id, nilai, catatan, input_by) VALUES ($1, $2, $3, $4, 'manager')", [tanggal, Number(entry.sopirId), Number(entry.nilai), entry.catatan || '']);
      }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan KPI.' });
  }
});

app.get('/api/manager/kpi/recommendations', async (req, res) => {
  const date = req.query.date || formatDate();
  try {
    const semuaSopir = await queryAll('SELECT id, username, nama, lisensi_expiry, k3_expiry, sertifikat_k3, nomor_hp FROM sopir ORDER BY nama');
    const [inspeksiRows, pengirimanRows, ruteRows, bahayaRows] = await Promise.all([
      queryAll('SELECT * FROM inspeksi_pagi WHERE tanggal = ?', [date]),
      queryAll('SELECT * FROM pengiriman WHERE tanggal = ?', [date]),
      queryAll('SELECT * FROM rute_harian WHERE tanggal = ?', [date]),
      queryAll('SELECT * FROM laporan_bahaya WHERE tanggal = ?', [date])
    ]);

    const results = semuaSopir.map((s) => {
      const ins = inspeksiRows.find((i) => i.sopir_id === s.id);
      const deliveryList = pengirimanRows.filter((p) => p.sopir_id === s.id);
      const routeList = ruteRows.filter((r) => r.sopir_id === s.id);
      const hazardList = bahayaRows.filter((b) => b.sopir_id === s.id);

      // 1. Skor Keselamatan Kendaraan (Bobot 30%)
      let scoreInspeksi = 0;
      let ketInspeksi = 'Belum inspeksi';
      if (ins) {
        const counts = countLolos(ins);
        const pct = counts.total > 0 ? (counts.lolos / counts.total) * 100 : 0;
        if (ins.status_validasi === 'AMAN') {
          scoreInspeksi = 100;
          ketInspeksi = `Lolos inspeksi (${counts.lolos}/${counts.total} item)`;
        } else if (ins.status_validasi === 'TIDAK_AMAN') {
          scoreInspeksi = Math.max(30, Math.round(pct * 0.5));
          ketInspeksi = `Tidak aman (${counts.tidakBaik} catatan)`;
        } else {
          scoreInspeksi = Math.round(pct * 0.85);
          ketInspeksi = `Menunggu validasi (${counts.lolos}/${counts.total} item)`;
        }
      }

      // 2. Skor Pengiriman & Target Tabung (Bobot 40%)
      const targetPangkalan = routeList.length || 5;
      const completedCount = deliveryList.length;
      const totalTabungKirim = deliveryList.reduce((sum, p) => sum + safeNumber(p.jumlah_dikirim_kg), 0);
      let scorePengiriman = Math.min(100, Math.round((completedCount / targetPangkalan) * 100));
      let ketPengiriman = `${completedCount}/${targetPangkalan} pangkalan (${totalTabungKirim} tabung)`;

      // 3. Skor Kepatuhan & Zero Incident K3 (Bobot 30%)
      let scoreKepatuhan = 100;
      let ketKepatuhan = 'Nihil insiden & rute aman';
      if (hazardList.length > 0) {
        scoreKepatuhan = Math.max(50, 100 - (hazardList.length * 25));
        ketKepatuhan = `${hazardList.length} laporan bahaya`;
      }

      // Skor Gabungan (0-100)
      const rekomendasiNilai = Math.round((scoreInspeksi * 0.3) + (scorePengiriman * 0.4) + (scoreKepatuhan * 0.3));
      const catatanOtomatis = `Evaluasi ${date}: Inspeksi ${scoreInspeksi}% (${ketInspeksi}), Pengiriman ${scorePengiriman}% (${ketPengiriman}), Safety ${scoreKepatuhan}% (${ketKepatuhan}).`;

      return {
        sopirId: s.id,
        nama: s.nama,
        scoreInspeksi,
        scorePengiriman,
        scoreKepatuhan,
        ketInspeksi,
        ketPengiriman,
        ketKepatuhan,
        rekomendasiNilai,
        catatanOtomatis
      };
    });

    res.json({ date, recommendations: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghitung rekomendasi KPI.' });
  }
});

app.get('/api/manager/export.xlsx', async (req, res) => {
  const tanggal = req.query.date || formatDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return res.status(400).send('Tanggal laporan tidak valid');

  try {
    const [inspeksi, pengiriman, permintaanLpg, laporanBahaya, kpi, rute, posisi, stok, sopir] = await Promise.all([
      queryAll(`SELECT i.*, s.nama AS sopir_nama, k.plat_nomor FROM inspeksi_pagi i JOIN sopir s ON s.id=i.sopir_id JOIN kendaraan k ON k.id=i.kendaraan_id WHERE i.tanggal=? ORDER BY i.created_at`, [tanggal]),
      queryAll(`SELECT p.*, s.nama AS sopir_nama, k.plat_nomor FROM pengiriman p JOIN sopir s ON s.id=p.sopir_id LEFT JOIN kendaraan k ON k.id=p.kendaraan_id WHERE p.tanggal=? ORDER BY p.created_at`, [tanggal]),
      queryAll(`SELECT r.*, s.nama AS sopir_nama, k.plat_nomor FROM permintaan_lpg r JOIN sopir s ON s.id=r.sopir_id LEFT JOIN kendaraan k ON k.id=r.kendaraan_id WHERE r.tanggal=? ORDER BY r.created_at`, [tanggal]),
      queryAll(`SELECT b.*, s.nama AS sopir_nama FROM laporan_bahaya b JOIN sopir s ON s.id=b.sopir_id WHERE b.tanggal=? ORDER BY b.created_at`, [tanggal]),
      queryAll(`SELECT k.*, s.nama AS sopir_nama FROM kpi_sopir k JOIN sopir s ON s.id=k.sopir_id WHERE k.tanggal=? ORDER BY k.sopir_id`, [tanggal]),
      queryAll(`SELECT r.*, s.nama AS sopir_nama, k.plat_nomor FROM rute_harian r JOIN sopir s ON s.id=r.sopir_id LEFT JOIN kendaraan k ON k.id=r.kendaraan_id WHERE r.tanggal=? ORDER BY r.sopir_id,r.urutan`, [tanggal]),
      queryAll(`SELECT l.*,s.nama AS sopir_nama,k.plat_nomor FROM lokasi_sopir l JOIN sopir s ON s.id=l.sopir_id LEFT JOIN kendaraan k ON k.id=CASE l.sopir_id WHEN 1 THEN 1 WHEN 2 THEN 2 END ORDER BY s.nama`),
      queryAll(`SELECT jumlah,updated_at FROM persediaan_lpg WHERE id=1`),
      queryAll(`SELECT id,nama,username,nomor_hp,lisensi_expiry,k3_expiry FROM sopir ORDER BY nama`)
    ]);

    const lolos = inspeksi.filter((i) => i.status_validasi === 'AMAN').length;
    const gagal = inspeksi.filter((i) => i.status_validasi === 'TIDAK_AMAN').length;
    const menunggu = inspeksi.length - lolos - gagal;
    const totalTabung = pengiriman.reduce((sum, p) => sum + safeNumber(p.jumlah_dikirim_kg), 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistem Distribusi LPG';
    workbook.created = new Date();
    workbook.modified = new Date();

    const setupSheet = (name, headers, rows) => {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(headers);
      rows.forEach((row) => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF284B63' } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
      sheet.columns.forEach((column) => { column.width = Math.min(Math.max(column.header ? String(column.header).length + 4 : 16, 14), 42); });
      return sheet;
    };

    setupSheet('Ringkasan', ['Informasi', 'Nilai'], [
      ['Tanggal laporan', tanggal],
      ['Total inspeksi', inspeksi.length],
      ['Inspeksi disetujui manager', lolos],
      ['Inspeksi ditolak manager', gagal],
      ['Menunggu review manager', menunggu],
      ['Total pengiriman', pengiriman.length],
      ['Total tabung terkirim', totalTabung],
      ['Laporan bahaya', laporanBahaya.length],
      ['Persediaan LPG saat ini (tabung)', stok[0]?.jumlah ?? 0],
      ['Dibuat pada', formatWaktuLengkap(new Date().toISOString())]
    ]);

    setupSheet('Inspeksi Pagi', ['ID', 'Sopir', 'Kendaraan', 'Tanggal', 'Status Manager', 'Baik', 'Tidak Baik', 'Belum Dicentang', 'Waktu Submit WIB', 'Catatan'], inspeksi.map((item) => {
      const counts = countLolos(item);
      return [item.id, item.sopir_nama, item.plat_nomor, item.tanggal, item.status_validasi, counts.lolos, counts.tidakBaik, counts.belumDicentang, formatWaktu(item.created_at), item.catatan || ''];
    }));

    const checklistRows = [];
    inspeksi.forEach((item) => {
      const checklist = parseChecklist(item) || [];
      const lampiran = parseLampiran(item) || [];
      checklist.forEach((entry) => {
        const sectionFiles = lampiran.find((file) => file.section === entry.section) || {};
        checklistRows.push([item.id, item.sopir_nama, item.plat_nomor, entry.section, entry.sectionNama, entry.item, entry.status, entry.keterangan || '', sectionFiles.foto || '', sectionFiles.video || '']);
      });
    });
    setupSheet('Rincian Checklist', ['ID Inspeksi', 'Sopir', 'Kendaraan', 'No Bagian', 'Bagian', 'Item Pemeriksaan', 'Status Sopir', 'Keterangan Sopir', 'File Foto', 'File Video'], checklistRows);

    setupSheet('Pengiriman', ['ID', 'Sopir', 'Kendaraan', 'Pangkalan', 'Jumlah (tabung)', 'Penerima', 'No. HP Penerima', 'Kondisi', 'Waktu Tiba', 'Waktu Selesai', 'Catatan'], pengiriman.map((item) => [item.id, item.sopir_nama, item.plat_nomor || '', item.pangkalan_nama || '', item.jumlah_dikirim_kg || 0, item.penerima_nama || '', item.penerima_hp || '', item.kondisi_pengiriman || '', item.waktu_tiba || '', item.waktu_selesai || '', item.catatan || '']));
    setupSheet('Permintaan LPG', ['ID', 'Sopir', 'Kendaraan', 'Jumlah (tabung)', 'Status', 'Catatan', 'Diajukan WIB', 'Disetujui Oleh', 'Waktu Persetujuan'], permintaanLpg.map((item) => [item.id, item.sopir_nama, item.plat_nomor || '', item.jumlah_diminta, item.status, item.catatan || '', formatWaktu(item.created_at), item.disetujui_oleh || '', formatWaktu(item.waktu_disetujui)]));
    setupSheet('Laporan Bahaya', ['ID', 'Sopir', 'Tanggal', 'Jenis Bahaya', 'Deskripsi', 'Latitude', 'Longitude', 'Status', 'Tanggapan Admin', 'Waktu Lapor WIB'], laporanBahaya.map((item) => [item.id, item.sopir_nama, item.tanggal, item.jenis_bahaya || '', item.deskripsi || '', item.latitude, item.longitude, item.status || '', item.admin_response || '', formatWaktu(item.created_at)]));
    setupSheet('KPI Sopir', ['Tanggal', 'Sopir', 'Nilai (%)', 'Catatan', 'Input Oleh', 'Waktu Input WIB'], kpi.map((item) => [item.tanggal, item.sopir_nama, item.nilai, item.catatan || '', item.input_by || '', formatWaktu(item.created_at)]));
    setupSheet('Rute Harian', ['Tanggal', 'Sopir', 'Kendaraan', 'Urutan', 'Pangkalan', 'Latitude', 'Longitude', 'Permintaan Ton', 'Estimasi Tiba'], rute.map((item) => [item.tanggal, item.sopir_nama, item.plat_nomor || '', item.urutan, item.pangkalan_nama, item.latitude, item.longitude, item.permintaan_ton, item.estimasi_waktu_tiba]));
    setupSheet('Posisi GPS', ['Sopir', 'Kendaraan', 'Latitude', 'Longitude', 'Akurasi (m)', 'Terakhir Diperbarui WIB', 'Status'], posisi.map((item) => [item.sopir_nama, item.plat_nomor || '', item.latitude, item.longitude, item.accuracy || '', formatWaktu(item.updated_at), Date.now() - new Date(item.updated_at).getTime() <= 35000 ? 'Aktif' : 'Tidak aktif']));
    setupSheet('Data Sopir', ['ID', 'Nama', 'Username', 'Nomor HP', 'Lisensi Berlaku Sampai', 'K3 Berlaku Sampai'], sopir.map((item) => [item.id, item.nama, item.username, item.nomor_hp || '', item.lisensi_expiry || '', item.k3_expiry || '']));

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-dashboard-${tanggal}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Gagal membuat Excel dashboard:', error);
    res.status(500).send('Gagal membuat file Excel dashboard');
  }
});


}
