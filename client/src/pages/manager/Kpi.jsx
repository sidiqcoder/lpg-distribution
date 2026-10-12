import RefreshNotice from '../../components/RefreshNotice';
import { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../../hooks';
import { apiGet, apiJson } from '../../api';
import { notifyDataChanged } from '../../events';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';
import { fmtSubmit } from '../../utils';

export default function ManagerKpi() {
  const { date } = useOutletContext();
  const { data, loading, error, reload } = useApi('/manager/summary', { params: { date }, interval: 10000 });
  const [form, setForm] = useState({});
  const [recommendations, setRecommendations] = useState(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [pedomanOpen, setPedomanOpen] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    const next = {};
    data.semuaSopir.forEach((s) => {
      const k = data.kpiData.find((x) => x.sopir_id === s.id) || {};
      next[s.id] = {
        nilai: k.nilai != null ? String(k.nilai) : '',
        catatan: k.catatan || ''
      };
    });
    setForm(next);
  }, [data]);

  const loadRecommendations = async () => {
    try {
      setBusy(true);
      const res = await apiGet('/manager/kpi/recommendations', { date });
      if (res?.recommendations) {
        setRecommendations(res.recommendations);
        const next = { ...form };
        res.recommendations.forEach((rec) => {
          next[rec.sopirId] = {
            nilai: String(rec.rekomendasiNilai),
            catatan: form[rec.sopirId]?.catatan || rec.catatanOtomatis
          };
        });
        setForm(next);
        setInfo('Nilai rekomendasi otomatis berhasil dihitung berdasarkan data operasional sistem hari ini.');
      }
    } catch (err) {
      alert('Gagal mengambil rekomendasi KPI: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || busy) return;

    submittingRef.current = true;
    setBusy(true);
    setInfo('');

    try {
      const entries = Object.entries(form).map(([sopirId, v]) => ({
        sopirId: Number(sopirId),
        nilai: v.nilai,
        catatan: v.catatan
      }));
      await apiJson('/manager/kpi', { tanggal: date, entries });
      notifyDataChanged({ type: 'kpi-saved', date });
      setInfo('Penilaian KPI sopir berhasil disimpan ke sistem.');
      await reload();
    } catch (err) {
      alert('Gagal menyimpan KPI: ' + err.message);
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat modul penilaian KPI sopir...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Data</span>
        </div>
        <p>{error.message}</p>
        <button type="button" className="btn btn-sm btn-outline mt-sm" onClick={reload}>
          <Icon name="refresh" size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  const getGrade = (val) => {
    const num = Number(val);
    if (isNaN(num) || val === '') return { grade: '-', label: 'Belum Dinilai', cls: 'badge-muted' };
    if (num >= 90) return { grade: 'A', label: 'Sangat Baik (A)', cls: 'badge-ok' };
    if (num >= 75) return { grade: 'B', label: 'Baik (B)', cls: 'badge-info' };
    if (num >= 60) return { grade: 'C', label: 'Cukup (C)', cls: 'badge-warn' };
    return { grade: 'D', label: 'Kurang / Pembinaan (D)', cls: 'badge-bad' };
  };

  return (
    <div className="kpi-page-layout">
      <RefreshNotice error={error} />
      {/* Top Header */}
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/manager" label="Kembali ke Ringkasan" />
          </div>
          <h1>Penilaian Kinerja Sopir (Driver KPI)</h1>
          <p className="subtitle">
            Evaluasi Berbasis Keselamatan K3, Efektivitas Pengiriman &amp; Kepatuhan Rute &middot; Tanggal: <strong>{date}</strong>
          </p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={loadRecommendations}
            disabled={busy}
            title="Hitung skor berdasarkan riwayat inspeksi, ritase pengiriman & keselamatan hari ini"
          >
            <Icon name="calculator" size={16} />
            <span>Hitung Otomatis Berdasarkan Data Sistem</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPedomanOpen(true)}
            title="Lihat metodologi dan rumus perhitungan KPI untuk bahan diskusi dosen"
          >
            <Icon name="info" size={16} />
            <span>Pedoman &amp; Rumus KPI (Untuk Dosen)</span>
          </button>
        </div>
      </div>

      {info && (
        <div className="banner ok mb">
          <div className="banner-title">
            <Icon name="check-circle" size={18} />
            <span>Informasi</span>
          </div>
          <p>{info}</p>
        </div>
      )}

      {/* KPI Explanation Banner */}
      <div className="card mb rubric-highlight-card">
        <div className="rubric-header">
          <Icon name="chart" size={20} />
          <strong>Formula Bobot Key Performance Indicator (KPI) Logistik LPG:</strong>
        </div>
        <div className="rubric-weights-grid mt-sm">
          <div className="rubric-weight-item">
            <span className="weight-percent">30%</span>
            <div>
              <strong>Inspeksi Keselamatan K3</strong>
              <small className="muted block">Kelengkapan 72 item checklist &amp; status AMAN</small>
            </div>
          </div>
          <div className="rubric-weight-item">
            <span className="weight-percent">40%</span>
            <div>
              <strong>Realisasi Pengiriman</strong>
              <small className="muted block">Pencapaian pangkalan tujuan &amp; jumlah tabung terkirim</small>
            </div>
          </div>
          <div className="rubric-weight-item">
            <span className="weight-percent">30%</span>
            <div>
              <strong>Kepatuhan Rute &amp; Safety</strong>
              <small className="muted block">Disiplin jalur GPS &amp; nihil insiden kebocoran gas</small>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Scoring Form */}
      <form onSubmit={submit}>
        <div className="driver-kpi-cards-grid">
          {data.semuaSopir.map((s) => {
            const currentScore = form[s.id]?.nilai || '';
            const gradeInfo = getGrade(currentScore);
            const rec = recommendations?.find((r) => r.sopirId === s.id);

            // Cari data riwayat sopir hari ini
            const insRow = data.inspeksi.find((i) => i.sopir_id === s.id);
            const devRows = data.pengiriman.filter((p) => p.sopir_id === s.id);
            const hazRows = data.laporanBahaya.filter((b) => b.sopir_id === s.id);

            return (
              <div key={s.id} className="card driver-kpi-card">
                <div className="kpi-card-head">
                  <div>
                    <h2 className="driver-name-title">{s.nama}</h2>
                    <small className="muted block">Jam submit penilaian: {fmtSubmit(data.kpiData.find(k => k.sopir_id === s.id)?.created_at)}</small>
                    <span className="muted text-sm">ID: #DRV-00{s.id} &middot; Kendaraan Armada LPG</span>
                  </div>
                  <div className="grade-badge-wrap">
                    <span className={`badge ${gradeInfo.cls}`}>
                      Predikat: {gradeInfo.label}
                    </span>
                  </div>
                </div>

                {/* Sub-metrik operasional aktual */}
                <div className="kpi-operational-metrics mt">
                  <div className="metric-pill">
                    <span className="metric-label">Status Inspeksi:</span>
                    <strong>{insRow ? (insRow.status_validasi === 'AMAN' ? 'Lolos (Aman)' : 'Perlu Perbaikan') : 'Belum Submit'}</strong>
                  </div>
                  <div className="metric-pill">
                    <span className="metric-label">Pangkalan Terkirim:</span>
                    <strong>{devRows.length} Pangkalan</strong>
                  </div>
                  <div className="metric-pill">
                    <span className="metric-label">Laporan Bahaya:</span>
                    <strong className={hazRows.length > 0 ? 'text-red' : 'text-green'}>
                      {hazRows.length === 0 ? 'Nihil Insiden' : `${hazRows.length} Kejadian`}
                    </strong>
                  </div>
                </div>

                {rec && (
                  <div className="recommendation-badge-box mt-sm">
                    <Icon name="calculator" size={14} />
                    <span>
                      Rekomendasi Sistem: <strong>{rec.rekomendasiNilai}%</strong> &mdash;
                      (Inspeksi: {rec.scoreInspeksi}%, Pengiriman: {rec.scorePengiriman}%, Safety: {rec.scoreKepatuhan}%)
                    </span>
                  </div>
                )}

                <div className="kpi-input-controls mt">
                  <div className="form-group">
                    <label htmlFor={`nilai_${s.id}`}>
                      Nilai KPI Akhir (Skala 0 - 100%)
                    </label>
                    <div className="input-with-affix">
                      <input
                        id={`nilai_${s.id}`}
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Contoh: 95"
                        value={form[s.id]?.nilai || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [s.id]: { ...form[s.id], nilai: e.target.value }
                          })
                        }
                        required
                      />
                      <span className="input-affix">%</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor={`catatan_${s.id}`}>Catatan Evaluasi / Rekomendasi Manager</label>
                    <textarea
                      id={`catatan_${s.id}`}
                      rows="2"
                      placeholder="Masukkan catatan penilaian kinerja atau feedback pengembangan..."
                      value={form[s.id]?.catatan || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [s.id]: { ...form[s.id], catatan: e.target.value }
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="form-actions-bar mt-lg">
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            <Icon name="save" size={18} />
            <span>{busy ? 'Menyimpan KPI...' : 'Simpan Seluruh Penilaian KPI'}</span>
          </button>
          <BackButton fallback="/manager" label="Kembali ke Ringkasan" />
        </div>
      </form>

      {/* Modal Penjelasan Metodologi & Rumus KPI untuk Diskusi Dosen */}
      {pedomanOpen && (
        <div className="modal-backdrop" onClick={() => setPedomanOpen(false)}>
          <div className="modal-card max-w-720" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Pedoman &amp; Metodologi Perhitungan KPI Sopir</h2>
              <button
                className="btn btn-ghost sm"
                type="button"
                onClick={() => setPedomanOpen(false)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="pedoman-body text-sm">
              <p>
                Modul KPI ini dirancang untuk menilai performa pengemudi distribusi LPG secara komprehensif
                dengan memadukan aspek <strong>Keselamatan Kerja (K3)</strong> dan <strong>Efisiensi Distribusi</strong>.
              </p>

              <h3>1. Variabel dan Bobot Penilaian</h3>
              <table className="data table-sm mt-xs mb">
                <thead>
                  <tr>
                    <th>Komponen KPI</th>
                    <th>Bobot</th>
                    <th>Parameter &amp; Sumber Data</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>1. Inspeksi Pra-Keberangkatan</strong></td>
                    <td><strong>30%</strong></td>
                    <td>
                      Kelayakan 72 item checklist teknis kendaraan (rem, ban, bak truk, alat pemadam APAR).
                      Status validasi manager (Aman = 100%, Perbaikan = 50%, Tidak ada = 0%).
                    </td>
                  </tr>
                  <tr>
                    <td><strong>2. Realisasi Pengiriman</strong></td>
                    <td><strong>40%</strong></td>
                    <td>
                      Rasio penyelesaian ritase pangkalan terjadwal dalam rute harian dan kuota tabung yang diserahterimakan dengan bukti dokumentasi.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>3. Kepatuhan Rute &amp; Zero Incident</strong></td>
                    <td><strong>30%</strong></td>
                    <td>
                      Kepatuhan terhadap koridor GPS teroptimasi (tidak menyimpang) serta nihil insiden kebocoran gas LPG atau kecelakaan lalu lintas.
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>2. Formula Matematis:</h3>
              <div className="formula-box">
                <code>
                  Skor_KPI = (0.30 &times; Skor_Inspeksi) + (0.40 &times; Skor_Pengiriman) + (0.30 &times; Skor_Safety)
                </code>
              </div>

              <h3 className="mt">3. Skala Konversi Predikat Akademik:</h3>
              <ul className="grade-list">
                <li><strong>90 &ndash; 100% (Predikat A):</strong> Kinerja Sangat Baik &amp; Disiplin K3 Tinggi.</li>
                <li><strong>75 &ndash; 89% (Predikat B):</strong> Kinerja Baik, Target Pengiriman Tercapai.</li>
                <li><strong>60 &ndash; 74% (Predikat C):</strong> Kinerja Cukup, Terdapat Kendala Ringan.</li>
                <li><strong>&lt; 60% (Predikat D):</strong> Kinerja Kurang, Wajib Mengikuti Pembinaan / Uji Ulang K3.</li>
              </ul>
            </div>
            <div className="modal-footer mt">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setPedomanOpen(false)}
              >
                Tutup Pedoman
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
