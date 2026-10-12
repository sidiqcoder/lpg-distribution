import { formatDate } from './format.js';

const error = (status, message) => Object.assign(new Error(message), { status });
const digest = async token => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(v => v.toString(16).padStart(2, '0')).join('');

export async function login(database, body) {
  const { role, username, password } = body || {};
  if (!['manager', 'driver'].includes(role) || typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 200) throw error(401, 'Username atau password tidak sesuai.');
  const account = await database.begin(async tx => {
    const [account] = await tx.unsafe(`SELECT *, password_hash = extensions.crypt($3, password_hash) AS valid
      FROM lpg_private.accounts WHERE username = $1 AND role = $2 FOR UPDATE`, [username, role, password]);
    if (!account) return null;
    if (account.locked_until && new Date(account.locked_until) > new Date()) throw error(429, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
    if (!account.valid) {
      await tx.unsafe(`UPDATE lpg_private.accounts SET failed_attempts = CASE WHEN locked_until < now() THEN 1 ELSE failed_attempts + 1 END,
        locked_until = CASE WHEN failed_attempts >= 9 THEN now() + interval '15 minutes' ELSE NULL END WHERE username = $1`, [username]);
      return null;
    }
    await tx.unsafe('UPDATE lpg_private.accounts SET failed_attempts = 0, locked_until = NULL WHERE username = $1', [username]);
    return account;
  });
  if (!account) throw error(401, 'Username atau password tidak sesuai.');
  const token = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await digest(token);
  await database.begin(async tx => {
    await tx.unsafe(`INSERT INTO lpg_private.sessions (token_hash, username, expires_at) VALUES ($1, $2, now() + interval '7 days')`, [tokenHash, account.username]);
    if (account.role === 'driver') await tx.unsafe('INSERT INTO driver_login_reports (sopir_id) VALUES ($1)', [account.sopir_id]);
  });
  await database.unsafe('DELETE FROM lpg_private.sessions WHERE expires_at < now()');
  return { user: { role: account.role, id: account.sopir_id, nama: account.nama }, token };
}

export async function authenticate(database, request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token || token.length > 200) throw Object.assign(error(401, 'Sesi berakhir. Silakan masuk kembali.'), { code: 'SESSION_EXPIRED' });
  const tokenHash = await digest(token);
  const [user] = await database.unsafe(`SELECT a.username, a.role, a.sopir_id AS id, a.nama, s.token_hash FROM lpg_private.sessions s
    JOIN lpg_private.accounts a ON a.username = s.username WHERE s.token_hash = $1 AND s.expires_at > now()`, [tokenHash]);
  if (!user) throw Object.assign(error(401, 'Sesi berakhir. Silakan masuk kembali.'), { code: 'SESSION_EXPIRED' });
  return user;
}

export async function authorize(database, req, path, method, user) {
  req.user = user;
  if (path.startsWith('/api/manager/')) {
    if (user.role !== 'manager') throw error(403, 'Akses hanya untuk manager.');
  }
  if (path.startsWith('/api/driver/') || (path === '/api/tracking' && method === 'POST')) {
    if (user.role !== 'driver') throw error(403, 'Akses hanya untuk sopir.');
    const requested = req.params.id ?? req.body.sopir_id;
    if (requested == null || Number(requested) !== user.id) throw error(403, 'Akses data sopir tidak diizinkan.');
    if (req.body.sopir_id != null) req.body.sopir_id = user.id;
    if (req.body.kendaraan_id != null) {
      const rows = await database.unsafe('SELECT id FROM kendaraan WHERE id = $1', [Number(req.body.kendaraan_id)]);
      if (!rows.length) throw error(400, 'Kendaraan tidak ditemukan.');
    }
  }
  if (path === '/api/manager/validate' && !['AMAN', 'TIDAK_AMAN'].includes(req.body.status_validasi)) throw error(400, 'Status validasi tidak valid.');
  if (path === '/api/tracking' && method === 'POST') {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180) throw error(400, 'Data lokasi tidak valid.');
  }
  if (path === '/api/driver/delivery' || path === '/api/driver/hazard') {
    const [inspection] = await database.unsafe('SELECT kendaraan_id, status_validasi FROM inspeksi_pagi WHERE sopir_id = $1 AND tanggal = $2', [user.id, formatDate()]);
    req.assignment = { kendaraan_id: inspection?.kendaraan_id || user.id, latitude: -8.17, longitude: 113.70 };
    if (path.endsWith('/delivery')) {
      const [lpg] = await database.unsafe('SELECT status FROM permintaan_lpg WHERE sopir_id = $1 AND tanggal = $2', [user.id, formatDate()]);
      if (inspection?.status_validasi !== 'AMAN' || lpg?.status !== 'DISETUJUI') throw error(409, 'Inspeksi dan permintaan LPG harus disetujui sebelum pengiriman.');
      if (!Number.isInteger(Number(req.body.jumlah_dikirim_tabung)) || Number(req.body.jumlah_dikirim_tabung) < 1) throw error(400, 'Jumlah tabung pengiriman tidak valid.');
      const [route] = await database.unsafe('SELECT latitude, longitude FROM rute_harian WHERE sopir_id = $1 AND tanggal = $2 AND pangkalan_nama = $3 AND urutan > 0', [user.id, formatDate(), req.body.pangkalan_nama]);
      if (!route) throw error(400, 'Pangkalan tidak ditemukan pada rute hari ini.');
      Object.assign(req.assignment, route);
    }
  }
}
