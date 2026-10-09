import { Link } from 'react-router-dom';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { uploadUrl } from '../../api';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverProfile() {
  const { user } = useAuth();
  const { data, loading, error } = useApi(`/driver/${user.id}/profile`);

  if (loading && !data) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat profil pengemudi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Profil</span>
        </div>
        <p>{error.message}</p>
      </div>
    );
  }

  const s = data.sopir;

  return (
    <div className="profile-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
          <h1>Profil Pengemudi Armada</h1>
          <p className="subtitle">
            Informasi Kepegawaian &amp; Masa Berlaku Dokumen Lisensi Berkendara
          </p>
        </div>
      </div>

      <div className="card max-w-720">
        <div className="profile-grid">
          <div className="profile-details">
            <div className="profile-item">
              <span className="profile-label">Nama Lengkap:</span>
              <strong className="profile-value fs-lg">{s.nama}</strong>
            </div>
            <div className="profile-item">
              <span className="profile-label">Nomor ID Sopir:</span>
              <span className="profile-value">#DRV-00{s.id}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Username Akun:</span>
              <span className="profile-value">{s.username}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Nomor Telepon / WhatsApp:</span>
              <span className="profile-value">{s.nomor_hp || '-'}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Masa Berlaku SIM BII Umum:</span>
              <span className="profile-value">{s.lisensi_expiry || '-'}</span>
            </div>
            <div className="profile-item">
              <span className="profile-label">Masa Berlaku Sertifikat K3:</span>
              <span className="profile-value">{s.k3_expiry || '-'}</span>
            </div>
          </div>

          <div className="profile-cert-box">
            <span className="cert-box-title">Dokumen Sertifikat K3</span>
            {s.sertifikat_k3 ? (
              <a href={uploadUrl(s.sertifikat_k3)} target="_blank" rel="noreferrer" className="cert-thumb-link">
                <img
                  src={uploadUrl(s.sertifikat_k3)}
                  alt="Sertifikat K3"
                  className="cert-thumb-img"
                />
                <span className="thumb-zoom-badge">
                  <Icon name="eye" size={14} /> Lihat Berkas
                </span>
              </a>
            ) : (
              <div className="empty-cert-placeholder">
                <Icon name="shield" size={32} />
                <span>Belum Ada Dokumen Terlampir</span>
              </div>
            )}
            <div className="mt-sm">
              <Link className="btn btn-outline btn-block btn-sm" to="/sopir/sertifikat">
                <Icon name="camera" size={14} /> {s.sertifikat_k3 ? 'Perbarui Sertifikat' : 'Unggah Sertifikat'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
