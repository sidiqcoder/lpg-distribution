import RefreshNotice from '../../components/RefreshNotice';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { fmtSubmit, badgeForLpg } from '../../utils';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverLpgStatus() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(`/driver/${user.id}/summary`, { interval: 5000 });

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memeriksa status permohonan LPG...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Status LPG</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Muat Ulang
        </button>
      </div>
    );
  }

  const lpg = data.lpg;

  return (
    <div className="status-page-layout">
      <RefreshNotice error={error} />
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
          <h1>Status Pengajuan Kuota Tabung LPG</h1>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Depo Distribusi PT Macan Gading
          </p>
        </div>
        <div>
          <button type="button" className="btn btn-sm btn-outline" onClick={reload}>
            <Icon name="refresh" size={14} /> Refresh Data
          </button>
        </div>
      </div>

      {lpg ? (
        <div className="card max-w-720">
          <div className="status-display-header">
            <div className="status-indicator-box">
              <span
                className={`status-chip ${
                  lpg.status === 'DISETUJUI'
                    ? 'chip-ok'
                    : lpg.status === 'DITOLAK'
                    ? 'chip-bad'
                    : 'chip-warn'
                }`}
              >
                {lpg.status === 'DISETUJUI' ? (
                  <>
                    <Icon name="check-circle" size={18} />
                    <span>DISETUJUI OLEH MANAGER</span>
                  </>
                ) : lpg.status === 'DITOLAK' ? (
                  <>
                    <Icon name="alert" size={18} />
                    <span>PERMOHONAN DITOLAK MANAGER</span>
                  </>
                ) : (
                  <>
                    <Icon name="clock" size={18} />
                    <span>MENUNGGU PERSETUJUAN MANAGER</span>
                  </>
                )}
              </span>
            </div>

            <div className="meta-list mt">
              <div className="meta-item">
                <span className="meta-label">Jumlah Tabung Diajukan:</span>
                <span className="meta-val font-bold fs-lg">{lpg.jumlah_diminta} Tabung Gas LPG</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Waktu Pengajuan:</span>
                <span className="meta-val">{fmtSubmit(lpg.created_at)}</span>
              </div>
              {lpg.disetujui_oleh && (
                <div className="meta-item">
                  <span className="meta-label">Disetujui Oleh:</span>
                  <span className="meta-val">{lpg.disetujui_oleh} ({fmtSubmit(lpg.waktu_disetujui)})</span>
                </div>
              )}
            </div>
          </div>

          {lpg.catatan && (
            <div className="audit-note-box mt">
              <strong>Catatan Pengajuan:</strong>
              <div className="note-body">{lpg.catatan}</div>
            </div>
          )}

          <div className="form-actions-bar mt-lg">
            {lpg.status !== 'DISETUJUI' && (
              <Link className="btn btn-primary" to="/sopir/permintaan-lpg">
                <Icon name="edit" size={16} /> Ajukan Ulang Kuota
              </Link>
            )}
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
        </div>
      ) : (
        <div className="card max-w-720">
          <div className="banner info">
            <div className="banner-title">
              <Icon name="cylinder" size={18} />
              <span>Belum Ada Permintaan LPG Hari Ini</span>
            </div>
            <p>
              Anda belum mengajukan jumlah tabung gas LPG yang akan diambil dari gudang depo.
              Silakan ajukan permohonan kuota tabung untuk diverifikasi oleh Manager.
            </p>
          </div>
          <div className="form-actions-bar mt">
            <Link className="btn btn-primary" to="/sopir/permintaan-lpg">
              <Icon name="cylinder" size={16} /> Ajukan Pengambilan LPG Sekarang
            </Link>
            <BackButton fallback="/sopir" label="Kembali" />
          </div>
        </div>
      )}
    </div>
  );
}
