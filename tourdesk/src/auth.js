'use strict';
const crypto = require('crypto');

const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'base64');
  const expected = Buffer.from(parts[3], 'base64');
  const key = crypto.scryptSync(password, salt, expected.length, { N, r: SCRYPT.r, p: SCRYPT.p });
  return crypto.timingSafeEqual(key, expected);
}

// A fixed hash used when the email is unknown, so a failed login takes the same time either way.
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  return { token, expires };
}

function getSessionUser(db, token) {
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.name, u.email, u.role, s.expires_at, s.token_hash FROM sessions s
    JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND u.active = 1`).get(sha256(token));
  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function purgeExpiredSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}

// In-memory limiter: at most `max` failed attempts per key in `windowMs`.
class RateLimiter {
  constructor(max, windowMs) { this.max = max; this.windowMs = windowMs; this.hits = new Map(); }
  blocked(key) {
    const h = this.hits.get(key);
    if (!h) return false;
    if (Date.now() - h.first > this.windowMs) { this.hits.delete(key); return false; }
    return h.count >= this.max;
  }
  fail(key) {
    const h = this.hits.get(key);
    if (!h || Date.now() - h.first > this.windowMs) this.hits.set(key, { first: Date.now(), count: 1 });
    else h.count++;
  }
  reset(key) { this.hits.delete(key); }
  prune() { const now = Date.now(); for (const [k, h] of this.hits) if (now - h.first > this.windowMs) this.hits.delete(k); }
}

module.exports = {
  hashPassword, verifyPassword, DUMMY_HASH, createSession, getSessionUser, destroySession,
  purgeExpiredSessions, RateLimiter, SESSION_DAYS, sha256,
};
