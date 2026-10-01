# OPIIUS bookings dashboard: one-time setup (about 10 minutes)

Every Reserve / vehicle request / trip request on opiius.online is written to a Google Sheet that only you own,
with the time, reference (e.g. OP-261001-HKCD4), agency, vehicle, dates and price. No customer name or phone number.
opiius.online/dashboard.html shows it per agency and prints a dated report for any agency.

## 1. Create the Sheet and the script
1. Go to sheets.google.com and create a blank sheet named "OPIIUS bookings".
2. Extensions > Apps Script. Delete what is there.
3. Open `tools/opiius-booking-log.gs` from this repo (or ask Claude for it), copy everything, paste it in.
4. On the line `const DASHBOARD_KEY = "CHANGE-ME-to-a-long-secret";` replace the text in quotes with your own
   secret, e.g. `opiius-7Hk29xQm4` (letters and numbers, at least 12 characters). Keep it private.
5. Click the save icon.

## 2. Publish it as a web app
1. Deploy > New deployment > the gear icon > Web app.
2. Execute as: **Me**. Who has access: **Anyone**. Click Deploy.
3. Allow the permissions Google asks for (it only accesses this one sheet).
4. Copy the **Web app URL** (ends with `/exec`).

## 3. Connect
1. Send the Web app URL to Claude: it goes into `assets/opiius/config.js` (`bookingLog`) so the site starts logging.
   (The URL is not secret: anyone can only add rows; reading needs your key.)
2. Open **opiius.online/dashboard.html**, paste the URL and your key, Save. They stay only in that browser.

## Every day
- When a booking arrives on WhatsApp, find its reference in the dashboard and set the status as it happens:
  Sent to agency > Confirmed / Declined / No reply > Completed / Cancelled. Add a note, e.g. "Owner said YES 10:05".
- Keep the owner's WhatsApp "YES" replies: together with the dashboard they are your proof.
- Month end: filter by agency and month, Print report (or Save as PDF) and send it to the owner.

If you change the script later, use Deploy > Manage deployments > Edit > New version, so the URL stays the same.
