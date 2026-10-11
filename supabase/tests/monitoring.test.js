import assert from 'node:assert/strict';
import { storage } from '../functions/lpg-api/storage.js';
import { formatDate, formatWaktu, formatWaktuLengkap } from '../functions/lpg-api/format.js';
import { authorize } from '../functions/lpg-api/security.js';
import { createRouter, upload } from '../functions/lpg-api/router.js';
import { registerMonitoring } from '../functions/lpg-api/monitoring.js';
import { ensureDailyRoutes } from '../functions/lpg-api/daily-routes.js';
import { distanceToRoute, routeStatus, waLink } from '../../client/src/tracking.js';

Deno.test('attachment signing preserves database timestamps in nested reports', async () => {
  const files = storage({ storage: { from: () => ({ createSignedUrls: () => ({ data: [{ path: 'proof.jpg', signedUrl: 'https://example.org/proof.jpg' }] }) }) } }, { sign: () => new Map() });
  const timestamp = new Date('2026-10-10T16:30:00Z');
  const result = await files.signMedia({ created_at: timestamp, reports: [{ captured_at: timestamp, foto: 'proof.jpg' }] });
  assert.equal(result.created_at, '2026-10-10T16:30:00.000Z');
  assert.equal(result.reports[0].captured_at, result.created_at);
  assert.equal(result.reports[0].foto, 'https://example.org/proof.jpg');
});

Deno.test('WITA date rollover and timestamp formatting accept database Date and offset strings', () => {
  assert.equal(formatDate('2026-10-10T16:30:00Z'), '2026-10-11');
  for (const value of [new Date('2026-10-10T16:30:00Z'), '2026-10-10T16:30:00Z', '2026-10-10 16:30:00+00', '2026-10-10 16:30:00']) {
    assert.match(formatWaktu(value), /00[.:]30[.:]00 WITA/);
    assert.match(formatWaktuLengkap(value), /11 Okt 2026.*00[.:]30[.:]00 WITA/);
  }
});

Deno.test('route corridor follows segments and does not invent an off-route status without data', () => {
  const route = [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.1 }];
  assert.ok(distanceToRoute(0, 0.05, route) < 0.001);
  assert.ok(distanceToRoute(0.01, 0.05, route) > 1);
  assert.equal(distanceToRoute(0, 0, []), null);
  assert.equal(routeStatus({ latitude: 1, longitude: 1, active: false, route }).off, false);
  assert.equal(routeStatus({ latitude: 1, longitude: 1, active: true, accuracy: 500, route }).off, false);
  const link = waLink('0812-3456-7890', 'Sopir Uji');
  assert.ok(link.startsWith('https://wa.me/6281234567890?'));
  assert.match(decodeURIComponent(link), /kembali ke jalur resmi/);
});

Deno.test('driver fatigue and monitoring access is restricted to the session driver', async () => {
  const user = { role: 'driver', id: 1 };
  await assert.rejects(() => authorize({}, { params: { id: '2' }, body: {} }, '/api/driver/2/fatigue', 'GET', user), { status: 403 });
  await assert.rejects(() => authorize({}, { params: {}, body: { sopir_id: 2 } }, '/api/driver/fatigue', 'POST', user), { status: 403 });
  await assert.rejects(() => authorize({}, { params: {}, body: {} }, '/api/manager/activity', 'GET', user), { status: 403 });
});

Deno.test('retrying a capture returns the existing report without storing another attachment', async () => {
  const app = createRouter();
  const existing = { id: 9, created_at: new Date() };
  const database = { begin: fn => fn({ unsafe: sql => Promise.resolve(sql.startsWith('SELECT id') ? [existing] : []) }) };
  registerMonitoring(app, { database, upload, saveUploadedFile: () => { throw new Error('Unexpected duplicate storage upload'); } });
  let result;
  await app.match('POST', '/api/driver/fatigue').handler({ user: { id: 1 }, body: { capture_id: crypto.randomUUID(), captured_at: new Date().toISOString(), kind: 'video', duration_seconds: 7 } }, { json: data => { result = data; } });
  assert.equal(result.id, existing.id);
  assert.equal(result.ok, true);
});

Deno.test('invalid capture metadata and camera state are rejected before database access', async () => {
  const app = createRouter();
  registerMonitoring(app, { database: {}, upload });
  await assert.rejects(() => app.match('POST', '/api/driver/fatigue').handler({ user: { id: 1 }, body: { capture_id: crypto.randomUUID(), captured_at: new Date().toISOString(), kind: 'video', duration_seconds: 40 } }, {}), { status: 400 });
  await assert.rejects(() => app.match('POST', '/api/driver/1/monitoring').handler({ user: { id: 1 }, body: { camera_enabled: 'true' } }, {}), { status: 400 });
});

Deno.test('existing daily assignments skip route backfill and write transactions', async () => {
  let reads = 0;
  await ensureDailyRoutes({ unsafe: () => { reads++; return Promise.resolve([{ count: 2 }]); } }, '2026-10-11');
  assert.equal(reads, 1);
});
