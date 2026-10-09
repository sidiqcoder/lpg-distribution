import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const backend = 'https://lvrxcxskroskkeifjyry.supabase.co/functions/v1/lpg-api/api';
const fixturePath = new URL('../../.local/e2e-credentials.json', import.meta.url);
const fixture = fs.existsSync(fixturePath) ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')) : null;
const image = { name: 'e2e-proof.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1EAAAAASUVORK5CYII=', 'base64') };

async function signIn(page, role, username, password) {
  await page.goto(role === 'manager' ? '/admin/login' : '/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /Masuk ke Dashboard/ }).click();
  await expect(page).toHaveURL(new RegExp(role === 'manager' ? '/manager$' : '/sopir$'));
  await expect(page.getByText('Terhubung', { exact: true }).first()).toBeVisible();
}

async function api(page, path, body) {
  const result = await page.evaluate(async ({ backend, path, body }) => {
    const response = await fetch(backend + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('lpg:session')}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
  }, { backend, path, body });
  return result;
}

test('existing logins, all pages, session restore, access restrictions and Excel export', async ({ page, browser, request }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page, 'manager', 'manager', '12345');
  const summary = await api(page, '/manager/summary');
  expect(summary.status).toBe(200);
  expect(summary.data.semuaSopir.some(driver => driver.username === 'budi')).toBeTruthy();
  expect(JSON.stringify(summary.data)).not.toContain('password');
  for (const path of ['/manager/stok', '/manager/inspeksi', '/manager/pengiriman', '/manager/pelacakan', '/manager/kpi', '/manager/bahaya', '/manager/sertifikat']) {
    await page.goto(path);
    await expect(page.locator('main .page-head')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/Gagal Memuat/);
  }
  await page.goto('/manager?date=2026-10-06');
  await expect(page.getByRole('button', { name: 'Unduh Laporan Excel' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh Laporan Excel' }).click();
  expect((await download).suggestedFilename()).toBe('laporan-dashboard-2026-10-06.xlsx');
  await page.reload();
  await expect(page.locator('main .page-head')).toBeVisible();
  await page.screenshot({ path: '../.local/manager-desktop.png', fullPage: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const driver = await context.newPage();
  driver.on('pageerror', error => errors.push(error.message));
  await signIn(driver, 'driver', 'budi', '12345');
  for (const path of ['/sopir/profil', '/sopir/peta', '/sopir/status-inspeksi', '/sopir/status-lpg', '/sopir/menu', '/sopir/inspeksi-form', '/sopir/permintaan-lpg', '/sopir/on-duty', '/sopir/rute-map', '/sopir/sertifikat']) {
    await driver.goto(path);
    await expect(driver.locator('main .page-head')).toBeVisible();
  }
  expect((await api(driver, '/manager/summary')).status).toBe(403);
  expect((await api(driver, '/driver/2/profile')).status).toBe(403);
  expect((await api(driver, '/tracking', { sopir_id: 2, latitude: -8, longitude: 113 })).status).toBe(403);
  expect((await request.get(backend + '/manager/summary')).status()).toBe(401);
  const anonymousData = await request.get('https://lvrxcxskroskkeifjyry.supabase.co/rest/v1/sopir?select=*', { headers: { apikey: 'sb_publishable_SD6g_zgYcqRcWjt-buEAtA_fnVmA3wI' } });
  expect([401, 403]).toContain(anonymousData.status());
  await driver.screenshot({ path: '../.local/driver-mobile.png', fullPage: true });
  await driver.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(driver).toHaveURL(/\/login$/);
  expect(await driver.evaluate(() => localStorage.getItem('lpg:session'))).toBeNull();
  expect(errors).toEqual([]);
  await context.close();
});

test('inspection, approval, LPG stock, delivery, hazard and certificate use live Supabase', async ({ page, browser }) => {
  test.skip(!fixture, 'Create an isolated driver fixture before running write tests.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page, 'driver', fixture.username, fixture.password);
  expect((await api(page, '/driver/delivery', { sopir_id: fixture.id, jumlah_dikirim_tabung: 1 })).status).toBe(409);
  await page.goto('/sopir/inspeksi-form');
  await page.locator('#kendaraan_id').selectOption('1');
  await page.getByRole('button', { name: 'Set Semua Kondisi BAIK' }).click();
  await page.locator('input[name="foto_section_1"]').setInputFiles(image);
  await page.locator('textarea[name="catatan"]').fill('E2E isolated workflow');
  await page.getByRole('button', { name: 'Kirim & Ajukan Inspeksi' }).click();
  await expect(page).toHaveURL(/\/sopir\/status-inspeksi$/);
  const summary = (await api(page, `/driver/${fixture.id}/summary`)).data;
  expect(summary.inspection.status_validasi).toBe('MENUNGGU');
  expect(summary.progress.lolos).toBe(summary.progress.total);
  const managerContext = await browser.newContext();
  const manager = await managerContext.newPage();
  manager.on('pageerror', error => errors.push(error.message));
  await signIn(manager, 'manager', 'manager', '12345');
  const baseline = (await api(manager, '/manager/summary')).data.persediaanLpg;
  await manager.goto(`/manager/review/${summary.inspection.id}`);
  await expect(manager.locator('img').first()).toBeVisible();
  await manager.locator('#catatanValidasi').fill('E2E: kendaraan aman');
  await manager.getByRole('button', { name: 'Setujui Kelayakan (Armada Aman)' }).click();
  await expect(manager).toHaveURL(/\/manager\/inspeksi$/);
  await page.goto('/sopir/permintaan-lpg');
  await page.locator('#kendaraan_id').selectOption('1');
  await page.locator('#jumlah_diminta').fill('1');
  await page.getByRole('button', { name: 'Kirim Pengajuan LPG' }).click();
  await expect(page).toHaveURL(/\/sopir\/status-lpg$/);
  const requestId = (await api(page, `/driver/${fixture.id}/summary`)).data.lpg.id;
  await manager.goto('/manager/stok');
  const row = manager.getByRole('row').filter({ hasText: fixture.name });
  await row.getByRole('button', { name: 'Setujui', exact: true }).click();
  await expect(row).toContainText('Disetujui');
  expect((await api(manager, '/manager/summary')).data.persediaanLpg).toBe(baseline - 1);
  const repeated = await Promise.all([api(manager, `/manager/lpg/${requestId}/decision`, { status: 'DISETUJUI' }), api(manager, `/manager/lpg/${requestId}/decision`, { status: 'DISETUJUI' })]);
  expect(repeated.every(result => result.status === 200)).toBeTruthy();
  expect((await api(manager, '/manager/summary')).data.persediaanLpg).toBe(baseline - 1);
  await page.goto('/sopir/on-duty');
  await page.getByText('E2E Pangkalan', { exact: true }).click();
  await page.locator('input[name="jumlah_dikirim_tabung"]').fill('1');
  await page.locator('input[name="penerima_nama"]').fill('E2E Penerima');
  await page.locator('input[name="penerima_hp"]').fill('080000000000');
  for (const field of ['foto_sebelum', 'foto_proses', 'foto_sesudah']) await page.locator(`input[name="${field}"]`).setInputFiles(image);
  await page.getByRole('button', { name: 'Simpan & Selesaikan Pengiriman' }).click();
  await expect(page.getByText('Pengiriman berhasil dicatat dan status pangkalan diperbarui!')).toBeVisible();
  expect((await api(page, `/driver/${fixture.id}/routes`)).data.delivered).toContain('E2E Pangkalan');
  await page.getByRole('button', { name: 'Lapor Bahaya / Kendala' }).click();
  await page.locator('select[name="jenis_bahaya"]').selectOption('Kerusakan Kendaraan');
  await page.locator('textarea[name="deskripsi"]').fill('E2E isolated hazard');
  await page.locator('input[name="foto_bukti"]').setInputFiles(image);
  await page.getByRole('button', { name: 'Kirim Laporan Darurat' }).click();
  await expect(page.getByText('Laporan bahaya berhasil dikirimkan ke Manager Operasional.')).toBeVisible();
  await page.goto('/sopir/sertifikat');
  await page.locator('input[name="sertifikat_k3"]').setInputFiles(image);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText('File sertifikat K3 berhasil diunggah.')).toBeVisible();
  const profile = (await api(page, `/driver/${fixture.id}/profile`)).data.sopir;
  expect(profile.sertifikat_k3).toContain('/storage/v1/object/sign/');
  const asset = await page.request.get(profile.sertifikat_k3);
  expect(asset.status()).toBe(200);
  expect((await api(page, '/tracking', { sopir_id: fixture.id, latitude: -8.17, longitude: 113.70, accuracy: 5 })).status).toBe(200);
  expect((await api(manager, '/tracking')).data.some(item => item.sopir_id === fixture.id)).toBeTruthy();
  expect((await api(manager, '/manager/kpi', { tanggal: '2099-01-01', entries: [{ sopirId: fixture.id, nilai: 90, catatan: 'E2E isolated KPI' }] })).status).toBe(200);
  expect((await api(manager, '/manager/summary?date=2099-01-01')).data.kpiData.some(item => item.sopir_id === fixture.id && item.nilai === 90)).toBeTruthy();
  // Return the allocated stock before fixture cleanup.
  expect((await api(manager, `/manager/lpg/${requestId}/decision`, { status: 'DITOLAK' })).status).toBe(200);
  expect((await api(manager, '/manager/summary')).data.persediaanLpg).toBe(baseline);
  expect(errors).toEqual([]);
  await managerContext.close();
});

test('certificate preview fits the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'driver', 'budi', '12345');
  await page.goto('/sopir/sertifikat');
  const image = page.getByRole('img', { name: 'Sertifikat K3', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => element.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '../.local/driver-mobile.png', fullPage: true });
});

test('historical large video supports private range playback without changing bytes', async ({ page, request }) => {
  await signIn(page, 'manager', 'manager', '12345');
  const inspection = await api(page, '/manager/inspection/33');
  expect(inspection.status).toBe(200);
  const video = inspection.data.lampiran.find(file => file.section === 5).video;
  expect(video).toContain('/functions/v1/lpg-api/media/');
  const source = new URL('../../uploads/1791251135321-784718474.mp4', import.meta.url);
  const fd = fs.openSync(source, 'r');
  const size = fs.statSync(source).size;
  try {
    for (const [start, length] of [[0, 1024], [16777000, 1000], [size - 1024, 1024]]) {
      const result = await request.get(video, { headers: { Range: `bytes=${start}-${start + length - 1}` } });
      expect(result.status()).toBe(206);
      expect(result.headers()['content-type']).toBe('video/mp4');
      expect(result.headers()['content-range']).toBe(`bytes ${start}-${start + length - 1}/${size}`);
      const original = Buffer.alloc(length);
      fs.readSync(fd, original, 0, length, start);
      expect(await result.body()).toEqual(original);
    }
  } finally { fs.closeSync(fd); }
  const unsigned = new URL(video); unsigned.search = '';
  expect((await request.get(unsigned.href)).status()).toBe(403);
  await page.goto('/manager/review/33');
  await expect(page.locator('video')).toBeVisible();
  await page.locator('video').evaluate(element => { element.preload = 'metadata'; element.load(); });
  await expect.poll(() => page.locator('video').evaluate(element => element.readyState), { timeout: 60000 }).toBeGreaterThan(0);
});

test('large form attachment is uploaded automatically and stays private', async ({ page, request }) => {
  test.skip(!fixture, 'Requires an isolated driver fixture.');
  await signIn(page, 'driver', fixture.username, fixture.password);
  const result = await page.evaluate(async id => {
    const { apiForm, apiGet } = await import('/src/api.js');
    const form = new FormData();
    form.set('sopir_id', String(id)); form.set('kendaraan_id', '1');
    const content = new Uint8Array(17 * 1024 * 1024).fill(37);
    form.set('video_section_5', new File([content], 'e2e-large.mp4', { type: 'video/mp4' }));
    await apiForm('/driver/inspection', form);
    const summary = await apiGet(`/driver/${id}/summary`);
    return JSON.parse(summary.inspection.lampiran_json).find(file => file.section === 5).video;
  }, fixture.id);
  expect(result).toContain('/functions/v1/lpg-api/media/');
  const range = await request.get(result, { headers: { Range: 'bytes=16777000-16777999' } });
  expect(range.status()).toBe(206);
  expect(await range.body()).toEqual(Buffer.alloc(1000, 37));
  const unsigned = new URL(result); unsigned.search = '';
  expect((await request.get(unsigned.href)).status()).toBe(403);
});
