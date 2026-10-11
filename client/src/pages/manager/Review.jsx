import RefreshNotice from '../../components/RefreshNotice';
import { useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks';
import { apiJson, uploadUrl } from '../../api';
import { notifyDataChanged } from '../../events';
import { fmtSubmit } from '../../utils';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function ManagerReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useApi(`/manager/inspection/${id}`);
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  const sections = useMemo(() => {
    if (!data?.checklist) return [];
    const map = new Map();
    data.checklist.forEach((c) => {
      if (!map.has(c.section)) {
        map.set(c.section, { key: c.section, nama: c.sectionNama, items: [] });
      }
      map.get(c.section).items.push(c);
    });
    return [...map.values()];
  }, [data]);

  if (!data && !error) {
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat formulir inspeksi kendaraan...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="banner bad">
        <div className="banner-title">
          <Icon name="alert" size={18} />
          <span>Gagal Memuat Inspeksi</span>
        </div>
        <p>{error.message}</p>
        <div className="mt-sm">
          <BackButton fallback="/manager/inspeksi" label="Kembali ke Daftar Inspeksi" />
        </div>
      </div>
    );
  }

  const { inspection: row, lampiran, counts } = data;
  const lampiranBy = (sid) => (lampiran || []).find((l) => l.section === sid) || {};

  const validate = async (status) => {
    if (!catatan.trim()) {
      alert('Catatan validasi wajib diisi untuk memberikan arahan resmi kepada sopir.');
      return;
    }
    if (submittingRef.current || busy) return;

    submittingRef.current = true;
    setBusy(true);

    try {
      await apiJson('/manager/validate', {
        inspeksi_id: Number(id),
        sopir_id: row.sopir_id,
        status_validasi: status,
        catatan_validasi: catatan
      });
      notifyDataChanged({ type: 'inspection-validated', inspeksiId: Number(id) });
      navigate('/manager/inspeksi', { replace: true });
    } catch (err) {
      alert(err.message || 'Gagal memvalidasi inspeksi.');
      setBusy(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="review-page-layout">
      <RefreshNotice error={error} />
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/manager/inspeksi" label="Kembali ke Daftar Inspeksi" />
          </div>
          <h1>Verifikasi &amp; Validasi Inspeksi K3 Kendaraan</h1>
          <p className="subtitle">
            Sopir: <strong>{row.sopir_nama}</strong> &middot; Plat: <strong>{row.plat_nomor}</strong> &middot; Diajukan: {fmtSubmit(row.created_at)}
          </p>
        </div>
      </div>

      {/* Summary Score Bar */}
      <div className="card mb">
        <div className="review-score-summary">
          <div className="score-summary-item">
            <span className="muted block text-xs">STATUS SAAT INI</span>
            <span className="badge badge-brand fs-sm">{row.status_validasi}</span>
          </div>
          <div className="score-summary-item">
            <span className="muted block text-xs">KONDISI BAIK</span>
            <strong className="text-green fs-md">{counts.lolos} Item</strong>
          </div>
          <div className="score-summary-item">
            <span className="muted block text-xs">KENDALA / TIDAK BAIK</span>
            <strong className="text-red fs-md">{counts.tidakBaik} Item</strong>
          </div>
          <div className="score-summary-item">
            <span className="muted block text-xs">BELUM DICENTANG</span>
            <strong className="text-muted fs-md">{counts.belumDicentang} Item</strong>
          </div>
        </div>
      </div>

      {/* Checklist Sections */}
      {sections.map((section) => {
        const files = lampiranBy(section.key);
        return (
          <div className="card mb" key={section.key}>
            <div className="section-head-bar">
              <span className="section-number">{section.key}</span>
              <h3>Bagian {section.nama}</h3>
            </div>

            <div className="review-items-list mt">
              {section.items.map((c, idx) => (
                <div key={idx} className="review-item-row">
                  <div className="item-badge-col">
                    <span
                      className={`badge ${
                        c.status === 'BAIK'
                          ? 'badge-ok'
                          : c.status === 'TIDAK'
                          ? 'badge-bad'
                          : 'badge-muted'
                      }`}
                    >
                      {c.status === 'BAIK' ? 'Baik' : c.status === 'TIDAK' ? 'Kendala' : 'Belum'}
                    </span>
                  </div>
                  <div className="item-text-col">
                    <div className="item-name">{c.item}</div>
                    {c.keterangan && (
                      <div className="item-sub-ket text-sm">
                        <strong>Catatan Sopir:</strong> {c.keterangan}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Lampiran Bukti Foto / Video */}
            <div className="media-preview-grid mt">
              <div className="media-box">
                <span className="media-label">Foto Bukti Pemeriksaan Bagian {section.nama}:</span>
                {files.foto ? (
                  <a href={uploadUrl(files.foto)} target="_blank" rel="noreferrer">
                    <img
                      src={uploadUrl(files.foto)}
                      alt="Foto Inspeksi"
                      className="media-img-fluid"
                    />
                  </a>
                ) : (
                  <div className="empty-media-box">Tidak ada foto dilampirkan</div>
                )}
              </div>
              <div className="media-box">
                <span className="media-label">Video Bukti:</span>
                {files.video ? (
                  <video
                    src={uploadUrl(files.video)}
                    controls
                    className="media-video-fluid"
                  />
                ) : (
                  <div className="empty-media-box">Tidak ada video dilampirkan</div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {row.catatan && (
        <div className="card mb">
          <div className="card-header-styled">
            <Icon name="clipboard" size={18} />
            <h3>Catatan Umum Dari Sopir</h3>
          </div>
          <div className="audit-note-box mt-sm">
            <div className="note-body">
              {String(row.catatan).split('\n\n--- FEEDBACK MANAGER')[0]}
            </div>
          </div>
        </div>
      )}

      {/* Action Decision Form */}
      <div className="card review-action-card">
        <div className="card-header-styled">
          <Icon name="shield" size={20} />
          <h2>Keputusan Verifikasi Kelayakan K3 Manager</h2>
        </div>

        <div className="form-group mt">
          <label htmlFor="catatanValidasi">
            Catatan Arahan &amp; Validasi Manager (Wajib Diisi):
          </label>
          <textarea
            id="catatanValidasi"
            rows="3"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: Tekanan ban dan rem utama dalam kondisi optimal, armada diizinkan melakukan pengisian kuota LPG."
            required
          />
          <span className="field-hint">Catatan ini akan langsung diterima dan terbaca pada layar sopir.</span>
        </div>

        <div className="form-actions-bar mt">
          <button
            className="btn btn-success btn-lg"
            type="button"
            disabled={busy}
            onClick={() => validate('AMAN')}
          >
            <Icon name="check-circle" size={18} />
            <span>{busy ? 'Menyimpan...' : 'Setujui Kelayakan (Armada Aman)'}</span>
          </button>
          <button
            className="btn btn-bad btn-lg"
            type="button"
            disabled={busy}
            onClick={() => validate('TIDAK_AMAN')}
          >
            <Icon name="alert" size={18} />
            <span>{busy ? 'Menyimpan...' : 'Tolak & Minta Perbaikan Teknis'}</span>
          </button>
          <BackButton fallback="/manager/inspeksi" label="Batal" />
        </div>
      </div>
    </div>
  );
}
