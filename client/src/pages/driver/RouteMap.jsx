import { useEffect, useRef, useState } from 'react';
import MapCanvas, { L, numberIcon } from '../../components/MapCanvas';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverRouteMap() {
  const { user } = useAuth();
  const { data, error, reload } = useApi(`/driver/${user.id}/routes`);
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
      ton: r.permintaan_ton,
      done: delivered.has(r.pangkalan_nama)
    }));
    if (!points.length) return;
    const latlngs = points.map((p) => [p.lat, p.lng]);
    L.polyline(latlngs, { color: '#b91c1c', weight: 4, dashArray: '6 6' }).addTo(layerRef.current);
    points.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: numberIcon(p.done ? '#15803d' : '#b91c1c', p.urutan) })
        .addTo(layerRef.current)
        .bindPopup(`<strong>${p.urutan}. ${p.nama}</strong><br>Permintaan: ${p.ton} Ton<br>Status: ${p.done ? 'Sudah Terkirim' : 'Menunggu Pengiriman'}`);
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
          <h1>Peta Rute Distribusi Teroptimasi</h1>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Urutan Pangkalan Berdasarkan TSP Heuristik
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
        {error && <p className="banner warn" role="alert">{error.message}<button className="btn btn-sm btn-outline" onClick={reload}>Coba Lagi</button></p>}
        <MapCanvas height={540} onReady={(m) => { mapRef.current = m; setReadyMap(m); }} />
        <div className="map-legend-bar mt-sm">
          <span>Titik bernomor menunjukkan urutan rute singgah pangkalan yang telah dioptimasi secara otomatis.</span>
        </div>
      </div>
    </div>
  );
}
