import { Link, useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import { useApi } from '../../hooks';
import { downloadExport } from '../../api';
import { todayWITA } from '../../utils';
import Icon from '../../components/Icon';
import ActivityReports from '../../components/ActivityReports';

export default function ManagerOverview() {
  const { date, setDate } = useOutletContext();
  const { data, loading, error, reload } = useApi('/manager/summary', { params: { date }, interval: 6000 });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportReport = async () => {
    setExporting(true); setExportError('');
    try { await downloadExport(date); } catch (error) { setExportError(error.message); }
    finally { setExporting(false); }
  };

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat ringkasan operasional harian...</p>
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
          <Icon name="refresh" size={14} /> Muat Ulang
        </button>
      </div>
    );
  }

  const s = data.stats;
  const pendingInspections = data.inspeksi.filter((i) => i.status_validasi === 'MENUNGGU');
  const pendingLpg = data.permintaanLpg.filter((r) => r.status === 'MENUNGGU');

  return (
    <div className="manager-overview-layout">
      {/* Top Header Bar */}
      <div className="page-head">
        <div>
          <h1>Ringkasan Operasional Logistik</h1>
          <p className="subtitle">
            Laporan Distribusi LPG PT Macan Gading &middot; Tanggal: <strong>{date}</strong>
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn btn-primary" to="/manager/kpi">
            <Icon name="chart" size={16} />
            <span>Evaluasi KPI Sopir</span>
          </Link>
          <button type="button" className="btn btn-outline" onClick={exportReport} disabled={exporting}>
            <Icon name="download" size={16} />
            <span>{exporting ? 'Menyiapkan Laporan...' : 'Unduh Laporan Excel'}</span>
          </button>
        </div>
      </div>

      {exportError && <div className="banner bad mb" role="alert">{exportError}</div>}
      {error && data && <div className="banner warn mb" role="alert">Pembaruan gagal. Menampilkan data terakhir. {error.message}</div>}
      {/* Date Filter Strip */}
      <div className="card filter-card mb">
        <div className="filter-inner-row">
          <div className="date-input-wrap">
            <label htmlFor="dateFilter">
              <Icon name="calendar" size={15} />
              <span>Tanggal Pemantauan:</span>
            </label>
            <input
              id="dateFilter"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="quick-date-buttons">
            <button
              type="button"
              className={`btn btn-sm ${date === todayWITA() ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDate(todayWITA())}
            >
              Hari Ini
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={reload}
              title="Sinkronisasi data langsung"
            >
              <Icon name="refresh" size={14} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pending Action Alerts */}
      {(pendingInspections.length > 0 || pendingLpg.length > 0) && (
        <div className="grid cols-2 mb">
          {pendingInspections.length > 0 && (
            <div className="banner warn">
              <div className="banner-title">
                <Icon name="clock" size={18} />
                <span>{pendingInspections.length} Inspeksi Pagi Menunggu Review</span>
              </div>
              <p>Ada armada yang menunggu validasi kelayakan kendaraan sebelum keberangkatan.</p>
              <div className="mt-sm">
                <Link className="btn btn-sm btn-primary" to="/manager/inspeksi">
                  Tinjau Inspeksi Sekarang &rarr;
                </Link>
              </div>
            </div>
          )}
          {pendingLpg.length > 0 && (
            <div className="banner info">
              <div className="banner-title">
                <Icon name="cylinder" size={18} />
                <span>{pendingLpg.length} Permintaan Ambil LPG Menunggu Persetujuan</span>
              </div>
              <p>Sopir mengajukan kuota muat tabung LPG yang membutuhkan otorisasi Manager.</p>
              <div className="mt-sm">
                <Link className="btn btn-sm btn-primary" to="/manager/stok">
                  Kelola Persediaan &amp; Setujui &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Key Performance Metric Cards */}
      <div className="stat-grid">
        <Link className="stat-card clickable" to="/manager/inspeksi">
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-green">
              <Icon name="check-circle" size={20} />
            </span>
            <span className="badge badge-ok">Lolos K3</span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Inspeksi Kendaraan Lolos</span>
            <div className="stat-value-text">{s.inspeksiLolos} Armada</div>
            <div className="stat-footer-link">
              <span>Buka Menu Inspeksi</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>

        <Link className="stat-card clickable" to="/manager/inspeksi">
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-red">
              <Icon name="x-circle" size={20} />
            </span>
            <span className="badge badge-bad">Perlu Perbaikan</span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Inspeksi Kendaraan Gagal</span>
            <div className="stat-value-text">{s.inspeksiGagal} Armada</div>
            <div className="stat-footer-link">
              <span>Buka Laporan Kendala</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>

        <Link className="stat-card clickable" to="/manager/pengiriman">
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-blue">
              <Icon name="package" size={20} />
            </span>
            <span className="badge badge-info">Distribusi</span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Total Ritase Pengiriman</span>
            <div className="stat-value-text">{s.totalPengiriman} Pengiriman</div>
            <div className="stat-footer-link">
              <span>Lihat Detail Pengiriman</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>

        {/* Persediaan LPG Dedicated Menu Shortcut */}
        <Link className="stat-card clickable highlight-card" to="/manager/stok">
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-orange">
              <Icon name="cylinder" size={20} />
            </span>
            <span className="badge badge-brand">Gudang Depo</span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Sisa Persediaan Tabung LPG</span>
            <div className="stat-value-text text-brand">{data.persediaanLpg} Tabung</div>
            <div className="stat-footer-link">
              <span>Buka Menu Persediaan &amp; Permintaan LPG</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>

        <Link className="stat-card clickable" to="/manager/bahaya">
          <div className="stat-header">
            <span className="stat-icon-wrapper icon-red">
              <Icon name="alert" size={20} />
            </span>
            <span className={`badge ${data.laporanBahaya.length > 0 ? 'badge-bad' : 'badge-ok'}`}>
              {data.laporanBahaya.length > 0 ? 'Waspada' : 'Aman'}
            </span>
          </div>
          <div className="stat-body">
            <span className="stat-label">Laporan Bahaya / Insiden</span>
            <div className="stat-value-text">{data.laporanBahaya.length} Laporan</div>
            <div className="stat-footer-link">
              <span>Lihat Laporan K3</span>
              <Icon name="chevron-right" size={14} />
            </div>
          </div>
        </Link>
      </div>

      <ActivityReports date={date} compact />
      {/* Charts & Breakdown */}
      <div className="grid cols-2 mt">
        <div className="card">
          <div className="card-header-styled">
            <Icon name="clipboard" size={18} />
            <h3>Status Kelayakan Inspeksi Armada</h3>
          </div>
          <div className="bar-row">
            <span>Lolos Validasi</span>
            <div className="bar-track">
              <div
                className="bar-fill fill-green"
                style={{ width: `${Math.round((s.inspeksiLolos / Math.max(s.totalInspeksi, 1)) * 100)}%` }}
              />
            </div>
            <strong>{s.inspeksiLolos}</strong>
          </div>
          <div className="bar-row">
            <span>Ditolak / Gagal</span>
            <div className="bar-track">
              <div
                className="bar-fill fill-red"
                style={{ width: `${Math.round((s.inspeksiGagal / Math.max(s.totalInspeksi, 1)) * 100)}%` }}
              />
            </div>
            <strong>{s.inspeksiGagal}</strong>
          </div>
          <div className="bar-row">
            <span>Menunggu Review</span>
            <div className="bar-track">
              <div
                className="bar-fill fill-warn"
                style={{ width: `${Math.round((s.inspeksiMenunggu / Math.max(s.totalInspeksi, 1)) * 100)}%` }}
              />
            </div>
            <strong>{s.inspeksiMenunggu}</strong>
          </div>
        </div>

        <div className="card">
          <div className="card-header-styled">
            <Icon name="truck" size={18} />
            <h3>Distribusi LPG per Pengemudi</h3>
          </div>
          {data.semuaSopir.map((driver) => {
            const jml = data.pengiriman.filter((p) => p.sopir_id === driver.id).length;
            const pct = Math.round((jml / Math.max(s.maxPengirimanSopir, 1)) * 100);
            return (
              <div className="bar-row" key={driver.id}>
                <span>{driver.nama}</span>
                <div className="bar-track">
                  <div className="bar-fill fill-brand" style={{ width: `${pct}%` }} />
                </div>
                <strong>{jml} Rit</strong>
              </div>
            );
          })}
          <div className="summary-highlight mt-sm">
            <span>Total Muatan Terdistribusi Hari Ini:</span>
            <strong>{s.totalTabung} Tabung LPG</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
