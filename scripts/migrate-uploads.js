require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const executeFile = promisify(execFile);
const root = path.resolve(__dirname, '..');
const settings = fs.readFileSync(path.join(root, 'client/.env.local'), 'utf8');
const url = process.env.VITE_SUPABASE_URL || settings.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || settings.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.*)$/m)?.[1]?.trim();
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.webp': 'image/webp' };
async function request(url, options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
      if (response.status < 500 || attempt === 2) return response;
      await response.body?.cancel();
    } catch (error) { if (attempt === 2) throw error; }
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}

async function curlUpload(args, name) {
  try {
    const { stdout } = await executeFile(process.platform === 'win32' ? 'curl.exe' : 'curl', [
      '--silent', '--show-error', '--fail-with-body', '--retry', '3', '--retry-all-errors',
      '--connect-timeout', '15', '--max-time', '120', ...args
    ], { windowsHide: true, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    // execFile's default message includes command arguments; keep session headers private.
    let reason;
    try { reason = JSON.parse(error.stdout).error; } catch { reason = error.stderr?.trim().slice(-500) || 'Koneksi unggah terputus. Jalankan ulang untuk melanjutkan.'; }
    throw new Error(`${name}: ${reason}`);
  }
}

async function main() {
  const login = await request(`${url}/functions/v1/lpg-api/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify({ role: 'manager', username: process.env.MANAGER_USERNAME || 'manager', password: process.env.MANAGER_PASSWORD || '12345' })
  });
  const session = await login.json();
  if (!login.ok) throw new Error(session.error);
  const allFiles = fs.readdirSync(path.join(root, 'uploads')).filter(name => fs.statSync(path.join(root, 'uploads', name)).isFile());
  const savedPath = path.join(root, '.local/storage-existing.json');
  const saved = new Set(fs.existsSync(savedPath) ? JSON.parse(fs.readFileSync(savedPath, 'utf8')) : []);
  const filenames = allFiles.filter(name => !saved.has(name));
  let existing = allFiles.length - filenames.length;
  let complete = existing;
  try {
    for (let i = 0; i < filenames.length; i += 4) {
      const results = await Promise.allSettled(filenames.slice(i, i + 4).map(async name => {
        // Stream historical videos from disk and retry interrupted uploads.
        const source = path.join(root, 'uploads', name);
        const size = fs.statSync(source).size;
        const type = mime[path.extname(name).toLowerCase()] || 'application/octet-stream';
        const authorization = ['-H', `Authorization: Bearer ${session.token}`, '-H', `apikey: ${key}`];
        let data;
        if (size > 50 * 1024 * 1024) {
          const planResponse = await request(`${url}/functions/v1/lpg-api/api/files/plan`, {
            method: 'POST', headers: { Authorization: `Bearer ${session.token}`, apikey: key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalname: name, size, type, preserveName: true })
          });
          const plan = await planResponse.json();
          if (!planResponse.ok) throw new Error(plan.error);
          if (!plan.ready) {
            fs.mkdirSync(path.join(root, '.local/upload-parts'), { recursive: true });
            const fd = fs.openSync(source, 'r');
            try {
              for (let part = 0; part < plan.count; part++) {
                if (plan.uploaded.includes(part)) continue;
                const buffer = Buffer.alloc(Math.min(plan.partBytes, size - part * plan.partBytes));
                fs.readSync(fd, buffer, 0, buffer.length, part * plan.partBytes);
                const partFile = path.join(root, '.local/upload-parts', `${name}.${part}`);
                fs.writeFileSync(partFile, buffer);
                await curlUpload([...authorization, '-H', 'Content-Type: application/octet-stream', '--upload-file', partFile,
                  `${url}/functions/v1/lpg-api/api/files/part/${encodeURIComponent(plan.filename)}/${part}`], name);
                console.log(`Video ${name}: bagian ${part + 1}/${plan.count}`);
              }
            } finally { fs.closeSync(fd); }
            const finalized = await request(`${url}/functions/v1/lpg-api/api/files/finish`, {
              method: 'POST', headers: { Authorization: `Bearer ${session.token}`, apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: plan.filename })
            });
            if (!finalized.ok) throw new Error((await finalized.json()).error);
          }
          data = { ok: true, existed: plan.ready };
        } else data = await curlUpload([...authorization, '-F', `file=@${source};type=${type}`,
          `${url}/functions/v1/lpg-api/api/manager/import-upload`], name);
        if (!data.ok) throw new Error(`${name}: ${data.error}`);
        complete++;
        if (data.existed) existing++;
      }));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      console.log(`Lampiran ${complete}/${allFiles.length}`);
    }
    fs.mkdirSync(path.join(root, '.local'), { recursive: true });
    fs.writeFileSync(path.join(root, '.local/uploads-report.json'), JSON.stringify({ total: complete, existing, completedAt: new Date().toISOString() }, null, 2));
  } finally {
    await request(`${url}/functions/v1/lpg-api/api/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, apikey: key, 'Content-Type': 'application/json' }, body: '{}' });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
