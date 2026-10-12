import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MapCanvas, { L, dotIcon } from '../../components/MapCanvas';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { apiForm } from '../../api';
import { notifyDataChanged } from '../../events';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';
import { useDriverLocation } from '../../components/DriverTelemetry';
import { distanceToRoute } from '../../tracking';

export default function DriverOnDuty() {
  const { user } = useAuth();
  const { data, error: routesError, reload } = useApi(`/driver/${user.id}/routes`, { interval: 5000 });
  const { data: summary, error: summaryError, reload: reloadSummary } = useApi(`/driver/${user.id}/summary`, { interval: 5000 });
  const [readyMap, setReadyMap] = useState(null);

  const mapRef = useRef(null);
  const lineRef = useRef(null);
  const fittedRef = useRef(false);
  const { position } = useDriverLocation();
  const markerRef = useRef(null);
  const routeMarkerRef = useRef(null);
  const deliveryFormRef = useRef(null);
  const hazardFormRef = useRef(null);
  const submittingRef = useRef(false);

  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [offRoute, setOffRoute] = useState(false);
  const [hazardOpen, setHazardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const rute = data?.rute || [];
  const delivered = new Set(data?.delivered || []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data || !summary?.siapBerangkat) return;
    const points = (data.origin ? [data.origin, ...rute] : rute).map((r) => ({ lat: Number(r.latitude), lng: Number(r.longitude) }));
    if (lineRef.current) { map.removeLayer(lineRef.current); lineRef.current = null; }
    if (points.length > 1) {
      lineRef.current = L.polyline(points.map((p) => [p.lat, p.lng]), { color: '#b91c1c', weight: 5, dashArray: '8 8' }).addTo(map);
      if (!fittedRef.current && !map.lpgUserMoved) map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [30, 30] });
      fittedRef.current = true;
    }
  }, [data, readyMap, summary?.siapBerangkat]);

  useEffect(() => {
    if (!position || !summary?.siapBerangkat) return;
    const { latitude: lat, longitude: lng, accuracy } = position;
    const distance = distanceToRoute(lat, lng, data?.origin ? [data.origin, ...rute] : rute);
    const off = distance != null && distance > 0.5 && accuracy <= 100;
    const map = mapRef.current;
    if (map) {
      const icon = dotIcon(off ? '#b91c1c' : '#15803d', 16);
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]).setIcon(icon);
      else markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      markerRef.current.bindPopup(off ? 'Peringatan: Keluar Jalur Rute' : 'Posisi Kendaraan Aktif');
    }
    setOffRoute(off);
  }, [position, data, readyMap, summary?.siapBerangkat]);

  const pickRoute = (r) => {
    setSelected(r);
    setShowForm(true);
    const map = mapRef.current;
    if (map) {
      if (routeMarkerRef.current) map.removeLayer(routeMarkerRef.current);
      routeMarkerRef.current = L.marker([Number(r.latitude), Number(r.longitude)]).addTo(map).bindPopup(r.pangkalan_nama);
      map.setView([Number(r.latitude), Number(r.longitude)], 15);
    }
  };

  const submitDelivery = async (e) => {
    e.preventDefault();
    if (!selected) { setError('Pilih pangkalan tujuan terlebih dahulu.'); return; }
    if (submittingRef.current || busy) return;

    submittingRef.current = true;
    setBusy(true);
    setError('');
    setSuccessMsg('');

    try {
      const fd = new FormData(deliveryFormRef.current);
      fd.set('sopir_id', String(user.id));
      fd.set('pangkalan_id', String(selected.pangkalan_id));
      fd.set('pangkalan_nama', selected.pangkalan_nama);
      await apiForm('/driver/delivery', fd);
      notifyDataChanged({ type: 'delivery', driverId: user.id });
      deliveryFormRef.current.reset();
      setSelected(null);
      setShowForm(false);
      setSuccessMsg('Pengiriman berhasil dicatat dan status pangkalan diperbarui!');
      await reload();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan data pengiriman.');
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const submitHazard = async (e) => {
    e.preventDefault();
    if (submittingRef.current || busy) return;

    submittingRef.current = true;
    setBusy(true);
    setError('');

    try {
      const fd = new FormData(hazardFormRef.current);
      fd.set('sopir_id', String(user.id));
      await apiForm('/driver/hazard', fd);
      notifyDataChanged({ type: 'hazard', driverId: user.id });
      hazardFormRef.current.reset();
      setHazardOpen(false);
      setSuccessMsg('Laporan bahaya berhasil dikirimkan ke Manager Operasional.');
    } catch (err) {
      setError(err.message || 'Gagal mengirim laporan bahaya.');
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  if (!summary || !data) return <div className="card"><div className="page-head"><h1>Status On-Duty Pengiriman</h1></div><p>{summaryError?.message || routesError?.message || 'Memuat status pengiriman...'}</p>{(summaryError || routesError) && <button className="btn btn-outline" onClick={() => { reload(); reloadSummary(); }}>Coba Lagi</button>}</div>;

  if (!summary.siapBerangkat) {
    return (
      <div className="status-page-layout">
        <div className="page-head">
          <div>
            <div className="breadcrumb-nav">
              <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
            </div>
            <h1>Status On-Duty Pengiriman</h1>
          </div>
        </div>
        <div className="card max-w-640">
          <div className="banner warn">
            <div className="banner-title">
              <Icon name="alert" size={18} />
              <span>Akses Pengiriman Belum Diizinkan</span>
            </div>
            <p>
              Anda belum dapat memulai tugas pengiriman hari ini.
              Pastikan formulir inspeksi kendaraan pagi sudah disetujui (AMAN) dan permintaan pengambilan tabung LPG sudah disetujui oleh Manager Operasional.
            </p>
          </div>
          <div className="form-actions-bar mt">
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="duty-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir/menu" label="Kembali ke Menu Operasional" />
          </div>
          <h1>On-Duty: Distribusi Armada LPG</h1>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Pantau Rute dan Konfirmasi Serah Terima
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-bad" type="button" onClick={() => setHazardOpen(true)}>
            <Icon name="alert" size={16} /> Lapor Bahaya / Kendala
          </button>
        </div>
      </div>

      {error && (
        <div className="banner bad mb">
          <div className="banner-title">
            <Icon name="alert" size={18} />
            <span>Terjadi Kendala</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="banner ok mb">
          <div className="banner-title">
            <Icon name="check-circle" size={18} />
            <span>Berhasil Disimpan</span>
          </div>
          <p>{successMsg}</p>
        </div>
      )}

      <div className="grid cols-2">
        {/* Kolom Kiri: Daftar Rute */}
        <div className="card">
          <div className="card-header-styled">
            <Icon name="map-pin" size={18} />
            <h2>Daftar Pangkalan Rute Hari Ini</h2>
          </div>
          <div className="pangkalan-list-wrap mt">
            {rute.length > 0 ? (
              rute.map((r) => {
                const done = delivered.has(r.pangkalan_nama);
                const isCurrent = selected?.pangkalan_id === r.pangkalan_id;
                return (
                  <div
                    key={r.id}
                    onClick={() => pickRoute(r)}
                    className={`route-card-item ${done ? 'done-route' : ''} ${isCurrent ? 'selected-route' : ''}`}
                  >
                    <div className="route-badge-num">{r.urutan}</div>
                    <div className="route-info-col">
                      <strong>{r.pangkalan_nama}</strong>
                      <span className="muted block text-sm">
                        {r.permintaan_ton > 0 ? `Permintaan: ${r.permintaan_ton} Ton` : 'Kuota belum ditetapkan'} &middot; {r.estimasi_waktu_tiba ? `Estimasi: ${r.estimasi_waktu_tiba} WITA` : 'Estimasi belum ditetapkan'}
                      </span>
                    </div>
                    <div className="route-status-col">
                      <span className={`badge ${done ? 'badge-ok' : 'badge-brand'}`}>
                        {done ? 'Selesai' : 'Belum Kirim'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted empty">Belum ada rute pengiriman yang ditugaskan hari ini.</p>
            )}
          </div>
          <div className="form-actions-bar mt">
            <Link className="btn btn-outline" to="/sopir/rute-map">
              <Icon name="map-pin" size={16} /> Buka Peta Rute Penuh
            </Link>
            <BackButton fallback="/sopir/menu" label="Kembali" />
          </div>
        </div>

        {/* Kolom Kanan: Peta Live & Form Konfirmasi Pengiriman */}
        <div className="card">
          <div className="card-header-styled">
            <Icon name="truck" size={18} />
            <h2>Peta Lokasi &amp; Konfirmasi Serah Terima</h2>
          </div>
          <div className="mt-sm">
            <MapCanvas height={280} onReady={(m) => {
              mapRef.current = m; lineRef.current = null; markerRef.current = null;
              routeMarkerRef.current = null; fittedRef.current = false; setReadyMap(m);
            }} />
          </div>

          {offRoute && (
            <div className="banner bad mt-sm">
              <div className="banner-title">
                <Icon name="alert" size={16} />
                <span>Peringatan: Posisi Keluar Jalur</span>
              </div>
              <p>GPS mendeteksi armada Anda berada di luar koridor rute yang ditentukan.</p>
            </div>
          )}

          {showForm && selected ? (
            <form ref={deliveryFormRef} onSubmit={submitDelivery} className="mt delivery-form-card">
              <div className="banner info">
                <strong>Konfirmasi Pengiriman ke: {selected.pangkalan_nama}</strong>
                <span>Isi bukti serah terima tabung LPG kepada penanggung jawab pangkalan.</span>
              </div>

              <div className="form-group mt-sm">
                <label>Jumlah Tabung Dikirim (Tabung)</label>
                <input type="number" name="jumlah_dikirim_tabung" required placeholder="Contoh: 100" />
              </div>

              <div className="field-row">
                <div className="form-group">
                  <label>Nama Penerima Pangkalan</label>
                  <input type="text" name="penerima_nama" required placeholder="Nama lengkap" />
                </div>
                <div className="form-group">
                  <label>No. HP Penerima</label>
                  <input type="tel" name="penerima_hp" required placeholder="08xxxxxxxxxx" />
                </div>
              </div>

              <div className="form-group">
                <label>Kondisi Tabung Saat Diterima</label>
                <select name="kondisi_pengiriman" required defaultValue="OK">
                  <option value="OK">OK &mdash; Kondisi Baik &amp; Segel Utuh</option>
                  <option value="Kebocoran Minor">Kebocoran Minor (Tabung Ditukar)</option>
                  <option value="Keterlambatan">Keterlambatan Lalu Lintas</option>
                  <option value="Masalah Lainnya">Masalah Lainnya</option>
                </select>
              </div>

              <div className="field-row">
                <div>
                  <label>Foto Sebelum Bongkar</label>
                  <input type="file" name="foto_sebelum" accept="image/*" required />
                </div>
                <div>
                  <label>Foto Proses Penyerahan</label>
                  <input type="file" name="foto_proses" accept="image/*" required />
                </div>
              </div>

              <div className="form-group mt-xs">
                <label>Foto Tabung Diterima Pangkalan</label>
                <input type="file" name="foto_sesudah" accept="image/*" required />
              </div>

              <div className="form-group">
                <label>Catatan Tambahan</label>
                <textarea name="catatan" rows="2" placeholder="Catatan kondisi serah terima..." />
              </div>

              <div className="form-actions-bar mt">
                <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                  <Icon name="check-circle" size={18} />
                  <span>{busy ? 'Menyimpan...' : 'Simpan & Selesaikan Pengiriman'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-selection-placeholder mt">
              <Icon name="map-pin" size={32} />
              <p>Pilih salah satu pangkalan di kolom sebelah kiri untuk mengonfirmasi serah terima tabung LPG.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Laporan Bahaya */}
      {hazardOpen && (
        <div className="modal-backdrop" onClick={() => setHazardOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Lapor Kendala / Bahaya Keselamatan (K3)</h2>
              <button className="btn btn-ghost sm" type="button" onClick={() => setHazardOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <form ref={hazardFormRef} onSubmit={submitHazard}>
              <div className="form-group">
                <label>Jenis Kejadian Bahaya</label>
                <select name="jenis_bahaya" required defaultValue="">
                  <option value="">-- Pilih Jenis Kejadian --</option>
                  <option value="Kebocoran LPG">Kebocoran Tabung / Gas LPG</option>
                  <option value="Kerusakan Kendaraan">Kerusakan Armada / Mesin / Rem</option>
                  <option value="Kecelakaan">Kecelakaan Lalu Lintas</option>
                  <option value="Bencana Alam">Kendala Jalan / Banjir / Longsor</option>
                  <option value="Masalah Lainnya">Masalah Operasional Lainnya</option>
                </select>
              </div>

              <div className="form-group">
                <label>Deskripsi Kronologi Kejadian</label>
                <textarea
                  name="deskripsi"
                  rows="4"
                  placeholder="Jelaskan secara detail kejadian dan kondisi saat ini..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Foto Bukti Kejadian</label>
                <input type="file" name="foto_bukti" accept="image/*" required />
              </div>

              <input type="hidden" name="latitude" value="-8.17" />
              <input type="hidden" name="longitude" value="113.70" />

              <div className="form-actions-bar mt">
                <button className="btn btn-bad btn-block" type="submit" disabled={busy}>
                  <Icon name="send" size={16} />
                  <span>{busy ? 'Mengirim...' : 'Kirim Laporan Darurat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
