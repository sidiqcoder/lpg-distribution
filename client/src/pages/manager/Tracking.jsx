import { useEffect, useRef, useState } from 'react';
import MapCanvas, { L, dotIcon } from '../../components/MapCanvas';
import { useApi } from '../../hooks';
import { fmtSubmit } from '../../utils';
import { routeStatus, waLink } from '../../tracking';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function ManagerTracking() {
  const { data, error, loading, reload } = useApi('/tracking', { interval: 5000 });
  const [map, setMap] = useState(null);
  const markers = useRef(new Map());
  const routes = useRef(null);
  const fitted = useRef(false);
  const drivers = data || [];
  const points = drivers.filter(item => item.latitude != null && item.longitude != null);
  const showFleet = () => { if (points.length) map?.fitBounds(points.map(item => [Number(item.latitude), Number(item.longitude)]), { padding: [40, 40], maxZoom: 15 }); };

  useEffect(() => {
    if (!map || !data) return;
    const visible = new Set(data.filter(item => item.latitude != null && item.longitude != null).map(item => item.sopir_id));
    markers.current.forEach((marker, id) => { if (!visible.has(id)) { map.removeLayer(marker); markers.current.delete(id); } });
    if (routes.current) map.removeLayer(routes.current);
    routes.current = L.layerGroup().addTo(map);
    data.forEach(item => {
      if (item.latitude == null || item.longitude == null) return;
      const point = [Number(item.latitude), Number(item.longitude)];
      const status = routeStatus(item);
      const color = !item.active ? '#64748b' : status.off ? '#b91c1c' : status.cls === 'ok' ? '#15803d' : '#d97706';
      const popup = document.createElement('div');
      popup.textContent = `${item.nama} · ${status.label} · Akurasi ${Number(item.accuracy || 0).toFixed(0)} m · ${fmtSubmit(item.updated_at)}`;
      if (markers.current.has(item.sopir_id)) markers.current.get(item.sopir_id).setLatLng(point).setIcon(dotIcon(color)).setPopupContent(popup);
      else markers.current.set(item.sopir_id, L.marker(point, { icon: dotIcon(color) }).addTo(map).bindPopup(popup));
      if (item.route?.length > 1) L.polyline(item.route.map(stop => [Number(stop.latitude), Number(stop.longitude)]), { color: '#2563eb', weight: 3, dashArray: '6 6' }).addTo(routes.current);
    });
    const located = data.filter(item => item.latitude != null && item.longitude != null);
    if (located.length && !fitted.current) {
      if (!map.lpgUserMoved) map.fitBounds(located.map(item => [Number(item.latitude), Number(item.longitude)]), { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [map, data]);

  return <div className="tracking-page-layout">
    <div className="page-head">
      <div><BackButton fallback="/manager" label="Kembali ke Ringkasan" /><h1>Pelacakan Posisi GPS Real-Time Armada</h1><p className="subtitle">Lokasi terakhir tetap terlihat saat GPS terputus. Status rute memakai koridor antara titik pangkalan.</p></div>
      <div className="head-actions"><button type="button" className="btn btn-outline" onClick={reload}><Icon name="refresh" size={14} /> Refresh Koordinat</button><button type="button" className="btn btn-outline" onClick={showFleet} disabled={!points.length}>Lihat Semua Sopir</button></div>
    </div>
    {error && <div className="banner warn mb" role="alert">{data ? 'Pembaruan GPS gagal. Menampilkan data terakhir. ' : ''}{error.message}<button className="btn btn-sm btn-outline ml" onClick={reload}>Coba Lagi</button></div>}
    <div className="card mb"><MapCanvas height={460} onReady={setMap} /><div className="map-legend-bar mt-sm">Hijau: rute sesuai · Merah: keluar rute · Abu-abu: lokasi terakhir · Garis biru: rute ditentukan</div></div>
    <div className="stat-grid mt">
      {drivers.map(pos => {
        const status = routeStatus(pos);
        const contact = waLink(pos.nomor_hp, pos.nama, false);
        const warning = waLink(pos.nomor_hp, pos.nama, true);
        return <div className="stat-card" key={pos.sopir_id}>
          <div className="stat-header"><Icon name="truck" size={18} /><span className={`badge badge-${status.cls}`}>{status.label}</span></div>
          <div className="stat-body"><strong>{pos.nama}</strong>
            <div className="text-xs muted mt-xs">Plat: {pos.plat_nomor || '-'} · Akurasi: {pos.accuracy == null ? '-' : `${Number(pos.accuracy).toFixed(0)} m`}</div>
            <div className="text-xs muted">Login terakhir: {fmtSubmit(pos.login_at)}</div>
            <div className="text-xs muted">GPS diperbarui: {fmtSubmit(pos.updated_at)}</div>
            {pos.latitude != null && pos.longitude != null && <button className="btn btn-sm btn-outline mt-sm" onClick={() => map?.setView([Number(pos.latitude), Number(pos.longitude)], 15)}>Lihat Posisi</button>}
            {contact ? <a className="btn btn-sm btn-outline btn-block mt-sm" href={contact} target="_blank" rel="noreferrer"><Icon name="phone" size={14} /> Hubungi via WhatsApp</a> : <small className="muted block mt-sm">Nomor WhatsApp sopir belum tersedia.</small>}
            {status.off && warning && <a className="btn btn-sm btn-primary btn-block mt-sm" href={warning} target="_blank" rel="noreferrer"><Icon name="alert" size={14} /> Peringatkan Keluar Jalur via WhatsApp</a>}
          </div>
        </div>;
      })}
      {!drivers.length && <div className="card"><p>{loading ? 'Memuat data sopir...' : 'Belum ada data sopir.'}</p></div>}
    </div>
    <p className="text-sm muted mt">Tombol WhatsApp membuka pesan yang sudah terisi. Manager mengirim pesan melalui WhatsApp.</p>
  </div>;
}
