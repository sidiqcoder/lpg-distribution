import postgres from 'postgres';

export function openDatabase(url) {
  if (!url) throw new Error('SUPABASE_DB_URL belum tersedia.');
  return postgres(url, {
    max: 1, prepare: false, idle_timeout: 20, connect_timeout: 10,
    connection: { application_name: 'lpg-api', timezone: 'Asia/Makassar', statement_timeout: 15000 },
    types: {
      date: { to: 1082, from: [1082], serialize: String, parse: String },
      bigint: { to: 20, from: [20], serialize: String, parse: Number }
    }
  });
}

// Translate the legacy query syntax without changing the endpoint response contract.
export function toPostgres(sql) {
  let index = 0;
  return sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/time\(datetime\('now',\s*'\+30 minutes'\)\)/gi, "(LOCALTIME + INTERVAL '30 minutes')")
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/time\('now'\)/gi, 'LOCALTIME')
    .replace(/\bMAX\(0,/gi, 'GREATEST(0,');
}

export function queries(database) {
  const queryAll = (sql, params = []) => database.unsafe(toPostgres(sql), params.map(v => v ?? null));
  const queryOne = async (sql, params = []) => (await queryAll(sql, params))[0];
  const run = async (sql, params = []) => { const rows = await queryAll(sql, params); return { changes: rows.count }; };
  return { queryAll, queryOne, run };
}
