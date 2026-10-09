export function todayWIB() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
}

export function fmtWaktu(ts) {
  if (!ts) return '-';
  const iso = String(ts).includes('T') ? ts : String(ts).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
}

export function fmtTanggalLengkap(ts) {
  if (!ts) return '-';
  const iso = String(ts).includes('T') ? ts : String(ts).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' });
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
