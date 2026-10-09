import { Link } from 'react-router-dom';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { fmtWaktu } from '../../utils';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverInspectionStatus() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(`/driver/${user.id}/summary`, { interval: 5000 });

  if (loading && !data) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memeriksa status inspeksi kendaraan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Status</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Muat Ulang
        </button>
      </div>
    );
  }

  const ins = data.inspection;
  const progress = data.progress;

  return (
    <div className="status-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
          <h1>Status Validasi Inspeksi Kendaraan</h1>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Laporan Pra-Keberangkatan
          </p>
        </div>
        <div>
          <button type="button" className="btn btn-sm btn-outline" onClick={reload}>
            <Icon name="refresh" size={14} /> Refresh Data
          </button>
        </div>
      </div>

      {ins ? (
        <div className="card max-w-720">
          <div className="status-display-header">
            <div className="status-indicator-box">
              <span
                className={`status-chip ${
                  ins.status_validasi === 'AMAN'
                    ? 'chip-ok'
                    : ins.status_validasi === 'TIDAK_AMAN'
                    ? 'chip-bad'
                    : 'chip-warn'
                }`}
              >
                {ins.status_validasi === 'AMAN' ? (
                  <>
                    <Icon name="check-circle" size={18} />
                    <span>DISETUJUI &mdash; KENDARAAN AMAN</span>
                  </>
                ) : ins.status_validasi === 'TIDAK_AMAN' ? (
                  <>
                    <Icon name="alert" size={18} />
                    <span>DITOLAK &mdash; PERLU PERBAIKAN TEKNIS</span>
                  </>
                ) : (
                  <>
                    <Icon name="clock" size={18} />
                    <span>SEDANG DITINJAU OLEH MANAGER</span>
                  </>
                )}
              </span>
            </div>

            <div className="meta-list mt">
              <div className="meta-item">
                <span className="meta-label">Waktu Pengajuan:</span>
                <span className="meta-val">{fmtWaktu(ins.created_at)} WIB</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Item Lolos:</span>
                <span className="meta-val font-bold">
                  {progress ? `${progress.lolos} dari ${progress.total} item checklist` : '-'}
                </span>
              </div>
              {ins.validasi_oleh && (
                <div className="meta-item">
                  <span className="meta-label">Divalidasi Oleh:</span>
                  <span className="meta-val">{ins.validasi_oleh} ({fmtWaktu(ins.validasi_waktu)} WIB)</span>
                </div>
              )}
            </div>
          </div>

          {ins.catatan && (
            <div className="audit-note-box mt">
              <strong>Catatan / Feedback Manager:</strong>
              <div className="note-body">{ins.catatan}</div>
            </div>
          )}

          <div className="form-actions-bar mt-lg">
            {ins.status_validasi !== 'AMAN' && (
              <Link className="btn btn-primary" to="/sopir/inspeksi-form">
                <Icon name="edit" size={16} /> Isi / Ajukan Ulang Inspeksi
              </Link>
            )}
            <BackButton fallback="/sopir" label="Kembali ke Dashboard" />
          </div>
        </div>
      ) : (
        <div className="card max-w-720">
          <div className="banner info">
            <div className="banner-title">
              <Icon name="info" size={18} />
              <span>Inspeksi Belum Dilakukan Hari Ini</span>
            </div>
            <p>
              Anda belum mengisi formulir inspeksi kendaraan untuk hari ini.
              Sebelum berangkat mengangkut tabung LPG, Anda wajib melakukan inspeksi kelayakan fisik armada.
            </p>
          </div>
          <div className="form-actions-bar mt">
            <Link className="btn btn-primary" to="/sopir/inspeksi-form">
              <Icon name="clipboard" size={16} /> Mulai Isi Inspeksi Pagi Sekarang
            </Link>
            <BackButton fallback="/sopir" label="Kembali" />
          </div>
        </div>
      )}
    </div>
  );
}
