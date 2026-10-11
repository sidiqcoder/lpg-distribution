import { useRef, useState } from 'react';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { apiForm, uploadUrl } from '../../api';
import { notifyDataChanged } from '../../events';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';
import { fmtSubmit } from '../../utils';

export default function DriverCertificate() {
  const { user } = useAuth();
  const { data, error: loadError, reload } = useApi(`/driver/${user.id}/profile`);
  const formRef = useRef(null);
  const submittingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || busy) return;

    submittingRef.current = true;
    setBusy(true);
    setError('');
    setInfo('');

    try {
      const fd = new FormData(formRef.current);
      await apiForm(`/driver/${user.id}/certificate`, fd);
      formRef.current.reset();
      notifyDataChanged({ type: 'certificate', driverId: user.id });
      setInfo('File sertifikat K3 berhasil diunggah.');
      await reload();
    } catch (err) {
      setError(err.message || 'Gagal mengunggah berkas sertifikat.');
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  if (!data) {
    if (loadError) return <div className="banner bad" role="alert">{loadError.message}<button className="btn btn-outline" onClick={reload}>Coba Lagi</button></div>;
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat data sertifikat...</p>
      </div>
    );
  }

  const s = data.sopir;

  return (
    <div className="form-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
          <h1>Sertifikat Keterampilan &amp; K3 Pengemudi</h1>
          <p className="subtitle">
            Sopir: <strong>{s.nama}</strong> &middot; Dokumen Kualifikasi Resmi
          </p>
        </div>
      </div>

      {info && (
        <div className="banner ok mb">
          <div className="banner-title">
            <Icon name="check-circle" size={18} />
            <span>Berhasil Disimpan</span>
          </div>
          <p>{info}</p>
        </div>
      )}

      {error && (
        <div className="banner bad mb">
          <div className="banner-title">
            <Icon name="alert" size={18} />
            <span>Gagal Mengunggah</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      <div className="card max-w-640">
        <p className="muted">Jam submit sertifikat: {fmtSubmit(s.sertifikat_submitted_at)}</p>
        <div className="cert-status-header">
          <div>
            <span className="muted block text-sm">Masa Berlaku K3:</span>
            <strong>{s.k3_expiry || 'Belum Diatur'}</strong>
          </div>
          <div>
            <span className="muted block text-sm">Status Dokumen:</span>
            <span className={`badge ${s.sertifikat_k3 ? 'badge-ok' : 'badge-warn'}`}>
              {s.sertifikat_k3 ? 'Terlampir' : 'Belum Ada'}
            </span>
          </div>
        </div>

        {s.sertifikat_k3 && (
          <div className="cert-preview-wrapper mt">
            <div className="preview-label">Pratinjau Sertifikat Saat Ini:</div>
            <a href={uploadUrl(s.sertifikat_k3)} target="_blank" rel="noreferrer">
              <img
                src={uploadUrl(s.sertifikat_k3)}
                alt="Sertifikat K3"
                className="cert-img-fluid"
              />
            </a>
          </div>
        )}

        <form ref={formRef} onSubmit={submit} className="mt">
          <div className="form-group">
            <label htmlFor="sertifikat_k3">Pilih File Foto / Scan Sertifikat K3</label>
            <input
              type="file"
              id="sertifikat_k3"
              name="sertifikat_k3"
              accept="image/*"
              required
            />
            <span className="field-hint">Format gambar yang didukung: JPG, PNG. Ukuran maksimal 10MB.</span>
          </div>

          <div className="form-actions-bar mt">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              <Icon name="save" size={16} />
              <span>{busy ? 'Mengunggah...' : 'Simpan Berkas Sertifikat'}</span>
            </button>
            <BackButton fallback="/sopir" label="Kembali" />
          </div>
        </form>
      </div>
    </div>
  );
}
