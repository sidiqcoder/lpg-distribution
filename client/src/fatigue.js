export const CAPTURE_INTERVAL = 30 * 60 * 1000;

// Keep one unsent capture across navigation, reloads and temporary outages.
async function queue(action, id, value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('lpg-fatigue', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pending');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('pending', action === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('pending');
      const request = action === 'get' ? store.get(id) : action === 'put' ? store.put(value, id) : store.delete(id);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export const pendingCapture = id => queue('get', id);
export const saveCapture = (id, value) => queue('put', id, value);
export const clearCapture = id => queue('delete', id);

export async function captureEvidence(stream, video, mode, signal) {
  video.srcObject = stream;
  await new Promise((resolve, reject) => {
    const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => { clean(); reject(new DOMException('Dibatalkan', 'AbortError')); };
    const timer = setTimeout(() => { clean(); reject(new Error('Kamera terlalu lama menyiapkan gambar. Coba lagi.')); }, 15000);
    signal.addEventListener('abort', abort, { once: true });
    video.play().then(() => { clean(); resolve(); }, error => { clean(); reject(error); });
  });
  if (signal.aborted) throw new DOMException('Dibatalkan', 'AbortError');
  const types = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  const mime = typeof MediaRecorder !== 'undefined' && types.find(type => MediaRecorder.isTypeSupported(type));
  if (mode === 'video' && mime) {
    return await new Promise((resolve, reject) => {
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 600000 });
      const chunks = [];
      const started = performance.now();
      let timer;
      const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
      const abort = () => { clean(); recorder.onstop = null; if (recorder.state !== 'inactive') recorder.stop(); reject(new DOMException('Dibatalkan', 'AbortError')); };
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { clean(); reject(new Error('Kamera gagal merekam video. Coba mode foto.')); };
      recorder.onstop = () => {
        clean();
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const elapsed = (performance.now() - started) / 1000;
        if (!blob.size) reject(new Error('Rekaman kosong. Coba lagi.'));
        else if (elapsed < 5 || elapsed > 10) reject(new Error('Rekaman terganggu. Durasi harus 5–10 detik. Coba lagi.'));
        else resolve({ blob, kind: 'video', duration: Math.round(elapsed) });
      };
      signal.addEventListener('abort', abort, { once: true });
      recorder.start();
      timer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 7000);
    });
  }
  if (!video.videoWidth || !video.videoHeight) throw new Error('Gambar kamera belum tersedia. Coba lagi.');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob || signal.aborted) throw new Error('Foto gagal diambil.');
  return { blob, kind: 'foto', duration: 0 };
}
