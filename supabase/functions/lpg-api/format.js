// Utilitas tanggal/waktu berbasis WIB (Asia/Jakarta).

function formatDate(date = new Date()) {
  return new Date(date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

function formatWaktu(sqliteTimestamp, opts = {}) {
  if (!sqliteTimestamp) return '-';
  const iso = String(sqliteTimestamp).includes('T') ? sqliteTimestamp : String(sqliteTimestamp).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', ...opts }) + ' WIB';
}

function formatWaktuLengkap(sqliteTimestamp) {
  if (!sqliteTimestamp) return '-';
  const iso = String(sqliteTimestamp).includes('T') ? sqliteTimestamp : String(sqliteTimestamp).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
}

export { formatDate, formatWaktu, formatWaktuLengkap };
