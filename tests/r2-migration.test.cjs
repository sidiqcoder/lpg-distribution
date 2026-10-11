const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const fs = require('node:fs');

const execute = promisify(execFile);
const root = path.resolve(__dirname, '..');

async function migrate(corrupt) {
  const source = Buffer.from('original video evidence');
  let target = null, released = 0, uploadHeaders, finalized = false;
  let origin;
  const filename = `migration-test-${crypto.randomUUID()}.webm`;
  const runLabel = `test-${crypto.randomUUID()}`;
  const work = path.join(root, '.local/r2-migration', runLabel);
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (req.url === '/source' || req.url === '/target') {
      res.writeHead(200, { 'Content-Type': 'video/webm' });
      return res.end(req.url === '/source' ? source : target);
    }
    if (req.url === '/upload') {
      uploadHeaders = req.headers;
      target = Buffer.concat(chunks);
      if (corrupt) target[0] ^= 1;
      res.writeHead(200); return res.end();
    }
    let result;
    if (req.url.endsWith('/login')) result = { token: 'test-session' };
    else if (req.url.endsWith('/logout')) result = { ok: true };
    else if (req.url.endsWith('/storage/source-videos')) result = { r2Configured: true, videos: [{ filename, size: source.length, type: 'video/webm', sourceUrl: `${origin}/source`, targetUrl: finalized ? `${origin}/target` : null }] };
    else if (req.url.endsWith('/files/plan')) result = { filename, provider: 'r2', ready: false, uploadUrl: `${origin}/upload`, headers: { 'Content-Type': 'video/webm' } };
    else if (req.url.endsWith('/files/finish')) { finalized = true; result = { ok: true }; }
    else if (req.url.endsWith('/storage/release-source')) { released++; result = { ok: true }; }
    else { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let exitCode = 0, output = '';
  try {
    try {
      const result = await execute(process.execPath, ['scripts/migrate-videos-r2.js', '--apply', '--release-source'], {
        cwd: root, windowsHide: true, env: { ...process.env, VITE_SUPABASE_URL: origin, VITE_SUPABASE_PUBLISHABLE_KEY: 'test-api-key', MANAGER_USERNAME: 'test-manager', MANAGER_PASSWORD: 'test-password', R2_MIGRATION_RUN_LABEL: runLabel }
      });
      output = result.stdout + result.stderr;
    } catch (error) { exitCode = error.code; output = error.stdout + error.stderr; }
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (fs.existsSync(path.join(work, 'report.json'))) fs.unlinkSync(path.join(work, 'report.json'));
    if (fs.existsSync(work)) fs.rmdirSync(work);
  }
  return { exitCode, output, released, uploadHeaders, source, target };
}

test('migration keeps the Supabase source if R2 content differs despite matching size', async () => {
  const result = await migrate(true);
  assert.equal(result.exitCode, 1);
  assert.match(result.output, /hash berbeda/);
  assert.equal(result.source.length, result.target.length);
  assert.equal(result.released, 0);
});

test('migration releases the source only after verifying identical content and sends no app credentials to storage', async () => {
  const result = await migrate(false);
  assert.equal(result.exitCode, 0, result.output);
  assert.deepEqual(result.source, result.target);
  assert.equal(result.released, 1);
  assert.equal(result.uploadHeaders.authorization, undefined);
  assert.equal(result.uploadHeaders.apikey, undefined);
});
