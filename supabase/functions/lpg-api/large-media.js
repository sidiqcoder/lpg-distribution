const BUCKET = 'lpg-uploads';
export const PART_BYTES = 16 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status });

export function largeMedia(database, supabase, secret, projectUrl) {
  const base = `${projectUrl}/functions/v1/lpg-api/media/`;
  const key = crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const bytes = text => new TextEncoder().encode(text);
  const hex = value => Array.from(new Uint8Array(value)).map(byte => byte.toString(16).padStart(2, '0')).join('');

  async function plan(user, body) {
    const { originalname, size, type, preserveName } = body;
    if (typeof originalname !== 'string' || !/^(image\/|video\/|application\/pdf$)/.test(type || '') || !Number.isSafeInteger(size) || size < 1 || size > 2 * 1024 ** 3) throw fail(400, 'File tidak valid.');
    if (preserveName && user.role !== 'manager') throw fail(403, 'Akses hanya untuk manager.');
    const suffix = originalname.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] || '.bin';
    const filename = preserveName ? originalname : `${Date.now()}-${crypto.randomUUID()}${suffix}`;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) throw fail(400, 'Nama file tidak valid.');
    const parts = Array.from({ length: Math.ceil(size / PART_BYTES) }, (_, index) => `chunks/${filename}/${index}`);
    const [existing] = await database.unsafe('SELECT * FROM lpg_private.media_files WHERE filename = $1', [filename]);
    if (existing && (existing.owner !== user.username || existing.total_size !== size || existing.content_type !== type)) throw fail(409, 'File dengan nama ini sudah ada.');
    if (!existing) await database.unsafe(`INSERT INTO lpg_private.media_files (filename,owner,total_size,content_type,parts)
      VALUES ($1,$2,$3,$4,$5::jsonb)`, [filename, user.username, size, type, parts]);
    return { filename, partBytes: PART_BYTES, count: parts.length, ready: !!existing?.ready, uploaded: existing?.uploaded || [] };
  }

  async function part(user, filename, index, request) {
    const [file] = await database.unsafe('SELECT * FROM lpg_private.media_files WHERE filename = $1 AND owner = $2', [filename, user.username]);
    if (!file || file.ready || !Number.isInteger(index) || index < 0 || index >= file.parts.length) throw fail(400, 'Bagian unggahan tidak valid.');
    const expected = Math.min(PART_BYTES, file.total_size - index * PART_BYTES);
    if (Number(request.headers.get('content-length')) > PART_BYTES) throw fail(413, 'Bagian file terlalu besar.');
    const body = await request.arrayBuffer();
    if (body.byteLength !== expected) throw fail(400, 'Ukuran bagian file tidak sesuai.');
    const { error } = await supabase.storage.from(BUCKET).upload(file.parts[index], body, { contentType: 'application/octet-stream', upsert: true });
    if (error) throw error;
    await database.unsafe(`UPDATE lpg_private.media_files SET uploaded = ARRAY(SELECT DISTINCT unnest(uploaded || ARRAY[$2::int]))
      WHERE filename = $1`, [filename, index]);
    return { ok: true };
  }

  async function finish(user, filename) {
    const [file] = await database.unsafe('SELECT * FROM lpg_private.media_files WHERE filename = $1 AND owner = $2', [filename, user.username]);
    if (!file || file.uploaded.length !== file.parts.length) throw fail(409, 'Unggahan belum lengkap.');
    await database.unsafe('UPDATE lpg_private.media_files SET ready = true WHERE filename = $1', [filename]);
    return { ok: true, filename, url: (await sign([filename])).get(filename), size: file.total_size };
  }

  async function sign(names) {
    const files = await database.unsafe('SELECT filename FROM lpg_private.media_files WHERE ready AND filename = ANY($1::text[])', [names]);
    const expires = Math.floor(Date.now() / 1000) + 3600;
    return new Map(await Promise.all(files.map(async file => {
      const signature = hex(await crypto.subtle.sign('HMAC', await key, bytes(`${file.filename}:${expires}`)));
      return [file.filename, `${base}${encodeURIComponent(file.filename)}?expires=${expires}&signature=${signature}`];
    })));
  }

  async function verifyUpload(user, filename) {
    const [file] = await database.unsafe('SELECT filename, content_type, total_size FROM lpg_private.media_files WHERE filename = $1 AND owner = $2 AND ready', [filename, user.username]);
    if (!file) throw fail(403, 'Lampiran tidak diizinkan.');
    return { mimetype: file.content_type, size: Number(file.total_size), provider: 'supabase' };
  }

  async function serve(request, filename, headers) {
    const url = new URL(request.url);
    const expires = Number(url.searchParams.get('expires'));
    const signature = url.searchParams.get('signature') || '';
    if (!Number.isInteger(expires) || expires < Date.now() / 1000 || expires > Date.now() / 1000 + 3601 || !/^[a-f0-9]{64}$/.test(signature)) throw fail(403, 'Tautan lampiran tidak valid atau kedaluwarsa.');
    const signatureBytes = new Uint8Array(signature.match(/../g).map(pair => parseInt(pair, 16)));
    if (!await crypto.subtle.verify('HMAC', await key, signatureBytes, bytes(`${filename}:${expires}`))) throw fail(403, 'Tautan lampiran tidak valid.');
    const [file] = await database.unsafe('SELECT * FROM lpg_private.media_files WHERE filename = $1 AND ready', [filename]);
    if (!file) throw fail(404, 'File tidak ditemukan.');
    let start = 0, end = file.total_size - 1;
    const range = request.headers.get('range');
    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match || (!match[1] && !match[2])) throw fail(416, 'Range tidak valid.');
      if (!match[1]) start = Math.max(0, file.total_size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= file.total_size) return new Response(null, { status: 416, headers: new Headers([...headers, ['Content-Range', `bytes */${file.total_size}`]]) });
    }
    headers.set('Content-Type', file.content_type);
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Disposition', `inline; filename="${filename}"`);
    if (range) headers.set('Content-Range', `bytes ${start}-${end}/${file.total_size}`);
    if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
    const abort = new AbortController();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for (let i = Math.floor(start / PART_BYTES); i <= Math.floor(end / PART_BYTES); i++) {
            const low = Math.max(0, start - i * PART_BYTES);
            const high = Math.min(PART_BYTES - 1, end - i * PART_BYTES);
            const objectUrl = `${projectUrl}/storage/v1/object/authenticated/${BUCKET}/${file.parts[i]}`;
            const result = await fetch(objectUrl, { headers: { Authorization: `Bearer ${secret}`, apikey: secret, Range: `bytes=${low}-${high}` }, signal: abort.signal });
            if (!result.ok || result.status !== 206) throw new Error('Bagian video tidak dapat dibaca.');
            const reader = result.body.getReader();
            while (true) { const { value, done } = await reader.read(); if (done) break; controller.enqueue(value); }
          }
          controller.close();
        } catch (error) { if (!abort.signal.aborted) controller.error(error); }
      },
      cancel() { abort.abort(); }
    });
    return new Response(body, { status: range ? 206 : 200, headers });
  }
  return { plan, part, finish, sign, serve, verifyUpload };
}
