import { useEffect, useRef } from 'react';
import MapCanvas, { L, numberIcon } from '../../components/MapCanvas';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverRouteMap() {
  const { user } = useAuth();
  const { data } = useApi(`/driver/${user.id}/routes`);
  const mapRef = useRef(null);
  const drawnRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data || drawnRef.current) return;
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
    L.polyline(latlngs, { color: '#b91c1c', weight: 4, dashArray: '6 6' }).addTo(map);
    points.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: numberIcon(p.done ? '#15803d' : '#b91c1c', p.urutan) })
        .addTo(map)
        .bindPopup(`<strong>${p.urutan}. ${p.nama}</strong><br>Permintaan: ${p.ton} Ton<br>Status: ${p.done ? 'Sudah Terkirim' : 'Menunggu Pengiriman'}`);
    });
    map.fitBounds(latlngs, { padding: [40, 40] });
    drawnRef.current = true;
  }, [data]);

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
        <MapCanvas height={540} onReady={(m) => { mapRef.current = m; }} />
        <div className="map-legend-bar mt-sm">
          <span>Titik bernomor menunjukkan urutan rute singgah pangkalan yang telah dioptimasi secara otomatis.</span>
        </div>
      </div>
    </div>
  );
}
