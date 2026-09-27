'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { startApp, seedOwner } = require('./helpers');
const { addDays, today } = require('../src/util');

let env, owner, seed;
test.before(async () => { env = await startApp(); owner = env.client(); seed = await seedOwner(owner); });
test.after(async () => { await env.close(); });

function quoteBody(extra = {}) {
  return {
    customer_name: 'Neha Kapoor', phone: '98765 43210', pax: 4, rooms: 2, start_date: addDays(today(), 10), category: 'Deluxe',
    package_name: 'Shillong 3D', vehicle_id: seed.v1, extras_pp: 500, markup_pct: 15, gst_pct: 5,
    days: [{ plan: 'Guwahati to Shillong', hotel_id: seed.hotels['Pine Crest'] }, { plan: 'Cherrapunji', hotel_id: seed.hotels['Sohra Stay'] }, { plan: 'Drop' }],
    ...extra,
  };
}

test('setup cannot be repeated and needs the code', async () => {
  const c = env.client();
  const again = await c.post('/api/setup', { setup_code: 'test-code', agency_name: 'X', name: 'Y', email: 'y@y.in', password: '12345678' });
  assert.strictEqual(again.status, 409);
  const wrong = await c.post('/api/setup', { setup_code: 'nope', agency_name: 'X', name: 'Y', email: 'y@y.in', password: '12345678' });
  assert.strictEqual(wrong.status, 403);
});

test('API needs a session, and writes need the CSRF header', async () => {
  const anon = env.client();
  assert.strictEqual((await anon.get('/api/bootstrap')).status, 401);
  const noHeader = await fetch(env.base + '/api/enquiries', { method: 'POST', headers: { Cookie: owner.cookie, 'Content-Type': 'application/json' }, body: '{"name":"x"}' });
  assert.strictEqual(noHeader.status, 403);
  const crossSite = await owner.post('/api/enquiries', { name: 'x' }, { Origin: 'https://evil.example' });
  assert.strictEqual(crossSite.status, 403);
});

test('login rejects wrong passwords and rate-limits', async () => {
  const c = env.client();
  for (let i = 0; i < 5; i++) assert.strictEqual((await c.post('/api/login', { email: 'owner@test.in', password: 'wrong-pass' })).status, 401);
  assert.strictEqual((await c.post('/api/login', { email: 'owner@test.in', password: 'correct-horse' })).status, 429);
});

test('security headers are set', async () => {
  const r = await owner.get('/api/session');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.strictEqual(r.headers.get('x-frame-options'), 'DENY');
});

test('enquiry to quote to trip, with server-side pricing', async () => {
  const e = await owner.post('/api/enquiries', { name: 'Neha Kapoor', phone: '98765 43210', source: 'WhatsApp', destination: 'Meghalaya 3 days', pax: 4 });
  assert.strictEqual(e.status, 200);
  assert.match(e.data.ref, /^E-\d+$/);
  assert.strictEqual(e.data.next_follow_up, today());

  // The client cannot choose its own prices: rates come from the hotels and vehicle on the server.
  const q = await owner.post('/api/quotes', quoteBody({ enquiry_id: e.data.id, vehicle_rate: 1, total: 1 }));
  assert.strictEqual(q.status, 200, JSON.stringify(q.data));
  const cost = (4000 + 3500) * 2 + 4500 * 3 + 500 * 4;
  assert.strictEqual(q.data.totals.cost, cost);
  assert.strictEqual(q.data.total, Math.round((cost + Math.round(cost * 0.15)) * 1.05));
  assert.strictEqual(q.data.days[0].hotel, 'Pine Crest');
  const enq = await owner.get('/api/enquiries/' + e.data.id);
  assert.strictEqual(enq.data.status, 'Quoted');

  // Public link shows the quote without cost or margin.
  const pub = await env.client().get('/api/public/quotes/' + q.data.public_token);
  assert.strictEqual(pub.status, 200);
  assert.strictEqual(pub.data.total, q.data.total);
  assert.strictEqual(pub.data.totals, undefined);
  assert.ok(!JSON.stringify(pub.data).includes('"rate"'));

  // Changing a hotel rate later does not change the saved quote.
  await owner.put('/api/hotels/' + seed.hotels['Pine Crest'], { rate: 9999 });
  assert.strictEqual((await owner.get('/api/quotes/' + q.data.id)).data.total, q.data.total);

  const t = await owner.post(`/api/quotes/${q.data.id}/confirm`, { advance: 10000, method: 'UPI', reference: 'UTR123' });
  assert.strictEqual(t.status, 200, JSON.stringify(t.data));
  assert.strictEqual(t.data.received, 10000);
  assert.strictEqual(t.data.balance, q.data.total - 10000);
  assert.strictEqual(t.data.end_date, addDays(today(), 12));
  assert.strictEqual((await owner.get('/api/enquiries/' + e.data.id)).data.status, 'Won');

  // A quote can only be confirmed once.
  assert.strictEqual((await owner.post(`/api/quotes/${q.data.id}/confirm`, {})).status, 409);

  // Payments: balance and supplier dues follow the ledger.
  await owner.post(`/api/trips/${t.data.id}/payments`, { direction: 'in', amount: 5000, paid_on: today(), method: 'Cash' });
  await owner.post(`/api/trips/${t.data.id}/payments`, { direction: 'out', amount: 7000, paid_on: today(), method: 'UPI', party: 'Pine Crest' });
  const td = await owner.get('/api/trips/' + t.data.id);
  assert.strictEqual(td.data.received, 15000);
  assert.strictEqual(td.data.supplier_due, q.data.totals.cost - 7000);
  assert.strictEqual(td.data.payments.length, 3);
  assert.strictEqual(td.data.profit, q.data.totals.markup);
});

test('a vehicle cannot be double-booked', async () => {
  const start = addDays(today(), 30);
  const a = await owner.post('/api/quotes', quoteBody({ start_date: start, customer_name: 'Group A' }));
  const b = await owner.post('/api/quotes', quoteBody({ start_date: addDays(start, 2), customer_name: 'Group B' }));
  assert.strictEqual((await owner.post(`/api/quotes/${a.data.id}/confirm`, {})).status, 200);
  const preview = await owner.post('/api/quotes/preview', quoteBody({ start_date: addDays(start, 2) }));
  assert.ok(preview.data.clash, 'preview warns about the clash');
  const clash = await owner.post(`/api/quotes/${b.data.id}/confirm`, {});
  assert.strictEqual(clash.status, 409);
  assert.match(clash.data.error, /already booked for Group A/);

  // Moving group B to the other vehicle works, and back to the first is blocked.
  const b2 = await owner.post('/api/quotes', quoteBody({ start_date: addDays(start, 2), customer_name: 'Group B', vehicle_id: seed.v2 }));
  const tb = await owner.post(`/api/quotes/${b2.data.id}/confirm`, {});
  assert.strictEqual(tb.status, 200);
  assert.strictEqual((await owner.put('/api/trips/' + tb.data.id, { vehicle_id: seed.v1 })).status, 409);

  // Cancelling A frees the vehicle.
  const ta = (await owner.get('/api/trips?filter=All')).data.rows.find((t) => t.customer_name === 'Group A');
  assert.strictEqual((await owner.post(`/api/trips/${ta.id}/cancel`, { reason: 'Customer cancelled' })).status, 200);
  assert.strictEqual((await owner.put('/api/trips/' + tb.data.id, { vehicle_id: seed.v1 })).status, 200);
});

test('validation gives clear messages', async () => {
  const r = await owner.post('/api/quotes', quoteBody({ start_date: '2026-02-30' }));
  assert.strictEqual(r.status, 400);
  assert.match(r.data.error, /start date/);
  const p = await owner.post('/api/enquiries', { name: '' });
  assert.strictEqual(p.status, 400);
  assert.match(p.data.error, /customer name/);
});

test('staff can work but not change settings, cancel trips or see profit', async () => {
  const u = await owner.post('/api/users', { name: 'Staff', email: 'staff@test.in', password: 'staff-pass-1', role: 'staff' });
  assert.strictEqual(u.status, 200);
  const staff = env.client();
  assert.strictEqual((await staff.post('/api/login', { email: 'staff@test.in', password: 'staff-pass-1' })).status, 200);
  assert.strictEqual((await staff.post('/api/enquiries', { name: 'Walk in' })).status, 200);
  assert.strictEqual((await staff.put('/api/agency', { name: 'Hacked' })).status, 403);
  assert.strictEqual((await staff.post('/api/hotels', { city: 'X', category: 'Deluxe', name: 'Y', rate: 1 })).status, 403);
  assert.strictEqual((await staff.get('/api/export')).status, 403);
  const money = await staff.get('/api/money');
  assert.strictEqual(money.data.profit, undefined);

  // Deactivating a user ends their session immediately.
  await owner.put('/api/users/' + u.data.id, { active: false });
  assert.strictEqual((await staff.get('/api/bootstrap')).status, 401);
});

test('the last owner cannot lock themselves out', async () => {
  const me = (await owner.get('/api/session')).data.user;
  assert.strictEqual((await owner.put('/api/users/' + me.id, { active: false })).status, 400);
});

test('dashboard, fleet and money endpoints respond', async () => {
  const d = await owner.get('/api/dashboard');
  assert.strictEqual(d.status, 200);
  assert.ok('kpis' in d.data);
  const f = await owner.get('/api/fleet?days=14');
  assert.strictEqual(f.data.vehicles.length, 2);
  const m = await owner.get('/api/money');
  assert.ok(Array.isArray(m.data.profit));
});

test('export and backup download work for the owner', async () => {
  const ex = await owner.get('/api/export');
  assert.strictEqual(ex.status, 200);
  const data = ex.data;
  assert.match(ex.headers.get("content-disposition"), /attachment; filename="tourdesk-export-/);
  assert.ok(data.trips.length >= 1);
  assert.ok(data.users.every((u) => !('pass_hash' in u)));
  const res = await fetch(env.base + '/api/backup', { headers: { Cookie: owner.cookie } });
  assert.strictEqual(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.strictEqual(buf.subarray(0, 15).toString(), 'SQLite format 3');
  await env.app.backup.daily();
  assert.ok(fs.readdirSync(env.dataDir + '/backups').some((f) => /^tourdesk-\d{4}-\d{2}-\d{2}\.db$/.test(f)));
});

test('static files and path traversal', async () => {
  assert.strictEqual((await fetch(env.base + '/')).status, 200);
  assert.strictEqual((await fetch(env.base + '/q/abcdefghijklmnopqrstuv')).status, 200);
  assert.strictEqual((await fetch(env.base + '/..%2fserver.js')).status, 404);
  assert.strictEqual((await fetch(env.base + '/healthz')).status, 200);
});
