import { useEffect, useRef, useState } from 'react';
import { apiForm, apiGet, apiJson, getToken } from '../api';
import { fmtWaktu } from '../utils';
import { CAPTURE_INTERVAL, captureEvidence, pendingCapture, saveCapture, clearCapture } from '../fatigue';
import { serverNow, clockOffset } from '../clock';

export default function FatigueMonitor({ user }) {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState('video');
  const [status, setStatus] = useState('Belum diaktifkan');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [next, setNext] = useState(null);
  const [last, setLast] = useState(null);
  const video = useRef(null);
  const runtime = useRef({ enabled: false, busy: false, starting: false, pending: null, due: null, stream: null, controller: null, disposed: false, error: '' });

  const heartbeat = async () => {
    const state = runtime.current;
    if (state.disposed || !getToken()) return;
    await apiJson(`/driver/${user.id}/monitoring`, {
      camera_enabled: state.enabled, next_capture_at: state.due ? new Date(state.due).toISOString() : null,
      camera_error: state.error || null
    }).catch(() => {});
  };

  const submitPending = async () => {
    const state = runtime.current;
    const evidence = state.pending;
    if (!evidence || !getToken()) return;
    if (!state.disposed) setStatus('Mengirim rekaman ke manager...');
    // Recover an older queued capture made with a device clock ahead of the server.
    if (Date.parse(evidence.capturedAt) > serverNow() + 120000 && clockOffset() < -120000) {
      evidence.originalCapturedAt ||= evidence.capturedAt;
      evidence.capturedAt = new Date(Date.parse(evidence.capturedAt) + clockOffset()).toISOString();
      state.due = Date.parse(evidence.capturedAt) + CAPTURE_INTERVAL;
      setNext(new Date(state.due).toISOString());
      await saveCapture(user.id, evidence).catch(() => {});
    }
    const form = new FormData();
    form.set('sopir_id', user.id);
    form.set('capture_id', evidence.id);
    form.set('captured_at', evidence.capturedAt);
    form.set('kind', evidence.kind);
    form.set('duration_seconds', evidence.duration);
    const extension = evidence.kind === 'foto' ? 'jpg' : evidence.blob.type.includes('mp4') ? 'mp4' : 'webm';
    form.set('evidence', evidence.blob, `fatigue-${evidence.id}.${extension}`);
    const result = await apiForm('/driver/fatigue', form);
    state.pending = null;
    await clearCapture(user.id).catch(() => {});
    state.error = '';
    state.permanentError = false;
    if (!state.disposed) { setLast(result.created_at); setStatus('Laporan berhasil dikirim ke manager'); }
  };

  const capture = async (manual = false, initialStream = null) => {
    const state = runtime.current;
    if (state.busy || state.disposed) { initialStream?.getTracks().forEach(track => track.stop()); return; }
    if (!manual && (!state.enabled || document.visibilityState !== 'visible')) { initialStream?.getTracks().forEach(track => track.stop()); return; }
    state.busy = true; setBusy(true);
    state.controller = new AbortController();
    state.stream = initialStream;
    const token = getToken();
    try {
      if (state.pending) await submitPending();
      if (!manual && state.due && serverNow() < state.due) return;
      setStatus(mode === 'video' ? 'Merekam kondisi sopir selama 7 detik...' : 'Mengambil foto kondisi sopir...');
      state.stream = initialStream || await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (state.disposed || state.controller.signal.aborted) return;
      const capturedAt = new Date(serverNow()).toISOString();
      const evidence = await captureEvidence(state.stream, video.current, mode, state.controller.signal);
      if (state.disposed || token !== getToken()) return;
      state.stream.getTracks().forEach(track => track.stop()); state.stream = null;
      state.due = Date.parse(capturedAt) + CAPTURE_INTERVAL;
      state.pending = { ...evidence, id: crypto.randomUUID(), capturedAt };
      // Persist before upload so the same capture ID can be retried safely.
      await saveCapture(user.id, state.pending).catch(() => {});
      setNext(new Date(state.due).toISOString());
      await submitPending();
    } catch (error) {
      if (!state.disposed && error.name !== 'AbortError') {
        state.error = error.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di browser.' : error.message || 'Kamera tidak tersedia.';
        state.permanentError = Boolean(state.pending && error.status >= 400 && error.status < 500 && error.status !== 429);
        setStatus(state.pending ? state.permanentError ? `Laporan belum diterima: ${state.error} Rekaman tetap tersimpan; tekan Kirim Ulang setelah diperbaiki.` : `Laporan menunggu koneksi, akan dicoba ulang: ${state.error}` : state.error);
        if (error.name === 'NotAllowedError') { state.enabled = false; setEnabled(false); }
      }
    } finally {
      state.stream?.getTracks().forEach(track => track.stop()); state.stream = null;
      if (video.current) video.current.srcObject = null;
      state.busy = false;
      if (!state.disposed) { setBusy(false); await heartbeat(); }
    }
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('Kamera memerlukan HTTPS dan browser yang mendukung.'); return; }
    const state = runtime.current;
    state.enabled = true; state.starting = true; state.error = ''; setEnabled(true); setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      state.stream = stream;
      if (state.disposed || !state.enabled) { stream.getTracks().forEach(track => track.stop()); return; }
      // Refresh the clock before recording after a long background suspension.
      await apiGet('/health').catch(() => {});
      state.starting = false;
      setStatus('Pemantauan kamera aktif');
      await capture(false, stream);
    } catch (error) {
      state.enabled = false;
      state.error = error.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di browser.' : error.message || 'Kamera tidak tersedia.';
      if (!state.disposed) { setEnabled(false); setStatus(state.error); }
    } finally {
      state.starting = false;
      if (!state.disposed) { setBusy(false); heartbeat(); }
    }
  };
  const stop = () => {
    const state = runtime.current;
    state.enabled = false; state.controller?.abort(); state.stream?.getTracks().forEach(track => track.stop());
    setEnabled(false); setStatus(state.pending ? 'Pemantauan berhenti; laporan tersimpan menunggu pengiriman' : 'Pemantauan kamera dihentikan');
    heartbeat();
  };

  useEffect(() => {
    const state = runtime.current;
    state.disposed = false;
    // Starting a new dashboard never silently reopens the camera.
    const initialize = apiGet(`/driver/${user.id}/fatigue`).then(result => {
      if (state.disposed) return;
      const serverDue = result.monitoring?.next_capture_at ? Date.parse(result.monitoring.next_capture_at) : 0;
      const lastCaptureDue = result.latest?.captured_at ? Date.parse(result.latest.captured_at) + CAPTURE_INTERVAL : 0;
      state.due = Math.max(state.due || 0, serverDue, lastCaptureDue) || null;
      setNext(state.due ? new Date(state.due).toISOString() : null);
      setLast(result.latest?.created_at || null);
      heartbeat();
    }).catch(() => {});
    const restore = pendingCapture(user.id).then(evidence => {
      if (state.disposed || !evidence) return;
      state.pending = evidence;
      state.due = Math.max(state.due || 0, Date.parse(evidence.capturedAt) + CAPTURE_INTERVAL);
      setNext(new Date(state.due).toISOString());
      setStatus('Laporan tersimpan akan dikirim ulang');
    }).catch(() => {});
    Promise.all([initialize, restore]).finally(() => { if (!state.disposed) setReady(true); });
    return () => {
      state.enabled = false;
      heartbeat();
      state.disposed = true; state.controller?.abort(); state.stream?.getTracks().forEach(track => track.stop());
    };
  }, [user.id]);

  useEffect(() => {
    const tick = async () => {
      const state = runtime.current;
      if (state.disposed || state.busy || state.starting) return;
      if (state.pending && !state.permanentError) {
        state.busy = true;
        try { await submitPending(); } catch (error) {
          state.error = error.message;
          state.permanentError = error.status >= 400 && error.status < 500 && error.status !== 429;
          setStatus(state.permanentError ? `Laporan belum diterima: ${error.message} Rekaman tetap tersimpan; tekan Kirim Ulang setelah diperbaiki.` : `Laporan menunggu koneksi, akan dicoba ulang: ${error.message}`);
        }
        finally { state.busy = false; }
      }
      if (!state.pending && state.enabled && (!state.due || serverNow() >= state.due)) {
        if (document.visibilityState === 'visible') await capture();
        else setStatus('Jadwal kamera tertunda. Kembali ke aplikasi untuk melanjutkan.');
      }
      await heartbeat();
    };
    const resume = () => {
      if (document.visibilityState === 'visible') tick();
      else if (runtime.current.busy) runtime.current.controller?.abort();
    };
    const timer = setInterval(tick, 30000);
    if (ready) tick();
    document.addEventListener('visibilitychange', resume); window.addEventListener('online', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', tick); };
  }, [user.id, mode, ready]);

  const retry = async () => {
    const state = runtime.current;
    if (state.busy) return;
    state.busy = true; setBusy(true);
    try { await apiGet('/health'); await submitPending(); }
    catch (error) { setStatus(`Laporan belum diterima: ${error.message}. Rekaman tetap tersimpan.`); }
    finally { state.busy = false; setBusy(false); }
  };

  return <div className="card mb fatigue-monitor">
    <strong>Pemantauan Kondisi Sopir / Fatigue</strong>
    <p className="text-sm">Kamera depan mengambil foto atau video 7 detik setiap 30 menit dan mengirimkannya ke manager untuk peninjauan. Aktifkan saat kendaraan berhenti, arahkan kamera ke wajah, dan biarkan aplikasi terbuka.</p>
    <div className="flex-row gap-sm">
      <select aria-label="Mode kamera fatigue" value={mode} disabled={enabled || busy} onChange={event => setMode(event.target.value)}>
        <option value="video">Video 7 detik (foto jika video tidak didukung)</option><option value="foto">Foto</option>
      </select>
      <button type="button" className="btn btn-sm btn-primary" disabled={!ready || (!enabled && busy)} onClick={enabled ? stop : start}>{enabled ? 'Hentikan Pemantauan' : 'Aktifkan Kamera'}</button>
      {enabled && <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={() => capture(true)}>Ambil Sekarang</button>}
      {runtime.current.pending && <button type="button" className="btn btn-sm btn-outline" disabled={busy} onClick={retry}>Kirim Ulang Rekaman</button>}
    </div>
    <p className="text-sm" role="status">{status}{enabled && next && <> · Jadwal berikutnya {fmtWaktu(next)}</>}{last && <> · Submit terakhir {fmtWaktu(last)}</>}</p>
    <video ref={video} autoPlay playsInline muted className="fatigue-preview" style={{ display: busy ? 'block' : 'none' }} />
    <small className="muted">{enabled ? 'Izin kamera sudah diberikan. Pemantauan aktif.' : 'Tekan Aktifkan Kamera untuk memulai pemantauan.'} Saat layar terkunci atau browser berhenti di latar belakang, perekaman dilanjutkan saat aplikasi aktif kembali.</small>
  </div>;
}
