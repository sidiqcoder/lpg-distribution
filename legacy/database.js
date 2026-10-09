// =====================================================================
// database.js - Lapisan database dual-mode (Supabase PostgreSQL / SQLite Lokal)
// ---------------------------------------------------------------------
// Jika DATABASE_URL ada: terhubung ke Supabase PostgreSQL
// Jika DATABASE_URL tidak ada: fallback ke SQLite lokal (lpg_database.db)
// =====================================================================

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const isPostgres = Boolean(process.env.DATABASE_URL);

let resolveReady;
let rejectReady;
const ready = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});

let dbInstance = null;

function toPgSql(sql) {
  let idx = 0;
  return sql
    .replace(/\?/g, () => `$${++idx}`)
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/time\('now'\)/gi, 'CURRENT_TIME')
    .replace(/time\(datetime\('now',\s*'\+30 minutes'\)\)/gi, "(CURRENT_TIME + INTERVAL '30 minutes')")
    .replace(/\bMAX\(0,/gi, 'GREATEST(0,');
}

if (isPostgres) {
  console.log('[DB] Mode: Supabase PostgreSQL');
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  dbInstance = {
    isPostgres: true,
    all: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      pool.query(toPgSql(sql), params || [])
        .then((res) => cb && cb(null, res.rows))
        .catch((err) => cb && cb(err));
    },
    get: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      pool.query(toPgSql(sql), params || [])
        .then((res) => cb && cb(null, res.rows[0]))
        .catch((err) => cb && cb(err));
    },
    run: function (sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      pool.query(toPgSql(sql), params || [])
        .then((res) => {
          if (cb) cb.call({ changes: res.rowCount, lastID: null }, null);
        })
        .catch((err) => cb && cb(err));
    },
    serialize: (fn) => {
      if (typeof fn === 'function') fn();
    }
  };

  async function initPostgres() {
    try {
      const schemaPath = path.join(__dirname, 'supabase-schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('[DB] Skema Supabase PostgreSQL sudah terpasang/siap');
      }
      resolveReady();
    } catch (err) {
      console.error('[DB] Gagal menyiapkan tabel PostgreSQL:', err);
      // Tetap resolve agar server bisa start dan menampilkan pesan error spesifik jika query gagal
      resolveReady();
    }
  }

  initPostgres();
} else {
  console.log('[DB] Mode: SQLite Lokal (lpg_database.db)');
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'lpg_database.db');

  const sqlite = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error membuka database SQLite:', err);
      rejectReady(err);
    } else {
      console.log('[DB] Database SQLite sudah terhubung');
      initSqliteDatabase().then(resolveReady).catch((initError) => {
        console.error('[DB] Error menyiapkan database SQLite:', initError);
        rejectReady(initError);
      });
    }
  });

  dbInstance = sqlite;

  function runSqlite(sql, params = []) {
    return new Promise((resolve, reject) => {
      sqlite.run(sql, params, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async function addColumnIfMissing(table, column, definition) {
    const columns = await new Promise((resolve, reject) => {
      sqlite.all(`PRAGMA table_info(${table})`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    if (!columns.some((existingColumn) => existingColumn.name === column)) {
      await runSqlite(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  async function initSqliteDatabase() {
    await runSqlite(`
      CREATE TABLE IF NOT EXISTS sopir (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        nama TEXT,
        lisensi_expiry TEXT,
        k3_expiry TEXT
      )
    `);
    await addColumnIfMissing('sopir', 'sertifikat_k3', 'TEXT');
    await addColumnIfMissing('sopir', 'nomor_hp', 'TEXT');

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS kendaraan (
        id INTEGER PRIMARY KEY,
        plat_nomor TEXT UNIQUE,
        kapasitas_ton INTEGER,
        tipe_tangki TEXT
      )
    `);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS inspeksi_pagi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE,
        sopir_id INTEGER,
        kendaraan_id INTEGER,
        ban_kondisi BOOLEAN,
        rem_berfungsi BOOLEAN,
        lampu_hidup BOOLEAN,
        tangki_integritas BOOLEAN,
        tidak_ada_kebocoran BOOLEAN,
        pemadam_ada BOOLEAN,
        p3k_ada BOOLEAN,
        kit_tumpah_ada BOOLEAN,
        sopir_fit BOOLEAN,
        dokumen_lengkap BOOLEAN,
        foto_kendaraan TEXT,
        foto_ban TEXT,
        foto_rem TEXT,
        foto_lampu TEXT,
        foto_bak TEXT,
        foto_kebocoran TEXT,
        foto_pemadam TEXT,
        foto_p3k TEXT,
        foto_kit TEXT,
        foto_dokumen TEXT,
        catatan TEXT,
        status_sopir TEXT DEFAULT 'PENDING',
        status_validasi TEXT DEFAULT 'MENUNGGU',
        validasi_oleh TEXT,
        validasi_waktu DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sopir_id) REFERENCES sopir(id),
        FOREIGN KEY(kendaraan_id) REFERENCES kendaraan(id)
      )
    `);
    await runSqlite(`CREATE INDEX IF NOT EXISTS idx_inspeksi_sopir_tanggal ON inspeksi_pagi(sopir_id, tanggal)`);
    await addColumnIfMissing('inspeksi_pagi', 'checklist_json', 'TEXT');
    await addColumnIfMissing('inspeksi_pagi', 'lampiran_json', 'TEXT');
    await runSqlite(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inspeksi_unik_harian ON inspeksi_pagi(sopir_id, tanggal)`);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS pengiriman (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE,
        sopir_id INTEGER,
        kendaraan_id INTEGER,
        pangkalan_nama TEXT,
        latitude REAL,
        longitude REAL,
        jumlah_dikirim_kg INTEGER,
        penerima_nama TEXT,
        penerima_hp TEXT,
        waktu_tiba TIME,
        waktu_selesai TIME,
        kondisi_pengiriman TEXT,
        foto_sebelum TEXT,
        foto_proses TEXT,
        foto_sesudah TEXT,
        tanda_tangan TEXT,
        catatan TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sopir_id) REFERENCES sopir(id),
        FOREIGN KEY(kendaraan_id) REFERENCES kendaraan(id)
      )
    `);

    await runSqlite(`INSERT OR IGNORE INTO sopir (id, username, password, nama, lisensi_expiry, k3_expiry) 
            VALUES (1, 'budi', '12345', 'Budi Santoso', '2025-12-31', '2025-06-30')`);
    await runSqlite(`INSERT OR IGNORE INTO sopir (id, username, password, nama, lisensi_expiry, k3_expiry) 
            VALUES (2, 'ahmad', '12345', 'Ahmad Wijaya', '2025-12-31', '2025-06-30')`);
    await runSqlite(`UPDATE sopir SET nomor_hp = '085745051120' WHERE id = 1`);

    await runSqlite(`INSERT OR IGNORE INTO kendaraan (id, plat_nomor, kapasitas_ton, tipe_tangki) 
        VALUES (1, 'DK 8680 GY', 543, 'Tangki Engkel')`);
    await runSqlite(`INSERT OR IGNORE INTO kendaraan (id, plat_nomor, kapasitas_ton, tipe_tangki) 
        VALUES (2, 'DK 8089 HG', 543, 'Tangki Engkel')`);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS rute_harian (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE,
        sopir_id INTEGER,
        kendaraan_id INTEGER,
        urutan INTEGER,
        pangkalan_id INTEGER,
        pangkalan_nama TEXT,
        latitude REAL,
        longitude REAL,
        permintaan_ton INTEGER,
        estimasi_waktu_tiba TIME,
        FOREIGN KEY(sopir_id) REFERENCES sopir(id),
        FOREIGN KEY(kendaraan_id) REFERENCES kendaraan(id)
      )
    `);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS route_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE,
        sopir_id INTEGER,
        kendaraan_id INTEGER,
        rute_sequence TEXT,
        total_distance_km REAL,
        total_time_minutes INTEGER,
        total_ton INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sopir_id) REFERENCES sopir(id),
        FOREIGN KEY(kendaraan_id) REFERENCES kendaraan(id)
      )
    `);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS lokasi_sopir (
        sopir_id INTEGER PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sopir_id) REFERENCES sopir(id)
      )
    `);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS laporan_bahaya (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE,
        sopir_id INTEGER,
        kendaraan_id INTEGER,
        latitude REAL,
        longitude REAL,
        jenis_bahaya TEXT,
        deskripsi TEXT,
        foto_bukti TEXT,
        status TEXT,
        admin_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY(sopir_id) REFERENCES sopir(id),
        FOREIGN KEY(kendaraan_id) REFERENCES kendaraan(id)
      )
    `);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS kpi_sopir (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE,
        sopir_id INTEGER,
        nilai INTEGER,
        catatan TEXT,
        input_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sopir_id) REFERENCES sopir(id)
      )
    `);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS persediaan_lpg (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        jumlah INTEGER NOT NULL DEFAULT 1200,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runSqlite(`INSERT OR IGNORE INTO persediaan_lpg (id, jumlah) VALUES (1, 1200)`);

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS permintaan_lpg (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal DATE,
        sopir_id INTEGER,
        kendaraan_id INTEGER,
        jumlah_diminta INTEGER,
        status TEXT DEFAULT 'MENUNGGU',
        disetujui_oleh TEXT,
        waktu_disetujui DATETIME,
        catatan TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sopir_id) REFERENCES sopir(id),
        FOREIGN KEY(kendaraan_id) REFERENCES kendaraan(id)
      )
    `);
    await runSqlite(`CREATE UNIQUE INDEX IF NOT EXISTS idx_permintaan_unik_harian ON permintaan_lpg(sopir_id, tanggal)`);
    console.log('[DB] Tabel database SQLite sudah siap');
  }
}

module.exports = dbInstance;
module.exports.ready = ready;
