// Utilitas tanggal/waktu berbasis WITA (Asia/Makassar).

function formatDate(date = new Date()) {
  return new Date(date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' });
}

function parseTimestamp(value) {
  if (value instanceof Date) return value;
  let iso = String(value).replace(' ', 'T');
  if (iso.includes('T')) iso = iso.replace(/([+-]\d{2})$/, '$1:00');
  if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !/(Z|[+-]\d{2}(?::?\d{2})?)$/.test(iso)) iso += 'Z';
  return new Date(iso);
}

function formatWaktu(timestamp, opts = {}) {
  if (!timestamp) return '-';
  const date = parseTimestamp(timestamp);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', second: '2-digit', ...opts }) + ' WITA';
}

function formatWaktuLengkap(timestamp) {
  if (!timestamp) return '-';
  const date = parseTimestamp(timestamp);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA';
}

export { formatDate, formatWaktu, formatWaktuLengkap };
