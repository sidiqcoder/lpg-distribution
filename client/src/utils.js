export function todayWITA(date = new Date()) {
  return new Date(date).toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' });
}

function parseTimestamp(ts) {
  if (ts instanceof Date) return ts;
  let iso = String(ts).replace(' ', 'T');
  if (iso.includes('T')) iso = iso.replace(/([+-]\d{2})$/, '$1:00');
  if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !/(Z|[+-]\d{2}(?::?\d{2})?)$/.test(iso)) iso += 'Z';
  return new Date(iso);
}

export function fmtWaktu(ts) {
  if (!ts) return '-';
  const d = parseTimestamp(ts);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WITA';
}

export function fmtTanggalLengkap(ts) {
  if (!ts) return '-';
  const d = parseTimestamp(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtSubmit(ts) {
  return ts ? `${fmtTanggalLengkap(ts)}, ${fmtWaktu(ts)}` : '-';
}

export function badgeForStatusValidasi(status) {
  if (status === 'AMAN') return { cls: 'ok', label: 'Lolos' };
  if (status === 'TIDAK_AMAN') return { cls: 'bad', label: 'Gagal' };
  return { cls: 'warn', label: 'Menunggu review' };
}

export function badgeForLpg(status) {
  if (status === 'DISETUJUI') return { cls: 'ok', label: 'Disetujui' };
  if (status === 'DITOLAK') return { cls: 'bad', label: 'Ditolak' };
  return { cls: 'warn', label: 'Menunggu' };
}

export { uploadUrl } from './api';
