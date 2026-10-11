import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const fixturePath = new URL('../../.local/monitoring-credentials.json', import.meta.url);
const fixture = fs.existsSync(fixturePath) ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')) : null;
const backend = 'https://lvrxcxskroskkeifjyry.supabase.co/functions/v1/lpg-api/api';
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['geolocation', 'camera'], geolocation: { latitude: -8.17, longitude: 113.7 } });

async function login(page, role, username, password) {
  await page.goto(role === 'manager' ? '/admin/login' : '/login');
  await page.locator('#username').fill(username); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /Masuk ke Dashboard/ }).click();
  await expect(page).toHaveURL(new RegExp(role === 'manager' ? '/manager$' : '/sopir$'));
}

async function api(page, path, body) {
  return page.evaluate(async ({ path, body, backend }) => {
    const response = await fetch(backend + path, {
      method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('lpg:session')}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
  }, { path, body, backend });
}

test('isolated live driver GPS, login and fatigue video reach manager with protected review and Excel export', async ({ page, browser }) => {
  test.skip(!fixture, 'Requires an isolated monitoring fixture; never use an operational driver for capture tests.');
  await login(page, 'driver', fixture.username, fixture.password);
  await expect(page.getByText('GPS tersinkron ke manager')).toBeVisible();
  const recording = page.waitForResponse(response => response.url().endsWith('/driver/fatigue') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Aktifkan Kamera', exact: true }).click();
  expect((await recording).status()).toBe(200);
  await expect(page.getByText('Laporan berhasil dikirim ke manager')).toBeVisible();
  const own = await api(page, `/driver/${fixture.id}/fatigue`);
  expect(own.status).toBe(200);
  expect(own.data.latest.kind).toBe('video'); expect(own.data.latest.duration_seconds).toBe(7);
  expect(typeof own.data.latest.created_at).toBe('string'); expect(typeof own.data.latest.captured_at).toBe('string');
  expect(own.data.latest.video).toContain('/storage/v1/object/sign/');
  expect((await api(page, '/manager/activity')).status).toBe(403);
  expect((await api(page, '/driver/1/fatigue')).status).toBe(403);
  const id = own.data.latest.id;
  expect((await api(page, `/manager/fatigue/${id}/review`, { status: 'FIT', note: 'Forged review' })).status).toBe(403);

  const managerDevice = await browser.newContext();
  const manager = await managerDevice.newPage();
  try {
    await login(manager, 'manager', 'manager', '12345');
    const positions = (await api(manager, '/tracking')).data;
    const gps = positions.find(position => position.sopir_id === fixture.id);
    expect(gps.active).toBe(true); expect(gps.latitude).toBe(-8.17); expect(typeof gps.login_at).toBe('string');
    const activity = (await api(manager, '/manager/activity')).data;
    expect(activity.logins.some(login => login.sopir_id === fixture.id)).toBe(true);
    expect(activity.reports.some(report => report.id === id && report.status === 'MENUNGGU')).toBe(true);
    await manager.goto('/manager/aktivitas');
    const article = manager.locator('article').filter({ hasText: fixture.name });
    await expect(article).toContainText('Jam rekam:'); await expect(article).toContainText('Jam submit:'); await expect(article).toContainText('WITA');
    await expect.poll(() => article.locator('video').evaluate(video => video.readyState)).toBeGreaterThan(0);
    await article.getByRole('textbox').fill('Uji terisolasi: manager meninjau kondisi sopir.');
    await article.getByRole('button', { name: 'Perlu Istirahat' }).click();
    await expect(article).toContainText('Perlu Istirahat');
    const reviewed = (await api(page, `/driver/${fixture.id}/fatigue`)).data.latest;
    expect(reviewed.status).toBe('PERLU_ISTIRAHAT'); expect(typeof reviewed.reviewed_at).toBe('string');
    await manager.goto('/manager');
    const download = manager.waitForEvent('download');
    await manager.getByRole('button', { name: 'Unduh Laporan Excel' }).click();
    await (await download).saveAs(new URL('../../.local/monitoring-export.xlsx', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
    await manager.screenshot({ path: '../.local/manager-fatigue-summary.png', fullPage: true });
    await page.getByRole('button', { name: 'Hentikan Pemantauan' }).click();
    await expect.poll(async () => (await api(page, `/driver/${fixture.id}/fatigue`)).data.monitoring.camera_enabled).toBe(false);
  } finally { await managerDevice.close(); }
});
