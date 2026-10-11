// Distance to the segments between assigned stops, in kilometres.
export function distanceToRoute(lat, lng, route) {
  const points = (route || []).filter(p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
  if (!points.length) return null;
  const scale = 111.32 * Math.cos(lat * Math.PI / 180);
  const vectors = points.map(p => [(Number(p.longitude) - lng) * scale, (Number(p.latitude) - lat) * 111.32]);
  let distance = Infinity;
  for (let i = 0; i < vectors.length; i++) {
    const a = vectors[i], b = vectors[i + 1] || a;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / length)) : 0;
    distance = Math.min(distance, Math.hypot(a[0] + t * dx, a[1] + t * dy));
  }
  return distance;
}

export function routeStatus(position) {
  if (position.latitude == null || position.longitude == null) return { label: 'Menunggu izin / sinyal GPS', cls: 'warn', off: false };
  if (!position.active) return { label: 'Lokasi terakhir · GPS belum diperbarui', cls: 'warn', off: false };
  if (Number(position.accuracy) > 100) return { label: 'Akurasi GPS rendah', cls: 'warn', off: false };
  const distance = distanceToRoute(Number(position.latitude), Number(position.longitude), position.route);
  if (distance == null) return { label: 'Rute belum tersedia', cls: 'info', off: false };
  return distance > 0.5 ? { label: 'Peringatan: Keluar Rute', cls: 'bad', off: true } : { label: 'Rute Sesuai', cls: 'ok', off: false };
}

export function waLink(number, name, off = true) {
  let normalized = String(number || '').replace(/\D/g, '');
  if (normalized.startsWith('0')) normalized = '62' + normalized.slice(1);
  else if (normalized.startsWith('8')) normalized = '62' + normalized;
  if (!/^\d{10,15}$/.test(normalized)) return null;
  const message = off
    ? `Peringatan untuk Sopir ${name}: Posisi kendaraan Anda terdeteksi keluar dari jalur yang ditentukan. Harap kembali ke jalur resmi saat aman dan konfirmasi kondisi Anda kepada Manager PT Macan Gading.`
    : `Halo ${name}, mohon konfirmasi posisi kendaraan dan kondisi Anda kepada Manager PT Macan Gading.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
