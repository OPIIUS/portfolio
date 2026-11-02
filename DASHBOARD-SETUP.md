# OPIIUS requests dashboard: one-time setup (about 10 minutes)

Every "Book a project" request on opiius.online is sent from the page (the customer is not taken to WhatsApp) to a
Google Sheet that only you own: the time, reference (e.g. OP-261102-HKCD4), the service, budget, timeline, message,
and the customer's name and WhatsApp number. You get an alert for each one at once: an email (always), and a WhatsApp
or Telegram message if you set one up below. opiius.online/dashboard.html lists the requests, with tap-to-call and
WhatsApp links, and lets you set a status on each.

Already set up the sheet for the old car rental site? Just do step 4 (update the script to the latest
`tools/opiius-booking-log.gs` and deploy a new version). The URL stays the same, so the form keeps working.

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
1. Send the Web app URL to Claude: it goes into `index.html` (`var LOG=`) so the form starts logging.
   (The URL is not secret: anyone can only add rows; reading needs your key.)
2. Open **opiius.online/dashboard.html**, paste the URL and your key, Save. They stay only in that browser.

## 4. Alerts on your phone (version 2 of the script)
Already set up the sheet before? Update the script once:
1. Open the sheet > Extensions > Apps Script. Replace everything with the new `tools/opiius-booking-log.gs`
   (keep your own DASHBOARD_KEY line).
2. Deploy > Manage deployments > the pencil icon > Version: **New version** > Deploy. The URL stays the same.
   Google asks for permission again (send email, connect to an outside service): allow it.
3. Email alerts now work: each request arrives in the Gmail of the Google account that owns the sheet.
   Turn on Gmail notifications on your phone. (To use another address, fill in NOTIFY_EMAIL.)

WhatsApp alerts to your own number (free, via CallMeBot):
1. Open callmebot.com, go to the free WhatsApp API page, and follow its step to send the activation message
   ("I allow callmebot to send me messages") from your WhatsApp to the number it shows.
2. CallMeBot replies with your API key. Paste it in the script: `const CALLMEBOT_APIKEY = "…";`
   Check `CALLMEBOT_PHONE` is your number (country code first, digits only). Deploy a new version again.
3. In the dashboard, Settings > **Send a test alert**: you should get the email and the WhatsApp message.

Until the script is updated, the form still works: the success screen also shows the customer a "send it on
WhatsApp" button, so no request is missed. Once version 2 or later is live, that button goes away.

## Every day
- When an alert arrives, tap the customer's WhatsApp link in it (or in the dashboard) and reply.
- Set the status in the dashboard as it goes, and add a note, e.g. "Quoted Rs 25,000, starts Monday".
- The `OWNERS` list in the script was for the car rental site. Project requests never use it, so you can leave it empty.

If you change the script later, use Deploy > Manage deployments > Edit > New version, so the URL stays the same.
