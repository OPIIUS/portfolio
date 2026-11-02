# OPIIUS

The studio site of Priyangshu Nath: websites, software and automation, with a "Book a project" form.

Live: https://opiius.online/

## What's here
- `index.html`: the home page (services, process, selected work, live demos, booking form, contact). Hand-written,
  one file with inline CSS and JS. No framework, no build step.
- `demos/`: the six runnable automation demos (and the desk demos).
- `coaching/`: the coaching institute compliance site, shown with a demo institute.
- `shots/`, `assets/studio/`: screenshots used on the home page. `assets/site/logo/`: logo and icons.
- `resume/`: resume PDF.
- `dashboard.html` (private, not indexed) and `tools/opiius-booking-log.gs`: the Google Sheet that stores every project
  request and alerts you by email (and WhatsApp or Telegram, if set up). Setup: `DASHBOARD-SETUP.md`.

## Booking form
The form posts the request to the booking-log web app (URL in `index.html`, `var LOG=`). The customer stays on the
page and gets a reference number. If the deployed script is older than version 2, the success screen also offers a
"send it on WhatsApp" button so the request still reaches you.

## The car rental marketplace (closed November 2026)
OPIIUS ran as a car rental marketplace for Guwahati and Barama in 2026. It is now a case study on the home page. Its old
URLs (`/rentals/`, `/agency/…`, `/get-matched/`, `/for-agencies/`, `/terms.html` and so on) redirect to the home page,
and `sw.js` clears the old app's offline cache. The full marketplace, its generator (`tools/build-site.mjs`) and data
are in the git history before this change.
