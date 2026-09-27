'use strict';
const crypto = require('crypto');
const Pricing = require('../public/pricing.js');
const auth = require('./auth');
const { HttpError, clean, isDate, today, addDays, daysBetween } = require('./util');

const CATEGORIES = ['Standard', 'Deluxe', 'Premium'];
const ENQ_STATUS = ['New', 'Quoted', 'Follow-up', 'Won', 'Lost'];
const OPEN_ENQ = ['New', 'Quoted', 'Follow-up'];
const SOURCES = ['WhatsApp', 'Call', 'Website', 'Instagram', 'Facebook', 'Referral', 'Walk-in', 'Email', 'Other'];
const METHODS = ['UPI', 'Cash', 'Bank transfer', 'Card', 'Cheque', 'Other'];
const MAX_DAYS = 30;

/* ---------------- helpers ---------------- */

function audit(ctx, action, entity, id, detail = '') {
  ctx.db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)')
    .run(ctx.user ? ctx.user.id : null, action, entity, id ?? null, String(detail).slice(0, 500));
}

function nextNumber(db, name, prefix) {
  const row = db.prepare('UPDATE sequences SET value = value + 1 WHERE name = ? RETURNING value').get(name);
  return `${prefix}-${row.value}`;
}

function agency(db) { return db.prepare('SELECT * FROM agency WHERE id = 1').get(); }

function idParam(ctx) {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Not found.');
  return id;
}

function must(row, what = 'Record') { if (!row) throw new HttpError(404, `${what} not found.`); return row; }

function requireOwner(ctx) { if (ctx.user.role !== 'owner') throw new HttpError(403, 'Only the owner can do this.'); }

function tripState(t, td) {
  if (t.status === 'Cancelled') return 'Cancelled';
  if (td < t.start_date) return 'Upcoming';
  if (td <= t.end_date) return 'On trip';
  return 'Completed';
}

function paidSums(db, tripId) {
  const r = db.prepare(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount END),0) AS received,
    COALESCE(SUM(CASE WHEN direction='out' THEN amount END),0) AS paid_out FROM payments WHERE trip_id = ?`).get(tripId);
  return r;
}

function tripView(db, t, td = today()) {
  const s = paidSums(db, t.id);
  const v = t.vehicle_id ? db.prepare('SELECT * FROM vehicles WHERE id = ?').get(t.vehicle_id) : null;
  return {
    ...t,
    days: JSON.parse(t.days_json), days_json: undefined,
    hotels_confirmed: !!t.hotels_confirmed,
    state: tripState(t, td),
    received: s.received, balance: t.status === 'Cancelled' ? 0 : t.total - s.received,
    paid_out: s.paid_out, supplier_due: t.status === 'Cancelled' ? 0 : t.cost - s.paid_out,
    profit: t.total - t.gst_amount - t.cost,
    vehicle: v ? { id: v.id, reg: v.reg, type: v.type, driver_name: v.driver_name, driver_phone: v.driver_phone } : null,
  };
}

function quoteView(q) {
  return {
    ...q,
    days: JSON.parse(q.days_json), days_json: undefined,
    extra_lines: JSON.parse(q.extra_lines_json), extra_lines_json: undefined,
    totals: JSON.parse(q.totals_json), totals_json: undefined,
  };
}

function vehicleClash(db, vehicleId, start, end, ignoreTripId = 0) {
  return db.prepare(`SELECT id, number, customer_name, start_date, end_date FROM trips
    WHERE vehicle_id = ? AND status = 'Confirmed' AND id != ? AND NOT (end_date < ? OR start_date > ?)
    ORDER BY start_date LIMIT 1`).get(vehicleId, ignoreTripId, start, end);
}

function clashError(v, c) {
  return new HttpError(409, `${v.type} ${v.reg} is already booked for ${c.customer_name} (${c.number}) from ${c.start_date} to ${c.end_date}. Pick another vehicle.`);
}

/* ---------------- validation specs ---------------- */

const AGENCY_SPEC = {
  name: { type: 'str', required: true, max: 120, label: 'agency name' },
  city: { type: 'str', max: 80 }, address: { type: 'str', max: 300 }, phone: { type: 'str', max: 40 },
  email: { type: 'str', max: 120 }, gstin: { type: 'str', max: 20, label: 'GSTIN' },
  advance_pct: { type: 'int', min: 0, max: 100, label: 'advance %' },
  markup_pct: { type: 'int', min: 0, max: 200, label: 'default markup %' },
  gst_pct: { type: 'int', min: 0, max: 28, label: 'GST %' },
  quote_valid_days: { type: 'int', min: 1, max: 90, label: 'quote validity' },
  balance_due_days: { type: 'int', min: 0, max: 60, label: 'balance due days' },
  included: { type: 'str', max: 2000 }, excluded: { type: 'str', max: 2000 }, terms: { type: 'str', max: 3000 },
};
const HOTEL_SPEC = {
  city: { type: 'str', required: true, max: 60 }, category: { type: 'enum', values: CATEGORIES, required: true },
  name: { type: 'str', required: true, max: 120, label: 'hotel name' },
  rate: { type: 'int', min: 0, max: 1000000, required: true, label: 'room rate' },
  phone: { type: 'str', max: 40 }, active: { type: 'bool', default: true },
};
const VEHICLE_SPEC = {
  reg: { type: 'str', required: true, max: 30, label: 'registration number' },
  type: { type: 'str', required: true, max: 60, label: 'vehicle type' },
  seats: { type: 'int', min: 1, max: 60, required: true },
  rate: { type: 'int', min: 0, max: 1000000, required: true, label: 'rate per day' },
  driver_name: { type: 'str', max: 80 }, driver_phone: { type: 'str', max: 40 }, active: { type: 'bool', default: true },
};
const ENQ_SPEC = {
  name: { type: 'str', required: true, max: 120, label: 'customer name' },
  phone: { type: 'phone', label: 'phone' },
  source: { type: 'enum', values: SOURCES, default: 'WhatsApp' },
  destination: { type: 'str', max: 200, label: 'trip wanted' },
  pax: { type: 'int', min: 1, max: 200, default: 2, label: 'travellers' },
  travel_date: { type: 'date', nullable: true, label: 'travel date' },
  status: { type: 'enum', values: ENQ_STATUS, default: 'New' },
  next_follow_up: { type: 'date', nullable: true, label: 'next follow-up' },
  notes: { type: 'str', max: 2000 },
};
const PAYMENT_SPEC = {
  direction: { type: 'enum', values: ['in', 'out'], required: true },
  amount: { type: 'int', min: 1, max: 100000000, required: true },
  paid_on: { type: 'date', required: true, label: 'payment date' },
  method: { type: 'enum', values: METHODS, default: 'UPI' },
  party: { type: 'str', max: 120, label: 'paid to' }, reference: { type: 'str', max: 120 },
};

function cleanDays(days) {
  if (!Array.isArray(days) || days.length < 1) throw new HttpError(400, 'Add at least one day.');
  if (days.length > MAX_DAYS) throw new HttpError(400, `A trip can have at most ${MAX_DAYS} days.`);
  return days.map((d, i) => {
    const c = clean(d || {}, { plan: { type: 'str', max: 300 }, city: { type: 'str', max: 60 },
      hotel_id: { type: 'int', min: 1, nullable: true } });
    if (!c.plan) c.plan = `Day ${i + 1}`;
    return c;
  });
}

/* ---------------- handlers ---------------- */

const routes = [];
function route(method, path, handler, access = 'user') {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, access });
}

/* ---- session & setup ---- */

route('GET', '/api/session', (ctx) => {
  const users = ctx.db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  return { user: ctx.user, needs_setup: users === 0, agency_name: agency(ctx.db).name };
}, 'public');

route('POST', '/api/setup', (ctx) => {
  const b = clean(ctx.body, {
    setup_code: { type: 'str', required: true, label: 'setup code' },
    agency_name: { type: 'str', required: true, max: 120, label: 'agency name' },
    name: { type: 'str', required: true, max: 80, label: 'your name' },
    email: { type: 'str', required: true, max: 120 },
    password: { type: 'str', required: true, max: 200 },
  });
  const code = String(ctx.config.setupCode || '');
  const given = String(b.setup_code);
  if (!code || given.length !== code.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(code))) {
    throw new HttpError(403, 'That setup code is not right. It is printed in the server log on first start.');
  }
  checkEmail(b.email); checkPassword(b.password);
  const user = ctx.db.transaction(() => {
    if (ctx.db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) throw new HttpError(409, 'Setup is already done. Please sign in.');
    const id = ctx.db.prepare('INSERT INTO users (name, email, pass_hash, role) VALUES (?, ?, ?, ?)')
      .run(b.name, b.email.toLowerCase(), auth.hashPassword(b.password), 'owner').lastInsertRowid;
    ctx.db.prepare('UPDATE agency SET name = ? WHERE id = 1').run(b.agency_name);
    return { id: Number(id), name: b.name, email: b.email.toLowerCase(), role: 'owner' };
  })();
  ctx.user = user;
  audit(ctx, 'setup', 'user', user.id, 'Owner account created');
  ctx.startSession(user.id);
  return { user };
}, 'public');

function checkEmail(e) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'Please enter a valid email address.'); }
function checkPassword(p) { if (String(p).length < 8) throw new HttpError(400, 'Passwords must be at least 8 characters.'); }

route('POST', '/api/login', (ctx) => {
  const b = clean(ctx.body, { email: { type: 'str', required: true, max: 120 }, password: { type: 'str', required: true, max: 200 } });
  const key = ctx.ip + '|' + b.email.toLowerCase();
  if (ctx.limiter.blocked(key) || ctx.ipLimiter.blocked(ctx.ip)) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.');
  const u = ctx.db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(b.email.toLowerCase());
  const ok = auth.verifyPassword(b.password, u ? u.pass_hash : auth.DUMMY_HASH) && !!u;
  if (!ok) {
    ctx.limiter.fail(key);
    ctx.ipLimiter.fail(ctx.ip);
    throw new HttpError(401, 'Wrong email or password.');
  }
  ctx.limiter.reset(key);
  ctx.startSession(u.id);
  ctx.user = { id: u.id, name: u.name, email: u.email, role: u.role };
  audit(ctx, 'login', 'user', u.id);
  return { user: ctx.user };
}, 'public');

route('POST', '/api/logout', (ctx) => { ctx.endSession(); return { ok: true }; }, 'public');

route('POST', '/api/me/password', (ctx) => {
  const b = clean(ctx.body, { current: { type: 'str', required: true, max: 200, label: 'current password' },
    password: { type: 'str', required: true, max: 200, label: 'new password' } });
  const u = ctx.db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(ctx.user.id);
  if (!auth.verifyPassword(b.current, u.pass_hash)) throw new HttpError(400, 'Your current password is not right.');
  checkPassword(b.password);
  ctx.db.transaction(() => {
    ctx.db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(auth.hashPassword(b.password), ctx.user.id);
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(ctx.user.id);
  })();
  ctx.startSession(ctx.user.id);
  audit(ctx, 'password', 'user', ctx.user.id);
  return { ok: true };
});

/* ---- bootstrap: everything the app needs on load ---- */

route('GET', '/api/bootstrap', (ctx) => {
  const db = ctx.db;
  return {
    user: ctx.user, today: today(), agency: agency(db),
    hotels: db.prepare('SELECT * FROM hotels ORDER BY city, category, rate').all(),
    vehicles: db.prepare('SELECT * FROM vehicles ORDER BY active DESC, seats, rate').all(),
    packages: db.prepare('SELECT * FROM packages ORDER BY active DESC, name').all()
      .map((p) => ({ ...p, days: JSON.parse(p.days_json), days_json: undefined })),
    options: { categories: CATEGORIES, enquiry_status: ENQ_STATUS, sources: SOURCES, methods: METHODS },
  };
});

/* ---- settings (owner) ---- */

route('PUT', '/api/agency', (ctx) => {
  requireOwner(ctx);
  const b = clean(ctx.body, AGENCY_SPEC);
  const cols = Object.keys(b);
  ctx.db.prepare(`UPDATE agency SET ${cols.map((c) => c + ' = @' + c).join(', ')} WHERE id = 1`).run(b);
  audit(ctx, 'update', 'agency', 1);
  return agency(ctx.db);
});

function crud(name, table, spec, label) {
  route('POST', `/api/${name}`, (ctx) => {
    requireOwner(ctx);
    const b = clean(ctx.body, spec);
    b.active = b.active ? 1 : 0;
    const cols = Object.keys(b);
    const id = ctx.db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`).run(b).lastInsertRowid;
    audit(ctx, 'create', table, Number(id), b.name || b.reg || '');
    return ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  });
  route('PUT', `/api/${name}/:id`, (ctx) => {
    requireOwner(ctx);
    const id = idParam(ctx);
    must(ctx.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id), label);
    const b = clean(ctx.body, spec, true);
    if ('active' in b) b.active = b.active ? 1 : 0;
    const cols = Object.keys(b);
    if (cols.length) ctx.db.prepare(`UPDATE ${table} SET ${cols.map((c) => c + ' = @' + c).join(', ')} WHERE id = @id`).run({ ...b, id });
    audit(ctx, 'update', table, id);
    return ctx.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  });
}
crud('hotels', 'hotels', HOTEL_SPEC, 'Hotel');
crud('vehicles', 'vehicles', VEHICLE_SPEC, 'Vehicle');

function cleanPackage(body, partial) {
  const b = clean(body, { name: { type: 'str', required: true, max: 120, label: 'package name' },
    extras_pp: { type: 'int', min: 0, max: 1000000, label: 'entry fees per person' }, active: { type: 'bool', default: true } }, partial);
  if (!partial || body.days !== undefined) b.days_json = JSON.stringify(cleanDays(body.days).map((d) => ({ plan: d.plan, city: d.city })));
  if ('active' in b) b.active = b.active ? 1 : 0;
  return b;
}
function packageOut(p) { return { ...p, days: JSON.parse(p.days_json), days_json: undefined }; }

route('POST', '/api/packages', (ctx) => {
  requireOwner(ctx);
  const b = cleanPackage(ctx.body, false);
  const id = ctx.db.prepare('INSERT INTO packages (name, extras_pp, days_json, active) VALUES (@name, @extras_pp, @days_json, @active)').run(b).lastInsertRowid;
  audit(ctx, 'create', 'packages', Number(id), b.name);
  return packageOut(ctx.db.prepare('SELECT * FROM packages WHERE id = ?').get(id));
});
route('PUT', '/api/packages/:id', (ctx) => {
  requireOwner(ctx);
  const id = idParam(ctx);
  must(ctx.db.prepare('SELECT id FROM packages WHERE id = ?').get(id), 'Package');
  const b = cleanPackage(ctx.body, true);
  const cols = Object.keys(b);
  if (cols.length) ctx.db.prepare(`UPDATE packages SET ${cols.map((c) => c + ' = @' + c).join(', ')} WHERE id = @id`).run({ ...b, id });
  audit(ctx, 'update', 'packages', id);
  return packageOut(ctx.db.prepare('SELECT * FROM packages WHERE id = ?').get(id));
});

/* ---- users (owner) ---- */

route('GET', '/api/users', (ctx) => {
  requireOwner(ctx);
  return ctx.db.prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY active DESC, name').all();
});
route('POST', '/api/users', (ctx) => {
  requireOwner(ctx);
  const b = clean(ctx.body, { name: { type: 'str', required: true, max: 80 }, email: { type: 'str', required: true, max: 120 },
    role: { type: 'enum', values: ['owner', 'staff'], default: 'staff' }, password: { type: 'str', required: true, max: 200 } });
  checkEmail(b.email); checkPassword(b.password);
  if (ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(b.email.toLowerCase())) throw new HttpError(409, 'Someone already uses that email.');
  const id = ctx.db.prepare('INSERT INTO users (name, email, pass_hash, role) VALUES (?, ?, ?, ?)')
    .run(b.name, b.email.toLowerCase(), auth.hashPassword(b.password), b.role).lastInsertRowid;
  audit(ctx, 'create', 'user', Number(id), `${b.name} (${b.role})`);
  return ctx.db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(id);
});
route('PUT', '/api/users/:id', (ctx) => {
  requireOwner(ctx);
  const id = idParam(ctx);
  must(ctx.db.prepare('SELECT id FROM users WHERE id = ?').get(id), 'User');
  const b = clean(ctx.body, { name: { type: 'str', max: 80 }, role: { type: 'enum', values: ['owner', 'staff'] },
    active: { type: 'bool' }, password: { type: 'str', max: 200, label: 'new password' } }, true);
  if (id === ctx.user.id && (b.active === false || b.role === 'staff')) throw new HttpError(400, "You can't remove your own owner access.");
  ctx.db.transaction(() => {
    if (b.name) ctx.db.prepare('UPDATE users SET name = ? WHERE id = ?').run(b.name, id);
    if (b.role) ctx.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(b.role, id);
    if (b.active !== undefined) ctx.db.prepare('UPDATE users SET active = ? WHERE id = ?').run(b.active ? 1 : 0, id);
    if (b.password) { checkPassword(b.password); ctx.db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(auth.hashPassword(b.password), id); }
    if (b.active === false || b.password || b.role) ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    const owners = ctx.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND active = 1").get().n;
    if (owners < 1) throw new HttpError(400, 'There must always be at least one active owner.');
  })();
  audit(ctx, 'update', 'user', id, Object.keys(b).filter((k) => k !== 'password').join(',') + (b.password ? ',password reset' : ''));
  return ctx.db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(id);
});

/* ---- enquiries ---- */

route('GET', '/api/enquiries', (ctx) => {
  const st = ctx.query.get('status') || 'Open';
  const q = (ctx.query.get('q') || '').trim();
  const where = [], args = [];
  if (st === 'Open') where.push(`status IN ('New','Quoted','Follow-up')`);
  else if (ENQ_STATUS.includes(st)) { where.push('status = ?'); args.push(st); }
  if (q) { where.push('(name LIKE ? OR phone LIKE ? OR destination LIKE ? OR ref LIKE ?)'); const l = `%${q}%`; args.push(l, l, l, l); }
  const rows = ctx.db.prepare(`SELECT * FROM enquiries ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE WHEN next_follow_up IS NULL THEN 1 ELSE 0 END, next_follow_up, created_at DESC LIMIT 500`).all(...args);
  const counts = Object.fromEntries(ctx.db.prepare('SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status').all().map((r) => [r.status, r.n]));
  return { rows, counts };
});

route('GET', '/api/enquiries/:id', (ctx) => {
  const e = must(ctx.db.prepare('SELECT * FROM enquiries WHERE id = ?').get(idParam(ctx)), 'Enquiry');
  const quotes = ctx.db.prepare('SELECT id, number, total, status, created_at FROM quotes WHERE enquiry_id = ? ORDER BY id DESC').all(e.id);
  return { ...e, quotes };
});

route('POST', '/api/enquiries', (ctx) => {
  const b = clean(ctx.body, ENQ_SPEC);
  if (!b.next_follow_up && OPEN_ENQ.includes(b.status)) b.next_follow_up = today();
  const row = ctx.db.transaction(() => {
    b.ref = nextNumber(ctx.db, 'enquiry', 'E');
    const id = ctx.db.prepare(`INSERT INTO enquiries (ref, name, phone, source, destination, pax, travel_date, status, next_follow_up, notes, created_by)
      VALUES (@ref, @name, @phone, @source, @destination, @pax, @travel_date, @status, @next_follow_up, @notes, @uid)`).run({ ...b, uid: ctx.user.id }).lastInsertRowid;
    return ctx.db.prepare('SELECT * FROM enquiries WHERE id = ?').get(id);
  })();
  audit(ctx, 'create', 'enquiry', row.id, row.ref + ' ' + row.name);
  return row;
});

route('PUT', '/api/enquiries/:id', (ctx) => {
  const id = idParam(ctx);
  must(ctx.db.prepare('SELECT id FROM enquiries WHERE id = ?').get(id), 'Enquiry');
  const b = clean(ctx.body, ENQ_SPEC, true);
  if (b.status && !OPEN_ENQ.includes(b.status)) b.next_follow_up = null;
  const cols = Object.keys(b);
  if (cols.length) ctx.db.prepare(`UPDATE enquiries SET ${cols.map((c) => c + ' = @' + c).join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...b, id });
  audit(ctx, 'update', 'enquiry', id, cols.join(','));
  return ctx.db.prepare('SELECT * FROM enquiries WHERE id = ?').get(id);
});

route('POST', '/api/enquiries/:id/followed-up', (ctx) => {
  const id = idParam(ctx);
  const e = must(ctx.db.prepare('SELECT * FROM enquiries WHERE id = ?').get(id), 'Enquiry');
  const b = clean(ctx.body || {}, { next_follow_up: { type: 'date', nullable: true }, note: { type: 'str', max: 500 } });
  const next = b.next_follow_up || addDays(today(), 2);
  const stamp = `${today()}: followed up${b.note ? ' – ' + b.note : ''}`;
  ctx.db.prepare(`UPDATE enquiries SET status = CASE WHEN status = 'New' THEN 'Follow-up' ELSE status END, next_follow_up = ?,
    notes = CASE WHEN notes = '' THEN ? ELSE ? || char(10) || notes END, updated_at = datetime('now') WHERE id = ?`).run(next, stamp, stamp, id);
  audit(ctx, 'follow-up', 'enquiry', id, e.ref);
  return ctx.db.prepare('SELECT * FROM enquiries WHERE id = ?').get(id);
});

/* ---- quotes ---- */

function buildQuote(db, body) {
  const b = clean(body, {
    enquiry_id: { type: 'int', min: 1, nullable: true },
    customer_name: { type: 'str', required: true, max: 120, label: 'customer name' },
    phone: { type: 'phone' },
    pax: { type: 'int', min: 1, max: 200, required: true, label: 'travellers' },
    rooms: { type: 'int', min: 0, max: 100, required: true },
    start_date: { type: 'date', required: true, label: 'start date' },
    category: { type: 'enum', values: CATEGORIES, required: true },
    package_name: { type: 'str', max: 120 },
    vehicle_id: { type: 'int', min: 1, nullable: true },
    vehicle_label: { type: 'str', max: 80, label: 'hired vehicle' },
    vehicle_rate: { type: 'int', min: 0, max: 1000000, label: 'vehicle rate' },
    extras_pp: { type: 'int', min: 0, max: 1000000, label: 'entry fees per person' },
    markup_pct: { type: 'int', min: 0, max: 200, required: true, label: 'markup %' },
    gst_pct: { type: 'int', min: 0, max: 28, required: true, label: 'GST %' },
  });
  const days = cleanDays(body.days).map((d) => {
    if (!d.hotel_id) return { plan: d.plan, city: d.city || '', hotel_id: null, hotel: '', rate: 0 };
    const h = db.prepare('SELECT * FROM hotels WHERE id = ?').get(d.hotel_id);
    if (!h) throw new HttpError(400, `The hotel chosen for "${d.plan}" no longer exists.`);
    return { plan: d.plan, city: h.city, hotel_id: h.id, hotel: h.name, rate: h.rate };
  });
  const lines = Array.isArray(body.extra_lines) ? body.extra_lines : [];
  if (lines.length > 20) throw new HttpError(400, 'At most 20 extra lines.');
  const extra_lines = lines.map((l) => clean(l || {}, { label: { type: 'str', required: true, max: 120, label: 'extra item name' },
    amount: { type: 'int', min: 0, max: 10000000, required: true, label: 'extra item amount' } }));
  if (b.vehicle_id) {
    const v = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(b.vehicle_id);
    if (!v) throw new HttpError(400, 'That vehicle no longer exists.');
    b.vehicle_label = `${v.type} (${v.reg})`;
    b.vehicle_rate = v.rate;
  } else if (!b.vehicle_label) {
    b.vehicle_rate = 0;
  }
  const totals = Pricing.compute({ ...b, days, extra_lines });
  return { ...b, days, extra_lines, totals };
}

route('POST', '/api/quotes/preview', (ctx) => {
  const q = buildQuote(ctx.db, ctx.body);
  const a = agency(ctx.db);
  const end = addDays(q.start_date, q.days.length - 1);
  const clash = q.vehicle_id ? vehicleClash(ctx.db, q.vehicle_id, q.start_date, end) : null;
  return { totals: q.totals, advance: Pricing.advance(q.totals.total, a.advance_pct), clash };
});

route('POST', '/api/quotes', (ctx) => {
  const q = buildQuote(ctx.db, ctx.body);
  const a = agency(ctx.db);
  const td = today();
  const row = ctx.db.transaction(() => {
    if (q.enquiry_id && !ctx.db.prepare('SELECT id FROM enquiries WHERE id = ?').get(q.enquiry_id)) throw new HttpError(400, 'That enquiry no longer exists.');
    const number = nextNumber(ctx.db, 'quote', 'Q');
    const id = ctx.db.prepare(`INSERT INTO quotes (number, public_token, enquiry_id, customer_name, phone, pax, rooms, start_date, category,
      package_name, vehicle_id, vehicle_label, vehicle_rate, extras_pp, markup_pct, gst_pct, days_json, extra_lines_json, totals_json, total, valid_until, created_by)
      VALUES (@number, @token, @enquiry_id, @customer_name, @phone, @pax, @rooms, @start_date, @category, @package_name, @vehicle_id, @vehicle_label,
      @vehicle_rate, @extras_pp, @markup_pct, @gst_pct, @days_json, @extra_lines_json, @totals_json, @total, @valid_until, @uid)`).run({
      ...q, number, token: crypto.randomBytes(18).toString('base64url'), days_json: JSON.stringify(q.days),
      extra_lines_json: JSON.stringify(q.extra_lines), totals_json: JSON.stringify(q.totals), total: q.totals.total,
      valid_until: addDays(td, a.quote_valid_days), uid: ctx.user.id,
    }).lastInsertRowid;
    if (q.enquiry_id) {
      ctx.db.prepare(`UPDATE enquiries SET status = CASE WHEN status IN ('New','Follow-up') THEN 'Quoted' ELSE status END,
        next_follow_up = COALESCE(next_follow_up, ?), updated_at = datetime('now') WHERE id = ? AND status NOT IN ('Won','Lost')`).run(addDays(td, 1), q.enquiry_id);
      ctx.db.prepare(`UPDATE enquiries SET next_follow_up = ? WHERE id = ? AND next_follow_up <= ? AND status NOT IN ('Won','Lost')`).run(addDays(td, 1), q.enquiry_id, td);
    } else {
      const ref = nextNumber(ctx.db, 'enquiry', 'E');
      const eid = ctx.db.prepare(`INSERT INTO enquiries (ref, name, phone, source, destination, pax, travel_date, status, next_follow_up, created_by)
        VALUES (?, ?, ?, 'Walk-in', ?, ?, ?, 'Quoted', ?, ?)`).run(ref, q.customer_name, q.phone, q.package_name, q.pax, q.start_date, addDays(td, 1), ctx.user.id).lastInsertRowid;
      ctx.db.prepare('UPDATE quotes SET enquiry_id = ? WHERE id = ?').run(eid, id);
    }
    return ctx.db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
  })();
  audit(ctx, 'create', 'quote', row.id, `${row.number} ${row.customer_name} ${Pricing.money(row.total)}`);
  return quoteView(row);
});

route('GET', '/api/quotes', (ctx) => {
  const eid = Number(ctx.query.get('enquiry_id')) || null;
  const rows = ctx.db.prepare(`SELECT id, number, enquiry_id, customer_name, phone, pax, start_date, package_name, total, status, valid_until, created_at
    FROM quotes ${eid ? 'WHERE enquiry_id = ?' : ''} ORDER BY id DESC LIMIT 300`).all(...(eid ? [eid] : []));
  return rows;
});

route('GET', '/api/quotes/:id', (ctx) => {
  const q = quoteView(must(ctx.db.prepare('SELECT * FROM quotes WHERE id = ?').get(idParam(ctx)), 'Quote'));
  const trip = ctx.db.prepare('SELECT id, number FROM trips WHERE quote_id = ?').get(q.id);
  return { ...q, trip, advance: Pricing.advance(q.total, agency(ctx.db).advance_pct) };
});

route('POST', '/api/quotes/:id/cancel', (ctx) => {
  const id = idParam(ctx);
  const q = must(ctx.db.prepare('SELECT * FROM quotes WHERE id = ?').get(id), 'Quote');
  if (q.status !== 'Sent') throw new HttpError(409, `This quote is already ${q.status.toLowerCase()}.`);
  ctx.db.prepare("UPDATE quotes SET status = 'Cancelled' WHERE id = ?").run(id);
  audit(ctx, 'cancel', 'quote', id, q.number);
  return { ok: true };
});

route('POST', '/api/quotes/:id/confirm', (ctx) => {
  const id = idParam(ctx);
  const b = clean(ctx.body || {}, {
    advance: { type: 'int', min: 0, max: 100000000, label: 'advance amount' },
    paid_on: { type: 'date', nullable: true, label: 'payment date' },
    method: { type: 'enum', values: METHODS, default: 'UPI' },
    reference: { type: 'str', max: 120 },
  });
  const trip = ctx.db.transaction(() => {
    const q = quoteView(must(ctx.db.prepare('SELECT * FROM quotes WHERE id = ?').get(id), 'Quote'));
    if (q.status !== 'Sent') throw new HttpError(409, `This quote is already ${q.status.toLowerCase()}.`);
    if (b.advance > q.total) throw new HttpError(400, 'The advance is more than the quote total.');
    const end = addDays(q.start_date, q.days.length - 1);
    if (q.vehicle_id) {
      const v = ctx.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(q.vehicle_id);
      const c = vehicleClash(ctx.db, q.vehicle_id, q.start_date, end);
      if (c) throw clashError(v, c);
    }
    const number = nextNumber(ctx.db, 'trip', 'T');
    const tid = ctx.db.prepare(`INSERT INTO trips (number, quote_id, enquiry_id, customer_name, phone, pax, rooms, start_date, end_date, category,
      package_name, vehicle_id, vehicle_label, days_json, total, cost, gst_amount, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(number, q.id, q.enquiry_id, q.customer_name, q.phone, q.pax, q.rooms,
      q.start_date, end, q.category, q.package_name, q.vehicle_id, q.vehicle_label, JSON.stringify(q.days), q.total, q.totals.cost, q.totals.gst, ctx.user.id).lastInsertRowid;
    if (b.advance > 0) {
      ctx.db.prepare(`INSERT INTO payments (trip_id, direction, amount, paid_on, method, reference, party, created_by)
        VALUES (?, 'in', ?, ?, ?, ?, ?, ?)`).run(tid, b.advance, b.paid_on || today(), b.method, b.reference, q.customer_name, ctx.user.id);
    }
    ctx.db.prepare("UPDATE quotes SET status = 'Accepted' WHERE id = ?").run(q.id);
    if (q.enquiry_id) ctx.db.prepare("UPDATE enquiries SET status = 'Won', next_follow_up = NULL, updated_at = datetime('now') WHERE id = ?").run(q.enquiry_id);
    return ctx.db.prepare('SELECT * FROM trips WHERE id = ?').get(tid);
  })();
  audit(ctx, 'confirm', 'trip', trip.id, `${trip.number} from quote ${id}, advance ${b.advance}`);
  return tripView(ctx.db, trip);
});

/* ---- public quote link (no login) ---- */

route('GET', '/api/public/quotes/:token', (ctx) => {
  const token = String(ctx.params.token);
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) throw new HttpError(404, 'Quote not found.');
  const q = ctx.db.prepare('SELECT * FROM quotes WHERE public_token = ?').get(token);
  if (!q || q.status === 'Cancelled') throw new HttpError(404, 'This quote is no longer available.');
  const v = quoteView(q);
  const a = agency(ctx.db);
  return {
    number: v.number, customer_name: v.customer_name, pax: v.pax, rooms: v.rooms, start_date: v.start_date,
    category: v.category, package_name: v.package_name, vehicle_label: v.vehicle_label, valid_until: v.valid_until,
    created_at: v.created_at, status: v.status, gst_pct: v.gst_pct, extras_pp: v.extras_pp,
    days: v.days.map((d) => ({ plan: d.plan, city: d.city, hotel: d.hotel })),
    extra_lines: v.extra_lines.map((l) => ({ label: l.label })),
    total: v.total, per_person: v.totals.per_person, nights: v.totals.nights, advance: Pricing.advance(v.total, a.advance_pct),
    agency: { name: a.name, city: a.city, address: a.address, phone: a.phone, email: a.email, gstin: a.gstin,
      included: a.included, excluded: a.excluded, terms: a.terms, balance_due_days: a.balance_due_days },
  };
}, 'public');

/* ---- trips ---- */

route('GET', '/api/trips', (ctx) => {
  const f = ctx.query.get('filter') || 'Upcoming';
  const td = today();
  const all = ctx.db.prepare('SELECT * FROM trips ORDER BY start_date').all().map((t) => tripView(ctx.db, t, td));
  const counts = {};
  all.forEach((t) => { counts[t.state] = (counts[t.state] || 0) + 1; });
  counts.All = all.length;
  let rows = f === 'All' ? all : all.filter((t) => t.state === f);
  if (f === 'Completed' || f === 'Cancelled' || f === 'All') rows = rows.slice().reverse();
  return { rows: rows.slice(0, 500), counts };
});

route('GET', '/api/trips/:id', (ctx) => {
  const t = must(ctx.db.prepare('SELECT * FROM trips WHERE id = ?').get(idParam(ctx)), 'Trip');
  const payments = ctx.db.prepare(`SELECT p.*, u.name AS by_name FROM payments p LEFT JOIN users u ON u.id = p.created_by
    WHERE trip_id = ? ORDER BY paid_on, p.id`).all(t.id);
  const quote = ctx.db.prepare('SELECT id, number, public_token FROM quotes WHERE id = ?').get(t.quote_id);
  const v = tripView(ctx.db, t);
  if (ctx.user.role !== 'owner') delete v.profit;
  return { ...v, payments, quote };
});

route('PUT', '/api/trips/:id', (ctx) => {
  const id = idParam(ctx);
  const b = clean(ctx.body, { hotels_confirmed: { type: 'bool' }, notes: { type: 'str', max: 3000 },
    vehicle_id: { type: 'int', min: 1, nullable: true }, vehicle_label: { type: 'str', max: 80 } }, true);
  ctx.db.transaction(() => {
    const t = must(ctx.db.prepare('SELECT * FROM trips WHERE id = ?').get(id), 'Trip');
    if (t.status === 'Cancelled') throw new HttpError(409, 'This trip is cancelled.');
    if ('hotels_confirmed' in b) ctx.db.prepare('UPDATE trips SET hotels_confirmed = ? WHERE id = ?').run(b.hotels_confirmed ? 1 : 0, id);
    if ('notes' in b) ctx.db.prepare('UPDATE trips SET notes = ? WHERE id = ?').run(b.notes, id);
    if ('vehicle_id' in b) {
      if (b.vehicle_id) {
        const v = must(ctx.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(b.vehicle_id), 'Vehicle');
        const c = vehicleClash(ctx.db, v.id, t.start_date, t.end_date, id);
        if (c) throw clashError(v, c);
        ctx.db.prepare('UPDATE trips SET vehicle_id = ?, vehicle_label = ? WHERE id = ?').run(v.id, `${v.type} (${v.reg})`, id);
      } else {
        ctx.db.prepare('UPDATE trips SET vehicle_id = NULL, vehicle_label = ? WHERE id = ?').run(b.vehicle_label || 'Hired vehicle', id);
      }
    }
  })();
  audit(ctx, 'update', 'trip', id, Object.keys(b).join(','));
  return tripView(ctx.db, ctx.db.prepare('SELECT * FROM trips WHERE id = ?').get(id));
});

route('POST', '/api/trips/:id/cancel', (ctx) => {
  requireOwner(ctx);
  const id = idParam(ctx);
  const b = clean(ctx.body || {}, { reason: { type: 'str', max: 500 } });
  const t = must(ctx.db.prepare('SELECT * FROM trips WHERE id = ?').get(id), 'Trip');
  if (t.status === 'Cancelled') throw new HttpError(409, 'This trip is already cancelled.');
  const note = `Cancelled ${today()}${b.reason ? ': ' + b.reason : ''}`;
  ctx.db.prepare("UPDATE trips SET status = 'Cancelled', notes = CASE WHEN notes = '' THEN ? ELSE notes || char(10) || ? END WHERE id = ?").run(note, note, id);
  audit(ctx, 'cancel', 'trip', id, t.number + (b.reason ? ' ' + b.reason : ''));
  return tripView(ctx.db, ctx.db.prepare('SELECT * FROM trips WHERE id = ?').get(id));
});

route('POST', '/api/trips/:id/payments', (ctx) => {
  const id = idParam(ctx);
  const b = clean(ctx.body, PAYMENT_SPEC);
  const t = must(ctx.db.prepare('SELECT * FROM trips WHERE id = ?').get(id), 'Trip');
  const pid = ctx.db.prepare(`INSERT INTO payments (trip_id, direction, amount, paid_on, method, party, reference, created_by)
    VALUES (@trip_id, @direction, @amount, @paid_on, @method, @party, @reference, @uid)`).run({ ...b, trip_id: id, uid: ctx.user.id, party: b.party || (b.direction === 'in' ? t.customer_name : '') }).lastInsertRowid;
  audit(ctx, 'create', 'payment', Number(pid), `${t.number} ${b.direction} ${b.amount}`);
  return tripView(ctx.db, t);
});

route('DELETE', '/api/payments/:id', (ctx) => {
  requireOwner(ctx);
  const id = idParam(ctx);
  const p = must(ctx.db.prepare('SELECT * FROM payments WHERE id = ?').get(id), 'Payment');
  ctx.db.prepare('DELETE FROM payments WHERE id = ?').run(id);
  audit(ctx, 'delete', 'payment', id, `trip ${p.trip_id} ${p.direction} ${p.amount} ${p.paid_on} ${p.method} ${p.reference}`);
  return { ok: true };
});

/* ---- dashboard, fleet, money ---- */

route('GET', '/api/dashboard', (ctx) => {
  const db = ctx.db, td = today(), a = agency(db);
  const trips = db.prepare("SELECT * FROM trips WHERE status = 'Confirmed' AND end_date >= ? ORDER BY start_date").all(addDays(td, -60)).map((t) => tripView(db, t, td));
  const onRoad = trips.filter((t) => t.state === 'On trip');
  const next7 = trips.filter((t) => t.state === 'Upcoming' && daysBetween(td, t.start_date) <= 7);
  const followUps = db.prepare(`SELECT * FROM enquiries WHERE status IN ('New','Quoted','Follow-up') AND next_follow_up IS NOT NULL AND next_follow_up <= ?
    ORDER BY next_follow_up LIMIT 50`).all(td);
  const newCount = db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'New'").get().n;
  const month = td.slice(0, 7);
  const booked = db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM trips WHERE status = 'Confirmed' AND substr(created_at,1,7) = ?").get(month).s;
  const toCollect = trips.filter((t) => t.state !== 'Completed').reduce((s, t) => s + Math.max(0, t.balance), 0);
  const alerts = [];
  trips.forEach((t) => {
    if (t.state === 'Completed') return;
    const n = daysBetween(td, t.start_date);
    if (!t.hotels_confirmed && n >= 0 && n <= 5) alerts.push({ level: 'red', trip_id: t.id, text: `Hotels not confirmed for ${t.customer_name} (${t.number}), leaving ${rel(n)}.` });
    if (t.balance > 0 && n >= 0 && n <= a.balance_due_days) alerts.push({ level: 'amber', trip_id: t.id, text: `${Pricing.money(t.balance)} balance still due from ${t.customer_name} before departure ${rel(n)}.` });
    if (t.received === 0 && n > a.balance_due_days) alerts.push({ level: 'amber', trip_id: t.id, text: `No advance yet from ${t.customer_name} (${t.number}). Trip ${rel(n)}.` });
  });
  return {
    today: td,
    kpis: { new_enquiries: newCount, follow_ups: followUps.length, on_road: onRoad.length, departures_7d: next7.length, booked_month: booked, to_collect: toCollect },
    follow_ups: followUps, alerts, on_road: onRoad, upcoming: next7,
  };
});

function rel(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`; }

route('GET', '/api/fleet', (ctx) => {
  const from = isDate(ctx.query.get('from')) ? ctx.query.get('from') : today();
  const n = Math.min(42, Math.max(7, Number(ctx.query.get('days')) || 14));
  const to = addDays(from, n - 1);
  const vehicles = ctx.db.prepare('SELECT * FROM vehicles WHERE active = 1 ORDER BY seats, rate').all();
  const trips = ctx.db.prepare(`SELECT id, number, customer_name, vehicle_id, start_date, end_date FROM trips
    WHERE status = 'Confirmed' AND vehicle_id IS NOT NULL AND NOT (end_date < ? OR start_date > ?)`).all(from, to);
  return { from, days: n, vehicles, trips };
});

route('GET', '/api/money', (ctx) => {
  const db = ctx.db, td = today();
  const trips = db.prepare("SELECT * FROM trips WHERE status = 'Confirmed' ORDER BY start_date").all().map((t) => tripView(db, t, td));
  const month = td.slice(0, 7);
  const received = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE direction = 'in' AND substr(paid_on,1,7) = ?").get(month).s;
  const out = {
    kpis: {
      received_month: received,
      to_collect: trips.reduce((s, t) => s + Math.max(0, t.balance), 0),
      supplier_due: trips.filter((t) => t.state !== 'Upcoming' || daysBetween(td, t.start_date) <= 7).reduce((s, t) => s + Math.max(0, t.supplier_due), 0),
    },
    to_collect: trips.filter((t) => t.balance > 0).map(slim),
    supplier_due: trips.filter((t) => t.supplier_due > 0 && (t.state !== 'Upcoming' || daysBetween(td, t.start_date) <= 7)).map(slim),
    recent: db.prepare(`SELECT p.*, t.number, t.customer_name FROM payments p JOIN trips t ON t.id = p.trip_id ORDER BY p.paid_on DESC, p.id DESC LIMIT 30`).all(),
  };
  if (ctx.user.role === 'owner') {
    out.kpis.profit_month = trips.filter((t) => t.start_date.slice(0, 7) === month).reduce((s, t) => s + t.profit, 0);
    out.profit = trips.slice().reverse().slice(0, 100).map((t) => ({ ...slim(t), gst_amount: t.gst_amount, cost: t.cost, profit: t.profit }));
  }
  return out;
  function slim(t) {
    return { id: t.id, number: t.number, customer_name: t.customer_name, start_date: t.start_date, state: t.state, total: t.total,
      received: t.received, balance: t.balance, cost: t.cost, paid_out: t.paid_out, supplier_due: t.supplier_due, vehicle_label: t.vehicle_label };
  }
});

/* ---- owner tools ---- */

route('GET', '/api/audit', (ctx) => {
  requireOwner(ctx);
  return ctx.db.prepare('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300').all();
});

route('GET', '/api/export', (ctx) => {
  requireOwner(ctx);
  const tables = ['agency', 'hotels', 'vehicles', 'packages', 'enquiries', 'quotes', 'trips', 'payments', 'audit_log'];
  const data = { exported_at: new Date().toISOString(), app: 'tourdesk', schema_version: ctx.db.pragma('user_version', { simple: true }) };
  tables.forEach((t) => { data[t] = ctx.db.prepare(`SELECT * FROM ${t}`).all(); });
  data.users = ctx.db.prepare('SELECT id, name, email, role, active, created_at FROM users').all();
  audit(ctx, 'export', 'data', null);
  ctx.download = { name: `tourdesk-export-${today()}.json`, type: 'application/json', body: JSON.stringify(data, null, 1) };
  return null;
});

route('GET', '/api/backup', async (ctx) => {
  requireOwner(ctx);
  const file = await ctx.backup.now('download');
  audit(ctx, 'backup', 'data', null, 'downloaded');
  ctx.download = { name: `tourdesk-backup-${today()}.db`, type: 'application/vnd.sqlite3', file };
  return null;
});

module.exports = { routes, tripState, vehicleClash };
