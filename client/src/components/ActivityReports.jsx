import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks';
import { apiJson } from '../api';
import { fmtSubmit } from '../utils';

function EvidencePreview({ report }) {
  const current = report.kind === 'video' ? report.video : report.foto;
  const [source, setSource] = useState({ url: current, at: Date.now() });
  useEffect(() => {
    if (Date.now() - source.at > 45 * 60 * 1000) setSource({ url: current, at: Date.now() });
  }, [current, source.at]);
  return report.kind === 'video' ? <video className="fatigue-preview mt-sm" controls playsInline preload="metadata" src={source.url} />
    : <a href={source.url} target="_blank" rel="noreferrer"><img className="fatigue-preview mt-sm" src={source.url} alt={`Kondisi ${report.nama}`} loading="lazy" /></a>;
}

function ReviewControl({ report, reload }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const review = async status => {
    if (!note.trim()) { setError('Isi catatan peninjauan.'); return; }
    setBusy(true); setError('');
    try { await apiJson(`/manager/fatigue/${report.id}/review`, { status, note }); await reload(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  if (report.status !== 'MENUNGGU') return <p className="text-sm">{report.review_note} · {report.reviewed_by} · {fmtSubmit(report.reviewed_at)}</p>;
  return <div className="mt-sm">
    <textarea aria-label={`Catatan fatigue ${report.id}`} placeholder="Catatan manager setelah meninjau rekaman" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} />
    <div className="flex-row gap-sm mt-sm"><button className="btn btn-sm btn-outline" disabled={busy} onClick={() => review('FIT')}>Kondisi Fit</button><button className="btn btn-sm btn-primary" disabled={busy} onClick={() => review('PERLU_ISTIRAHAT')}>Perlu Istirahat</button></div>
    {error && <p role="alert" className="text-red">{error}</p>}
  </div>;
}

export default function ActivityReports({ date, compact = false }) {
  const { data, error, loading, reload } = useApi('/manager/activity', { params: { date }, interval: 15000 });
  const reports = data?.reports || [];
  const logins = data?.logins || [];
  return <div className="mt">
    <div className="card mb">
      <div className="table-header-flex"><h2>Aktivitas Login & Pemantauan Fatigue</h2>{compact ? <Link className="btn btn-sm btn-outline" to={`/manager/aktivitas?date=${date}`}>Lihat Semua Laporan</Link> : <button className="btn btn-sm btn-outline" onClick={reload}>Refresh Laporan</button>}</div>
      {error && <p className="banner warn" role="alert">{data ? 'Pembaruan gagal, menampilkan laporan terakhir. ' : ''}{error.message}</p>}
      {loading && !data && <p>Memuat laporan aktivitas...</p>}
      <p className="text-sm">{logins.length} login · {reports.length} rekaman · {reports.filter(report => report.status === 'MENUNGGU').length} menunggu peninjauan. Rekaman ditampilkan pada tanggal rekam atau tanggal submit WITA; status kamera di bawah menunjukkan keadaan saat ini.</p>
      <div className="stat-grid mt-sm">
        {(data?.monitoring || []).map(driver => <div key={driver.sopir_id} className="card">
          <strong>{driver.nama}</strong><p className="text-sm">{driver.camera_error || (driver.active ? 'Pemantauan kamera aktif' : driver.camera_enabled ? 'Pemantauan terputus / aplikasi tidak aktif' : 'Kamera belum aktif / dihentikan')}</p>
          <small className="muted block">Rekam terakhir: {fmtSubmit(driver.last_capture_at)}</small>
          <small className="muted block">Jadwal berikutnya: {fmtSubmit(driver.next_capture_at)}</small>
          <small className="muted block">Status diperbarui: {fmtSubmit(driver.updated_at)}</small>
        </div>)}
      </div>
    </div>
    <div className="grid cols-2">
      <div className="card"><h3>Laporan Sopir Login</h3><div className="table-wrap mt-sm"><table className="data"><thead><tr><th>Sopir</th><th>Jam Login / Submit (WITA)</th></tr></thead><tbody>
        {(compact ? logins.slice(0, 5) : logins).map(login => <tr key={login.id}><td>{login.nama}</td><td>{fmtSubmit(login.created_at)}</td></tr>)}
        {!logins.length && <tr><td colSpan={2}>Belum ada login pada tanggal ini.</td></tr>}
      </tbody></table></div></div>
      <div className="card"><h3>Rekaman Kondisi Sopir</h3><p className="muted text-sm">Manager meninjau foto/video untuk menilai kondisi sopir.</p>
        {(compact ? reports.slice(0, 3) : reports).map(report => <article className="fatigue-report" key={report.id}>
          <strong>{report.nama}</strong> <span className={`badge badge-${report.status === 'MENUNGGU' ? 'warn' : report.status === 'FIT' ? 'ok' : 'bad'}`}>{report.status === 'MENUNGGU' ? 'Menunggu Review' : report.status === 'FIT' ? 'Fit' : 'Perlu Istirahat'}</span>
          <small className="muted block">Jam rekam: {fmtSubmit(report.captured_at)}</small><small className="muted block">Jam submit: {fmtSubmit(report.created_at)}</small>
          {!compact && <EvidencePreview report={report} />}
          {!compact && <ReviewControl report={report} reload={reload} />}
        </article>)}
        {!reports.length && <p>Belum ada rekaman pada tanggal ini.</p>}
      </div>
    </div>
    {!compact && <p className="muted text-sm mt">Menampilkan maksimal 200 login dan 200 rekaman terbaru per tanggal. Laporan yang tertunda saat koneksi terputus juga muncul pada tanggal submit, dengan jam rekam dan jam submit sebenarnya.</p>}
  </div>;
}
