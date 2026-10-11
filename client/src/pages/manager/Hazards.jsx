import RefreshNotice from '../../components/RefreshNotice';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../../hooks';
import { uploadUrl, fmtSubmit } from '../../utils';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function ManagerHazards() {
  const { date } = useOutletContext();
  const { data, loading, error, reload } = useApi('/manager/summary', { params: { date }, interval: 8000 });

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat laporan bahaya dan kendala lapangan...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Laporan Bahaya</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  const reports = data.laporanBahaya || [];

  return (
    <div className="hazards-page-layout">
      <RefreshNotice error={error} />
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/manager" label="Kembali ke Ringkasan" />
          </div>
          <h1>Laporan Bahaya &amp; Insiden Keselamatan (K3)</h1>
          <p className="subtitle">
            Notifikasi Darurat &amp; Kendala Lapangan Pengemudi Distribusi LPG &middot; Tanggal: <strong>{date}</strong>
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-outline" onClick={reload}>
            <Icon name="refresh" size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-header-flex">
          <div className="flex-row items-center gap-sm">
            <Icon name="alert" size={20} />
            <h2>Daftar Insiden Terlaporkan</h2>
          </div>
          <span className="muted text-sm">{reports.length} Kejadian Tercatat</span>
        </div>

        <div className="table-wrap mt">
          <table className="data table-hover">
            <thead>
              <tr>
                <th>ID</th>
                <th>Sopir Pelapor</th>
                <th>Jenis Bahaya</th>
                <th>Deskripsi Kejadian</th>
                <th>Koordinat GPS</th>
                <th>Foto Bukti</th>
                <th>Status Penanganan</th>
                <th>Jam Submit (WITA)</th>
              </tr>
            </thead>
            <tbody>
              {reports.length > 0 ? (
                reports.map((b) => (
                  <tr key={b.id}>
                    <td><span className="id-badge">#{b.id}</span></td>
                    <td><strong>{b.sopir_nama}</strong></td>
                    <td><span className="badge badge-bad">{b.jenis_bahaya || '-'}</span></td>
                    <td><p className="text-sm mb-0">{b.deskripsi || '-'}</p></td>
                    <td>
                      <small className="muted font-mono">
                        {Number(b.latitude || 0).toFixed(4)}, {Number(b.longitude || 0).toFixed(4)}
                      </small>
                    </td>
                    <td>
                      {b.foto_bukti ? (
                        <a href={uploadUrl(b.foto_bukti)} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline">
                          <Icon name="eye" size={12} /> Lihat Foto
                        </a>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${b.status === 'RESOLVED' ? 'badge-ok' : 'badge-warn'}`}>
                        {b.status === 'RESOLVED' ? 'Selesai Ditangani' : 'Dalam Penanganan'}
                      </span>
                    </td>
                    <td>{fmtSubmit(b.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-state-cell">
                    <Icon name="shield" size={32} />
                    <p>Nihil kejadian bahaya. Seluruh armada beroperasi dalam kondisi aman.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
