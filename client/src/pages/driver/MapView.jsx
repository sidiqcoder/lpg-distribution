import { useEffect, useRef, useState } from 'react';
import MapCanvas, { L, dotIcon } from '../../components/MapCanvas';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';

import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverMap() {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const lineRef = useRef(null);
  const centeredRef = useRef(false);
  const { data, error, reload } = useApi('/tracking', { interval: 4000 });
  const [readyMap, setReadyMap] = useState(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const item = data.find((e) => Number(e.sopir_id) === Number(user.id));
    if (!item || item.latitude == null || item.longitude == null) return;
    const point = [Number(item.latitude), Number(item.longitude)];
    const route = item.route || [];
    if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
    if (route.length > 1) {
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
    if (!centeredRef.current && !map.lpgUserMoved) map.setView(point, 15);
    centeredRef.current = true;
  }, [data, user.id, readyMap]);


  return (
    <div className="map-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
          <h1>Posisi Real-Time GPS Armada</h1>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => { const item = data?.find(p => Number(p.sopir_id) === Number(user.id)); if (item?.latitude != null) mapRef.current?.setView([Number(item.latitude), Number(item.longitude)], 15); }}>Lihat Posisi Saya</button>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Koordinat GPS Terhubung dengan Dashboard Manager
          </p>
        </div>
      </div>

      <div className="card">
        {error && <p className="banner warn" role="alert">{error.message}<button className="btn btn-sm btn-outline" onClick={reload}>Coba Lagi</button></p>}
        {data && !data.some(item => item.latitude != null && item.longitude != null) && <p className="muted">Menunggu izin lokasi dan sinyal GPS perangkat.</p>}
        <MapCanvas height={500} onReady={(m) => { mapRef.current = m; setReadyMap(m); }} />
        <div className="map-legend-bar mt-sm">
          <Icon name="activity" size={14} />
          <span>Titik merah menunjukkan koordinat GPS kendaraan Anda saat ini yang diperbarui secara langsung.</span>
        </div>
      </div>
    </div>
  );
}
