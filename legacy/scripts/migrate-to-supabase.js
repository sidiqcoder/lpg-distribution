// =====================================================================
// scripts/migrate-to-supabase.js
// Memindahkan data yang sudah ada di lpg_database.db (SQLite) ke Supabase (PostgreSQL)
// ---------------------------------------------------------------------
// Cara pakai:
// node scripts/migrate-to-supabase.js
// (Pastikan DATABASE_URL sudah terisi di .env atau environment variable)
// =====================================================================

require('dotenv').config();
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL tidak ditemukan. Pastikan sudah mengisi DATABASE_URL di file .env');
  process.exit(1);
}

const sqliteDb = new sqlite3.Database(path.join(__dirname, '..', 'lpg_database.db'));
const pgPool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function runMigration() {
  console.log('[Migrasi] Menghubungkan ke Supabase PostgreSQL...');
  const client = await pgPool.connect();

  try {
    const tables = [
      'sopir',
      'kendaraan',
      'persediaan_lpg',
      'inspeksi_pagi',
      'permintaan_lpg',
      'pengiriman',
      'rute_harian',
      'lokasi_sopir',
      'laporan_bahaya',
      'kpi_sopir'
    ];

    for (const table of tables) {
      const rows = await sqliteAll(`SELECT * FROM ${table}`);
      if (rows.length === 0) {
        console.log(`[Migrasi] Tabel ${table}: 0 baris (dilewati)`);
        continue;
      }

      console.log(`[Migrasi] Memindahkan ${rows.length} baris dari tabel ${table}...`);
      for (const row of rows) {
        const keys = Object.keys(row);
        const values = Object.values(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const columns = keys.join(', ');

        const sql = `
          INSERT INTO ${table} (${columns})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `;
        await client.query(sql, values);
      }
      console.log(`[Migrasi] Tabel ${table} selesai.`);
    }

    // Reset sequence id untuk tabel identity
    const identityTables = ['inspeksi_pagi', 'pengiriman', 'rute_harian', 'laporan_bahaya', 'kpi_sopir', 'permintaan_lpg'];
    for (const t of identityTables) {
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('${t}', 'id'),
          COALESCE((SELECT MAX(id) FROM ${t}), 1)
        )
      `).catch(() => {});
    }

    console.log('[Migrasi] Semua data berhasil dipindahkan ke Supabase!');
  } catch (err) {
    console.error('[Migrasi] Gagal memindahkan data:', err);
  } finally {
    client.release();
    await pgPool.end();
    sqliteDb.close();
  }
}

runMigration();
