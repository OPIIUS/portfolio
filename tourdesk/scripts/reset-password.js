'use strict';
// Sets a user's password from the server command line, or creates an owner if the email is new.
// Use it when the owner forgets their password:
//   node scripts/reset-password.js owner@agency.in 'new-password'
//   docker compose exec tourdesk node scripts/reset-password.js owner@agency.in 'new-password'
const path = require('path');
const { open } = require('../src/db');
const auth = require('../src/auth');

const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/reset-password.js <email> <new-password> [name for a new owner]');
  process.exit(1);
}
if (password.length < 8) { console.error('Passwords must be at least 8 characters.'); process.exit(1); }

const db = open(path.join(path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')), 'tourdesk.db'));
const u = db.prepare('SELECT id, name, role FROM users WHERE email = ?').get(email.toLowerCase());
db.transaction(() => {
  if (u) {
    db.prepare('UPDATE users SET pass_hash = ?, active = 1 WHERE id = ?').run(auth.hashPassword(password), u.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    db.prepare("INSERT INTO audit_log (action, entity, entity_id, detail) VALUES ('password', 'user', ?, 'reset from command line')").run(u.id);
    console.log(`Password reset for ${u.name} (${u.role}). They have been signed out everywhere.`);
  } else {
    const id = db.prepare("INSERT INTO users (name, email, pass_hash, role) VALUES (?, ?, ?, 'owner')").run(name || 'Owner', email.toLowerCase(), auth.hashPassword(password)).lastInsertRowid;
    db.prepare("INSERT INTO audit_log (action, entity, entity_id, detail) VALUES ('create', 'user', ?, 'owner created from command line')").run(id);
    console.log(`Created owner account ${email}.`);
  }
})();
db.close();
