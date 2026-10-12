import { AwsClient } from 'aws4fetch';

const fail = (status, message) => Object.assign(new Error(message), { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VIDEO = 2 * 1024 ** 3;
export const isR2Name = name => typeof name === 'string' && name.startsWith('r2-');

export function r2Configuration(get) {
  const names = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const values = Object.fromEntries(names.map(name => [name, get(name)?.trim() || '']));
  const missing = names.filter(name => !values[name]);
  const provider = get('VIDEO_STORAGE_PROVIDER')?.trim() || (missing.length ? 'supabase' : 'r2');
  if (!['supabase', 'r2'].includes(provider)) throw new Error('VIDEO_STORAGE_PROVIDER harus supabase atau r2.');
  const valid = /^[a-f0-9]{32}$/i.test(values.R2_ACCOUNT_ID) && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(values.R2_BUCKET_NAME);
  return { ...values, provider, configured: !missing.length && valid, missing };
}

export function r2Storage(database, config, clientOverride) {
  const client = clientOverride || (config.configured ? new AwsClient({
    service: 's3', region: 'auto', accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY, retries: 2
  }) : null);
  const selected = () => config.provider === 'r2';
  const requireConfig = () => { if (!config.configured) throw fail(503, 'Penyimpanan video belum dikonfigurasi. Hubungi manager.'); };
  const url = key => `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${config.R2_BUCKET_NAME}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const signed = async (key, method, type, expires = 600) => {
    requireConfig();
    const request = await client.sign(`${url(key)}?X-Amz-Expires=${expires}`, {
      method, headers: type ? { 'Content-Type': type } : {}, aws: { signQuery: true, allHeaders: true }
    });
    return request.url;
  };
  const fetchObject = async (key, options = {}) => {
    requireConfig();
    const response = await client.fetch(url(key), { ...options, signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw fail(response.status === 404 ? 409 : 502, response.status === 404 ? 'Video belum selesai diunggah.' : 'Penyimpanan video tidak dapat diakses. Coba lagi.');
    }
    return response;
  };
  const owned = async (user, filename) => {
    const [file] = await database.unsafe('SELECT * FROM lpg_private.r2_files WHERE filename = $1 AND owner = $2', [filename, user.username]);
    if (!file) throw fail(403, 'Lampiran tidak diizinkan.');
    return file;
  };

  async function plan(user, body) {
    requireConfig();
    const { originalname, size, type, captureId, preserveName } = body;
    const purpose = body.purpose || 'report';
    if (typeof originalname !== 'string' || originalname.length > 240 || !/^video\//.test(type || '') || !Number.isSafeInteger(size) || size < 1 || size > MAX_VIDEO || !['fatigue', 'report', 'migration'].includes(purpose)) throw fail(400, 'Data unggahan video tidak valid.');
    if (purpose === 'fatigue' && (user.role !== 'driver' || !UUID.test(captureId || '') || size > 12 * 1024 ** 2)) throw fail(400, 'Rekaman fatigue harus maksimal 12 MB dan memiliki capture ID.');
    if ((preserveName || purpose === 'migration') && (user.role !== 'manager' || purpose !== 'migration' || !preserveName)) throw fail(403, 'Migrasi hanya untuk manager.');
    const extension = (originalname.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] || '.bin').toLowerCase();
    const filename = preserveName ? originalname : purpose === 'fatigue' ? `r2-fatigue-${user.id}-${captureId}${extension}` : `r2-${crypto.randomUUID()}${extension}`;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) throw fail(400, 'Nama file tidak valid.');
    if (purpose === 'migration') {
      const [source] = await database.unsafe(`SELECT 1 FROM (
        SELECT (metadata->>'size')::bigint AS size, metadata->>'mimetype' AS type FROM storage.objects WHERE bucket_id = 'lpg-uploads' AND name = $1
        UNION ALL SELECT total_size AS size, content_type AS type FROM lpg_private.media_files WHERE filename = $1 AND ready
      ) source WHERE size = $2 AND type = $3 AND type LIKE 'video/%' LIMIT 1`, [filename, size, type]);
      if (!source) throw fail(409, 'Video sumber tidak ditemukan atau metadata berbeda.');
    }
    const file = await database.begin(async tx => {
      await tx.unsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [filename]);
      const [existing] = await tx.unsafe('SELECT * FROM lpg_private.r2_files WHERE filename = $1', [filename]);
      if (existing) {
        if (existing.owner !== user.username || Number(existing.total_size) !== size || existing.content_type !== type || existing.purpose !== purpose) throw fail(409, 'Data unggahan berbeda dengan file sebelumnya.');
        return existing;
      }
      const key = `videos/${crypto.randomUUID()}${extension}`;
      const [created] = await tx.unsafe(`INSERT INTO lpg_private.r2_files (filename, owner, object_key, staging_key, total_size, content_type, purpose, capture_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [filename, user.username, key, `staging/${crypto.randomUUID()}${extension}`, size, type, purpose, purpose === 'fatigue' ? captureId : null]);
      return created;
    });
    return { provider: 'r2', filename, ready: file.ready, uploadUrl: file.ready ? null : await signed(file.staging_key, 'PUT', file.content_type), headers: { 'Content-Type': file.content_type } };
  }

  async function finish(user, filename) {
    requireConfig();
    // Copy from the temporary upload key to an immutable playback key. An old
    // upload URL cannot overwrite evidence after it has been submitted.
    const file = await database.begin(async tx => {
      const [file] = await tx.unsafe('SELECT * FROM lpg_private.r2_files WHERE filename = $1 AND owner = $2 FOR UPDATE', [filename, user.username]);
      if (!file) throw fail(403, 'Lampiran tidak diizinkan.');
      if (file.ready) return file;
      const head = await fetchObject(file.staging_key, { method: 'HEAD' });
      if (Number(head.headers.get('content-length')) !== Number(file.total_size) || head.headers.get('content-type') !== file.content_type) throw fail(400, 'Ukuran atau tipe video tidak sesuai dengan rencana unggahan.');
      const etag = head.headers.get('etag');
      if (!etag) throw fail(502, 'Verifikasi video gagal. Coba lagi.');
      const copied = await fetchObject(file.object_key, { method: 'PUT', headers: {
        'x-amz-copy-source': `/${config.R2_BUCKET_NAME}/${file.staging_key}`,
        'x-amz-copy-source-if-match': etag
      } });
      if (!/<CopyObjectResult[\s>]/.test(await copied.text())) throw fail(502, 'Video gagal diselesaikan. Coba lagi.');
      const verified = await fetchObject(file.object_key, { method: 'HEAD' });
      if (Number(verified.headers.get('content-length')) !== Number(file.total_size) || verified.headers.get('content-type') !== file.content_type || verified.headers.get('etag') !== etag) throw fail(502, 'Salinan video belum terverifikasi. Coba lagi.');
      await tx.unsafe('UPDATE lpg_private.r2_files SET ready = true, etag = $2, completed_at = now() WHERE filename = $1', [filename, etag]);
      return { ...file, ready: true };
    });
    // Best effort: a one-day lifecycle on staging/ removes any interrupted uploads.
    await fetchObject(file.staging_key, { method: 'DELETE' }).then(response => response.body?.cancel()).catch(() => {});
    return { ok: true, provider: 'r2', filename, size: Number(file.total_size) };
  }

  async function verifyUpload(user, filename) {
    const file = await owned(user, filename);
    if (!file.ready) throw fail(409, 'Unggahan video belum selesai.');
    return { mimetype: file.content_type, size: Number(file.total_size), provider: 'r2', purpose: file.purpose, captureId: file.capture_id };
  }

  async function proxyUpload(user, filename, request) {
    const file = await owned(user, filename);
    const limit = 12 * 1024 ** 2;
    if (file.purpose !== 'fatigue' || Number(file.total_size) > limit) throw fail(413, 'Jalur cadangan hanya untuk rekaman kamera maksimal 12 MB.');
    if (file.ready) return { ok: true, filename };
    if (!request.body) throw fail(400, 'Rekaman kamera kosong.');
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit || size > Number(file.total_size)) { await reader.cancel(); throw fail(413, 'Ukuran rekaman melebihi rencana unggahan.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (size !== Number(file.total_size)) throw fail(400, 'Ukuran rekaman tidak sesuai rencana unggahan.');
    const bytes = new Uint8Array(size);
    let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
    const response = await fetchObject(file.staging_key, { method: 'PUT', headers: { 'Content-Type': file.content_type }, body: bytes });
    await response.body?.cancel();
    return finish(user, filename);
  }

  async function sign(names) {
    const files = await database.unsafe('SELECT filename, object_key FROM lpg_private.r2_files WHERE ready AND filename = ANY($1::text[])', [names]);
    return new Map(await Promise.all(files.map(async file => [file.filename, config.configured ? await signed(file.object_key, 'GET', null, 3600) : ''])));
  }

  async function save(file, user) {
    if (!user?.username) throw fail(403, 'Pemilik video tidak ditemukan.');
    const upload = await plan(user, { originalname: file.originalname, size: file.buffer.length, type: file.mimetype });
    const record = await owned(user, upload.filename);
    const response = await fetchObject(record.staging_key, { method: 'PUT', headers: { 'Content-Type': file.mimetype }, body: file.buffer });
    await response.body?.cancel();
    await finish(user, upload.filename);
    return upload.filename;
  }

  async function remove(names) {
    const files = await database.unsafe('SELECT * FROM lpg_private.r2_files WHERE filename = ANY($1::text[])', [names]);
    for (const file of files) for (const key of [file.object_key, file.staging_key]) {
      const response = await fetchObject(key, { method: 'DELETE' });
      await response.body?.cancel();
    }
    await database.unsafe('DELETE FROM lpg_private.r2_files WHERE filename = ANY($1::text[])', [files.map(file => file.filename)]);
    return files.map(file => file.filename);
  }
  return { selected, plan, finish, proxyUpload, verifyUpload, sign, save, remove, status: () => ({ videoProvider: config.provider, r2Configured: config.configured, missing: config.missing }) };
}
