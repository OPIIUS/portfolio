'use strict';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Checks `input` against `spec` and returns a clean object with only the listed fields.
// spec: { field: { type: 'str'|'int'|'date'|'bool'|'enum'|'phone', required, max, min, values, nullable } }
// With partial = true, missing fields are skipped (for PATCH-style updates).
function clean(input, spec, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Expected a JSON object.');
  const out = {};
  for (const [key, rule] of Object.entries(spec)) {
    const label = rule.label || key.replace(/_/g, ' ');
    let v = input[key];
    if (v === undefined || v === '' || v === null) {
      if (partial && v === undefined) continue;
      if (rule.required) throw new HttpError(400, `Please fill in ${label}.`);
      if (v === undefined && rule.default !== undefined) { out[key] = rule.default; continue; }
      out[key] = rule.nullable ? null : (rule.type === 'int' ? (rule.default ?? 0) : rule.type === 'bool' ? false : '');
      continue;
    }
    switch (rule.type) {
      case 'str':
      case 'phone': {
        if (typeof v !== 'string' && typeof v !== 'number') throw new HttpError(400, `${label} must be text.`);
        v = String(v).trim();
        const max = rule.max || (rule.type === 'phone' ? 20 : 200);
        if (v.length > max) throw new HttpError(400, `${label} is too long (max ${max} characters).`);
        if (rule.type === 'phone' && v && !/^[+\d][\d\s-]{5,19}$/.test(v)) throw new HttpError(400, `${label} doesn't look like a phone number.`);
        if (rule.required && !v) throw new HttpError(400, `Please fill in ${label}.`);
        break;
      }
      case 'int': {
        v = Number(v);
        if (!Number.isInteger(v)) throw new HttpError(400, `${label} must be a whole number.`);
        if (rule.min !== undefined && v < rule.min) throw new HttpError(400, `${label} must be at least ${rule.min}.`);
        if (rule.max !== undefined && v > rule.max) throw new HttpError(400, `${label} must be at most ${rule.max}.`);
        break;
      }
      case 'date':
        if (!isDate(v)) throw new HttpError(400, `${label} must be a valid date.`);
        break;
      case 'bool':
        v = v === true || v === 1 || v === '1' || v === 'true';
        break;
      case 'enum':
        if (!rule.values.includes(v)) throw new HttpError(400, `${label} must be one of: ${rule.values.join(', ')}.`);
        break;
      default:
        throw new Error('Unknown rule type ' + rule.type);
    }
    out[key] = v;
  }
  return out;
}

// Today's date as YYYY-MM-DD in the agency's time zone (default India).
function today(tz = process.env.TZ_AGENCY || 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
}

module.exports = { HttpError, clean, isDate, today, addDays, daysBetween };
