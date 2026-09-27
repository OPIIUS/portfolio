'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

// Starts a fresh app on a random port with its own data folder. Returns a small client.
async function startApp() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tourdesk-test-'));
  const app = createApp({ port: 0, host: '127.0.0.1', dataDir, trustProxy: false, setupCode: 'test-code', backupKeep: 3, quiet: true });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;

  function client() {
    let cookie = '';
    async function call(method, url, body, headers = {}) {
      const h = { 'X-Requested-With': 'tourdesk', ...headers };
      if (cookie) h.Cookie = cookie;
      if (body !== undefined) h['Content-Type'] = 'application/json';
      const res = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const type = res.headers.get('content-type') || '';
      const data = type.includes('json') ? await res.json() : await res.text();
      return { status: res.status, data, headers: res.headers };
    }
    return {
      get: (u, h) => call('GET', u, undefined, h), post: (u, b = {}, h) => call('POST', u, b, h),
      put: (u, b, h) => call('PUT', u, b, h), del: (u, h) => call('DELETE', u, undefined, h),
      get cookie() { return cookie; },
    };
  }

  async function close() { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
  return { app, base, client, close, dataDir };
}

// Creates the owner and a small data set: two cities with hotels, two vehicles, one package.
async function seedOwner(c) {
  const r = await c.post('/api/setup', { setup_code: 'test-code', agency_name: 'Test Trails', name: 'Owner', email: 'owner@test.in', password: 'correct-horse' });
  if (r.status !== 200) throw new Error('setup failed ' + JSON.stringify(r.data));
  const h = {};
  for (const [city, cat, name, rate] of [['Shillong', 'Deluxe', 'Pine Crest', 4000], ['Cherrapunji', 'Deluxe', 'Sohra Stay', 3500], ['Shillong', 'Premium', 'Cloud Nine', 7000]]) {
    h[name] = (await c.post('/api/hotels', { city, category: cat, name, rate })).data.id;
  }
  const v1 = (await c.post('/api/vehicles', { reg: 'AS01 AB 1234', type: 'Innova Crysta', seats: 6, rate: 4500, driver_name: 'Bipul' })).data.id;
  const v2 = (await c.post('/api/vehicles', { reg: 'AS01 CD 5678', type: 'Ertiga', seats: 5, rate: 3300, driver_name: 'Raju' })).data.id;
  return { hotels: h, v1, v2 };
}

module.exports = { startApp, seedOwner };
