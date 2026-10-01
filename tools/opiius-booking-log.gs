/**
 * OPIIUS booking log: Google Apps Script web app.
 *
 * Paste this whole file into Extensions > Apps Script of your OPIIUS Google Sheet (see DASHBOARD-SETUP.md).
 * - opiius.online POSTs one row per reservation / request (no customer name or phone is sent).
 * - dashboard.html reads the rows and updates statuses with your secret key.
 *
 * 1) Change DASHBOARD_KEY below to a long secret only you know (letters and numbers).
 * 2) Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone > Deploy.
 * 3) Copy the Web app URL. Send it to Claude for the website; paste it + your key into dashboard.html.
 */
const DASHBOARD_KEY = "CHANGE-ME-to-a-long-secret";

const SHEET = "Bookings";
const HEAD = ["Received", "Ref", "Type", "Agency ID", "Agency", "Vehicle / trip", "City", "From", "To", "Days",
  "Price/day", "Total", "Pickup", "Budget", "Style", "Device", "Page", "Status", "Note", "Updated"];
const STATUSES = ["New", "Sent to agency", "Confirmed", "Declined", "Completed", "Cancelled", "No reply"];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
const s_ = (v, n) => String(v == null ? "" : v).slice(0, n || 200);

/* the website logs here (public, append-only) */
function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "bad json" }); }
  if (!/^OP-\d{6}-[A-Z0-9]{3,6}$/.test(d.ref || "")) return out_({ ok: false, error: "bad ref" });
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = sheet_();
    const refs = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat() : [];
    if (refs.indexOf(d.ref) >= 0) return out_({ ok: true, duplicate: true });
    sh.appendRow([new Date(), s_(d.ref, 20), s_(d.type, 30), s_(d.agency, 40), s_(d.agencyName, 80), s_(d.vehicle, 80),
      s_(d.city, 30), s_(d.from, 20), s_(d.to, 20), Number(d.days) || "", Number(d.pricePerDay) || "", Number(d.total) || "",
      s_(d.pickup, 120), s_(d.budget, 40), s_(d.style, 40), s_(d.ua, 10), s_(d.page, 120), "New", "", new Date()]);
    return out_({ ok: true });
  } finally { lock.releaseLock(); }
}

/* the dashboard reads and updates here (needs the key) */
function doGet(e) {
  const p = e.parameter || {};
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
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
  return out_({ ok: true, head: HEAD, rows: rows.map(r => r.map(v => v instanceof Date ? v.toISOString() : v)) });
}
