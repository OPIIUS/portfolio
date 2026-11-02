/**
 * OPIIUS request log: Google Apps Script web app (version 4).
 *
 * Paste this whole file into Extensions > Apps Script of your OPIIUS Google Sheet (see DASHBOARD-SETUP.md).
 * - opiius.online POSTs one row per enquiry, with the customer's name and WhatsApp number.
 * - You get an alert at once: by email (always) and on WhatsApp (once one of the two WhatsApp options is filled in).
 * - dashboard.html reads the rows and updates statuses with your secret key.
 *
 * 1) Change DASHBOARD_KEY below to a long secret only you know (letters and numbers).
 * 2) Fill in the alert settings below.
 * 3) Pick "testAlert" in the function menu at the top and press Run: you should get the test email and WhatsApp.
 *    The log at the bottom says what each channel answered.
 * 4) Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy. The URL stays the same.
 *    Google asks for permission (send email, connect to an outside service): allow it.
 */
const DASHBOARD_KEY = "CHANGE-ME-to-a-long-secret";

/* ---- email alerts (always on) ---- */
const NOTIFY_EMAIL = "opiiusservice@gmail.com";  // more than one: "a@gmail.com,b@gmail.com"; empty = the script owner

/* ---- WhatsApp alerts: fill in ONE of the two options ---- */
/* Option A, CallMeBot (free, 5 minutes): the key CallMeBot sends you on WhatsApp. */
const CALLMEBOT_PHONE = "918638830682";          // your WhatsApp number, country code first, digits only
const CALLMEBOT_APIKEY = "";                     // empty = option A off
/* Option B, WhatsApp Cloud API by Meta (official, most reliable): see DASHBOARD-SETUP.md. */
const WA_TOKEN = "";                             // permanent access token; empty = option B off
const WA_PHONE_ID = "";                          // "Phone number ID" from the WhatsApp > API Setup page
const WA_TO = "918638830682";                    // where alerts go: your WhatsApp number
const WA_TEMPLATE = "new_enquiry";               // approved template with 4 variables (see DASHBOARD-SETUP.md)
const WA_LANG = "en";

/* ---- optional: Telegram ---- */
const TELEGRAM_TOKEN = "";
const TELEGRAM_CHAT = "";

const VERSION = 4;
const SHEET = "Bookings";
const HEAD = ["Received", "Ref", "Type", "Agency ID", "Agency", "Vehicle / trip", "City", "From", "To", "Days",
  "Price/day", "Total", "Pickup", "Budget", "Style", "Device", "Page", "Status", "Note", "Updated", "Customer", "Phone", "Message"];
const STATUSES = ["New", "Sent to agency", "Confirmed", "Declined", "Completed", "Cancelled", "No reply"];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  else if (sh.getLastColumn() < HEAD.length) sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
  return sh;
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
const s_ = (v, n) => String(v == null ? "" : v).replace(/^[=+\-@]/, "'$&").slice(0, n || 200);
const digits_ = v => String(v || "").replace(/\D/g, "");
const intl_ = p => (p.length === 10 ? "91" + p : p);

/* the website sends enquiries here (public, append-only) */
function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "bad json" }); }
  if (!/^OP-\d{6}-[A-Z0-9]{3,6}$/.test(d.ref || "")) return out_({ ok: false, error: "bad ref" });
  const phone = digits_(d.phone);
  if (d.phone && (phone.length < 10 || phone.length > 13)) return out_({ ok: false, error: "bad phone" });
  /* a light brake on spam: at most 8 requests per number (or per device without a number) in 30 minutes */
  const cache = CacheService.getScriptCache(), ck = "n" + (phone || s_(d.ua, 10) + s_(d.page, 40));
  const seen = Number(cache.get(ck) || 0);
  if (seen >= 8) return out_({ ok: false, error: "too many requests" });
  cache.put(ck, String(seen + 1), 1800);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = sheet_();
    const refs = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat() : [];
    if (refs.indexOf(d.ref) >= 0) return out_({ ok: true, duplicate: true, v: VERSION });
    sh.appendRow([new Date(), s_(d.ref, 20), s_(d.type, 30), s_(d.agency, 40), s_(d.agencyName, 80), s_(d.vehicle, 120),
      s_(d.city, 30), s_(d.from, 20), s_(d.to, 20), Number(d.days) || "", Number(d.pricePerDay) || "", Number(d.total) || "",
      s_(d.pickup, 120), s_(d.budget, 40), s_(d.style, 40), s_(d.ua, 10), s_(d.page, 120), "New", "", new Date(),
      s_(d.name, 80), phone ? "'" + phone : "", s_(d.msg, 500)]);
  } finally { lock.releaseLock(); }
  const res = notify_(d, phone);
  return out_({ ok: true, v: VERSION, notified: Object.keys(res).filter(k => res[k] === "sent") });
}

/* Sends the alert on every channel that is set up. Returns { email: "sent" | error, whatsapp: ..., telegram: ... }. */
function notify_(d, phone) {
  const need = d.vehicle || "New enquiry";
  const customer = (d.name || "-") + (phone ? ", +" + intl_(phone) : "");
  const lines = [
    "New enquiry on OPIIUS",
    "Ref: " + d.ref,
    "Need: " + need,
    d.budget ? "Plan: " + d.budget : "",
    d.city ? "When: " + d.city : "",
    d.msg ? "Message: " + d.msg : "",
    "Customer: " + customer,
    phone ? "WhatsApp them: https://wa.me/" + intl_(phone) : ""
  ].filter(Boolean);
  const text = lines.join("\n"), res = {};

  try {
    const mail = { to: NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(), subject: "OPIIUS " + d.ref + ": " + need, body: text };
    const em = String(d.msg || "").match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (em) mail.replyTo = em[0];   /* reply straight to the customer when they left an email */
    MailApp.sendEmail(mail);
    res.email = "sent";
  } catch (err) { res.email = "failed: " + err; }

  if (WA_TOKEN && WA_PHONE_ID && WA_TO) {
    /* WhatsApp template variables cannot hold new lines or long runs of spaces */
    const v = t => String(t || "-").replace(/\s+/g, " ").trim().slice(0, 300) || "-";
    const body = { messaging_product: "whatsapp", to: digits_(WA_TO), type: "template",
      template: { name: WA_TEMPLATE, language: { code: WA_LANG }, components: [{ type: "body", parameters:
        [d.ref, need + (d.budget ? " (" + d.budget + ")" : ""), customer, d.msg || "-"].map(t => ({ type: "text", text: v(t) })) }] } };
    try {
      const r = UrlFetchApp.fetch("https://graph.facebook.com/v21.0/" + WA_PHONE_ID + "/messages", { method: "post", contentType: "application/json",
        headers: { Authorization: "Bearer " + WA_TOKEN }, payload: JSON.stringify(body), muteHttpExceptions: true });
      res.whatsapp = r.getResponseCode() === 200 ? "sent" : "Meta answered " + r.getResponseCode() + ": " + r.getContentText().slice(0, 300);
    } catch (err) { res.whatsapp = "failed: " + err; }
  } else if (CALLMEBOT_APIKEY && CALLMEBOT_PHONE) {
    try {
      const r = UrlFetchApp.fetch("https://api.callmebot.com/whatsapp.php?phone=" + digits_(CALLMEBOT_PHONE) + "&text=" + encodeURIComponent(text) +
        "&apikey=" + encodeURIComponent(CALLMEBOT_APIKEY), { muteHttpExceptions: true });
      const t = r.getContentText();
      res.whatsapp = r.getResponseCode() === 200 && /queued|sent/i.test(t) ? "sent" : "CallMeBot answered " + r.getResponseCode() + ": " + t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300);
    } catch (err) { res.whatsapp = "failed: " + err; }
  } else res.whatsapp = "off (no WhatsApp option filled in)";

  if (TELEGRAM_TOKEN && TELEGRAM_CHAT) try {
    const r = UrlFetchApp.fetch("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage", { method: "post", payload: { chat_id: TELEGRAM_CHAT, text: text }, muteHttpExceptions: true });
    res.telegram = r.getResponseCode() === 200 ? "sent" : "Telegram answered " + r.getResponseCode();
  } catch (err) { res.telegram = "failed: " + err; }
  return res;
}

/* Run this from the editor (function menu > testAlert > Run) to check the alerts. The log shows what each channel said. */
function testAlert() {
  const res = notify_({ ref: "OP-000000-TEST", type: "project", vehicle: "Business website", budget: "India · from ₹2,000/month",
    city: "Flexible", name: "OPIIUS test", msg: "This is a test alert from the request log." }, "8638830682");
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/* the dashboard reads and updates here (needs the key); ?ping=1 tells the website this version */
function doGet(e) {
  const p = e.parameter || {};
  if (p.ping) return out_({ ok: true, v: VERSION });
  if (p.key !== DASHBOARD_KEY || DASHBOARD_KEY.indexOf("CHANGE-ME") === 0) return out_({ ok: false, error: "wrong key" });
  const sh = sheet_();
  if (p.action === "status") {
    if (STATUSES.indexOf(p.status) < 0) return out_({ ok: false, error: "bad status" });
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const n = sh.getLastRow() - 1;
      const refs = n > 0 ? sh.getRange(2, 2, n, 1).getValues().flat() : [];
      const i = refs.indexOf(p.ref);
      if (i < 0) return out_({ ok: false, error: "ref not found" });
      sh.getRange(i + 2, 18, 1, 3).setValues([[p.status, s_(p.note, 300), new Date()]]);
      return out_({ ok: true });
    } finally { lock.releaseLock(); }
  }
  /* a test alert from the dashboard's Settings */
  if (p.action === "test") { const r = testAlert(); return out_({ ok: true, notified: Object.keys(r).filter(k => r[k] === "sent"), detail: r }); }
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
  return out_({ ok: true, head: HEAD, rows: rows.map(r => r.map(v => v instanceof Date ? v.toISOString() : v)) });
}
