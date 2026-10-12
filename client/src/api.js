import { syncClock } from './clock';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const BASE = `${SUPABASE_URL}/functions/v1/lpg-api/api`;
const TOKEN_KEY = 'lpg:session';
export const getToken = () => localStorage.getItem(TOKEN_KEY);

function headers(extra = {}) {
  return {
    Accept: 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...extra
  };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('lpg:user');
}

async function request(url, options, attempts = 1) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const timeout = AbortSignal.timeout(options.body instanceof FormData || options.body instanceof Blob ? 120000 : 20000);
      const started = Date.now();
      const response = await fetch(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout });
      if (url.startsWith(BASE + '/')) syncClock(response, started);
      if (response.status >= 500 && attempt + 1 < attempts) {
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      response.sessionToken = options.headers?.Authorization?.replace(/^Bearer /i, '') || null;
      return response;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (attempt + 1 === attempts) throw new Error(error.name === 'TimeoutError' ? 'Koneksi terlalu lama. Silakan coba lagi.' : 'Koneksi terputus. Periksa internet lalu coba lagi.');
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

function buildUrl(path, params) {
  if (!SUPABASE_URL) throw new Error('Koneksi aplikasi belum dikonfigurasi.');
  const url = new URL(BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  return url.href;
}

async function handle(res, path) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    if (res.status === 401 && path !== '/login' && res.sessionToken === getToken() && data?.code === 'SESSION_EXPIRED') {
      clearSession();
      window.dispatchEvent(new Event('lpg:session-expired'));
    }
    const message = (data && data.error) || (typeof data === 'string' && data) || `Permintaan gagal (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  if (path === '/login' && data?.token) localStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

export function apiGet(path, params, options = {}) {
  return request(buildUrl(path, params), { headers: headers(), ...options }, 2).then(res => handle(res, path));
}

export function apiJson(path, body, method = 'POST') {
  return request(buildUrl(path), {
    method,
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  }).then(res => handle(res, path));
}

export async function apiForm(path, formData, method = 'POST') {
  // Upload planning must not consume the caller's form when a request needs retrying.
  const copy = new FormData();
  for (const [key, value] of formData) copy.append(key, value);
  formData = copy;
  const totalBytes = [...formData.values()].reduce((sum, file) => sum + (file instanceof File ? file.size : 0), 0);
  for (const [field, file] of [...formData.entries()]) {
    if (file instanceof File && file.size > 0 && (/^video\//.test(file.type) || file.size > 16 * 1024 * 1024 || totalBytes > 16 * 1024 * 1024)) {
      const plan = await apiJson('/files/plan', { originalname: file.name, size: file.size, type: file.type, chunked: totalBytes > 16 * 1024 * 1024,
        ...(path === '/driver/fatigue' ? { purpose: 'fatigue', captureId: formData.get('capture_id') } : {}) });
      if (plan.inline) continue;
      if (!plan.ready) {
        if (plan.provider === 'r2') {
          // Only R2's signed headers go to R2. Never forward app session/API keys.
          try {
            const result = await request(plan.uploadUrl, { method: 'PUT', headers: plan.headers, body: file,
              ...(path === '/driver/fatigue' ? { signal: AbortSignal.timeout(20000) } : {}) }, path === '/driver/fatigue' ? 1 : 3);
            await result.body?.cancel();
            if (!result.ok) throw new Error('Video gagal diunggah. Periksa koneksi lalu coba lagi.');
          } catch (error) {
            if (path !== '/driver/fatigue' || file.size > 12 * 1024 ** 2) throw error;
            // Small camera evidence can go through the API when direct R2 access fails.
            // The same owned upload plan/capture ID is kept for safe retries.
            const result = await request(buildUrl(`/files/proxy/${encodeURIComponent(plan.filename)}`), {
              method: 'PUT', headers: headers({ 'Content-Type': 'application/octet-stream' }), body: file
            });
            await handle(result, '/files/proxy');
          }
        } else {
          for (let index = 0; index < plan.count; index++) {
            const part = file.slice(index * plan.partBytes, Math.min(file.size, (index + 1) * plan.partBytes));
            const result = await request(buildUrl(`/files/part/${encodeURIComponent(plan.filename)}/${index}`), {
              method: 'PUT', headers: headers({ 'Content-Type': 'application/octet-stream' }), body: part
            }, 3);
            await handle(result, '/files/part');
          }
        }
        await apiJson('/files/finish', { filename: plan.filename });
      }
      formData.delete(field);
      formData.set(`uploaded_${field}`, plan.filename);
    }
  }
  return request(buildUrl(path), { method, body: formData, headers: headers() }).then(res => handle(res, path));
}

export const uploadUrl = (filename) => {
  if (!filename) return '';
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  return '';
};

export async function downloadExport(date) {
  const response = await request(buildUrl('/manager/export.xlsx', { date }), { headers: headers() }, 2);
  if (!response.ok) return handle(response, '/manager/export.xlsx');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `laporan-dashboard-${date}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
