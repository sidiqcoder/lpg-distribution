import RefreshNotice from '../../components/RefreshNotice';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { todayWITA } from '../../utils';
import Icon from '../../components/Icon';

export default function DriverOverview() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(`/driver/${user.id}/summary`, { interval: 5000 });

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat ringkasan armada sopir...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Ringkasan</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  const { sopir, inspection, lpg, siapBerangkat, progress, maxTabung } = data;

  const inspStatus = !inspection ? 'BELUM' : inspection.status_validasi;
  const inspLabel = !inspection
    ? 'Belum Diajukan'
    : inspection.status_validasi === 'AMAN'
    ? 'Disetujui (Aman)'
    : inspection.status_validasi === 'TIDAK_AMAN'
    ? 'Perlu Perbaikan'
    : 'Menunggu Review Manager';

  const inspBadgeClass = !inspection
    ? 'badge-muted'
    : inspection.status_validasi === 'AMAN'
    ? 'badge-ok'
    : inspection.status_validasi === 'TIDAK_AMAN'
    ? 'badge-bad'
    : 'badge-warn';

  const lpgStatus = !lpg ? 'BELUM' : lpg.status;
  const lpgLabel = !lpg
    ? 'Belum Diajukan'
    : lpg.status === 'DISETUJUI'
    ? `Disetujui (${lpg.jumlah_diminta} Tabung)`
    : lpg.status === 'DITOLAK'
    ? 'Ditolak Manager'
    : `Menunggu (${lpg.jumlah_diminta} Tabung)`;

  const lpgBadgeClass = !lpg
    ? 'badge-muted'
    : lpg.status === 'DISETUJUI'
    ? 'badge-ok'
    : lpg.status === 'DITOLAK'
    ? 'badge-bad'
    : 'badge-warn';

  const insPercent = progress ? Math.round((progress.lolos / Math.max(progress.total, 1)) * 100) : 0;
  const lpgPercent = lpg ? Math.min(100, Math.round((Number(lpg.jumlah_diminta) / maxTabung) * 100)) : 0;

  return (
    <div className="dashboard-content">
      <RefreshNotice error={error} />
      <div className="page-head">
        <div>
          <h1>Ringkasan Operasional Hari Ini</h1>
          <p className="subtitle">
            Sopir: <strong>{sopir.nama}</strong> &middot; Tanggal: {todayWITA()}
          </p>
        </div>
        <div className="head-badge-wrapper">
          <span className={`status-pill ${siapBerangkat ? 'pill-ready' : 'pill-pending'}`}>
            <span className="dot" />
            <span>{siapBerangkat ? 'SIAP BERANGKAT & ON-DUTY' : 'MENUNGGU VERIFIKASI OPERASIONAL'}</span>
          </span>
        </div>
      </div>

      {/* Operational Flow Tracker */}
      <div className="workflow-steps-card card mb">
        <div className="workflow-title">
          <Icon name="activity" size={18} />
          <span>Alur Kesiapan Distribusi LPG Harian</span>
        </div>
        <div className="steps-container">
          <div className={`step-item ${inspection?.status_validasi === 'AMAN' ? 'done' : inspection ? 'active' : ''}`}>
            <div className="step-circle">1</div>
            <div className="step-content">
              <strong>Inspeksi Pagi Kendaraan</strong>
              <small>{inspLabel}</small>
            </div>
          </div>
          <div className="step-arrow">&rarr;</div>
          <div className={`step-item ${lpg?.status === 'DISETUJUI' ? 'done' : lpg ? 'active' : ''}`}>
            <div className="step-circle">2</div>
            <div className="step-content">
              <strong>Persetujuan Kuota LPG</strong>
              <small>{lpgLabel}</small>
            </div>
          </div>
          <div className="step-arrow">&rarr;</div>
          <div className={`step-item ${siapBerangkat ? 'done' : ''}`}>
            <div className="step-circle">3</div>
            <div className="step-content">
              <strong>Izin On-Duty Pengiriman</strong>
              <small>{siapBerangkat ? 'Diizinkan Berangkat' : 'Menunggu Langkah 1 & 2'}</small>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Stat Cards */}
      <div className="stat-grid">
        <Link className="stat-card clickable" to="/sopir/status-inspeksi">
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-blue">
              <Icon name="clipboard" size={20} />
            </span>
            <span className={`badge ${inspBadgeClass}`}>{inspStatus}</span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Inspeksi Kendaraan</span>
            <div className="stat-value-text">{inspLabel}</div>
            <div className="stat-footer-link">
              <span>Lihat Detail Status</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>

        <Link className="stat-card clickable" to="/sopir/status-lpg">
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-orange">
              <Icon name="cylinder" size={20} />
            </span>
            <span className={`badge ${lpgBadgeClass}`}>{lpgStatus}</span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Pengambilan Tabung LPG</span>
            <div className="stat-value-text">{lpgLabel}</div>
            <div className="stat-footer-link">
              <span>Lihat Detail Kuota</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>

        <Link
          className={`stat-card clickable ${!siapBerangkat ? 'card-disabled' : ''}`}
          to={siapBerangkat ? '/sopir/on-duty' : '/sopir/menu'}
        >
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-green">
              <Icon name="truck" size={20} />
            </span>
            <span className={`badge ${siapBerangkat ? 'badge-ok' : 'badge-warn'}`}>
              {siapBerangkat ? 'BERANGKAT' : 'MENUNGGU'}
            </span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Status Distribusi On-Duty</span>
            <div className="stat-value-text">{siapBerangkat ? 'Siap Berangkat' : 'Belum Diizinkan'}</div>
            <div className="stat-footer-link">
              <span>{siapBerangkat ? 'Buka Pengiriman Sekarang' : 'Selesaikan Verifikasi'}</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>

        <Link className="stat-card clickable" to="/sopir/rute-map">
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-purple">
              <Icon name="map-pin" size={20} />
            </span>
            <span className="badge badge-info">PETA AKTIF</span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Rute Pangkalan</span>
            <div className="stat-value-text">Rute Harian Sopir</div>
            <div className="stat-footer-link">
              <span>Lihat Peta Rute</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>
      </div>

      {/* Progress & Quick Actions */}
      <div className="grid cols-2 mt">
        <div className="card">
          <div className="card-header-styled">
            <Icon name="chart" size={18} />
            <h3>Progres Verifikasi Harian</h3>
          </div>
          <div className="bar-row">
            <span>Checklist Lolos K3</span>
            <div className="bar-track">
              <div className="bar-fill fill-brand" style={{ width: `${insPercent}%` }} />
            </div>
            <strong>{progress ? `${progress.lolos}/${progress.total}` : '0/72'} Item</strong>
          </div>
          <div className="bar-row">
            <span>Kuota Muat Tabung</span>
            <div className="bar-track">
              <div className="bar-fill fill-green" style={{ width: `${lpgPercent}%` }} />
            </div>
            <strong>{lpg ? lpg.jumlah_diminta : 0}/{maxTabung} Tabung</strong>
          </div>
        </div>

        <div className="card">
          <div className="card-header-styled">
            <Icon name="layers" size={18} />
            <h3>Pintasan Menu Cepat</h3>
          </div>
          <div className="quick-action-btns">
            {!inspection && (
              <Link className="btn btn-primary btn-block" to="/sopir/inspeksi-form">
                <Icon name="clipboard" size={16} /> Isi Formulir Inspeksi Pagi
              </Link>
            )}
            {!lpg && (
              <Link className="btn btn-outline btn-block" to="/sopir/permintaan-lpg">
                <Icon name="cylinder" size={16} /> Ajukan Kuota Ambil LPG
              </Link>
            )}
            {siapBerangkat && (
              <Link className="btn btn-success btn-block" to="/sopir/on-duty">
                <Icon name="truck" size={16} /> Buka Layar On-Duty Pengiriman
              </Link>
            )}
            <Link className="btn btn-ghost btn-block" to="/sopir/menu">
              <Icon name="layers" size={16} /> Buka Menu Operasional Lengkap
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
