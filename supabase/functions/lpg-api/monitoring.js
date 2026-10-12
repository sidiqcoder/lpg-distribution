import { formatDate } from './format.js';
const fail = (message) => Object.assign(new Error(message), { status: 400 });

export function registerMonitoring(app, { database, queryAll, queryOne, upload, saveUploadedFile }) {
  app.get('/api/driver/:id/fatigue', async (req, res) => {
    const id = Number(req.params.id);
    const monitoring = await queryOne('SELECT * FROM driver_monitoring WHERE sopir_id = ?', [id]);
    const latest = await queryOne('SELECT * FROM fatigue_reports WHERE sopir_id = ? ORDER BY captured_at DESC LIMIT 1', [id]);
    res.json({ monitoring: monitoring || null, latest: latest || null });
  });

  app.post('/api/driver/:id/monitoring', async (req, res) => {
    const { camera_enabled, next_capture_at, camera_error } = req.body;
    if (typeof camera_enabled !== 'boolean' || (next_capture_at != null && !Number.isFinite(Date.parse(next_capture_at))) || (camera_error != null && typeof camera_error !== 'string')) throw fail('Status kamera tidak valid.');
    await database.unsafe(`INSERT INTO driver_monitoring (sopir_id, camera_enabled, next_capture_at, camera_error)
      VALUES ($1, $2, $3, $4) ON CONFLICT (sopir_id) DO UPDATE SET
      camera_enabled = excluded.camera_enabled, next_capture_at = excluded.next_capture_at,
      camera_error = excluded.camera_error, updated_at = now()`, [req.user.id, camera_enabled, next_capture_at || null, camera_error?.slice(0, 500) || null]);
    res.json({ ok: true });
  });

  app.post('/api/driver/fatigue', upload.single('evidence'), async (req, res) => {
    const { capture_id, captured_at, kind } = req.body;
    const duration = Number(req.body.duration_seconds);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(capture_id || '') ||
      !Number.isFinite(Date.parse(captured_at)) || !/(Z|[+-]\d{2}:\d{2})$/.test(captured_at || '') ||
      !['foto', 'video'].includes(kind) || !Number.isInteger(duration) ||
      (kind === 'foto' ? duration !== 0 : duration < 5 || duration > 10)) throw fail('Data rekaman tidak valid.');
    if (Date.parse(captured_at) > Date.now() + 120000) throw Object.assign(fail('Jam rekaman mendahului server. Sinkronkan waktu dan kirim ulang rekaman.'), { code: 'CAPTURE_TIME_AHEAD' });
    const report = await database.begin(async tx => {
      await tx.unsafe('SELECT pg_advisory_xact_lock($1)', [req.user.id]);
      const [existing] = await tx.unsafe('SELECT id, created_at FROM fatigue_reports WHERE sopir_id = $1 AND capture_id = $2', [req.user.id, capture_id]);
      if (existing) return existing;
      const attachment = req.file?.savedMetadata || req.file;
      const size = req.file?.buffer?.length ?? attachment?.size;
      if (!attachment || !(kind === 'foto' ? /^image\// : /^video\//).test(attachment.mimetype || '') || !Number.isSafeInteger(size) || size < 1 || size > 12 * 1024 * 1024 ||
        (attachment.provider === 'r2' && (attachment.purpose !== 'fatigue' || attachment.captureId !== capture_id))) throw fail('Lampiran kamera harus sesuai mode dan maksimal 12 MB.');
      const filename = await saveUploadedFile(req.file, req.user);
      const [saved] = await tx.unsafe(`INSERT INTO fatigue_reports (sopir_id, capture_id, captured_at, kind, duration_seconds, foto, video)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
        [req.user.id, capture_id, captured_at, kind, duration, kind === 'foto' ? filename : null, kind === 'video' ? filename : null]);
      return saved;
    });
    res.json({ ok: true, ...report });
  });

  app.get('/api/manager/activity', async (req, res) => {
    const date = req.query.date || formatDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail('Tanggal tidak valid.');
    const [logins, reports, monitoring] = await Promise.all([
      queryAll(`SELECT l.id, l.sopir_id, l.created_at, s.nama FROM driver_login_reports l JOIN sopir s ON s.id = l.sopir_id
        WHERE l.created_at >= (?::date::timestamp AT TIME ZONE 'Asia/Makassar')
        AND l.created_at < ((?::date + 1)::timestamp AT TIME ZONE 'Asia/Makassar') ORDER BY l.created_at DESC LIMIT 200`, [date, date]),
      queryAll(`SELECT f.*, s.nama FROM fatigue_reports f JOIN sopir s ON s.id = f.sopir_id
        WHERE (f.captured_at >= (?::date::timestamp AT TIME ZONE 'Asia/Makassar')
        AND f.captured_at < ((?::date + 1)::timestamp AT TIME ZONE 'Asia/Makassar'))
        OR (f.created_at >= (?::date::timestamp AT TIME ZONE 'Asia/Makassar')
        AND f.created_at < ((?::date + 1)::timestamp AT TIME ZONE 'Asia/Makassar')) ORDER BY f.created_at DESC LIMIT 200`, [date, date, date, date]),
      queryAll(`SELECT s.id AS sopir_id, s.nama, m.camera_enabled, m.camera_error, m.next_capture_at, m.updated_at,
        (m.camera_enabled AND m.updated_at > now() - interval '90 seconds') AS active,
        (SELECT max(captured_at) FROM fatigue_reports WHERE sopir_id = s.id) AS last_capture_at
        FROM sopir s LEFT JOIN driver_monitoring m ON m.sopir_id = s.id ORDER BY s.nama`)
    ]);
    res.json({ logins, reports, monitoring });
  });

  app.post('/api/manager/fatigue/:id/review', async (req, res) => {
    const { status, note } = req.body;
    if (!['FIT', 'PERLU_ISTIRAHAT'].includes(status) || typeof note !== 'string' || !note.trim() || note.length > 2000) throw fail('Isi hasil peninjauan dan catatan manager.');
    const rows = await database.unsafe(`UPDATE fatigue_reports SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = now()
      WHERE id = $4 RETURNING id`, [status, note.trim(), req.user.nama, Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    res.json({ ok: true });
  });
}
