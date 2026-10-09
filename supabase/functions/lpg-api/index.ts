import { createClient } from 'supabase';
import { openDatabase, queries } from './database.js';
import { createRouter, upload, parseRequest, createResponse } from './router.js';
import { registerRoutes } from './routes.js';
import { login, authenticate, authorize } from './security.js';
import { storage } from './storage.js';
import { ensureDailyRoutes } from './daily-routes.js';
import { formatDate } from './format.js';
import { largeMedia } from './large-media.js';

const database = openDatabase(Deno.env.get('SUPABASE_DB_URL'));
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const media = largeMedia(database, supabase, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, Deno.env.get('SUPABASE_URL')!);
const files = storage(supabase, media);
const app = createRouter();
registerRoutes(app, { ...queries(database), database, upload, ...files });
let routeDate = '';

Deno.serve(async (request: Request) => {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, range',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, HEAD, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Range, Accept-Ranges',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    const path = new URL(request.url).pathname.replace(/^\/functions\/v1\/lpg-api/, '').replace(/^\/lpg-api/, '');
    const response = createResponse(headers, files.signMedia);
    if (path.startsWith('/media/') && ['GET', 'HEAD'].includes(request.method)) return await media.serve(request, decodeURIComponent(path.slice(7)), headers);
    if (path === '/api/login' && request.method === 'POST') return response.json(await login(database, await request.json()));
    const user = await authenticate(database, request);
    if (path === '/api/files/plan' && request.method === 'POST') return response.json(await media.plan(user, await request.json()));
    const part = path.match(/^\/api\/files\/part\/([^/]+)\/(\d+)$/);
    if (part && request.method === 'PUT') return response.json(await media.part(user, decodeURIComponent(part[1]), Number(part[2]), request));
    if (path === '/api/files/finish' && request.method === 'POST') return response.json(await media.finish(user, (await request.json()).filename));
    if (path === '/api/logout' && request.method === 'POST') {
      await database.unsafe('DELETE FROM lpg_private.sessions WHERE token_hash = $1', [user.token_hash]);
      return response.json({ ok: true });
    }
    if (path === '/api/session' && request.method === 'GET') return response.json({ user: { role: user.role, id: user.id, nama: user.nama } });
    if (path === '/api/health' && request.method === 'GET') {
      await database.unsafe('SELECT 1');
      return response.json({ ok: true, backend: 'supabase', date: formatDate() });
    }
    // Authenticated manager utility for preserving historical attachment filenames.
    if (path === '/api/manager/import-upload' && request.method === 'POST') {
      if (user.role !== 'manager') return response.status(403).json({ error: 'Akses hanya untuk manager.' });
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(file.name) || file.size > 52428800) return response.status(400).json({ error: 'File tidak valid.' });
      const { error } = await supabase.storage.from('lpg-uploads').upload(file.name, file, { contentType: file.type, upsert: false });
      if (error && String(error.statusCode) !== '409') throw error;
      return response.json({ ok: true, existed: !!error });
    }
    // Clean up only unreferenced attachment objects after a migration/test run.
    if (path === '/api/manager/cleanup-uploads' && request.method === 'POST') {
      if (user.role !== 'manager') return response.status(403).json({ error: 'Akses hanya untuk manager.' });
      const { filenames } = await request.json();
      if (!Array.isArray(filenames) || filenames.length > 50 || filenames.some(name => typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name))) return response.status(400).json({ error: 'Daftar file tidak valid.' });
      for (const name of filenames) {
        const [references] = await database.unsafe(`SELECT EXISTS (
          SELECT 1 FROM sopir WHERE sertifikat_k3 = $1
          UNION ALL SELECT 1 FROM pengiriman WHERE $1 IN (foto_sebelum, foto_proses, foto_sesudah, tanda_tangan)
          UNION ALL SELECT 1 FROM laporan_bahaya WHERE foto_bukti = $1
          UNION ALL SELECT 1 FROM inspeksi_pagi WHERE position($1 IN coalesce(lampiran_json, '')) > 0
            OR $1 IN (foto_kendaraan, foto_ban, foto_rem, foto_lampu, foto_bak, foto_kebocoran, foto_pemadam, foto_p3k,
              foto_kit, foto_dokumen, foto_tangki, foto_integritas_bak, foto_kit_tumpah, foto_sopir_fit)
        ) AS found`, [name]);
        if (references.found) return response.status(409).json({ error: 'File masih dipakai oleh data operasional.' });
      }
      const manifests = await database.unsafe('SELECT filename, parts FROM lpg_private.media_files WHERE filename = ANY($1::text[])', [filenames]);
      const manifestMap = new Map(manifests.map(file => [file.filename, file.parts as string[]]));
      const objects = filenames.flatMap(name => manifestMap.get(name) || [name]);
      const { error } = await supabase.storage.from('lpg-uploads').remove(objects);
      if (error) throw error;
      await database.unsafe('DELETE FROM lpg_private.media_files WHERE filename = ANY($1::text[])', [filenames]);
      return response.json({ ok: true, removed: filenames.length });
    }
    const route = app.match(request.method, path);
    if (!route) return response.status(404).json({ error: 'Endpoint tidak ditemukan.' });
    // Reject unauthorized roles and driver IDs before reading multipart attachments.
    if (path.startsWith('/api/manager/') && user.role !== 'manager') return response.status(403).json({ error: 'Akses hanya untuk manager.' });
    if (path.startsWith('/api/driver/') && (user.role !== 'driver' || (route.params.id && Number(route.params.id) !== user.id))) return response.status(403).json({ error: 'Akses data sopir tidak diizinkan.' });
    const req = await parseRequest(request, route);
    await authorize(database, req, path, request.method, user);
    for (const upload of Object.values(req.files).flat() as Array<{ savedFilename?: string }>) {
      if (upload.savedFilename) await media.verifyUpload(user, upload.savedFilename);
    }
    if (routeDate !== formatDate()) { await ensureDailyRoutes(database, formatDate()); routeDate = formatDate(); }
    await route.handler(req, response);
    return await response.finish();
  } catch (cause) {
    const err = cause as Error & { status?: number };
    console.error('LPG API:', err.message);
    return new Response(JSON.stringify({ error: err.status ? err.message : 'Terjadi kesalahan pada server.' }), { status: err.status || 500, headers: new Headers([...headers, ['Content-Type', 'application/json']]) });
  }
});
