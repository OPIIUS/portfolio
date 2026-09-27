'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { open } = require('./src/db');
const auth = require('./src/auth');
const { routes } = require('./src/api');
const { Backups } = require('./src/backup');
const { HttpError } = require('./src/util');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 1024 * 1024;
const COOKIE = 'td_sid';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, 'data')),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    cookieSecure: env.COOKIE_SECURE, // '1' forces Secure cookies, '0' disables, unset = automatic
    setupCode: env.SETUP_CODE || '',
    backupKeep: Number(env.BACKUP_KEEP) || 14,
    quiet: env.QUIET === '1',
  };
}

function createApp(config) {
  const db = open(path.join(config.dataDir, 'tourdesk.db'));
  const backup = new Backups(db, path.join(config.dataDir, 'backups'), config.backupKeep);
  const limiter = new auth.RateLimiter(5, 15 * 60e3);     // per IP + email
  const ipLimiter = new auth.RateLimiter(30, 15 * 60e3);  // per IP
  const log = config.quiet ? () => {} : (...a) => console.log(...a);

  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    if (!config.setupCode) config.setupCode = crypto.randomBytes(5).toString('hex');
    console.log('\n  Tour Desk has no accounts yet. Open the app and use this setup code to create the owner account:');
    console.log(`  SETUP CODE: ${config.setupCode}\n`);
  }

  function clientIp(req) {
    if (config.trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
    return req.socket.remoteAddress || '';
  }
  function isHttps(req) {
    if (config.cookieSecure === '1') return true;
    if (config.cookieSecure === '0') return false;
    return !!req.socket.encrypted || (config.trustProxy && req.headers['x-forwarded-proto'] === 'https');
  }
  function cookies(req) {
    const out = {};
    String(req.headers.cookie || '').split(';').forEach((p) => {
      const i = p.indexOf('=');
      if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
  }
  function setCookie(res, req, value, maxAge) {
    const parts = [`${COOKIE}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
    if (isHttps(req)) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function send(res, status, body, headers = {}) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
  }
  function json(res, status, data) {
    send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(new HttpError(413, 'Request is too large.')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new HttpError(400, 'Invalid JSON.')); }
      });
      req.on('error', reject);
    });
  }

  async function handleApi(req, res, url) {
    const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
    if (!route) {
      const any = routes.some((r) => r.re.test(url.pathname));
      throw new HttpError(any ? 405 : 404, any ? 'Method not allowed.' : 'Not found.');
    }
    const m = url.pathname.match(route.re);
    const params = {};
    route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });

    // CSRF: state-changing requests must come from our own page (custom header + same origin).
    if (req.method !== 'GET') {
      if (req.headers['x-requested-with'] !== 'tourdesk') throw new HttpError(403, 'Blocked request.');
      const origin = req.headers.origin;
      if (origin) {
        const host = req.headers['x-forwarded-host'] && config.trustProxy ? req.headers['x-forwarded-host'] : req.headers.host;
        try { if (new URL(origin).host !== host) throw new Error(); } catch { throw new HttpError(403, 'Blocked cross-site request.'); }
      }
      if (!/^application\/json/.test(req.headers['content-type'] || '') && req.headers['content-length'] && req.headers['content-length'] !== '0') {
        throw new HttpError(415, 'Send JSON.');
      }
    }

    const token = cookies(req)[COOKIE];
    const user = auth.getSessionUser(db, token);
    if (route.access === 'user' && !user) throw new HttpError(401, 'Please sign in.');
    const body = req.method === 'GET' ? {} : await readBody(req);

    const ctx = {
      db, user, body, params, query: url.searchParams, req, res, config, backup, limiter, ipLimiter, ip: clientIp(req),
      startSession(userId) {
        auth.destroySession(db, token);
        const s = auth.createSession(db, userId);
        setCookie(res, req, s.token, auth.SESSION_DAYS * 86400);
      },
      endSession() { auth.destroySession(db, token); setCookie(res, req, '', 0); },
    };
    const data = await route.handler(ctx);
    if (ctx.download) {
      const d = ctx.download;
      const headers = { 'Content-Type': d.type, 'Content-Disposition': `attachment; filename="${d.name}"`, 'Cache-Control': 'no-store' };
      if (d.file) {
        res.writeHead(200, { ...SECURITY_HEADERS, ...headers, 'Content-Length': fs.statSync(d.file).size });
        const stream = fs.createReadStream(d.file);
        stream.pipe(res);
        const cleanup = () => fs.unlink(d.file, () => {});
        stream.on('close', cleanup);
        stream.on('error', cleanup);
      } else {
        send(res, 200, d.body, headers);
      }
      return;
    }
    json(res, 200, data);
  }

  function serveStatic(req, res, url) {
    let p = url.pathname;
    if (p === '/' || p === '/app' || p.startsWith('/app/')) p = '/index.html';
    else if (/^\/q\/[A-Za-z0-9_-]+$/.test(p)) p = '/quote.html';
    const file = path.normalize(path.join(PUBLIC_DIR, p));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
      const ext = path.extname(file);
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    res.on('finish', () => log(`${new Date().toISOString()} ${req.method} ${req.url.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`));
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, 'Bad request'); }
    try {
      if (url.pathname === '/healthz') {
        db.prepare('SELECT 1').get();
        return json(res, 200, { ok: true });
      }
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, url);
    } catch (e) {
      if (e instanceof HttpError) return json(res, e.status, { error: e.message });
      if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') return json(res, 409, { error: 'That already exists.' });
      console.error(`${new Date().toISOString()} ERROR ${req.method} ${url.pathname}`, e);
      if (!res.headersSent) json(res, 500, { error: 'Something went wrong on the server. Please try again.' });
      else res.destroy();
    }
  });
  server.keepAliveTimeout = 65e3;
  server.headersTimeout = 70e3;
  server.requestTimeout = 60e3;

  const purge = setInterval(() => auth.purgeExpiredSessions(db), 6 * 3600e3);
  const prune = setInterval(() => { limiter.prune(); ipLimiter.prune(); }, 10 * 60e3);
  prune.unref();
  purge.unref();

  function close() {
    return new Promise((resolve) => {
      clearInterval(purge); clearInterval(prune); backup.stop();
      server.close(() => { db.close(); resolve(); });
      server.closeIdleConnections && server.closeIdleConnections();
    });
  }

  return { server, db, backup, config, close };
}

if (require.main === module) {
  const config = loadConfig();
  const app = createApp(config);
  app.backup.start();
  app.server.listen(config.port, config.host, () => {
    console.log(`Tour Desk running on http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port} (data: ${config.dataDir})`);
  });
  let closing = false;
  const stop = (sig) => {
    if (closing) return; closing = true;
    console.log(`${sig} received, shutting down`);
    app.close().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 10e3).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

module.exports = { createApp, loadConfig };
