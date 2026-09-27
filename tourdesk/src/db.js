'use strict';
// Opens the SQLite database and applies schema migrations in order.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const MIGRATIONS = [
  // 1: initial schema. Money is stored as whole rupees (INTEGER). Dates are 'YYYY-MM-DD' strings.
  `
  CREATE TABLE agency (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT 'My Tour Agency',
    city TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    gstin TEXT NOT NULL DEFAULT '',
    advance_pct INTEGER NOT NULL DEFAULT 30,
    markup_pct INTEGER NOT NULL DEFAULT 15,
    gst_pct INTEGER NOT NULL DEFAULT 5,
    quote_valid_days INTEGER NOT NULL DEFAULT 7,
    balance_due_days INTEGER NOT NULL DEFAULT 3,
    included TEXT NOT NULL DEFAULT '',
    excluded TEXT NOT NULL DEFAULT '',
    terms TEXT NOT NULL DEFAULT ''
  );
  INSERT INTO agency (id, included, excluded, terms) VALUES (1,
    'Hotel stay with breakfast as per the itinerary
Vehicle for all days with driver, fuel, tolls and parking
Airport or railway station pickup and drop',
    'Lunch and dinner
Entry tickets and activities unless listed
Personal expenses, camera fees and tips
Anything not listed as included',
    'Prices depend on hotel availability at the time of booking.
Free date change up to 7 days before travel.');

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner','staff')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE sequences (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
  INSERT INTO sequences VALUES ('enquiry', 1000), ('quote', 1000), ('trip', 1000);

  CREATE TABLE hotels (
    id INTEGER PRIMARY KEY,
    city TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Standard','Deluxe','Premium')),
    name TEXT NOT NULL,
    rate INTEGER NOT NULL CHECK (rate >= 0),
    phone TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX hotels_city ON hotels(city, category);

  CREATE TABLE vehicles (
    id INTEGER PRIMARY KEY,
    reg TEXT NOT NULL,
    type TEXT NOT NULL,
    seats INTEGER NOT NULL CHECK (seats > 0),
    rate INTEGER NOT NULL CHECK (rate >= 0),
    driver_name TEXT NOT NULL DEFAULT '',
    driver_phone TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE packages (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    extras_pp INTEGER NOT NULL DEFAULT 0,
    days_json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE enquiries (
    id INTEGER PRIMARY KEY,
    ref TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'WhatsApp',
    destination TEXT NOT NULL DEFAULT '',
    pax INTEGER NOT NULL DEFAULT 2,
    travel_date TEXT,
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Quoted','Follow-up','Won','Lost')),
    next_follow_up TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX enquiries_status ON enquiries(status, next_follow_up);

  CREATE TABLE quotes (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    public_token TEXT NOT NULL UNIQUE,
    enquiry_id INTEGER REFERENCES enquiries(id),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    pax INTEGER NOT NULL,
    rooms INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    category TEXT NOT NULL,
    package_name TEXT NOT NULL DEFAULT '',
    vehicle_id INTEGER REFERENCES vehicles(id),
    vehicle_label TEXT NOT NULL DEFAULT '',
    vehicle_rate INTEGER NOT NULL DEFAULT 0,
    extras_pp INTEGER NOT NULL DEFAULT 0,
    markup_pct INTEGER NOT NULL,
    gst_pct INTEGER NOT NULL,
    days_json TEXT NOT NULL,
    extra_lines_json TEXT NOT NULL DEFAULT '[]',
    totals_json TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Sent' CHECK (status IN ('Sent','Accepted','Cancelled')),
    valid_until TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE trips (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    quote_id INTEGER NOT NULL REFERENCES quotes(id),
    enquiry_id INTEGER REFERENCES enquiries(id),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    pax INTEGER NOT NULL,
    rooms INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    category TEXT NOT NULL,
    package_name TEXT NOT NULL DEFAULT '',
    vehicle_id INTEGER REFERENCES vehicles(id),
    vehicle_label TEXT NOT NULL DEFAULT '',
    days_json TEXT NOT NULL,
    total INTEGER NOT NULL,
    cost INTEGER NOT NULL,
    gst_amount INTEGER NOT NULL,
    hotels_confirmed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed','Cancelled')),
    notes TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX trips_vehicle ON trips(vehicle_id, start_date, end_date);
  CREATE INDEX trips_dates ON trips(start_date);

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id),
    direction TEXT NOT NULL CHECK (direction IN ('in','out')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    paid_on TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'UPI',
    party TEXT NOT NULL DEFAULT '',
    reference TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX payments_trip ON payments(trip_id);

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    detail TEXT NOT NULL DEFAULT '',
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
];

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(db) {
  const version = db.pragma('user_version', { simple: true });
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

module.exports = { open };
