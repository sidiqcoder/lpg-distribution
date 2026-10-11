import RefreshNotice from '../../components/RefreshNotice';
import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../../hooks';
import { apiJson } from '../../api';
import { notifyDataChanged } from '../../events';
import { badgeForLpg, fmtSubmit } from '../../utils';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function ManagerStock() {
  const { date } = useOutletContext();
  const { data, loading, error, reload } = useApi('/manager/summary', { params: { date }, interval: 5000 });
  const [jumlah, setJumlah] = useState('');
  const [busy, setBusy] = useState(false);
  const [decidingId, setDecidingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const submittingRef = useRef(false);

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat data stok &amp; permintaan LPG...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Data Persediaan</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  const saveStock = async (e) => {
    e.preventDefault();
    if (submittingRef.current || busy || jumlah === '') return;
    submittingRef.current = true;
    setBusy(true);
    setFeedbackMsg('');

    try {
      await apiJson('/manager/stock', { jumlah: Number(jumlah), tanggal: date });
      notifyDataChanged({ type: 'stock-updated' });
      setFeedbackMsg(`Stok persediaan berhasil diperbarui menjadi ${jumlah} tabung.`);
      setJumlah('');
      await reload();
    } catch (err) {
      alert(err.message || 'Gagal memperbarui stok.');
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const addStockQuick = async (amount) => {
    if (submittingRef.current || busy) return;
    const current = Number(data.persediaanLpg) || 0;
    const updated = current + amount;
    submittingRef.current = true;
    setBusy(true);
    setFeedbackMsg('');

    try {
      await apiJson('/manager/stock', { jumlah: updated, tanggal: date });
      notifyDataChanged({ type: 'stock-updated' });
      setFeedbackMsg(`Stok berhasil ditambah +${amount} tabung (Total: ${updated} tabung).`);
      await reload();
    } catch (err) {
      alert(err.message || 'Gagal menambah stok.');
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const decide = async (id, status) => {
    if (decidingId) return;
    setDecidingId(id);
    try {
      await apiJson(`/manager/lpg/${id}/decision`, { status, tanggal: date });
      notifyDataChanged({ type: 'lpg-decision', id, status });
      setFeedbackMsg(`Permintaan #${id} telah ${status === 'DISETUJUI' ? 'DISETUJUI' : 'DITOLAK'}.`);
      await reload();
    } catch (err) {
      alert(err.message || 'Gagal memperbarui status permintaan.');
    } finally {
      setDecidingId(null);
    }
  };

  const permintaanList = (data.permintaanLpg || []).filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  const pendingCount = (data.permintaanLpg || []).filter((r) => r.status === 'MENUNGGU').length;

  return (
    <div className="stock-page-layout">
      <RefreshNotice error={error} />
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/manager" label="Kembali ke Ringkasan" />
          </div>
          <h1>Manajemen Persediaan &amp; Permintaan LPG</h1>
          <p className="subtitle">
            Kontrol Stok Gudang Depo &amp; Otorisasi Pengambilan Tabung Armada &middot; Tanggal: {date}
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-outline" onClick={reload}>
            <Icon name="refresh" size={14} />
            <span>Sinkronisasi Live</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="banner ok mb">
          <div className="banner-title">
            <Icon name="check-circle" size={18} />
            <span>Pembaruan Berhasil</span>
          </div>
          <p>{feedbackMsg}</p>
        </div>
      )}

      {/* Stock Warehouse Card */}
      <div className="card mb stock-hero-card">
        <div className="stock-hero-inner">
          <div className="stock-big-metric">
            <div className="stock-badge-title">
              <Icon name="cylinder" size={20} />
              <span>STOK FISIK GUDANG DEPO</span>
            </div>
            <div className="stock-huge-number">
              {data.persediaanLpg} <span className="unit">Tabung</span>
            </div>
            <div className="stock-metric-meta">
              <span>Status Stok: </span>
              <strong className={data.persediaanLpg < 200 ? 'text-red' : 'text-green'}>
                {data.persediaanLpg < 200 ? 'Stok Kritis / Menipis' : 'Persediaan Aman'}
              </strong>
            </div>
          </div>

          <div className="stock-control-col">
            <form onSubmit={saveStock} className="stock-update-form">
              <label htmlFor="stokInput">Atur / Reset Jumlah Stok Depo</label>
              <div className="input-group-combo">
                <input
                  id="stokInput"
                  type="number"
                  min="0"
                  value={jumlah}
                  onChange={(e) => setJumlah(e.target.value)}
                  placeholder={`Saat ini: ${data.persediaanLpg}`}
                />
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy || jumlah === ''}
                >
                  <Icon name="save" size={16} />
                  <span>Simpan</span>
                </button>
              </div>
            </form>

            <div className="quick-add-strip mt-sm">
              <span className="quick-add-label">Tambah Stok Cepat (Pasokan Masuk):</span>
              <div className="quick-buttons-row">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => addStockQuick(200)}
                  disabled={busy}
                >
                  <Icon name="plus" size={14} /> 200 Tabung
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => addStockQuick(500)}
                  disabled={busy}
                >
                  <Icon name="plus" size={14} /> 500 Tabung
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => addStockQuick(1000)}
                  disabled={busy}
                >
                  <Icon name="plus" size={14} /> 1.000 Tabung
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Requests Section */}
      <div className="card">
        <div className="table-header-flex">
          <div>
            <div className="flex-row items-center gap-sm">
              <Icon name="clipboard" size={20} />
              <h2>Daftar Permintaan Pengambilan LPG Sopir</h2>
            </div>
            <p className="muted text-sm mt-xs">
              {pendingCount > 0
                ? `${pendingCount} pengajuan sedang menunggu verifikasi Anda.`
                : 'Semua pengajuan telah diproses.'}
            </p>
          </div>

          <div className="filter-pill-group">
            <button
              type="button"
              className={`pill-btn ${filterStatus === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterStatus('ALL')}
            >
              Semua ({data.permintaanLpg?.length || 0})
            </button>
            <button
              type="button"
              className={`pill-btn ${filterStatus === 'MENUNGGU' ? 'active' : ''}`}
              onClick={() => setFilterStatus('MENUNGGU')}
            >
              Menunggu Review ({pendingCount})
            </button>
            <button
              type="button"
              className={`pill-btn ${filterStatus === 'DISETUJUI' ? 'active' : ''}`}
              onClick={() => setFilterStatus('DISETUJUI')}
            >
              Disetujui
            </button>
            <button
              type="button"
              className={`pill-btn ${filterStatus === 'DITOLAK' ? 'active' : ''}`}
              onClick={() => setFilterStatus('DITOLAK')}
            >
              Ditolak
            </button>
          </div>
        </div>

        <div className="table-wrap mt">
          <table className="data table-hover">
            <thead>
              <tr>
                <th>ID</th>
                <th>Sopir</th>
                <th>Plat Armada</th>
                <th>Jumlah Ambil</th>
                <th>Status Otorisasi</th>
                <th>Waktu Pengajuan</th>
                <th>Catatan Sopir</th>
                <th>Aksi Manager</th>
              </tr>
            </thead>
            <tbody>
              {permintaanList.length > 0 ? (
                permintaanList.map((r) => {
                  const b = badgeForLpg(r.status);
                  const isProcessing = decidingId === r.id;
                  return (
                    <tr key={r.id}>
                      <td><span className="id-badge">#{r.id}</span></td>
                      <td><strong>{r.sopir_nama}</strong></td>
                      <td><span className="plat-badge">{r.plat_nomor}</span></td>
                      <td><strong className="fs-md">{r.jumlah_diminta} Tabung</strong></td>
                      <td>
                        <span className={`badge ${b.cls}`}>
                          {b.label}
                        </span>
                      </td>
                      <td>{fmtSubmit(r.created_at)}</td>
                      <td>{r.catatan || <span className="muted">-</span>}</td>
                      <td>
                        {r.status === 'MENUNGGU' ? (
                          <div className="action-buttons-cell">
                            <button
                              className="btn btn-sm btn-success"
                              type="button"
                              disabled={isProcessing}
                              onClick={() => decide(r.id, 'DISETUJUI')}
                              title="Setujui dan potong stok gudang"
                            >
                              <Icon name="check" size={14} />
                              <span>{isProcessing ? 'Proses...' : 'Setujui'}</span>
                            </button>
                            <button
                              className="btn btn-sm btn-bad"
                              type="button"
                              disabled={isProcessing}
                              onClick={() => decide(r.id, 'DITOLAK')}
                              title="Tolak permohonan"
                            >
                              <Icon name="x" size={14} />
                              <span>Tolak</span>
                            </button>
                          </div>
                        ) : (
                          <div className="reviewed-by-tag">
                            <Icon name={r.status === 'DISETUJUI' ? 'check-circle' : 'x-circle'} size={14} />
                            <span>{r.disetujui_oleh || 'Manager'} ({fmtSubmit(r.waktu_disetujui)})</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="empty-state-cell">
                    <Icon name="cylinder" size={32} />
                    <p>Tidak ada data permintaan LPG yang sesuai dengan filter.</p>
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
