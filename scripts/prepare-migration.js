const fs = require('node:fs');
const path = require('node:path');
const sqlite = require('sqlite3');
const root = path.resolve(__dirname, '..');
const tables = ['sopir', 'kendaraan', 'persediaan_lpg', 'inspeksi_pagi', 'permintaan_lpg', 'pengiriman', 'rute_harian', 'route_history', 'lokasi_sopir', 'laporan_bahaya', 'kpi_sopir'];
const quoted = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + String(value).replace(/'/g, "''") + "'";
const booleanColumns = new Set(['ban_kondisi', 'rem_berfungsi', 'lampu_hidup', 'tangki_integritas', 'tidak_ada_kebocoran', 'pemadam_ada', 'p3k_ada', 'kit_tumpah_ada', 'sopir_fit', 'dokumen_lengkap']);

async function main() {
  let schema = fs.readFileSync(path.join(root, 'legacy/supabase-schema.sql'), 'utf8').split('-- DATA AWAL')[0];
  schema = schema.replace('  password TEXT NOT NULL,\n', '').replace('  password TEXT NOT NULL,\r\n', '');
  schema = 'CREATE SCHEMA IF NOT EXISTS extensions;\nCREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;\n' + schema;
  schema += `
CREATE SCHEMA IF NOT EXISTS lpg_private;
REVOKE ALL ON SCHEMA lpg_private FROM PUBLIC, anon, authenticated;
CREATE TABLE lpg_private.accounts (
  username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('manager', 'driver')),
  sopir_id INTEGER REFERENCES public.sopir(id), nama TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ,
  CHECK ((role = 'driver' AND sopir_id IS NOT NULL) OR (role = 'manager' AND sopir_id IS NULL))
);
CREATE TABLE lpg_private.sessions (
  token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES lpg_private.accounts(username) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry ON lpg_private.sessions(expires_at);
CREATE INDEX sessions_account ON lpg_private.sessions(username);
ALTER TABLE lpg_private.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lpg_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persediaan_lpg ADD CONSTRAINT stock_nonnegative CHECK (jumlah >= 0);
ALTER TABLE public.permintaan_lpg ADD CONSTRAINT quota_valid CHECK (jumlah_diminta BETWEEN 1 AND 543);
ALTER TABLE public.kpi_sopir ADD CONSTRAINT kpi_valid CHECK (nilai BETWEEN 0 AND 100);
`;
  for (const table of tables) {
    schema += `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;\nREVOKE ALL ON public.${table} FROM anon, authenticated;\n`;
    if (!['sopir', 'kendaraan', 'persediaan_lpg', 'lokasi_sopir'].includes(table)) schema += `CREATE INDEX ${table}_tanggal ON public.${table}(tanggal);\nCREATE INDEX ${table}_driver ON public.${table}(sopir_id);\n`;
    if (['inspeksi_pagi', 'permintaan_lpg', 'pengiriman', 'laporan_bahaya', 'kpi_sopir', 'route_history'].includes(table)) schema += `CREATE INDEX ${table}_kendaraan ON public.${table}(kendaraan_id);\n`.replace(/CREATE INDEX kpi_sopir_kendaraan.*\n/, '');
  }
  schema += `INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('lpg-uploads', 'lpg-uploads', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = excluded.file_size_limit;\n`;
  const migration = fs.readdirSync(path.join(root, 'supabase/migrations')).find(name => name.endsWith('_rebuild_lpg_backend.sql'));
  // Schema history is immutable after deployment. Only create the initial file if empty.
  const migrationPath = path.join(root, 'supabase/migrations', migration);
  if (!fs.readFileSync(migrationPath, 'utf8').trim()) fs.writeFileSync(migrationPath, schema);

  const db = new sqlite.Database(path.join(root, 'lpg_database.db'), sqlite.OPEN_READONLY);
  const all = sql => new Promise((resolve, reject) => db.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
  let dataSql = 'BEGIN;\n';
  const counts = {};
  for (const table of tables) {
    const rows = await all(`SELECT * FROM ${table}`);
    counts[table] = rows.length;
    for (const row of rows) {
      if (table === 'pengiriman') {
        const invalid = {};
        for (const key of ['waktu_tiba', 'waktu_selesai']) {
          if (row[key] != null && !/^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?$/.test(row[key])) {
            invalid[key] = row[key];
            row[key] = null;
          }
        }
        if (Object.keys(invalid).length) row.legacy_waktu_json = JSON.stringify(invalid);
      }
      const entries = Object.entries(row).filter(([key]) => key !== 'password');
      dataSql += `INSERT INTO public.${table} (${entries.map(([key]) => '"' + key + '"').join(',')}) VALUES (${entries.map(([key, value]) => booleanColumns.has(key) && value != null ? (value ? 'true' : 'false') : quoted(value)).join(',')}) ON CONFLICT DO NOTHING;\n`;
      if (table === 'sopir') dataSql += `INSERT INTO lpg_private.accounts (username, password_hash, role, sopir_id, nama) VALUES (${quoted(row.username)}, extensions.crypt(${quoted(row.password)}, extensions.gen_salt('bf', 10)), 'driver', ${row.id}, ${quoted(row.nama)}) ON CONFLICT DO NOTHING;\n`;
    }
    if (!['sopir', 'kendaraan', 'persediaan_lpg', 'lokasi_sopir'].includes(table)) dataSql += `SELECT setval(pg_get_serial_sequence('public.${table}', 'id'), COALESCE((SELECT max(id) FROM public.${table}), 1), EXISTS(SELECT 1 FROM public.${table}));\n`;
  }
  dataSql += `INSERT INTO lpg_private.accounts (username, password_hash, role, nama) VALUES (${quoted(process.env.MANAGER_USERNAME || 'manager')}, extensions.crypt(${quoted(process.env.MANAGER_PASSWORD || '12345')}, extensions.gen_salt('bf', 10)), 'manager', 'Manager Operasional') ON CONFLICT DO NOTHING;\nCOMMIT;\n`;
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  fs.writeFileSync(path.join(root, '.local/import-data.sql'), dataSql);
  fs.writeFileSync(path.join(root, '.local/migration-counts.json'), JSON.stringify(counts, null, 2));
  db.close();
  console.log(JSON.stringify({ migration, counts, uploads: fs.readdirSync(path.join(root, 'uploads')).length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
