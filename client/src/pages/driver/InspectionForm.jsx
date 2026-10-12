import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import { apiForm } from '../../api';
import { notifyDataChanged } from '../../events';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverInspectionForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const submittingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: meta, error: metaError, reload: reloadMeta } = useApi('/meta');
  const { data: kendaraanData, error: vehicleError, reload: reloadVehicles } = useApi('/kendaraan');

  const checkAllBaik = () => {
    if (!formRef.current) return;
    const radios = formRef.current.querySelectorAll('input[type="radio"][value="BAIK"]');
    radios.forEach((r) => {
      r.checked = true;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || busy) return;
    const form = formRef.current;
    const missing = [...form.querySelectorAll('[required]')].find(input => !input.validity.valid);
    if (missing) {
      const item = missing.closest('.checklist-item-row')?.querySelector('.item-text')?.textContent;
      setError(item ? `Pilih kondisi BAIK atau TIDAK untuk: ${item}.` : 'Pilih kendaraan yang akan diinspeksi terlebih dahulu.');
      missing.scrollIntoView({ behavior: 'smooth', block: 'center' });
      missing.focus();
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const fd = new FormData(formRef.current);
      fd.set('sopir_id', String(user.id));
      await apiForm('/driver/inspection', fd);
      notifyDataChanged({ type: 'inspection', driverId: user.id });
      setSuccess('Inspeksi pagi berhasil diajukan dan sedang menunggu review manager.');
      setTimeout(() => {
        navigate('/sopir/status-inspeksi', { replace: true });
      }, 700);
    } catch (err) {
      setError(err.message || 'Gagal mengirim formulir inspeksi.');
      setBusy(false);
      submittingRef.current = false;
    }
  };

  if (!meta || !kendaraanData) {
    if (metaError || vehicleError) return <div className="banner bad" role="alert">{(metaError || vehicleError).message}<button className="btn btn-outline" onClick={() => { reloadMeta(); reloadVehicles(); }}>Coba Lagi</button></div>;
    return (
      <div className="card loading-card">
        <div className="spinner" />
        <p>Memuat formulir checklist inspeksi kendaraan...</p>
      </div>
    );
  }

  const kendaraan = kendaraanData?.kendaraan || [];

  return (
    <div className="form-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir/menu" label="Kembali ke Menu Operasional" />
          </div>
          <h1>Inspeksi Pra-Keberangkatan Armada</h1>
          <p className="subtitle">
            Sopir: <strong>{user.nama}</strong> &middot; Formulir Standar K3 Distribusi Gas LPG
          </p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={checkAllBaik}
            title="Centang otomatis seluruh item kondisi BAIK sesuai SOP"
          >
            <Icon name="check-circle" size={16} />
            <span>Set Semua Kondisi BAIK</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="banner bad mb" role="alert">
          <div className="banner-title">
            <Icon name="alert" size={18} />
            <span>Pengajuan Gagal Dikirim</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="banner ok mb">
          <div className="banner-title">
            <Icon name="check-circle" size={18} />
            <span>Pengajuan Berhasil</span>
          </div>
          <p>{success}</p>
        </div>
      )}

      <form ref={formRef} onSubmit={submit} noValidate>
        {/* Pilihan Kendaraan */}
        <div className="card mb">
          <div className="card-header-styled">
            <Icon name="truck" size={20} />
            <h2>Identitas Armada Pengangkut LPG</h2>
          </div>
          <div className="form-group mt">
            <label htmlFor="kendaraan_id">Nomor Polisi / Plat Truk Engkel</label>
            <select id="kendaraan_id" name="kendaraan_id" required defaultValue="">
              <option value="">-- Pilih Kendaraan Tugas --</option>
              {kendaraan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.plat_nomor} &mdash; Kapasitas {k.kapasitas_ton} Tabung (Truk Engkel)
                </option>
              ))}
            </select>
            <span className="field-hint">Pilih kendaraan yang akan Anda operasikan hari ini.</span>
          </div>
        </div>

        {/* Sections Checklist */}
        {meta.sections.map((section) => (
          <div className="card mb" key={section.id}>
            <div className="section-head-bar">
              <span className="section-number">{section.id}</span>
              <h3>Bagian {section.nama}</h3>
            </div>

            <div className="checklist-items-grid">
              {section.items.map((item, idx) => (
                <div key={idx} className="checklist-item-row">
                  <div className="item-label-col">
                    <span className="item-index">{idx + 1}.</span>
                    <span className="item-text">{item}</span>
                  </div>
                  <div className="item-controls-col">
                    <div className="radio-group-segmented">
                      <label className="segmented-opt opt-good">
                        <input
                          type="radio"
                          name={`status_${section.id}_${idx}`}
                          value="BAIK"
                          required
                        />
                        <span>BAIK</span>
                      </label>
                      <label className="segmented-opt opt-bad">
                        <input
                          type="radio"
                          name={`status_${section.id}_${idx}`}
                          value="TIDAK"
                          required
                        />
                        <span>TIDAK</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      className="input-sm mt-xs"
                      name={`ket_${section.id}_${idx}`}
                      placeholder="Keterangan jika ada kendala..."
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Lampiran Foto & Video per Bagian */}
            <div className="media-upload-strip mt">
              <div className="upload-box">
                <label htmlFor={`foto_${section.id}`}>
                  <Icon name="camera" size={16} />
                  <span>Lampirkan Foto {section.nama} (Opsional)</span>
                </label>
                <input
                  type="file"
                  id={`foto_${section.id}`}
                  name={`foto_section_${section.id}`}
                  accept="image/*"
                />
              </div>
              <div className="upload-box">
                <label htmlFor={`video_${section.id}`}>
                  <Icon name="eye" size={16} />
                  <span>Lampirkan Video Bukti (Opsional)</span>
                </label>
                <input
                  type="file"
                  id={`video_${section.id}`}
                  name={`video_section_${section.id}`}
                  accept="video/*"
                />
              </div>
            </div>
          </div>
        ))}

        {/* Catatan Tambahan & Tombol Kirim */}
        <div className="card mb">
          <div className="card-header-styled">
            <Icon name="clipboard" size={20} />
            <h2>Catatan Tambahan &amp; Konfirmasi Sopir</h2>
          </div>
          <div className="form-group mt">
            <label htmlFor="catatan">Catatan / Keterangan Kondisi Khusus</label>
            <textarea
              id="catatan"
              name="catatan"
              rows="3"
              placeholder="Tuliskan catatan kondisi khusus kendaraan jika diperlukan..."
            />
          </div>

          <div className="form-actions-bar mt">
            {error && <p className="text-danger" role="alert">{error}</p>}
            {busy && <p role="status">Mengunggah lampiran dan mengajukan inspeksi. Mohon tunggu...</p>}
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={busy}
            >
              <Icon name="send" size={18} />
              <span>{busy ? 'Mengirim Formulir...' : 'Kirim & Ajukan Inspeksi'}</span>
            </button>
            <BackButton fallback="/sopir/menu" label="Batal & Kembali" />
          </div>
        </div>
      </form>
    </div>
  );
}
