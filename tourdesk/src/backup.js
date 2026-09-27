'use strict';
// Daily SQLite backups into DATA_DIR/backups, keeping the newest `keep` daily files.
const fs = require('fs');
const path = require('path');
const { today } = require('./util');

class Backups {
  constructor(db, dir, keep = 14, log = console) {
    this.db = db; this.dir = dir; this.keep = keep; this.log = log;
    fs.mkdirSync(dir, { recursive: true });
  }

  // tag 'daily' writes tourdesk-YYYY-MM-DD.db; 'download' writes a temporary file the caller removes.
  async now(tag = 'daily') {
    const name = tag === 'daily' ? `tourdesk-${today()}.db` : `download-${Date.now()}.db`;
    const file = path.join(this.dir, name);
    await this.db.backup(file);
    return file;
  }

  async daily() {
    const file = path.join(this.dir, `tourdesk-${today()}.db`);
    if (fs.existsSync(file)) return null;
    await this.now('daily');
    this.prune();
    this.log.log(`[backup] wrote ${file}`);
    return file;
  }

  prune() {
    const files = fs.readdirSync(this.dir).filter((f) => /^tourdesk-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    files.slice(0, Math.max(0, files.length - this.keep)).forEach((f) => fs.unlinkSync(path.join(this.dir, f)));
    // Remove download copies older than an hour (normally deleted right after sending).
    fs.readdirSync(this.dir).filter((f) => f.startsWith('download-')).forEach((f) => {
      const p = path.join(this.dir, f);
      if (Date.now() - fs.statSync(p).mtimeMs > 3600e3) fs.unlinkSync(p);
    });
  }

  start() {
    const run = () => this.daily().catch((e) => this.log.error('[backup] failed:', e.message));
    run();
    this.timer = setInterval(run, 3600e3);
    this.timer.unref();
  }

  stop() { clearInterval(this.timer); }
}

module.exports = { Backups };
