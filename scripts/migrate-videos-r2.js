require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const root = path.resolve(__dirname, '..');
const settings = fs.existsSync(path.join(root, 'client/.env.local')) ? fs.readFileSync(path.join(root, 'client/.env.local'), 'utf8') : '';
const project = process.env.VITE_SUPABASE_URL || settings.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || settings.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.*)$/m)?.[1]?.trim();
const base = `${project}/functions/v1/lpg-api/api`;
const apply = process.argv.includes('--apply');
const release = process.argv.includes('--release-source');
let token;

async function api(endpoint, body) {
  const response = await fetch(base + endpoint, {
    method: body ? 'POST' : 'GET', headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120000)
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `API gagal (${response.status}).`);
  return value;
}

async function hashRemote(url, filename, expectedSize, output) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!response.ok || !response.body) throw new Error(`${filename}: berkas tidak dapat diunduh.`);
  const hash = createHash('sha256');
  let bytes = 0;
  const source = Readable.fromWeb(response.body);
  source.on('data', chunk => { bytes += chunk.length; hash.update(chunk); });
  if (output) await pipeline(source, fs.createWriteStream(output, { flags: 'w' }));
  else for await (const _chunk of source) { /* hash and size are collected above */ }
  if (bytes !== expectedSize) throw new Error(`${filename}: ukuran unduhan tidak sesuai.`);
  return hash.digest('hex');
}

async function main() {
  if (!project || !key) throw new Error('URL dan publishable key Supabase belum dikonfigurasi.');
  if (!process.env.MANAGER_USERNAME || !process.env.MANAGER_PASSWORD) throw new Error('Isi MANAGER_USERNAME dan MANAGER_PASSWORD melalui .env privat.');
  if (release && !apply) throw new Error('--release-source harus disertai --apply.');
  token = (await api('/login', { role: 'manager', username: process.env.MANAGER_USERNAME, password: process.env.MANAGER_PASSWORD })).token;
  const report = { copied: [], released: [], verifiedAt: null };
  const runLabel = process.env.R2_MIGRATION_RUN_LABEL || '';
  if (runLabel && !/^test-[a-f0-9-]{36}$/.test(runLabel)) throw new Error('Label direktori pengujian tidak valid.');
  const work = path.join(root, '.local/r2-migration', runLabel);
  fs.mkdirSync(work, { recursive: true });
  try {
    const source = await api('/manager/storage/source-videos');
    const total = source.videos.reduce((sum, video) => sum + video.size, 0);
    console.log(`${source.videos.length} video, ${(total / 1000000).toFixed(1)} MB. R2 ${source.r2Configured ? 'siap' : 'belum dikonfigurasi'}.`);
    if (!apply) { console.log('Pratinjau selesai. Gunakan --apply untuk menyalin; tambahkan --release-source untuk menghapus sumber setelah hash identik.'); return; }
    if (!source.r2Configured) throw new Error('Pasang secret R2 di backend sebelum menjalankan migrasi.');
    for (const video of source.videos) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(video.filename)) throw new Error('Nama berkas sumber tidak valid.');
      const local = path.join(work, video.filename);
      try {
        const originalHash = await hashRemote(video.sourceUrl, video.filename, video.size, local);
        const plan = await api('/files/plan', { originalname: video.filename, size: video.size, type: video.type, preserveName: true, purpose: 'migration' });
        if (!plan.ready) {
          const response = await fetch(plan.uploadUrl, { method: 'PUT', headers: { ...plan.headers, 'Content-Length': String(video.size) }, body: fs.createReadStream(local), duplex: 'half', signal: AbortSignal.timeout(300000) });
          await response.body?.cancel();
          if (!response.ok) throw new Error(`${video.filename}: unggahan R2 gagal (${response.status}).`);
          await api('/files/finish', { filename: plan.filename });
        }
        const updated = await api('/manager/storage/source-videos');
        const target = updated.videos.find(item => item.filename === video.filename);
        const copiedHash = await hashRemote(target?.targetUrl, video.filename, video.size);
        if (copiedHash !== originalHash) throw new Error(`${video.filename}: hash berbeda, sumber dipertahankan.`);
        report.copied.push({ filename: video.filename, size: video.size, sha256: originalHash });
        if (release) {
          await api('/manager/storage/release-source', { filename: video.filename });
          report.released.push(video.filename);
        }
        console.log(`${video.filename}: SHA-256 cocok${release ? ', sumber dilepas' : ', sumber dipertahankan'}.`);
      } finally { if (fs.existsSync(local)) fs.unlinkSync(local); }
    }
    report.verifiedAt = new Date().toISOString();
  } finally {
    fs.writeFileSync(path.join(work, 'report.json'), JSON.stringify(report, null, 2));
    await api('/logout', {}).catch(() => {});
    token = null;
  }
}

main().catch(error => { console.error(error instanceof TypeError ? 'Koneksi migrasi gagal. Jalankan ulang; sumber yang belum diverifikasi tetap dipertahankan.' : error.message); process.exitCode = 1; });
