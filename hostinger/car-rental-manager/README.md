# Car Rental Manager

A simple management system for a car rental business. The owner enters the business details, the cars, the customers and each rental, and the app works out availability, balances, overdue trips, damage history and service/document reminders.

It runs on ordinary PHP + MySQL hosting such as Hostinger. There is no build step.

## The 8 sections

| Section | What it does |
|---|---|
| **Dashboard** | **Cars:** total, available, currently rented, reserved, under maintenance. **Money:** collected this month, money still due, unpaid and partially paid rentals. **Lists:** who has which car and when it returns, plus today's important items (returns today, overdue returns, payments due, service and document reminders, damage to review). All figures come from the database. |
| **Cars** | Add, edit, remove (kept in history, can be restored) and photos. Statuses: Available, Currently rented, Reserved, Under maintenance, Unavailable. A car that is out with a customer always shows "Currently rented". Each car has its rental history, damage history, service & documents, and photos. |
| **Customers** | Name and phone (others optional). Shows times rented, cars rented, previous trips, total paid, remaining due, damage records and the current active rental. Licence and ID numbers are hidden from staff unless the owner allows it. |
| **Rentals** | New rental: customer, car, start, expected return, duration, price worked out from the agreed terms, deposit, advance, additional charge, notes. Then either hand over the car now (starting km, fuel, condition, photos) or reserve it for later. Overlapping rentals of the same car are refused. Lists: Active, Upcoming, Overdue, Extended, Completed, Cancelled. Extensions record the agreed terms and charge. The return form records km, fuel, condition, new damage, extra charges, final payment and deposit return. A before-vs-after comparison is shown. |
| **Money Due** | Customer, phone, car, total, paid, remaining, due date and overdue days, plus rentals paid in full, refunds owed and deposits still held. Payments: several per rental (date, amount, method, reference, note), never overwritten; mistakes are cancelled by the owner with a reason and stay visible. **Remaining = Total payable − Payments received.** Security deposits are kept separate from rent. |
| **Maintenance & Documents** | Last service, current km, next service km/date, service cost. Expiry dates for insurance, PUC and other documents. Reminders for service due or overdue and documents expiring or expired, with "Mark service done" and "Update expiry date" right on each reminder. The app only uses the dates you enter; it does not check documents. |
| **Reports** | Total, active and completed rentals; money collected by month; outstanding; car-wise and customer-wise history; damage history; maintenance expenses. Each exports to Excel or CSV. |
| **Settings** | Business details (name, owner, phone, address, currency, opening date, number of vehicles, usual charging method), staff accounts with permissions, reminder days, categories, backups, and the activity log. |

## Damage

Damage found at return (or at any time) is saved against the car, the customer and the rental. **It is never charged automatically.** The owner chooses "Charge the customer" with an agreed amount (added to that rental's balance) or "No charge". When the car is repaired, the repair cost is saved as a maintenance expense.

## Security

- Passwords are stored hashed.
- Owner and staff roles; the owner ticks what each staff member can do.
- Security tokens on every form, lockout after repeated wrong passwords, and sign-out after inactivity.
- Uploaded photos and documents are stored privately and only shown to signed-in users with permission.
- Every change is recorded in the activity log.
- Daily backups (with the hourly cron job), with download and restore.

## Tests

```
php tests/run.php                                         # business rules on a temporary SQLite database
FLEET_TEST_MYSQL="host;db;user;pass" php tests/run.php    # the same on an EMPTY MySQL/MariaDB database
```

A Playwright browser test (kept outside this folder) installs the app and runs the owner's 15 scenarios plus invalid inputs, double bookings, accidental deletion, staff access and phone layout.
