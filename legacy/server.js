// =====================================================================
// server.js - Backend API (JSON) + penyaji SPA React untuk aplikasi LPG
// ---------------------------------------------------------------------
// Menggantikan tampilan server-rendered lama (app.js). Semua data
// disajikan sebagai JSON di bawah /api, dan hasil build React
// (client/dist) disajikan sebagai aplikasi front-end.
// =====================================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const ExcelJS = require('exceljs');
const { formatDate, formatWaktu, formatWaktuLengkap } = require('./lib/format');
const { CHECKLIST_SECTIONS, CHECKLIST_TOTAL_ITEMS, parseChecklist, parseLampiran, countLolos } = require('./lib/checklist');

let routeOptimizer = null;
try { routeOptimizer = require('./routeOptimizer'); } catch (e) { console.warn('routeOptimizer.js tidak ditemukan, optimasi rute di-skip.'); }

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MAX_LPG_TABUNG = 543;
const activeDrivers = new Map();
const CLIENT_DIST = path.join(__dirname, 'client', 'dist');
const { saveUploadedFile, isSupabaseStorage, BUCKET_NAME } = require('./lib/storage');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sajikan file /uploads: cek disk lokal dulu, jika tidak ada dan pakai Supabase, redirect ke Supabase Storage
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const localFile = path.join(__dirname, 'uploads', filename);
  if (fs.existsSync(localFile)) {
    return res.sendFile(localFile);
  }
  if (process.env.SUPABASE_URL) {
    const bucket = BUCKET_NAME || 'lpg-uploads';
    return res.redirect(`${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`);
  }
  res.status(404).send('File tidak ditemukan');
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({ storage: multer.memoryStorage() });

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}
function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { return err ? reject(err) : resolve(this); });
  });
}

// ---------------------------------------------------------------------
// Auth & meta
// ---------------------------------------------------------------------
app.post('/api/login', async (req, res) => {
  const { role, username, password } = req.body || {};
  try {
    if (role === 'manager') {
      const expectedUser = process.env.MANAGER_USERNAME || 'manager';
      const expectedPass = process.env.MANAGER_PASSWORD || '12345';
      if (username === expectedUser && password === expectedPass) {
        return res.json({ user: { role: 'manager', id: null, nama: 'Manager Operasional' } });
      }
      return res.status(401).json({ error: 'Username atau password tidak sesuai.' });
    }
    const sopir = await queryOne('SELECT * FROM sopir WHERE username = ? AND password = ?', [username, password]);
    if (!sopir) return res.status(401).json({ error: 'Username atau password tidak sesuai.' });
    activeDrivers.set(sopir.id, Date.now());
    res.json({ user: { role: 'driver', id: sopir.id, nama: sopir.nama } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

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
      SELECT l.*, s.nama, s.nomor_hp FROM lokasi_sopir l JOIN sopir s ON s.id = l.sopir_id ORDER BY s.nama
    `);
    const routes = await queryAll(`
      SELECT sopir_id, urutan, latitude, longitude, pangkalan_nama FROM rute_harian WHERE tanggal = ? ORDER BY sopir_id, urutan
    `, [formatDate()]);
    const now = Date.now();
    const routeMap = new Map();
    routes.forEach((r) => { if (!routeMap.has(r.sopir_id)) routeMap.set(r.sopir_id, []); routeMap.get(r.sopir_id).push(r); });
    res.json(rows
      .filter((row) => {
        if (activeDrivers.has(row.sopir_id) && now - (activeDrivers.get(row.sopir_id) || 0) <= 30000) return true;
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
    activeDrivers.set(Number(sopir_id), Date.now());
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
    const sopir = await queryOne('SELECT * FROM sopir WHERE id = ?', [id]);
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
    const sopir = await queryOne('SELECT * FROM sopir WHERE id = ?', [Number(req.params.id)]);
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
  const { sopir_id, kendaraan_id, jumlah_diminta, catatan } = req.body || {};
  const jumlah = Number(jumlah_diminta);
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > MAX_LPG_TABUNG) {
    return res.status(400).json({ error: `Jumlah LPG harus bilangan bulat antara 1 dan ${MAX_LPG_TABUNG} tabung.` });
  }
  try {
    await run(`
      INSERT INTO permintaan_lpg (tanggal, sopir_id, kendaraan_id, jumlah_diminta, catatan, status)
      VALUES (?, ?, ?, ?, ?, 'MENUNGGU')
      ON CONFLICT(sopir_id, tanggal) DO UPDATE SET
        kendaraan_id = excluded.kendaraan_id,
        jumlah_diminta = excluded.jumlah_diminta,
        catatan = excluded.catatan,
        status = 'MENUNGGU',
        disetujui_oleh = NULL,
        waktu_disetujui = NULL,
        created_at = CURRENT_TIMESTAMP
    `, [formatDate(), sopir_id, kendaraan_id, jumlah, catatan || '']);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan permintaan LPG.' });
  }
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
      body.sopir_id, 1, body.pangkalan_nama || '-', '-8.17', '113.70',
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
    `, [sopir_id, 1, Number(latitude || -8.17), Number(longitude || 113.70), jenis_bahaya, deskripsi, fotoBukti]);
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
      queryAll('SELECT * FROM sopir ORDER BY nama')
    ]);

    const inspeksi = inspeksiRows.map((i) => { const c = countLolos(i); return { ...i, lolos: c.lolos, total: c.total, tidakBaik: c.tidakBaik, belumDicentang: c.belumDicentang }; });
    const inspeksiLolos = inspeksi.filter((i) => i.status_validasi === 'AMAN').length;
    const inspeksiGagal = inspeksi.filter((i) => i.status_validasi === 'TIDAK_AMAN').length;
    const inspeksiMenunggu = Math.max(0, inspeksi.length - inspeksiLolos - inspeksiGagal);
    const totalTabung = pengiriman.reduce((sum, p) => sum + safeNumber(p.jumlah_dikirim_kg), 0);
    const maxPengirimanSopir = Math.max(1, ...semuaSopir.map((d) => pengiriman.filter((p) => p.sopir_id === d.id).length));
    const now = Date.now();
    const currentPositions = positions.filter((p) => {
      if (activeDrivers.has(p.sopir_id) && now - (activeDrivers.get(p.sopir_id) || 0) <= 30000) return true;
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
  const { status } = req.body || {};
  try {
    const permintaan = await queryOne('SELECT * FROM permintaan_lpg WHERE id = ?', [Number(req.params.id)]);
    if (!permintaan) return res.status(404).json({ error: 'Permintaan LPG tidak ditemukan' });
    await run(`UPDATE permintaan_lpg SET status = ?, disetujui_oleh = 'manager', waktu_disetujui = datetime('now') WHERE id = ?`, [status, permintaan.id]);
    if (status === 'DISETUJUI') {
      await run(`UPDATE persediaan_lpg SET jumlah = MAX(0, jumlah - ?), updated_at = datetime('now') WHERE id = 1`, [permintaan.jumlah_diminta]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui permintaan LPG.' });
  }
});

app.post('/api/manager/stock', async (req, res) => {
  const jumlah = Number(req.body?.jumlah);
  if (!Number.isFinite(jumlah) || jumlah < 0) return res.status(400).json({ error: 'Jumlah persediaan tidak valid.' });
  try {
    await run(`UPDATE persediaan_lpg SET jumlah = ?, updated_at = datetime('now') WHERE id = 1`, [jumlah]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Gagal memperbarui persediaan.' }); }
});

app.post('/api/manager/kpi', async (req, res) => {
  const tanggal = req.body?.tanggal || formatDate();
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  try {
    await run('DELETE FROM kpi_sopir WHERE tanggal = ?', [tanggal]);
    for (const entry of entries) {
      if (entry.nilai === '' || entry.nilai === undefined || entry.nilai === null) continue;
      await run('INSERT INTO kpi_sopir (tanggal, sopir_id, nilai, catatan, input_by) VALUES (?, ?, ?, ?, ?)', [tanggal, entry.sopirId, Number(entry.nilai), entry.catatan || '', 'manager']);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan KPI.' });
  }
});

app.get('/api/manager/kpi/recommendations', async (req, res) => {
  const date = req.query.date || formatDate();
  try {
    const semuaSopir = await queryAll('SELECT * FROM sopir ORDER BY nama');
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
    setupSheet('Posisi GPS', ['Sopir', 'Kendaraan', 'Latitude', 'Longitude', 'Akurasi (m)', 'Terakhir Diperbarui WIB', 'Status'], posisi.map((item) => [item.sopir_nama, item.plat_nomor || '', item.latitude, item.longitude, item.accuracy || '', formatWaktu(item.updated_at), activeDrivers.has(item.sopir_id) ? 'Aktif' : 'Tidak aktif']));
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

// ---------------------------------------------------------------------
// SPA: sajikan hasil build React, fallback ke index.html
// ---------------------------------------------------------------------
app.use(express.static(CLIENT_DIST));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  const indexFile = path.join(CLIENT_DIST, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res.status(503).send('Frontend belum di-build. Jalankan: npm run build:client');
  }
  res.sendFile(indexFile);
});

// ---------------------------------------------------------------------
// Alokasi & optimasi rute harian (dijalankan saat start)
// ---------------------------------------------------------------------
if (routeOptimizer) {
  setTimeout(() => {
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

    async function generateRuteForDate(tanggal, done) {
      try {
        const existingRows = await queryAll(`SELECT sopir_id, urutan, pangkalan_id FROM rute_harian WHERE tanggal = ? ORDER BY sopir_id, urutan`, [tanggal]);
        const routeA = pangkalan.filter((p) => p.zona === 'A');
        const routeB = pangkalan.filter((p) => p.zona === 'B');
        const optimizedA = routeOptimizer.optimizeRoute ? routeOptimizer.optimizeRoute(routeA, true) : { pangkalanOrdered: routeA };
        const optimizedB = routeOptimizer.optimizeRoute ? routeOptimizer.optimizeRoute(routeB, true) : { pangkalanOrdered: routeB };
        const newRows = [
          ...optimizedA.pangkalanOrdered.map((p, idx) => ({ sopir: 1, p, urutan: idx + 1 })),
          ...optimizedB.pangkalanOrdered.map((p, idx) => ({ sopir: 2, p, urutan: idx + 1 }))
        ];
        const storedSignature = existingRows.map((r) => `${r.sopir_id}:${r.urutan}:${r.pangkalan_id}`).join('|');
        const expectedSignature = newRows.map((r) => `${r.sopir}:${r.urutan}:${r.p.id}`).join('|');
        const needsRefresh = existingRows.length === 0 || (tanggal === formatDate() && storedSignature !== expectedSignature);
        if (!needsRefresh) { if (done) done(); return; }

        await run(`DELETE FROM rute_harian WHERE tanggal = ?`, [tanggal]);
        for (const { sopir, p, urutan } of newRows) {
          await run(`
            INSERT INTO rute_harian (tanggal, sopir_id, kendaraan_id, urutan, pangkalan_id, pangkalan_nama, latitude, longitude, permintaan_ton, estimasi_waktu_tiba)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [tanggal, sopir, sopir, urutan, p.id, p.nama, p.lat, p.lng, p.permintaan_ton, '06:30']);
        }
        if (done) done();
      } catch (e) {
        console.error('Error generating rute for date:', tanggal, e);
        if (done) done(e);
      }
    }

    const today = formatDate();
    const MAX_BACKFILL_DAYS = 14;
    function addDays(dateStr, days) {
      const d = new Date(dateStr + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().split('T')[0];
    }
    queryAll(`SELECT DISTINCT tanggal FROM rute_harian ORDER BY tanggal`, []).then((rows) => {
      const existing = new Set((rows || []).map((r) => (r.tanggal instanceof Date ? r.tanggal.toISOString().split('T')[0] : String(r.tanggal))));
      const oldestAllowed = addDays(today, -(MAX_BACKFILL_DAYS - 1));
      const firstExisting = existing.size === 0 ? today : [...existing].sort()[0];
      const startDate = firstExisting > oldestAllowed ? firstExisting : oldestAllowed;
      const dates = [];
      let cursor = startDate;
      let guard = 0;
      while (cursor <= today && guard < MAX_BACKFILL_DAYS) {
        if (!existing.has(cursor) || cursor === today) dates.push(cursor);
        cursor = addDays(cursor, 1);
        guard++;
      }
      dates.forEach((tanggal) => generateRuteForDate(tanggal));
    }).catch((err) => console.error('Error reading existing rute dates:', err));
  }, 2000);
}

if (!process.env.VERCEL) {
  db.ready.then(() => {
    app.listen(PORT, () => {
      console.log(`Server berjalan di http://localhost:${PORT}`);
      console.log(`Login Sopir: http://localhost:${PORT}/login`);
      console.log(`Login Manager: http://localhost:${PORT}/admin/login`);
    });
  }).catch((err) => {
    console.error('Database gagal siap:', err);
    process.exit(1);
  });
}

module.exports = app;
