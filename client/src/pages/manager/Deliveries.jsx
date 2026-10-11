import RefreshNotice from '../../components/RefreshNotice';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../../hooks';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';
import { fmtSubmit } from '../../utils';

export default function ManagerDeliveries() {
  const { date } = useOutletContext();
  const { data, loading, error, reload } = useApi('/manager/summary', { params: { date }, interval: 8000 });

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat rekap data pengiriman...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Pengiriman</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  const deliveries = data.pengiriman || [];
  const totalTabung = deliveries.reduce((sum, p) => sum + (Number(p.jumlah_dikirim_kg) || 0), 0);

  return (
    <div className="deliveries-page-layout">
      <RefreshNotice error={error} />
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/manager" label="Kembali ke Ringkasan" />
          </div>
          <h1>Monitoring Realisasi Pengiriman LPG</h1>
          <p className="subtitle">
            Rekap Serah Terima Tabung LPG ke Pangkalan &middot; Tanggal: <strong>{date}</strong>
          </p>
        </div>
        <div className="head-actions">
          <div className="metric-pill">
            <span className="metric-label">Total Tabung Terkirim:</span>
            <strong>{totalTabung} Tabung</strong>
          </div>
          <button type="button" className="btn btn-outline" onClick={reload}>
            <Icon name="refresh" size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-header-flex">
          <div className="flex-row items-center gap-sm">
            <Icon name="package" size={20} />
            <h2>Log Ritase Serah Terima Tabung</h2>
          </div>
          <span className="muted text-sm">{deliveries.length} Transaksi Tercatat</span>
        </div>

        <div className="table-wrap mt">
          <table className="data table-hover">
            <thead>
              <tr>
                <th>ID</th>
                <th>Sopir Armada</th>
                <th>Pangkalan Tujuan</th>
                <th>Jumlah Muatan</th>
                <th>Penanggung Jawab Pangkalan</th>
                <th>Kondisi Tabung</th>
                <th>Jam Submit (WITA)</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length > 0 ? (
                deliveries.map((p) => (
                  <tr key={p.id}>
                    <td><span className="id-badge">#{p.id}</span></td>
                    <td><strong>{p.sopir_nama}</strong></td>
                    <td><strong className="text-brand">{p.pangkalan_nama || '-'}</strong></td>
                    <td><strong className="fs-md">{p.jumlah_dikirim_kg || 0} Tabung</strong></td>
                    <td>
                      <div>{p.penerima_nama || '-'}</div>
                      <small className="muted">{p.penerima_hp || '-'}</small>
                    </td>
                    <td>
                      <span className={`badge ${p.kondisi_pengiriman === 'OK' ? 'badge-ok' : 'badge-warn'}`}>
                        {p.kondisi_pengiriman || '-'}
                      </span>
                    </td>
                    <td>{fmtSubmit(p.created_at)}</td>
                    <td>{p.catatan || <span className="muted">-</span>}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-state-cell">
                    <Icon name="package" size={32} />
                    <p>Belum ada ritase pengiriman yang diselesaikan pada tanggal ini.</p>
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
