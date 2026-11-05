# OPIIUS requests dashboard: one-time setup (about 10 minutes)

Every "Book a project" request on opiius.online is sent from the page (the customer is not taken to WhatsApp) to a
Google Sheet that only you own: the time, reference (e.g. OP-261102-HKCD4), the service, budget, timeline, message,
and the customer's name and WhatsApp number. You get an alert for each one at once: an email to opiiusservice@gmail.com
(always), and a WhatsApp message once you set one up below. opiius.online/dashboard.html lists the requests, with tap-to-call and
WhatsApp links, and lets you set a status on each.

**Current setup (5 Nov 2026):** the live log is the Sheet "OPIIUS enquiries" in the **opiiusservice@gmail.com** Google account,
running version 4 of the script. It saves every enquiry and emails the alert from Gmail itself. FormSubmit is only a
backup the website uses if this log ever fails.

Already set up the sheet before? Just do step 4 (update the script to the latest `tools/opiius-booking-log.gs`
and deploy a new version). The URL stays the same, so the form keeps working.

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

## 4. Alerts by email and WhatsApp (version 4 of the script)
Every enquiry is sent to **opiiusservice@gmail.com** (the `NOTIFY_EMAIL` line) and, once you fill in one of the
two WhatsApp options below, to your WhatsApp too.

**Update the script (do this first, 2 minutes):**
1. Open the sheet > Extensions > Apps Script. Replace everything with the new `tools/opiius-booking-log.gs`.
   Put your own secret back on the `DASHBOARD_KEY` line.
2. At the top, pick **testAlert** in the function menu and press **Run**. Allow the permissions Google asks for.
   Open **Execution log**: it shows `"email": "sent"`. Check opiiusservice@gmail.com, and turn on Gmail
   notifications for that account on your phone.
3. Deploy > Manage deployments > the pencil icon > Version: **New version** > Deploy. The URL stays the same.

**WhatsApp, option A: CallMeBot (free, about 5 minutes, sometimes slow to reply)**
1. Open callmebot.com > "Free WhatsApp API". Save the phone number shown there in your contacts.
2. From your WhatsApp (86388 30682), send it exactly: `I allow callmebot to send me messages`
3. Wait for the reply with your API key (can take a few minutes; if nothing comes in 10 minutes, send it again).
4. Paste the key in the script: `const CALLMEBOT_APIKEY = "your key";` then Run **testAlert** again.
   The log should say `"whatsapp": "sent"`. Deploy a new version (step 3 above).

**WhatsApp, option B: WhatsApp Cloud API by Meta (official, most reliable, about 30 minutes)**
Use this if CallMeBot never replies. Alerts come from a separate business number, not your own.
1. Go to developers.facebook.com > My Apps > Create app > type **Business** > add the **WhatsApp** product.
2. WhatsApp > API Setup: note the **Phone number ID**. Under "To", add and verify 86388 30682.
3. Create a permanent token: business.facebook.com > Settings > System users > Add (Admin) > Generate token for
   your app with the `whatsapp_business_messaging` permission. Copy it.
4. WhatsApp Manager > Message templates > Create template: category **Utility**, name **new_enquiry**,
   language **English**, body:
   `New OPIIUS enquiry {{1}}. Need: {{2}}. Customer: {{3}}. Message: {{4}}`
   Submit and wait for approval (usually minutes).
5. In the script fill in `WA_TOKEN`, `WA_PHONE_ID` (and `WA_TO` if alerts should go to another number).
   Run **testAlert**: the log should say `"whatsapp": "sent"`. If it says "Meta answered …", the message
   explains what to fix. Deploy a new version (step 3 above).
Meta may charge a small fee per message once you pass its free allowance; check the pricing page in WhatsApp Manager.

If one option is filled in, the script uses it. If both are, it uses option B.

Until the script is updated, the form still works: the success screen also shows the customer a "send it on
WhatsApp" button, so no request is missed. Once version 2 or later is live, that button goes away.

## Every day
- When an alert arrives, tap the customer's WhatsApp link in it (or in the dashboard) and reply.
- Set the status in the dashboard as it goes, and add a note, e.g. "Quoted Rs 25,000, starts Monday".
- Reply to emailed alerts straight from Gmail: when the customer left an email, the reply goes to them.

If you change the script later, use Deploy > Manage deployments > Edit > New version, so the URL stays the same.
