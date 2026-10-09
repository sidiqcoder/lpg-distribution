import { useEffect, useRef } from 'react';
import MapCanvas, { L, dotIcon } from '../../components/MapCanvas';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { apiJson } from '../../api';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverMap() {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const lineRef = useRef(null);
  const { data } = useApi('/tracking', { interval: 4000 });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const item = data.find((e) => Number(e.sopir_id) === Number(user.id));
    if (!item) return;
    const point = [Number(item.latitude), Number(item.longitude)];
    const route = item.route || [];
    if (!lineRef.current && route.length > 1) {
      lineRef.current = L.polyline(route.map((r) => [Number(r.latitude), Number(r.longitude)]), {
        color: '#b91c1c',
        weight: 5,
        dashArray: '8 8'
      }).addTo(map);
    }
    const icon = dotIcon('#b91c1c', 16);
    if (markerRef.current) {
      markerRef.current.setLatLng(point).setIcon(icon);
    } else {
      markerRef.current = L.marker(point, { icon }).addTo(map).bindPopup('Posisi Armada Anda Saat Ini');
    }
    map.setView(point, 15);
  }, [data, user.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const send = () => navigator.geolocation.getCurrentPosition((pos) => {
      apiJson('/tracking', {
        sopir_id: user.id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }).catch(() => {});
    });
    send();
    const t = setInterval(send, 5000);
    return () => clearInterval(t);
  }, [user.id]);

  return (
    <div className="map-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
          <h1>Posisi Real-Time GPS Armada</h1>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Koordinat GPS Terhubung dengan Dashboard Manager
          </p>
        </div>
      </div>

      <div className="card">
        <MapCanvas height={500} onReady={(m) => { mapRef.current = m; }} />
        <div className="map-legend-bar mt-sm">
          <Icon name="activity" size={14} />
          <span>Titik merah menunjukkan koordinat GPS kendaraan Anda saat ini yang diperbarui secara langsung.</span>
        </div>
      </div>
    </div>
  );
}
