# Tour Desk

Runs a tour and travel agency from one screen: enquiries and follow-ups, 2-minute quotations, a customer quotation link, trips, a vehicle and driver calendar that blocks double bookings, a payments ledger and profit per trip.

Built by OPIIUS. One install per agency: each agency gets its own server and database, so no agency can see another's data.

## What's inside

| | |
|---|---|
| Server | Node.js 20+ (`server.js`), one dependency: `better-sqlite3` |
| Database | One SQLite file, `data/tourdesk.db` (WAL mode, foreign keys on) |
| Front end | Plain HTML/CSS/JS in `public/`, no build step. Works on phones. |
| Backups | Automatic daily copy in `data/backups/`, newest 14 kept. Owners can download a backup or a JSON export any time. |
| Tests | `npm test` (pricing, auth, permissions, CSRF, double-booking, full enquiry → quote → trip → payment flow) |

### Security

- Passwords hashed with scrypt. Sessions are random tokens, stored hashed, in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` over HTTPS), valid for 30 days.
- Login is rate-limited: 5 failures per email and IP, 30 per IP, per 15 minutes.
- Every write needs a custom header and a same-origin `Origin` (CSRF protection).
- Strict Content-Security-Policy (no inline scripts), `X-Frame-Options: DENY`, `nosniff`, HSTS through Caddy.
- The server computes every price from its own hotel and vehicle rates. A quote stores a snapshot of those rates, so later rate changes never alter a sent quote.
- The vehicle clash check runs inside the same database transaction that confirms the trip.
- Roles: **owner** (everything) and **staff** (enquiries, quotes, trips, payments). Only owners change settings and users, cancel trips, delete payments, see profit, and download backups.
- The first account needs a one-time setup code, printed in the server log on first start (or set with `SETUP_CODE`).
- An activity log records logins, quotes, confirmations, payments, deletions and settings changes.

## Run it locally

```bash
npm install
npm start            # http://localhost:3000
npm test
```

The first start prints a **setup code**. Open the app, enter the code, and create the owner account.

## Set up a new agency (production)

You need a small Linux server (1 vCPU, 1 GB RAM is plenty, about ₹400–600/month on DigitalOcean, Hetzner, Lightsail or a local provider) and a domain or subdomain, e.g. `desk.agencyname.in`.

1. **Point the domain at the server.** Add a DNS `A` record for `desk.agencyname.in` with the server's IP address.
2. **Install Docker** on the server (`curl -fsSL https://get.docker.com | sh`).
3. **Copy this folder** to the server, for example to `/opt/tourdesk`.
4. **Configure it:**
   ```bash
   cd /opt/tourdesk
   cp .env.example .env
   nano .env            # set DOMAIN=desk.agencyname.in
   ```
5. **Start it:**
   ```bash
   docker compose up -d --build
   docker compose logs tourdesk | grep "SETUP CODE"
   ```
   Caddy gets the HTTPS certificate automatically within a minute.
6. **Create the owner account.** Open `https://desk.agencyname.in`, enter the setup code, the agency name, and the owner's name, email and password.
7. **Load the agency's data** in Settings:
   - Agency details and GSTIN (shown on every quotation), default markup, GST and advance %
   - Hotels with room rates per category
   - Vehicles and drivers
   - Packages (day-by-day plan and the city for each night)
   - Staff users
8. **Train the team:** add an enquiry, build a quote, send it on WhatsApp, confirm the trip, record a payment.

Without Docker: install Node 20+, run `npm ci --omit=dev`, and start `node server.js` under systemd or pm2 behind any HTTPS reverse proxy. Set `TRUST_PROXY=1` when behind a proxy.

### Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `HOST` | `0.0.0.0` | Address to listen on |
| `DATA_DIR` | `./data` | Where the database and backups live. Keep it on a persistent disk. |
| `TRUST_PROXY` | off | Set to `1` behind Caddy/Nginx so client IPs and HTTPS are detected |
| `COOKIE_SECURE` | auto | `1` to force `Secure` cookies, `0` to disable (only for plain-HTTP testing) |
| `SETUP_CODE` | random | One-time code needed to create the first owner |
| `TZ_AGENCY` | `Asia/Kolkata` | Time zone for "today", follow-ups and trip status |
| `BACKUP_KEEP` | `14` | Number of daily backups kept |

## Everyday operations

**Health check:** `GET /healthz` returns `{"ok":true}`. The Docker image has a built-in health check.

**Logs:** one line per request on stdout. `docker compose logs -f tourdesk`.

**Owner forgot their password:**
```bash
docker compose exec tourdesk node scripts/reset-password.js owner@agency.in 'new-password-here'
```
The same command with a new email creates an extra owner.

**Backups:** a copy is written to `data/backups/tourdesk-YYYY-MM-DD.db` every day. Also copy `data/backups` off the server regularly, e.g. with a nightly `rclone` to Google Drive or `rsync` to another machine. Owners can download a backup from Settings → Backup & log.

**Restore a backup:**
```bash
docker compose stop tourdesk
cp data/backups/tourdesk-2026-09-27.db data/tourdesk.db
rm -f data/tourdesk.db-wal data/tourdesk.db-shm
docker compose start tourdesk
```

**Update to a new version:**
```bash
git pull            # or copy the new files over
docker compose up -d --build
```
Database changes are applied automatically on start (`src/db.js` migrations). Take a backup first.

## How the money works

All amounts are whole rupees.

```
hotels   = Σ (that night's hotel rate × rooms)
vehicle  = rate per day × number of days
extras   = entry fees per person × travellers + extra items
cost     = hotels + vehicle + extras
markup   = cost × markup %
GST      = (cost + markup) × GST %
total    = cost + markup + GST
advance  = total × advance %, rounded up to the next ₹100
```

The margin shown to the owner is `total − GST − cost`. Payments are a ledger: money **received** from the customer and money **paid out** to hotels, drivers and suppliers. Balance and supplier dues are worked out from the ledger, never typed in.

## API

JSON over HTTPS, cookie session. Writes need the header `X-Requested-With: tourdesk`.

| | |
|---|---|
| `GET /api/session`, `POST /api/setup`, `POST /api/login`, `POST /api/logout` | Sign in |
| `GET /api/bootstrap` | Agency, hotels, vehicles, packages, options |
| `GET/POST/PUT /api/enquiries[/:id]`, `POST /api/enquiries/:id/followed-up` | Enquiries |
| `POST /api/quotes/preview`, `POST /api/quotes`, `GET /api/quotes[/:id]`, `POST /api/quotes/:id/confirm`, `POST /api/quotes/:id/cancel` | Quotes |
| `GET /api/public/quotes/:token` | Customer view of a quote (no login, no costs) |
| `GET /api/trips[/:id]`, `PUT /api/trips/:id`, `POST /api/trips/:id/cancel`, `POST /api/trips/:id/payments`, `DELETE /api/payments/:id` | Trips and payments |
| `GET /api/dashboard`, `GET /api/fleet`, `GET /api/money` | Overviews |
| `PUT /api/agency`, `POST/PUT /api/hotels`, `/api/vehicles`, `/api/packages`, `/api/users` | Settings (owner) |
| `GET /api/export`, `GET /api/backup`, `GET /api/audit` | Data (owner) |
