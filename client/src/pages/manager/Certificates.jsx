import RefreshNotice from '../../components/RefreshNotice';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../../hooks';
import { uploadUrl } from '../../api';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';
import { fmtSubmit } from '../../utils';

export default function ManagerCertificates() {
  const { date } = useOutletContext();
  const { data, loading, error, reload } = useApi('/manager/summary', { params: { date }, interval: 15000 });

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat arsip sertifikat K3 pengemudi...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Sertifikat</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="certificates-page-layout">
      <RefreshNotice error={error} />
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/manager" label="Kembali ke Ringkasan" />
          </div>
          <h1>Arsip Sertifikat Keterampilan &amp; K3 Sopir</h1>
          <p className="subtitle">
            Kepatuhan Sertifikasi Keselamatan Kerja Pengangkut Bahan Berbahaya dan Gas Bertekanan
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-outline" onClick={reload}>
            <Icon name="refresh" size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="stat-grid mt">
        {data.semuaSopir.map((s) => (
          <div className="card cert-card-item" key={s.id}>
            <div className="cert-card-header">
              <div className="user-icon-badge">
                <Icon name="user" size={18} />
              </div>
              <div>
                <strong>{s.nama}</strong>
                <small className="muted block">ID: #DRV-00{s.id}</small>
              </div>
            </div>

            <div className="cert-meta-info mt-sm">
              <div className="meta-row"><span className="muted">Jam Submit:</span><span>{fmtSubmit(s.sertifikat_submitted_at)}</span></div>
              <div className="meta-row">
                <span className="muted">Masa Berlaku K3:</span>
                <strong>{s.k3_expiry || 'Belum Diatur'}</strong>
              </div>
              <div className="meta-row">
                <span className="muted">SIM BII Umum:</span>
                <span>{s.lisensi_expiry || 'Belum Diatur'}</span>
              </div>
            </div>

            <div className="cert-preview-frame mt">
              {s.sertifikat_k3 ? (
                <a
                  href={uploadUrl(s.sertifikat_k3)}
                  target="_blank"
                  rel="noreferrer"
                  className="cert-img-link"
                >
                  <img
                    src={uploadUrl(s.sertifikat_k3)}
                    alt={`Sertifikat K3 ${s.nama}`}
                    className="cert-thumbnail"
                  />
                  <span className="zoom-label">
                    <Icon name="eye" size={14} /> Perbesar Berkas
                  </span>
                </a>
              ) : (
                <div className="empty-cert-box">
                  <Icon name="shield" size={28} />
                  <span>Sopir belum melampirkan berkas sertifikat K3</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
