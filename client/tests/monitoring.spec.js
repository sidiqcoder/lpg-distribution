import { test, expect } from '@playwright/test';

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['geolocation', 'camera'], geolocation: { latitude: -8.17, longitude: 113.7 }, timezoneId: 'UTC'
});

const driver = { id: 1, role: 'driver', nama: 'Sopir Uji' };
const manager = { id: null, role: 'manager', nama: 'Manager' };
const timestamp = '2026-10-10T16:30:00Z';
const summary = {
  stats: { inspeksiLolos: 0, inspeksiGagal: 0, inspeksiMenunggu: 0, totalInspeksi: 0, totalPengiriman: 0, totalTabung: 0, maxPengirimanSopir: 1 },
  inspeksi: [], pengiriman: [], laporanBahaya: [], kpiData: [], permintaanLpg: [], currentPositions: [],
  semuaSopir: [{ id: 1, nama: driver.nama, username: 'uji' }], persediaanLpg: 520
};

async function mock(context, state = {}) {
  state.positions ||= []; state.reports ||= []; state.uploads ||= []; state.monitors ||= [];
  await context.route('**/functions/v1/lpg-api/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split('/api')[1];
    let result = { ok: true };
    if (path === '/session') result = { user: request.headers().authorization?.includes('driver') ? driver : manager };
    else if (path === '/files/plan') {
      if (!state.r2) result = { provider: 'supabase', inline: true };
      else {
        const body = request.postDataJSON();
        state.r2Plans ||= [];
        state.r2Plans.push(body);
        result = { provider: 'r2', filename: `r2-fatigue-${body.captureId}.webm`, ready: !!state.r2Ready,
          uploadUrl: 'https://r2-upload.test/staging/capture?signature=test', headers: { 'Content-Type': body.type } };
      }
    }
    else if (path === '/files/finish') { state.r2Ready = true; result = { ok: true }; }
    else if (path.startsWith('/files/proxy/')) { state.proxyUploads = (state.proxyUploads || 0) + 1; state.r2Ready = true; result = { ok: true }; }
    else if (path === '/health') result = { ok: true };
    else if (path === '/manager/summary') {
      if (state.failSummary) return route.fulfill({ status: 503, json: { error: 'Koneksi uji terputus' } });
      result = summary;
    } else if (/\/driver\/1\/summary/.test(path)) result = { sopir: driver, inspection: null, lpg: null, siapBerangkat: false, progress: null, maxTabung: 543, stok: 520, ...state.driverSummary };
    else if (path === '/tracking' && request.method() === 'POST') {
      const body = request.postDataJSON();
      state.positions = [{ ...body, nama: driver.nama, nomor_hp: '081234567890', updated_at: timestamp, login_at: timestamp, active: true, route: [{ latitude: -8.17, longitude: 113.7 }, { latitude: -8.18, longitude: 113.71 }] }];
    } else if (path === '/tracking') { state.polls = (state.polls || 0) + 1; result = state.positions; }
    else if (path === '/driver/1/fatigue') result = { monitoring: state.monitor || null, latest: state.reports.at(-1) || null };
    else if (path === '/driver/1/monitoring') {
      const monitoring = request.postDataJSON(); state.monitors.push(monitoring);
      if (state.failMonitoring) return route.fulfill({ status: 503, json: { error: 'Status kamera belum terkirim' } });
      state.monitor = monitoring;
    }
    else if (path === '/driver/fatigue') {
      const body = request.postDataBuffer().toString('latin1');
      const field = name => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]+)`))?.[1];
      state.uploads.push({ id: field('capture_id'), capturedAt: field('captured_at'), kind: field('kind'), duration: field('duration_seconds'), size: request.postDataBuffer().length });
      if (state.rejectMetadata) return route.fulfill({ status: 400, json: { error: 'Data rekaman tidak valid.' } });
      if (state.failUpload) return route.fulfill({ status: 503, json: { error: 'Unggah uji gagal' } });
      const report = { id: state.reports.length + 1, nama: driver.nama, kind: field('kind'), captured_at: field('captured_at'), created_at: timestamp, status: 'MENUNGGU', foto: '', video: '' };
      state.reports.push(report); result = { ok: true, id: report.id, created_at: timestamp };
    } else if (path === '/manager/activity') result = { logins: [{ id: 1, nama: driver.nama, created_at: timestamp }], reports: state.reports, monitoring: [] };
    else if (path === '/driver/1/profile') result = { sopir: driver };
    else if (path === '/driver/1/routes') { state.routeReads = (state.routeReads || 0) + 1; result = { rute: state.route || [], delivered: [] }; }
    else if (path === '/meta') result = { sections: state.sections || [], totalItems: 0 };
    else if (path === '/kendaraan') result = { kendaraan: state.vehicles || [] };
    else if (path === '/driver/inspection') {
      state.inspectionBody = request.postDataBuffer().toString('latin1');
      state.driverSummary = { inspection: { id: 1, status_validasi: 'MENUNGGU', created_at: timestamp, checklist_json: '[]' } };
    }
    await route.fulfill({ json: result, headers: state.serverClock ? { 'X-Server-Time': new Date().toISOString(), 'Access-Control-Expose-Headers': 'X-Server-Time' } : {} });
  });
  if (state.r2) await context.route('https://r2-upload.test/**', async route => {
    state.r2Puts ||= [];
    state.r2Puts.push({ headers: route.request().headers(), size: route.request().postDataBuffer()?.length || 0 });
    await route.fulfill({ status: state.directUploadFails ? 503 : 200, body: '', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  return state;
}

async function session(context, role) {
  await context.addInitScript(role => {
    localStorage.setItem('lpg:session', `mock-${role}`);
    localStorage.setItem('lpg:user', JSON.stringify(role === 'driver' ? { id: 1, role, nama: 'Sopir Uji' } : { id: null, role, nama: 'Manager' }));
  }, role);
}

async function settledMarker(page) {
  return page.locator('.leaflet-marker-icon').evaluate(element => new Promise(resolve => {
    let previous = '', stable = 0;
    const frame = () => {
      const rect = element.getBoundingClientRect();
      const value = `${rect.x},${rect.y}`;
      stable = value === previous ? stable + 1 : 0;
      previous = value;
      if (stable >= 20) resolve({ x: rect.x, y: rect.y });
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }));
}

test('GPS from the driver overview appears in a separate manager device and map survives polling', async ({ page, context, browser }) => {
  const state = await mock(context);
  await session(context, 'driver');
  await page.goto('/sopir');
  await expect(page.getByText('GPS tersinkron ke manager')).toBeVisible();
  expect(state.positions[0].sopir_id).toBe(1);
  const managerDevice = await browser.newContext();
  await mock(managerDevice, state); await session(managerDevice, 'manager');
  const mapPage = await managerDevice.newPage();
  await mapPage.goto('/manager/pelacakan');
  await expect(mapPage.getByText('Sopir Uji', { exact: true }).first()).toBeVisible();
  await expect(mapPage.locator('.leaflet-marker-icon')).toHaveCount(1);
  await mapPage.locator('.map').evaluate(element => { window.originalMapContainer = element; });
  const box = await mapPage.locator('.map').boundingBox();
  await mapPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await mapPage.mouse.down(); await mapPage.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 80, { steps: 10 }); await mapPage.mouse.up();
  const markerPosition = await settledMarker(mapPage);
  const initialPolls = state.polls;
  await expect.poll(() => state.polls).toBeGreaterThan(initialPolls);
  expect(await mapPage.locator('.map').evaluate(element => element === window.originalMapContainer)).toBe(true);
  await expect(mapPage.locator('.leaflet-marker-icon')).toHaveCount(1);
  const afterPoll = await settledMarker(mapPage);
  expect(afterPoll.x).toBeCloseTo(markerPosition.x, 0); expect(afterPoll.y).toBeCloseTo(markerPosition.y, 0);
  await expect(mapPage.getByRole('link', { name: 'Hubungi via WhatsApp' })).toHaveAttribute('href', /wa.me\/6281234567890/);
  await managerDevice.close();
});

test('manager retains last GPS and warns only on fresh accurate off-route positions', async ({ page, context }) => {
  const position = { sopir_id: 1, nama: driver.nama, latitude: -8, longitude: 114, accuracy: 10, active: true, updated_at: timestamp, login_at: timestamp, nomor_hp: '081234567890', route: [{ latitude: -8.17, longitude: 113.7 }] };
  const state = await mock(context, { positions: [position] }); await session(context, 'manager');
  await page.goto('/manager/pelacakan');
  const warning = page.getByRole('link', { name: 'Peringatkan Keluar Jalur via WhatsApp' });
  await expect(warning).toBeVisible();
  expect(decodeURIComponent(await warning.getAttribute('href'))).toContain('kembali ke jalur resmi');
  state.positions = [{ ...position, active: false }];
  await page.getByRole('button', { name: 'Refresh Koordinat' }).click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByText('Lokasi terakhir · GPS belum diperbarui', { exact: true })).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
});

test('dashboard retains loaded data during transient errors and recovers after date changes', async ({ page, context }) => {
  const errors = []; page.on('pageerror', err => errors.push(err.message));
  const state = await mock(context); await session(context, 'manager');
  await page.goto('/manager');
  await expect(page.getByRole('heading', { name: 'Ringkasan Operasional Logistik' })).toBeVisible();
  state.failSummary = true;
  await page.getByRole('button', { name: 'Refresh Data' }).click();
  await expect(page.getByText(/Pembaruan gagal. Menampilkan data terakhir/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ringkasan Operasional Logistik' })).toBeVisible();
  state.failSummary = false;
  await page.locator('#dateFilter').fill('2026-10-10');
  await expect(page.locator('.subtitle')).toContainText('2026-10-10');
  await expect(page.getByText('Halaman belum dapat ditampilkan')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('on-duty map recovers when approval changes while GPS and route polling continue', async ({ page, context }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const state = await mock(context, { driverSummary: { siapBerangkat: true }, route: [
    { latitude: -8.17, longitude: 113.7, urutan: 1, pangkalan_nama: 'Pangkalan Uji A', permintaan_ton: 1 },
    { latitude: -8.18, longitude: 113.71, urutan: 2, pangkalan_nama: 'Pangkalan Uji B', permintaan_ton: 1 }
  ] });
  await session(context, 'driver'); await page.goto('/sopir/on-duty');
  await expect(page.locator('.map')).toBeVisible(); await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  state.driverSummary.siapBerangkat = false;
  await expect(page.getByText('Akses Pengiriman Belum Diizinkan')).toBeVisible();
  const reads = state.routeReads;
  await expect.poll(() => state.routeReads).toBeGreaterThan(reads);
  await expect(page.getByText('Halaman belum dapat ditampilkan')).toHaveCount(0);
  state.driverSummary.siapBerangkat = true;
  await expect(page.locator('.map')).toBeVisible(); await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('photo capture retries the same queued report after reload and schedules every 30 minutes', async ({ page, context }) => {
  const state = await mock(context, { failUpload: true, failMonitoring: true }); await session(context, 'driver');
  await page.goto('/sopir');
  await page.getByLabel('Mode kamera fatigue').selectOption('foto');
  await page.getByRole('button', { name: 'Aktifkan Kamera', exact: true }).click();
  await expect(page.getByText(/Laporan menunggu koneksi/)).toBeVisible();
  const first = state.uploads[0]; expect(first.kind).toBe('foto'); expect(first.size).toBeGreaterThan(1000);
  state.failUpload = false; state.failMonitoring = false;
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => state.reports.length).toBe(1);
  expect(state.uploads.at(-1).id).toBe(first.id);
  await page.getByLabel('Mode kamera fatigue').selectOption('foto');
  await page.getByRole('button', { name: 'Aktifkan Kamera', exact: true }).click();
  await expect.poll(() => state.monitor?.camera_enabled).toBe(true);
  expect(state.reports).toHaveLength(1);
  await page.clock.install();
  await page.clock.fastForward(30 * 60 * 1000 + 1000);
  await expect.poll(() => state.reports.length).toBe(2);
  await page.getByRole('button', { name: 'Hentikan Pemantauan' }).click();
  await expect.poll(() => state.monitor?.camera_enabled).toBe(false);
});

test('video mode records seven seconds and keeps monitoring across driver navigation', async ({ page, context }) => {
  const state = await mock(context); await session(context, 'driver');
  await page.goto('/sopir');
  await page.getByRole('button', { name: 'Aktifkan Kamera', exact: true }).click();
  await expect(page.getByText('Laporan berhasil dikirim ke manager')).toBeVisible();
  expect(state.uploads[0].kind).toBe('video'); expect(state.uploads[0].duration).toBe('7'); expect(state.uploads[0].size).toBeGreaterThan(1000);
  await page.getByRole('link', { name: 'Profil Saya', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hentikan Pemantauan' })).toBeVisible();
  await expect(page.getByText('Jadwal berikutnya', { exact: false })).toContainText('WITA');
});

test('R2 camera uploads bytes directly without app credentials and retries a ready file without re-uploading it', async ({ page, context }) => {
  const state = await mock(context, { r2: true, failUpload: true });
  await session(context, 'driver');
  await page.goto('/sopir');
  await page.getByRole('button', { name: 'Aktifkan Kamera', exact: true }).click();
  await expect(page.getByText(/Laporan menunggu koneksi/)).toBeVisible();
  expect(state.r2Plans[0].purpose).toBe('fatigue');
  expect(state.r2Plans[0].captureId).toBe(state.uploads[0].id);
  expect(state.r2Puts).toHaveLength(1);
  expect(state.r2Puts[0].size).toBeGreaterThan(1000);
  expect(state.r2Puts[0].headers.authorization).toBeUndefined();
  expect(state.r2Puts[0].headers.apikey).toBeUndefined();
  expect(state.uploads[0].size).toBeLessThan(2000);
  state.failUpload = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => state.reports.length).toBe(1);
  expect(state.r2Puts).toHaveLength(1);
  expect(state.r2Plans[1].captureId).toBe(state.r2Plans[0].captureId);
  await page.getByRole('button', { name: 'Hentikan Pemantauan' }).click();
});

test('WITA reports and manager username are consistent regardless of device timezone', async ({ page, context }) => {
  await mock(context); await session(context, 'manager');
  await page.goto('/manager/aktivitas?date=2026-10-11');
  await expect(page.getByRole('cell', { name: /11 Okt 2026, 00.30.00 WITA/ })).toBeVisible();
  const formatted = await page.evaluate(async () => { const { todayWITA, fmtWaktu } = await import('/src/utils.js'); return [todayWITA('2026-10-10T16:30:00Z'), fmtWaktu('2026-10-10T16:30:00Z')]; });
  expect(formatted[0]).toBe('2026-10-11'); expect(formatted[1]).toMatch(/00.30.00 WITA/);
  await page.goto('/admin/login');
  await expect(page.locator('#username')).toHaveAttribute('placeholder', 'manager');
});

test('camera uses the authenticated fallback when direct R2 upload fails', async ({ page, context }) => {
  const state = await mock(context, { r2: true, directUploadFails: true }); await session(context, 'driver');
  await page.goto('/sopir'); await page.getByRole('button', { name: 'Aktifkan Kamera', exact: true }).click();
  await expect.poll(() => state.reports.length).toBe(1); expect(state.proxyUploads).toBe(1);
  expect(state.r2Plans[0].captureId).toBe(state.uploads[0].id);
  expect(state.r2Puts[0].headers.authorization).toBeUndefined();
  await page.getByRole('button', { name: 'Hentikan Pemantauan' }).click();
});

test('inspection submit explains missing fields and complete form reaches status page', async ({ page, context }) => {
  const state = await mock(context, { sections: [{ id: 'A', nama: 'Armada', items: ['Rem berfungsi'] }], vehicles: [{ id: 1, plat_nomor: 'DK UJI', kapasitas_ton: 543, tipe_tangki: 'Truk Engkel' }] });
  await session(context, 'driver'); await page.goto('/sopir/inspeksi-form');
  await page.getByRole('button', { name: 'Kirim & Ajukan Inspeksi' }).click();
  await expect(page.getByRole('alert').last()).toContainText('Pilih kendaraan');
  await page.locator('#kendaraan_id').selectOption('1');
  await page.getByRole('button', { name: 'Kirim & Ajukan Inspeksi' }).click();
  await expect(page.getByRole('alert').last()).toContainText('Rem berfungsi');
  await page.getByRole('button', { name: 'Set Semua Kondisi BAIK' }).click();
  await page.getByRole('button', { name: 'Kirim & Ajukan Inspeksi' }).click();
  await expect(page).toHaveURL(/status-inspeksi/);
  expect(state.inspectionBody).toContain('status_A_0'); expect(state.inspectionBody).toContain('BAIK');
  await expect(page.getByText('Gagal Memuat Status')).toHaveCount(0);
});

test('device clock one hour ahead is corrected for WITA and video capture', async ({ page, context }) => {
  const state = await mock(context, { serverClock: true }); await session(context, 'driver');
  await page.clock.install({ time: new Date(Date.now() + 3600000) });
  await page.goto('/sopir');
  await page.getByRole('button', { name: 'Aktifkan Kamera', exact: true }).click();
  await expect.poll(() => state.reports.length).toBe(1);
  expect(Math.abs(Date.parse(state.uploads[0].capturedAt) - Date.now())).toBeLessThan(60000);
  const clock = await page.evaluate(async () => { const { serverNow } = await import('/src/clock.js'); return serverNow(); });
  expect(Math.abs(clock - Date.now())).toBeLessThan(60000);
  await expect(page.getByText('Izin kamera sudah diberikan.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Hentikan Pemantauan' }).click();
});

test('old queued capture with a clock ahead is repaired and reaches manager without recapturing', async ({ page, context }) => {
  const state = await mock(context, { serverClock: true }); await session(context, 'driver');
  await page.clock.install({ time: new Date(Date.now() + 3600000) }); await page.goto('/sopir');
  const captureId = await page.evaluate(async () => {
    const { saveCapture } = await import('/src/fatigue.js'); const id = crypto.randomUUID();
    await saveCapture(1, { id, capturedAt: new Date().toISOString(), kind: 'foto', duration: 0, blob: new Blob(['saved photo'], { type: 'image/jpeg' }) }); return id;
  });
  await page.reload();
  await expect.poll(() => state.reports.length).toBe(1);
  expect(state.uploads[0].id).toBe(captureId);
  expect(Math.abs(Date.parse(state.uploads[0].capturedAt) - Date.now())).toBeLessThan(60000);
  await expect(page.getByRole('button', { name: 'Aktifkan Kamera', exact: true })).toBeVisible();
});

test('validation rejection retains recording and explicit retry succeeds without opening camera', async ({ page, context }) => {
  const state = await mock(context, { rejectMetadata: true }); await session(context, 'driver'); await page.goto('/sopir');
  await page.getByLabel('Mode kamera fatigue').selectOption('foto'); await page.getByRole('button', { name: 'Aktifkan Kamera', exact: true }).click();
  await expect(page.getByText(/Laporan belum diterima:/)).toBeVisible(); const id = state.uploads[0].id;
  await page.getByRole('button', { name: 'Hentikan Pemantauan' }).click(); state.rejectMetadata = false;
  await page.getByRole('button', { name: 'Kirim Ulang Rekaman' }).click();
  await expect.poll(() => state.reports.length).toBe(1); expect(state.uploads.at(-1).id).toBe(id);
});

test('late unauthorized response cannot erase a newer session and logout propagates across tabs', async ({ page, context }) => {
  await mock(context); await session(context, 'driver'); await page.goto('/sopir');
  await expect(page.getByRole('heading', { name: 'Ringkasan Operasional Hari Ini' })).toBeVisible();
  let release; const gate = new Promise(resolve => { release = resolve; }); let started = false;
  await context.route('**/api/late401', async route => { started = true; await gate; await route.fulfill({ status: 401, json: { error: 'Sesi berakhir.', code: 'SESSION_EXPIRED' } }); });
  const pending = page.evaluate(async () => { const { apiGet } = await import('/src/api.js'); try { await apiGet('/late401'); } catch (error) { return error.status; } });
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => localStorage.setItem('lpg:session', 'new-driver-session')); release(); expect(await pending).toBe(401);
  expect(await page.evaluate(() => localStorage.getItem('lpg:session'))).toBe('new-driver-session');
  const other = await context.newPage(); await other.goto('/sopir');
  await other.evaluate(() => { localStorage.removeItem('lpg:session'); localStorage.removeItem('lpg:user'); });
  await expect(page).toHaveURL(/\/login$/);
  await other.close();
});
