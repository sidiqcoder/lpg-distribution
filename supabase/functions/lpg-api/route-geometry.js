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
