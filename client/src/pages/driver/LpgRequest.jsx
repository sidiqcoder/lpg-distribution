import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { apiJson } from '../../api';
import { notifyDataChanged } from '../../events';
import { badgeForLpg } from '../../utils';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverLpgRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const { data, error: loadError, reload } = useApi(`/driver/${user.id}/summary`, { interval: 5000 });
  const { data: kendaraanData, error: vehicleError, reload: reloadVehicles } = useApi('/kendaraan');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ kendaraan_id: '', jumlah_diminta: '', catatan: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const lpg = data?.lpg;
  const stok = data?.stok;
  const maxTabung = data?.maxTabung || 543;

  useEffect(() => {
    if (!lpg) setShowForm(true);
  }, [lpg]);

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || busy) return;

    submittingRef.current = true;
    setBusy(true);
    setError('');
    setInfo('');

    try {
      await apiJson('/driver/lpg', {
        sopir_id: user.id,
        kendaraan_id: Number(form.kendaraan_id),
        jumlah_diminta: Number(form.jumlah_diminta),
        catatan: form.catatan
      });
      notifyDataChanged({ type: 'lpg', driverId: user.id });
      setInfo('Pengajuan kuota tabung LPG berhasil dikirim dan menunggu validasi manager.');
      setShowForm(false);
      setForm({ kendaraan_id: '', jumlah_diminta: '', catatan: '' });
      await reload();
      setTimeout(() => {
        navigate('/sopir/status-lpg', { replace: true });
      }, 700);
    } catch (err) {
      setError(err.message || 'Gagal mengirim pengajuan.');
      setBusy(false);
      submittingRef.current = false;
    }
  };

  if (!data || !kendaraanData) {
    if (loadError || vehicleError) return <div className="banner bad" role="alert">{(loadError || vehicleError).message}<button className="btn btn-outline" onClick={() => { reload(); reloadVehicles(); }}>Coba Lagi</button></div>;
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat status persediaan LPG...</p>
      </div>
    );
  }

  const kendaraan = kendaraanData?.kendaraan || [];

  return (
    <div className="form-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir/menu" label="Kembali ke Menu Operasional" />
          </div>
          <h1>Pengajuan Pengambilan Tabung LPG</h1>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Depo Distribusi Resmi
          </p>
        </div>
      </div>

      {info && (
        <div className="banner ok mb">
          <div className="banner-title">
            <Icon name="check-circle" size={18} />
            <span>Pengajuan Terkirim</span>
          </div>
          <p>{info}</p>
        </div>
      )}

      {error && (
        <div className="banner bad mb">
          <div className="banner-title">
            <Icon name="alert" size={18} />
            <span>Gagal Mengajukan Permintaan</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      <div className="card max-w-640">
        <div className="stock-info-banner">
          <div className="stock-info-icon">
            <Icon name="cylinder" size={28} />
          </div>
          <div>
            <div className="stock-info-label">Sisa Stok Persediaan Gudang Depo</div>
            <div className="stock-info-value">{stok ?? '-'} Tabung</div>
            <small className="muted">Setiap pengisian tabung wajib disetujui oleh Manager Operasional</small>
          </div>
        </div>

        {lpg && !showForm ? (
          <div className="existing-request-box mt">
            <div className="box-title">Status Pengajuan Hari Ini</div>
            <div className="request-details-row">
              <div>
                <span className="muted block">Jumlah Diajukan</span>
                <strong className="fs-lg">{lpg.jumlah_diminta} Tabung</strong>
              </div>
              <div>
                <span className="muted block">Status Verifikasi</span>
                <span className={`badge ${badgeForLpg(lpg.status).cls}`}>
                  {badgeForLpg(lpg.status).label}
                </span>
              </div>
            </div>
            {lpg.catatan && (
              <p className="mt-sm text-sm">
                <strong>Catatan Sopir:</strong> {lpg.catatan}
              </p>
            )}

            <div className="form-actions-bar mt">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setShowForm(true)}
              >
                <Icon name="edit" size={16} />
                <span>Ajukan Perubahan / Kuota Ulang</span>
              </button>
              <BackButton fallback="/sopir/menu" label="Kembali" />
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt">
            <div className="form-group">
              <label htmlFor="kendaraan_id">Truk Engkel Bertugas</label>
              <select
                id="kendaraan_id"
                value={form.kendaraan_id}
                onChange={(e) => setForm({ ...form, kendaraan_id: e.target.value })}
                required
              >
                <option value="">-- Pilih Truk Engkel --</option>
                {kendaraan.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.plat_nomor} &mdash; Kapasitas Maks: {k.kapasitas_ton} Tabung
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="jumlah_diminta">Jumlah Tabung LPG Yang Diambil</label>
              <div className="input-with-affix">
                <input
                  id="jumlah_diminta"
                  type="number"
                  min="1"
                  max={maxTabung}
                  value={form.jumlah_diminta}
                  onChange={(e) => setForm({ ...form, jumlah_diminta: e.target.value })}
                  placeholder="Contoh: 540"
                  required
                />
                <span className="input-affix">Tabung</span>
              </div>
              <span className="field-hint">Kapasitas maksimal pengangkutan armada adalah {maxTabung} tabung.</span>
            </div>

            <div className="form-group">
              <label htmlFor="catatan">Catatan / Alasan Permintaan (Opsional)</label>
              <input
                id="catatan"
                type="text"
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                placeholder="Contoh: Pengambilan kuota rute pagi zona A"
              />
            </div>

            <div className="form-actions-bar mt">
              <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
                <Icon name="send" size={18} />
                <span>{busy ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan LPG'}</span>
              </button>
              <BackButton fallback="/sopir/menu" label="Batal" />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
