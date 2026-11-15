# BS Car Rentals · Fleet Manager

A private web app for running the rental business: vehicles, bookings, payments, documents, servicing, expenses, customers, alerts and reports. It runs on ordinary Hostinger shared hosting (PHP and MySQL). There is no build step and nothing to install on the server.

## Modules

| Area | What it does |
|---|---|
| **Fleet** | Full vehicle profile (registration, make, model, category, year, fuel, gearbox, colour, seats, odometer, purchase details, rates, free km per day, service interval, GPS tracker ID and link, photos). Statuses: Available, Booked, Rented, Overdue return, Under maintenance, Unavailable. Search, filter and sort. Archive instead of delete. |
| **Live status** | Shows who has each vehicle, the handover time, the return time and the pickup/drop-off locations. Overdue rentals are listed first. **GPS:** stores the tracker ID and opens the tracker's own app or website. It does not invent a live location. |
| **Bookings** | Inquiry → Confirmed → Vehicle assigned → Active (handed over) → Overdue → Completed, or Cancelled with a reason. Double bookings are blocked, and a late return also blocks the next booking. Handover and return checklists record odometer, fuel, items checked, damage, photos and who did it. Extensions show a suggested charge that the owner can edit before saving. |
| **Payments** | Partial payments, rent / deposit / deposit return / refund, and paying rent from the deposit. Every payment gets a numbered, printable receipt. Mistakes are **voided by the owner with a reason and stay visible**; nothing is deleted. The outstanding page shows days overdue and a WhatsApp reminder button. Daily, weekly and monthly collection totals. **Deposits are never counted as income.** |
| **Documents** | Insurance, PUC, RC, Fitness, Permit and Road tax, plus any type you add. The owner ticks which categories need which document. Reminders at 30/15/7/1/0 days (configurable), shown as valid, expiring, expired or missing. Handover is blocked when a required document is expired or missing, unless the owner overrides it and writes a reason. Renewals keep the old document in the history. |
| **Maintenance** | Service every N km or N days, whichever comes first. Due and overdue alerts. Each job records cost, provider, description and the bill. A scheduled service restarts the countdown. The cost goes into expenses automatically. Breakdowns and accidents alert the owner. |
| **Expenses** | 14 categories, per vehicle or general. Bills can be uploaded. Daily, weekly and monthly totals, by category and by vehicle. Voided, never deleted. |
| **Customers** | Repeat customers, customers who owe money, overdue rentals, notes and complaints, and a flag for problem customers. Licence and ID numbers and ID scans are visible only to people given that permission, and every view of an ID scan is logged. |
| **Alerts** | One notification centre. Each problem alerts only once and closes itself when fixed. Alerts can also be resolved by hand. Optional email digest. |
| **Reports** | Rent collected vs rent billed vs deposits vs receivables, expenses, profit on a cash basis, a 6-month trend, vehicle performance (utilisation, net) and customers. Filter by date, vehicle and customer. Export to Excel (.xlsx), CSV or PDF (print). |
| **Security** | Password hashing (bcrypt). Owner and Staff roles with per-permission ticks for staff. CSRF tokens. Login lockout after 8 failures. Inactivity sign-out. Strict security headers (CSP). Uploads type-checked and stored privately. Full audit log. Daily backups with download and restore. |

## Honest limits

- **WhatsApp:** only "click to send" links. Automatic messages need a paid WhatsApp Business API account, which is not connected.
- **GPS:** not connected. It needs trackers fitted in the vehicles.
- **Email:** uses the server's mail. It is optional and can land in spam.
- **The law:** the app does not decide what the law requires. The owner sets which documents each category needs.

## Tests

- `php tests/run.php`: 90 automated checks of the business rules on SQLite, using a test clock. They cover overdue alerts, the 30/15/7/1/0 reminders, de-duplication, auto-resolve, deposits, refunds, cancellations, extensions, servicing, reports, permissions, security, and backup/restore.
- `FLEET_TEST_MYSQL="host;db;user;pass" php tests/run.php`: the same checks on an **empty** MySQL/MariaDB database. They passed on MariaDB 10.11. Never point this at the live database.
- A browser test (Playwright, kept outside this folder) installs the app and clicks through every screen on desktop and iPhone, on both SQLite and MariaDB.

## Code map

```
index.php        front controller: security headers, session, routing (?p=page)
install.php      one-time setup (locks itself)       cron.php   hourly alerts, daily backup, email digest
lib/core.php     config, database, settings, time, money (stored as paise), sessions, CSRF, roles, audit
lib/schema.php   one schema definition, turned into MySQL or SQLite tables
lib/domain.php   business rules: booking money, statuses, conflicts, compliance, servicing, payments, alerts, backups
lib/view.php     layout and UI helpers
pages/*.php      one file per section
assets/          app.css, app.js (no libraries), icon.svg
storage/         uploads, backups, sessions (blocked from the web)
```
