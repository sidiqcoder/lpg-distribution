import assert from 'node:assert/strict';
import { AwsClient } from 'aws4fetch';
import { r2Configuration, r2Storage } from '../functions/lpg-api/r2.js';
import { storage } from '../functions/lpg-api/storage.js';
import { createRouter, upload } from '../functions/lpg-api/router.js';
import { registerMonitoring } from '../functions/lpg-api/monitoring.js';

const settings = { R2_ACCOUNT_ID: 'a'.repeat(32), R2_BUCKET_NAME: 'lpg-videos', R2_ACCESS_KEY_ID: 'test-access', R2_SECRET_ACCESS_KEY: 'private-test-secret' };
const config = r2Configuration(name => settings[name]);
const user = { role: 'driver', id: 1, username: 'driver-test' };

function fixture({ size = 6, type = 'video/webm', etag = '"proof"' } = {}) {
  const rows = new Map(), objects = new Map(), operations = [];
  const database = { begin: callback => callback(database), unsafe: async (sql, params = []) => {
    if (sql.startsWith('SELECT pg_advisory')) return [];
    if (sql.startsWith('INSERT INTO lpg_private.r2_files')) {
      const [filename, owner, object_key, staging_key, total_size, content_type, purpose, capture_id] = params;
      const row = { filename, owner, object_key, staging_key, total_size, content_type, purpose, capture_id, ready: false };
      rows.set(filename, row); return [row];
    }
    if (sql.startsWith('UPDATE lpg_private.r2_files')) { rows.get(params[0]).ready = true; return []; }
    if (sql.includes('filename = ANY')) return [...rows.values()].filter(row => row.ready && params[0].includes(row.filename));
    const file = rows.get(params[0]);
    return file && (!sql.includes('owner = $2') || file.owner === params[1]) ? [file] : [];
  } };
  const signer = new AwsClient({ service: 's3', region: 'auto', accessKeyId: settings.R2_ACCESS_KEY_ID, secretAccessKey: settings.R2_SECRET_ACCESS_KEY });
  const client = { sign: (...args) => signer.sign(...args), fetch: async (url, options) => {
    const key = new URL(url).pathname.split('/').slice(2).join('/'); operations.push({ key, ...options });
    if (options.method === 'HEAD') {
      if (!objects.has(key)) return new Response(null, { status: 404 });
      return new Response(null, { headers: { 'Content-Length': String(size), 'Content-Type': type, ETag: etag } });
    }
    if (options.method === 'DELETE') { objects.delete(key); return new Response(null, { status: 204 }); }
    if (options.headers?.['x-amz-copy-source']) { objects.set(key, objects.get(options.headers['x-amz-copy-source'].split('/').slice(2).join('/'))); return new Response('<CopyObjectResult><ETag>proof</ETag></CopyObjectResult>'); }
    objects.set(key, options.body); return new Response(null, { status: 200 });
  } };
  return { r2: r2Storage(database, config, client), rows, objects, operations, database };
}

Deno.test('R2 configuration preserves the current provider until credentials exist and fails explicitly when R2 is selected', async () => {
  assert.equal(r2Configuration(() => undefined).provider, 'supabase');
  const missing = r2Configuration(name => name === 'VIDEO_STORAGE_PROVIDER' ? 'r2' : undefined);
  assert.equal(missing.configured, false);
  assert.equal(missing.missing.length, 4);
  await assert.rejects(() => r2Storage({}, missing).plan(user, {}), { status: 503 });
  assert.equal(config.provider, 'r2'); assert.equal(config.configured, true);
});

Deno.test('R2 upload signature binds temporary key and type; playback signature grants only finalized object access', async () => {
  const f = fixture();
  const plan = await f.r2.plan(user, { originalname: 'capture.webm', size: 6, type: 'video/webm', purpose: 'fatigue', captureId: crypto.randomUUID() });
  const put = new URL(plan.uploadUrl), row = f.rows.get(plan.filename);
  assert.match(put.pathname, /\/staging\//);
  assert.equal(put.searchParams.get('X-Amz-Expires'), '600');
  assert.equal(put.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host');
  assert.equal(plan.headers['Content-Type'], 'video/webm');
  assert.ok(!plan.uploadUrl.includes(settings.R2_SECRET_ACCESS_KEY));
  assert.equal((await f.r2.sign([plan.filename])).size, 0);
  f.objects.set(row.staging_key, new Uint8Array(6));
  await f.r2.finish(user, plan.filename);
  const read = new URL((await f.r2.sign([plan.filename])).get(plan.filename));
  assert.match(read.pathname, /\/videos\//);
  assert.equal(read.searchParams.get('X-Amz-Expires'), '3600');
  assert.equal(f.operations.filter(operation => operation.headers?.['x-amz-copy-source']).length, 1);
  assert.ok(f.objects.has(row.object_key)); assert.ok(!f.objects.has(row.staging_key));
  // Reusing a stale PUT URL can recreate staging, but cannot alter the finalized object.
  const original = f.objects.get(row.object_key);
  f.objects.set(row.staging_key, new Uint8Array([9]));
  await f.r2.finish(user, plan.filename);
  assert.equal(f.objects.get(row.object_key), original);
  assert.equal(f.operations.filter(operation => operation.headers?.['x-amz-copy-source']).length, 1);
});

Deno.test('R2 rejects unfinished, foreign-owner, oversize and inconsistent uploads before reports can reference them', async () => {
  const f = fixture({ size: 7 });
  const body = { originalname: 'capture.webm', size: 6, type: 'video/webm', purpose: 'fatigue', captureId: crypto.randomUUID() };
  const plan = await f.r2.plan(user, body);
  assert.equal((await f.r2.plan(user, body)).filename, plan.filename);
  await assert.rejects(() => f.r2.plan(user, { ...body, size: 7 }), { status: 409 });
  await assert.rejects(() => f.r2.plan(user, { ...body, size: 13 * 1024 ** 2 }), { status: 400 });
  await assert.rejects(() => f.r2.verifyUpload(user, plan.filename), { status: 409 });
  await assert.rejects(() => f.r2.finish({ ...user, username: 'another-driver' }, plan.filename), { status: 403 });
  f.objects.set(f.rows.get(plan.filename).staging_key, new Uint8Array(7));
  await assert.rejects(() => f.r2.finish(user, plan.filename), { status: 400 });
  assert.equal(f.rows.get(plan.filename).ready, false);
  assert.equal(f.operations.filter(operation => operation.headers?.['x-amz-copy-source']).length, 0);
});

Deno.test('R2 rejects a type mismatch even when byte count matches', async () => {
  const f = fixture({ type: 'image/jpeg' });
  const plan = await f.r2.plan(user, { originalname: 'capture.webm', size: 6, type: 'video/webm' });
  f.objects.set(f.rows.get(plan.filename).staging_key, new Uint8Array(6));
  await assert.rejects(() => f.r2.finish(user, plan.filename), { status: 400 });
  assert.equal(f.rows.get(plan.filename).ready, false);
});

Deno.test('migration cannot replace a source filename without matching an existing video', async () => {
  const f = fixture();
  const body = { originalname: 'old-photo.jpg', size: 6, type: 'video/mp4', purpose: 'migration', preserveName: true };
  await assert.rejects(() => f.r2.plan(user, body), { status: 403 });
  await assert.rejects(() => f.r2.plan({ role: 'manager', username: 'manager' }, body), { status: 409 });
  assert.equal(f.rows.size, 0);
});

Deno.test('mixed report signing prefers migrated R2 originals, retains legacy media and never saves signed URLs', async () => {
  const calls = [];
  const files = storage({ storage: { from: () => ({ createSignedUrls: names => { calls.push(names); return { data: names.map(path => ({ path, signedUrl: `https://supabase.test/${path}` })) }; } }) } },
    { sign: names => new Map(names.includes('large.mp4') ? [['large.mp4', 'https://supabase.test/chunks']] : []) },
    { sign: () => new Map([['migrated.mp4', 'https://r2.test/signed-video']]) });
  const original = { created_at: new Date('2026-10-11T00:00:00Z'), lampiran_json: JSON.stringify({ section: { video: 'migrated.mp4', foto: 'proof.jpg' } }), reports: [{ video: 'large.mp4' }] };
  const result = await files.signMedia(original);
  assert.equal(JSON.parse(result.lampiran_json).section.video, 'https://r2.test/signed-video');
  assert.equal(result.reports[0].video, 'https://supabase.test/chunks');
  assert.deepEqual(calls, [['proof.jpg']]);
  assert.equal(JSON.parse(original.lampiran_json).section.video, 'migrated.mp4');
});

Deno.test('fatigue verifies the capture ID of an uploaded R2 attachment', async () => {
  const app = createRouter();
  const captureId = crypto.randomUUID();
  const saved = [];
  const database = { begin: fn => fn({ unsafe: async sql => sql.startsWith('INSERT') ? [{ id: 9, created_at: new Date() }] : [] }) };
  registerMonitoring(app, { database, upload, saveUploadedFile: file => { saved.push(file.savedFilename); return file.savedFilename; } });
  const req = { user, body: { capture_id: captureId, captured_at: new Date().toISOString(), kind: 'video', duration_seconds: 7 } };
  req.file = { savedFilename: 'r2-proof.webm', savedMetadata: { provider: 'r2', size: 6, mimetype: 'video/webm', purpose: 'fatigue', captureId: crypto.randomUUID() } };
  const handler = app.match('POST', '/api/driver/fatigue').handler;
  await assert.rejects(() => handler(req, {}), { status: 400 });
  req.file.savedMetadata.captureId = captureId;
  await handler(req, { json: () => {} });
  assert.deepEqual(saved, ['r2-proof.webm']);
});

