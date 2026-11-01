import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const server = createApp({ limitPerMinute: 120 });
let base;
before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('La web principal carga', async () => {
  const res = await fetch(base);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /LOCOS[- ]API/i);
});

test('Render puede consultar /healthz', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.deepEqual(await res.json(), { ok: true, status: 'up' });
});

test('Documentación pública de endpoints', async () => {
  const res = await fetch(`${base}/api/docs`);
  const json = await res.json();
  assert.equal(json.name, 'Locos API');
  assert.ok(json.endpoints.some(x => x.path === '/api/v1/ping'));
});

test('GET /api/v1/ping', async () => {
  const res = await fetch(`${base}/api/v1/ping`);
  assert.deepEqual(await res.json(), { ok: true, message: 'pong' });
});

test('POST /api/v1/echo', async () => {
  const res = await fetch(`${base}/api/v1/echo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hola' })
  });
  assert.deepEqual(await res.json(), { ok: true, message: 'hola' });
});

test('Valida el JSON', async () => {
  const res = await fetch(`${base}/api/v1/echo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 12 })
  });
  assert.equal(res.status, 400);
});

test('Los endpoints inexistentes responden 404', async () => {
  const res = await fetch(`${base}/api/v1/noexiste`);
  assert.equal(res.status, 404);
});

test('La API aplica un límite configurable', async () => {
  const limited = createApp({ limitPerMinute: 2 });
  await new Promise(resolve => limited.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${limited.address().port}`;
  try {
    const responses = [];
    for (let i = 0; i < 3; i++) responses.push(await fetch(`${address}/api/v1/ping`));
    assert.deepEqual(responses.map(x => x.status), [200, 200, 429]);
  } finally {
    await new Promise(resolve => limited.close(resolve));
  }
});
