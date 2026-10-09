import { useEffect, useRef } from 'react';
import MapCanvas, { L, dotIcon } from '../../components/MapCanvas';
import { useApi } from '../../hooks';
import { fmtWaktu } from '../../utils';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

function distanceToRoute(lat, lng, route) {
  if (!route || !route.length) return Infinity;
  return Math.min(...route.map((p) => Math.sqrt(Math.pow((lat - Number(p.latitude)) * 111, 2) + Math.pow((lng - Number(p.longitude)) * 111 * Math.cos((lat * Math.PI) / 180), 2))));
}

function waLink(nomor, nama) {
  if (!nomor) return null;
  const pesan = `Peringatan Resmi Dispatcher LPG PT Macan Gading untuk Sopir ${nama}: Posisi GPS kendaraan Anda terdeteksi keluar dari rute koridor yang ditentukan. Harap segera kembali ke rute resmi dan konfirmasi status keselamatan.`;
  const normalized = String(nomor).replace(/\D/g, '').replace(/^0/, '62');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(pesan)}`;
}

export default function ManagerTracking() {
  const { data, reload } = useApi('/tracking', { interval: 4000 });
  const mapRef = useRef(null);
  const markers = useRef(new Map());

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const visible = new Set(data.map((d) => d.sopir_id));
    markers.current.forEach((marker, id) => {
      if (!visible.has(id)) {
        map.removeLayer(marker);
        markers.current.delete(id);
      }
    });

    data.forEach((item) => {
      const point = [Number(item.latitude), Number(item.longitude)];
      const off = distanceToRoute(point[0], point[1], item.route) > 0.5;
      const icon = dotIcon(off ? '#b91c1c' : '#15803d', 18);
      const popup = `<strong>${item.nama}</strong><br>Status: ${off ? 'Keluar Jalur Rute' : 'Sesuai Jalur Resmi'}<br>Akurasi GPS: ${Number(item.accuracy || 0).toFixed(0)} m`;
      if (markers.current.has(item.sopir_id)) {
        markers.current.get(item.sopir_id).setLatLng(point).setIcon(icon).setPopupContent(popup);
      } else {
        markers.current.set(item.sopir_id, L.marker(point, { icon }).addTo(map).bindPopup(popup));
      }
    });
  }, [data]);

  const drivers = data || [];

  return (
    <div className="tracking-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/manager" label="Kembali ke Ringkasan" />
          </div>
          <h1>Pelacakan Posisi GPS Real-Time Armada</h1>
          <p className="subtitle">
            Monitoring Pergerakan Truk Tangki Pengangkut Tabung Gas LPG Secara Langsung
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-outline" onClick={reload}>
            <Icon name="refresh" size={14} />
            <span>Refresh Koordinat</span>
          </button>
        </div>
      </div>

      <div className="card mb">
        <MapCanvas height={460} onReady={(m) => { mapRef.current = m; }} />
        <div className="map-legend-bar mt-sm">
          <span className="legend-indicator dot-green" /> Sesuai Jalur Distribusi
          <span className="legend-indicator dot-red ml" /> Keluar dari Koridor Rute
        </div>
      </div>

      <div className="stat-grid mt">
        {drivers.length > 0 ? (
          drivers.map((pos) => {
            const off = distanceToRoute(Number(pos.latitude), Number(pos.longitude), pos.route) > 0.5;
            const wa = waLink(pos.nomor_hp, pos.nama);
            return (
              <div className="stat-card" key={pos.sopir_id}>
                <div className="stat-header">
                  <span className="stat-icon-wrapper icon-blue">
                    <Icon name="truck" size={18} />
                  </span>
                  <span className={`badge ${off ? 'badge-bad' : 'badge-ok'}`}>
                    {off ? 'Peringatan: Keluar Rute' : 'Rute Sesuai'}
                  </span>
                </div>
                <div className="stat-body">
                  <strong className="fs-md">{pos.nama}</strong>
                  <div className="text-xs text-muted mt-xs">
                    Plat: {pos.plat_nomor || '-'} &middot; Akurasi: {Number(pos.accuracy || 0).toFixed(0)}m
                  </div>
                  <div className="text-xs muted mt-xs">
                    Koordinat: {Number(pos.latitude).toFixed(4)}, {Number(pos.longitude).toFixed(4)}
                  </div>
                  <div className="text-xs muted">
                    Diperbarui: {fmtWaktu(pos.updated_at || pos.created_at)} WIB
                  </div>
                  {wa && (
                    <a
                      className="btn btn-sm btn-outline btn-block mt-sm"
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="phone" size={14} /> Peringatkan via WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="card empty-state-card">
            <Icon name="map-pin" size={32} />
            <p>Belum ada sopir armada yang sedang aktif menyalakan GPS hari ini.</p>
          </div>
        )}
      </div>
    </div>
  );
}
