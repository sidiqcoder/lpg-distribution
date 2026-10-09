import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useApi } from '../../hooks';
import { badgeForStatusValidasi, fmtWaktu } from '../../utils';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function ManagerInspections() {
  const { date } = useOutletContext();
  const { data, loading, error, reload } = useApi('/manager/summary', { params: { date }, interval: 6000 });
  const [filter, setFilter] = useState('ALL');

  if (loading && !data) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat laporan inspeksi kendaraan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Laporan Inspeksi</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  const list = (data.inspeksi || []).filter((i) => {
    if (filter === 'ALL') return true;
    return i.status_validasi === filter;
  });

  return (
    <div className="inspections-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/manager" label="Kembali ke Ringkasan" />
          </div>
          <h1>Laporan Inspeksi Pagi Armada</h1>
          <p className="subtitle">
            Pemeriksaan 72 Item Fisik &amp; K3 Kendaraan Pengangkut Gas LPG &middot; Tanggal: <strong>{date}</strong>
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-outline" onClick={reload}>
            <Icon name="refresh" size={14} />
            <span>Sinkronisasi</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-header-flex">
          <div className="flex-row items-center gap-sm">
            <Icon name="clipboard" size={20} />
            <h2>Daftar Formulir Inspeksi Sopir</h2>
          </div>

          <div className="filter-pill-group">
            <button
              type="button"
              className={`pill-btn ${filter === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              Semua ({data.inspeksi?.length || 0})
            </button>
            <button
              type="button"
              className={`pill-btn ${filter === 'MENUNGGU' ? 'active' : ''}`}
              onClick={() => setFilter('MENUNGGU')}
            >
              Menunggu Review
            </button>
            <button
              type="button"
              className={`pill-btn ${filter === 'AMAN' ? 'active' : ''}`}
              onClick={() => setFilter('AMAN')}
            >
              Lolos (Aman)
            </button>
            <button
              type="button"
              className={`pill-btn ${filter === 'TIDAK_AMAN' ? 'active' : ''}`}
              onClick={() => setFilter('TIDAK_AMAN')}
            >
              Perlu Perbaikan
            </button>
          </div>
        </div>

        <div className="table-wrap mt">
          <table className="data table-hover">
            <thead>
              <tr>
                <th>ID</th>
                <th>Sopir</th>
                <th>Nomor Polisi</th>
                <th>Status Validasi</th>
                <th>Item Lolos K3</th>
                <th>Waktu Pengajuan</th>
                <th>Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {list.length > 0 ? (
                list.map((i) => {
                  const b = badgeForStatusValidasi(i.status_validasi);
                  return (
                    <tr key={i.id}>
                      <td><span className="id-badge">#{i.id}</span></td>
                      <td><strong>{i.sopir_nama}</strong></td>
                      <td><span className="plat-badge">{i.plat_nomor}</span></td>
                      <td><span className={`badge ${b.cls}`}>{b.label}</span></td>
                      <td>
                        <strong className={i.lolos === i.total ? 'text-green' : 'text-red'}>
                          {i.lolos} / {i.total} Item
                        </strong>
                      </td>
                      <td>{fmtWaktu(i.created_at)} WIB</td>
                      <td>
                        <Link className="btn btn-sm btn-primary" to={`/manager/review/${i.id}`}>
                          <Icon name="eye" size={14} />
                          <span>{i.status_validasi === 'MENUNGGU' ? 'Verifikasi Sekarang' : 'Detail Review'}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="empty-state-cell">
                    <Icon name="clipboard" size={32} />
                    <p>Tidak ada data inspeksi kendaraan yang sesuai dengan filter.</p>
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
