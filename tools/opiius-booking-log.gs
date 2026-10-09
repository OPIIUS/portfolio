/**
 * OPIIUS booking log: Google Apps Script web app (version 2).
 *
 * Paste this whole file into Extensions > Apps Script of your OPIIUS Google Sheet (see DASHBOARD-SETUP.md).
 * - opiius.online POSTs one row per booking request, with the customer's name and WhatsApp number,
 *   and you are notified at once: by email (always) and on WhatsApp / Telegram (if set up below).
 * - dashboard.html reads the rows and updates statuses with your secret key.
 *
 * 1) Change DASHBOARD_KEY below to a long secret only you know (letters and numbers).
 * 2) Fill in the NOTIFY settings below.
 * 3) Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy. The URL stays the same.
 *    Google asks for permission again (email and outside requests): allow it.
 */
const DASHBOARD_KEY = "CHANGE-ME-to-a-long-secret";

/* ---- notifications for every new request ---- */
const NOTIFY_EMAIL = "";                 // empty = the Google account that owns this script
const CALLMEBOT_PHONE = "918638830682";  // your WhatsApp number for alerts, country code first, digits only
const CALLMEBOT_APIKEY = "";             // the key CallMeBot sends you (DASHBOARD-SETUP.md); empty = no WhatsApp alert
const TELEGRAM_TOKEN = "";               // optional: a Telegram bot token from @BotFather
const TELEGRAM_CHAT = "";                // optional: your chat id with that bot

const VERSION = 2;
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

/* the website sends requests here (public, append-only) */
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
  const sent = notify_(d, phone);
  return out_({ ok: true, v: VERSION, notified: sent });
}

/* email always; WhatsApp (CallMeBot) and Telegram when their settings are filled in */
function notify_(d, phone) {
  const inr = n => "Rs " + Number(n).toLocaleString("en-IN");
  const lines = [
    d.type === "rental" ? "New booking request on OPIIUS" : "New request on OPIIUS",
    "Ref: " + d.ref,
    d.agencyName ? "Agency: " + d.agencyName : "",
    d.vehicle ? (d.type === "rental" ? "Car: " : "Need: ") + d.vehicle + (d.pricePerDay ? " (" + inr(d.pricePerDay) + "/day)" : "") : "",
    d.from ? "Dates: " + d.from + (d.to && d.to !== d.from ? " to " + d.to : "") + (d.days ? " (" + d.days + (d.days == 1 ? " day)" : " days)") : "") : "",
    d.total ? "Estimate: " + inr(d.total) : "",
    d.pickup ? "Pickup: " + d.pickup : "",
    d.city ? "City: " + d.city : "",
    d.budget ? "Budget: " + d.budget : "",
    d.msg ? "Message: " + d.msg : "",
    "Customer: " + (d.name || "-") + (phone ? ", +" + (phone.length === 10 ? "91" + phone : phone) : ""),
    phone ? "WhatsApp them: https://wa.me/" + (phone.length === 10 ? "91" + phone : phone) : ""
  ].filter(Boolean);
  const text = lines.join("\n"), sent = [];
  try {
    MailApp.sendEmail(NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(), "OPIIUS " + d.ref + ": " + (d.vehicle || "new request"), text);
    sent.push("email");
  } catch (err) {}
  if (CALLMEBOT_APIKEY && CALLMEBOT_PHONE) try {
    UrlFetchApp.fetch("https://api.callmebot.com/whatsapp.php?phone=" + CALLMEBOT_PHONE + "&text=" + encodeURIComponent(text) + "&apikey=" + encodeURIComponent(CALLMEBOT_APIKEY), { muteHttpExceptions: true });
    sent.push("whatsapp");
  } catch (err) {}
  if (TELEGRAM_TOKEN && TELEGRAM_CHAT) try {
    UrlFetchApp.fetch("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage", { method: "post", payload: { chat_id: TELEGRAM_CHAT, text: text }, muteHttpExceptions: true });
    sent.push("telegram");
  } catch (err) {}
  return sent;
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
  /* a test alert from the dashboard's Settings, to check notifications work */
  if (p.action === "test") return out_({ ok: true, notified: notify_({ ref: "OP-000000-TEST", type: "rental", vehicle: "Test alert", name: "OPIIUS test" }, "") });
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
  return out_({ ok: true, head: HEAD, rows: rows.map(r => r.map(v => v instanceof Date ? v.toISOString() : v)) });
}
