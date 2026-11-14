import { useEffect, useRef, useState } from 'react';
import MapCanvas, { L, numberIcon, locationIcon, escapeHtml } from '../../components/MapCanvas';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverRouteMap() {
  const { user } = useAuth();
  const { data, error, reload } = useApi(`/driver/${user.id}/routes`, { interval: 10000 });
  const [readyMap, setReadyMap] = useState(null);
  const mapRef = useRef(null);
  const drawnRef = useRef(false);
  const layerRef = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = L.layerGroup().addTo(map);
    const delivered = new Set(data.delivered || []);
    const points = (data.rute || []).map((r) => ({
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      urutan: r.urutan,
      nama: r.pangkalan_nama,
      quantity: r.permintaan_tabung,
      deadline: r.estimasi_waktu_tiba,
      done: delivered.has(r.pangkalan_nama)
    }));
    if (!points.length) return;
    const latlngs = points.map((p) => [p.lat, p.lng]);
    if (data.origin) {
      const origin = [Number(data.origin.latitude), Number(data.origin.longitude)];
      latlngs.unshift(origin);
      L.marker(origin, { icon: numberIcon('#1d4ed8', 'Awal') }).addTo(layerRef.current).bindPopup('Gudang: titik awal keberangkatan');
    }
    L.polyline(latlngs, { color: '#b91c1c', weight: 4, dashArray: '6 6' }).addTo(layerRef.current);
    points.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: locationIcon(p.done ? '#15803d' : '#b91c1c') })
        .addTo(layerRef.current)
        .bindTooltip(escapeHtml(p.nama), { permanent: true, direction: 'right' })
        .bindPopup(`<strong>${p.urutan}. ${escapeHtml(p.nama)}</strong><br>Permintaan: ${p.quantity ?? 0} Tabung<br>Batas tiba: ${p.deadline || '-'} WITA<br>Status: ${p.done ? 'Sudah Terkirim' : 'Menunggu Pengiriman'}`);
    });
    if (!drawnRef.current && !map.lpgUserMoved) map.fitBounds(latlngs, { padding: [40, 40] });
    drawnRef.current = true;
  }, [data, readyMap]);

  return (
    <div className="map-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir/menu" label="Kembali ke Menu Operasional" />
          </div>
          <h1>Peta Rute Distribusi</h1>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Urutan tujuan sesuai penugasan harian
          </p>
        </div>
        <div className="head-badge-wrapper">
          <span className="badge badge-info">
            <Icon name="clock" size={12} /> Menunggu Dikirim
          </span>
          <span className="badge badge-ok ml-xs">
            <Icon name="check-circle" size={12} /> Sudah Terkirim
          </span>
        </div>
      </div>

      <div className="card">
        {data?.route_source && <p className="banner warn">Sumber rute: {data.route_source}</p>}
        {error && <p className="banner warn" role="alert">{error.message}<button className="btn btn-sm btn-outline" onClick={reload}>Coba Lagi</button></p>}
        <MapCanvas height={540} onReady={(m) => { mapRef.current = m; setReadyMap(m); }} />
        <div className="map-legend-bar mt-sm">
          <span>Penanda biru menunjukkan gudang. Rute baru memakai Saving Matrix + Nearest Neighbor. Penugasan yang sudah berjalan tetap dipertahankan. Garis menghubungkan urutan tujuan, bukan geometri jalan.</span>
        </div>
      </div>
      {data?.rute?.length > 0 && <div className="card mt"><h2>Daftar Tujuan</h2><ol>{data.rute.map(r => <li key={r.id || r.urutan}>{r.pangkalan_nama} · Permintaan: {r.permintaan_tabung ?? 0} Tabung · Batas tiba: {r.estimasi_waktu_tiba} WITA</li>)}</ol></div>}
    </div>
  );
}
