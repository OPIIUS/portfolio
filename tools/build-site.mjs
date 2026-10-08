/* Builds the static OPIIUS marketplace pages from assets/opiius/data.js (+ partners.js, config.js).
   Run from the repo root:  node tools/build-site.mjs
   Writes: index.html, rentals/, agency/, for-agencies/,
   verification/, about/, get-matched/, 404.html and sitemap.xml. Only real partners (real:true) are shown. */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://opiius.online";
const ctx = {window: {}};
vm.createContext(ctx);
for (const f of ["assets/opiius/config.js", "assets/opiius/partners.js", "assets/opiius/data.js"])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, {filename: f});
const O = ctx.window.OP, CFG = ctx.window.OPIIUS_CONFIG || {};
const WA = CFG.whatsapp || "918638830682", PHONE = CFG.phoneDisplay || "86388 30682";
const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = new Date().getFullYear();

/* ---------- helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const inr = n => "₹" + Number(n).toLocaleString("en-IN");
const plural = (n, a, b) => `${n} ${n === 1 ? a : (b || a + "s")}`;
const waLink = t => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
const written = [];
function write(rel, html) {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, html);
  written.push(rel);
}
const ASSET_V = crypto.createHash("sha1").update(["assets/site/site.css", "assets/site/site.js", "assets/opiius/config.js"].map(f => fs.readFileSync(path.join(ROOT, f))).join("")).digest("hex").slice(0, 8);
const urlOf = rel => "/" + rel.replace(/index\.html$/, "");

/* ---------- icons (24px, stroke) ---------- */
const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  heart: P('<path d="M12 20.5s-7.5-4.6-9.4-9.6A5.1 5.1 0 0 1 12 6.6a5.1 5.1 0 0 1 9.4 4.3c-1.9 5-9.4 9.6-9.4 9.6z"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.3-4.3"/>'),
  car: P('<path d="M5 17h14M3 17v-4l2.2-5.2A2 2 0 0 1 7 6.5h10a2 2 0 0 1 1.8 1.3L21 13v4"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M3.5 12.5h17"/>'),
  bike: P('<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h5l4.5 7.5M12 9l-2-3H7.5M14 9l1.5-3H18"/>'),
  map: P('<path d="m9 4-6 2.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>'),
  tent: P('<path d="M3 20 12 4l9 16z"/><path d="M12 4v16M9 20l3-6 3 6"/>'),
  party: P('<path d="M4 20 8 8l8 8z"/><path d="M14 4v2M20 10h-2M17.5 6.5 19 5M12 7c1-1 1-2 0-3M17 12c1-1 2-1 3 0"/>'),
  van: P('<path d="M3 16V7a1 1 0 0 1 1-1h10l5 4h1a1 1 0 0 1 1 1v5"/><path d="M3 16h18"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/><path d="M14 6v4h5"/>'),
  plane: P('<path d="M10.5 13.5 4 11l1.5-1.5 7 1L17 6a2 2 0 0 1 3 3l-4.5 4.5 1 7L15 22l-2.5-6.5L9 19v2.5L7.5 23l-1-3.5L3 18.5 4.5 17H7l3.5-3.5z"/>'),
  shield: P('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.5 7.5 9.5 4.4-1 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>'),
  check: P('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  camera: P('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  tag: P('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>'),
  chat: P('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  star: P('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  pin: P('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.8 3 2.5 3.5 5.2"/>'),
  arrow: P('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  doc: P('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  id: P('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h4M14.5 13.5h3"/>'),
  home: P('<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
  eye: P('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  chart: P('<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>'),
  award: P('<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>'),
  refresh: P('<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>'),
  flag: P('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  bolt: P('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  compass: P('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.3c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1.9 2 1.2 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.2 1.4z"/></svg>'
};
const WORDMARK = fs.readFileSync(path.join(ROOT, "assets/site/logo/opiius-wordmark.svg"), "utf8").replace("<svg ", '<svg class="wm" aria-hidden="true" focusable="false" ');
const LOGO = `<img class="bdg" src="/assets/site/logo/opiius-icon-96.png" width="40" height="40" alt="">${WORDMARK}<span class="sr">OPIIUS</span>`;
const CAR_LINE = '<svg viewBox="0 0 200 70" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M8 52h14m36 0h76m36 0h22v-12c0-5-3-8-8-9l-28-5-22-15c-4-3-8-4-13-4H74c-6 0-11 2-15 6L44 26l-24 4c-6 1-10 5-10 11v11"/><circle cx="40" cy="52" r="12"/><circle cx="152" cy="52" r="12"/></svg>';
const BIKE_LINE = '<svg viewBox="0 0 200 70" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="42" cy="50" r="16"/><circle cx="158" cy="50" r="16"/><path d="M42 50l26-24h44l14 12h-34l-12 12M126 38l32 12M110 26l-8-10h-14M138 22l10 4"/></svg>';

/* ---------- marketplace structure ---------- */
const CHECKS = {
  rentals: ["Business proof (trade licence, Udyam or GST)", "Owner's photo ID", "Rent-a-cab or rent-a-motorcycle permit", "RC and commercial insurance for every listed vehicle", "Photos of the actual fleet"]
};
/* OPIIUS is for rental vehicles only: self-drive cars, cars with driver and, once an agency offers them, bikes and tempo travellers. */
const CATS = [
  {id: "rentals", name: "Rentals", icon: "car", menu: "Self-drive cars and cars with driver", agencyNoun: "rental agency", subs: [
      {id: "self-drive-cars", name: "Self-drive cars", icon: "car", desc: "Hatchbacks, compact SUVs and 7-seaters you drive yourself.", kind: "car"},
      {id: "cars-with-driver", name: "Cars with driver", icon: "users", desc: "Innova, Ertiga and SUVs with an experienced local driver."},
      {id: "bikes", name: "Bikes & scooters", icon: "bike", desc: "Scooters for the city, Royal Enfields for the hills.", kind: "bike", onlyWhenLive: true},
      {id: "tempo-travellers", name: "Tempo travellers", icon: "van", desc: "12 to 26 seats for groups, colleges and weddings.", onlyWhenLive: true}]}
];
const SUB = {};
CATS.forEach(c => c.subs.forEach(s => { SUB[s.id] = {...s, cat: c}; }));
const CITIES_ASK = ["Guwahati", "Barama", "Elsewhere in Assam", "Shillong", "Elsewhere in the Northeast"];

/* ---------- real partners and their vehicles ---------- */
const GROUPS = [
  {id: "hatchbacks", t: "City hatchbacks", nav: "Hatchbacks", e: "5 seats · easy to park", d: "Light, economical cars for city traffic and quick runs out of town.", test: m => m.kind === "car" && m.type === "Hatchback"},
  {id: "sedans", t: "Sedans", nav: "Sedans", e: "5 seats · a proper boot", d: "Comfortable for four adults and their luggage on longer drives.", test: m => m.kind === "car" && m.type === "Sedan"},
  {id: "compact-suvs", t: "Compact SUVs", nav: "Compact SUVs", e: "5 seats · higher ground clearance", d: "A taller stance and more clearance for hill roads, still easy in the city.", test: m => m.kind === "car" && m.type !== "Hatchback" && m.type !== "Sedan" && m.seats < 6},
  {id: "seven-seaters", t: "7-seaters for families and groups", nav: "7-seaters", e: "6–7 seats · room for luggage", d: "Space for the whole family and their bags, for Meghalaya, Kaziranga and long days.", test: m => m.kind === "car" && m.seats >= 6},
  {id: "scooters", t: "Scooters", nav: "Scooters", e: "No gears · automatic", d: "The easiest way around town.", test: m => m.kind === "bike" && m.type === "Scooter"},
  {id: "motorcycles", t: "Motorcycles", nav: "Motorcycles", e: "Geared · for the hills", d: "From commuters to Royal Enfields for the mountain roads.", test: m => m.kind === "bike" && m.type !== "Scooter"}
];
const AGENCIES = Object.entries(O.AGENCIES).filter(([, a]) => a.real && !a.demo).map(([id, a]) => ({id, ...a, slug: a.slug || id, category: a.category || "self-drive-cars"}));
const CARS = Object.values(O.LISTINGS).filter(l => AGENCIES.some(a => a.id === l.agency)).map(l => {
  const m = O.MODELS[l.model], a = AGENCIES.find(x => x.id === l.agency), b = (O.BRANDS[m.brand] || {name: ""}).name;
  const nm = (a.trims && a.trims[l.model]) || m.name;
  return {id: l.id, model: l.model, m, a, brand: b, nm, name: `${b} ${nm}`.trim(), price: l.price, units: l.units, year: l.year, trans: (a.trans && a.trans[l.model]) || m.trans, photo: l.photo ? "/" + l.photo.replace(/^\//, "") : "", sample: !!l.sample};
}).sort((x, y) => x.price - y.price || x.name.localeCompare(y.name));
const carsOf = (pred) => CARS.filter(pred);
/* rental types marked onlyWhenLive (bikes, tempo travellers) appear only once an agency offers them */
for (const c of CATS) c.subs = c.subs.filter(s => !s.onlyWhenLive || AGENCIES.some(a => a.category === s.id) || (s.kind && CARS.some(x => x.m.kind === s.kind)));
const groupsOf = list => GROUPS.map(g => ({g, list: list.filter(c => g.test(c.m))})).filter(x => x.list.length);
const minP = list => Math.min(...list.map(c => c.price)), maxP = list => Math.max(...list.map(c => c.price));
/* cars with driver: an agency's optional driver block from partners.js, {cars: [{name, seats, local, perKm, airport}], allowance, areas, note} */
const drv = a => a.driver && (a.driver.cars || []).some(c => c.name && +c.local) ? a.driver : null;
const drvCars = a => drv(a) ? a.driver.cars.filter(c => c.name && +c.local) : [];
const drvMin = a => Math.min(...drvCars(a).map(c => +c.local));
const DRV = AGENCIES.filter(drv);
const driverUrl = DRV.length ? "/rentals/#cars-with-driver" : "/get-matched/?need=cars-with-driver";
const subLive = sub => sub.kind ? carsOf(c => c.m.kind === sub.kind) : [];
const cityName = id => (O.PLACES[id] || {name: id}).name;
const liveCities = kind => [...new Set(carsOf(c => c.m.kind === kind).map(c => c.a.city))];
const listingPath = (sub, city) => `rentals/${sub}/${city}/index.html`;
const agencyPath = a => `agency/${a.slug}/index.html`;

function badge(a, cls = "") {
  if (a.verified) return `<span class="badge ver ${cls}">${I.shield}Verified${a.verifiedOn ? " · " + esc(a.verifiedOn) : ""}</span>`;
  if (a.founding) return `<span class="badge fp ${cls}">${I.star}Founding partner</span>`;
  return `<span class="badge lst ${cls}">${I.check}Listed on OPIIUS</span>`;
}
const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

/* ---------- layout ---------- */
const NAV = [["rentals/", "Rentals", "rentals"], [driverUrl.slice(1), "Cars with driver", "driver"], ["verification/", "How we verify", "verification"], ["about/", "About", "about"]];
function header(active) {
  return `<a class="skip" href="#main">Skip to content</a>
<header class="hdr"><div class="wrap">
  <a class="logo" href="/" aria-label="OPIIUS home">${LOGO}</a>
  <nav class="nav" aria-label="Main">${NAV.map(([h, t, k]) => `<a href="/${h}"${active === k ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
  <div class="cta"><a class="btn outline sm hide-m" href="/for-agencies/"${active === "agencies" ? ' aria-current="page"' : ""}>For agencies</a>
    <button type="button" class="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="mnav">${I.menu}</button></div>
</div></header>
<nav class="mnav" id="mnav" aria-label="Mobile">
  <a href="/rentals/">Rentals<small>Choose a local agency</small></a><a href="${selfDriveUrl}">Self-drive cars<small>Choose an agency</small></a><a href="${driverUrl}">Cars with driver<small>${DRV.length ? "Choose an agency" : "Tell us your dates"}</small></a>
  <a href="/verification/">How we verify</a><a href="/about/">About</a>
  <a class="btn primary" href="/for-agencies/">For agencies: list your cars</a>
</nav>`;
}
/* phone tab bar: the active tab rises into a circle that springs between tabs (motion in site.js) */
function tabbar() {
  const t = [["/", "home", I.home, "Home"], ["/rentals/", "rentals", I.car, "Rentals"], [driverUrl, "driver", I.users, "With driver"], ["/rentals/#liked", "liked", I.heart, "Saved"]];
  return `<nav class="tabbar" aria-label="Quick links"><svg class="tb-bg" aria-hidden="true" focusable="false"><path/></svg><span class="tb-ball" aria-hidden="true"></span>
  ${t.map(([h, k, ic, l]) => `<a class="tb" href="${h}" data-tab="${k}">${ic}<span>${l}</span></a>`).join("")}<button type="button" class="tb" data-tab="menu" aria-controls="mnav" aria-expanded="false">${I.menu}<span>Menu</span></button></nav>`;
}
function footer() {
  return `<footer class="ftr"><div class="wrap">
  <div class="cols">
    <div><a class="logo" href="/">${LOGO}</a><p class="about">Self-drive cars and cars with driver from trusted local rental agencies in Assam. Real photos, clear prices, inquiries on WhatsApp.</p></div>
    <div><h4>Rentals</h4><ul>
      <li><a href="/rentals/">All rental agencies</a></li><li><a href="${selfDriveUrl}">Self-drive cars in Assam</a></li><li><a href="${driverUrl}">Cars with driver</a></li>
      ${BRAND_LIST.slice(0, 3).map(b => `<li><a href="${urlOf(brandPath(b.k))}">${esc(b.name)} cars</a></li>`).join("")}</ul></div>
    <div><h4>Agencies</h4><ul>${AGENCIES.map(a => `<li><a href="${urlOf(agencyPath(a))}">${esc(a.name)}</a></li>`).join("")}<li><a href="/agency/">All agencies</a></li><li><a href="/get-matched/">Get matched</a></li></ul></div>
    <div><h4>For agencies</h4><ul>
      <li><a href="/for-agencies/">Showcase your agency</a></li><li><a href="/for-agencies/#plans">Plans &amp; pricing</a></li>
      <li><a href="/verification/">Verification standards</a></li><li><a href="/onboard.html">Add your rental agency</a></li>
      <li><a href="/terms.html#partners">Partner terms</a></li></ul></div>
    <div><h4>OPIIUS</h4><ul>
      <li><a href="/about/">About us</a></li><li><a href="/verification/">How we verify</a></li>
      <li><a href="${waLink("Hi OPIIUS, I'd like to report a problem with an agency.")}" rel="noopener">Report an agency</a></li>
      <li><a href="${waLink("Hi OPIIUS")}" rel="noopener">WhatsApp ${esc(PHONE)}</a></li><li><a href="/terms.html">Terms &amp; privacy</a></li></ul></div>
  </div>
  <div class="base"><span>© ${YEAR} OPIIUS · Guwahati, Assam</span><span><b>Featured placements are paid and always labelled. Verification is never sold.</b></span></div>
</div></footer>`;
}
function layout({rel, title, desc, active = "", body, og = "/assets/site/media/hills.jpg", jsonld = [], noindex = false, extraHead = ""}) {
  const url = SITE + urlOf(rel);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
<meta name="theme-color" content="#11261f">
<meta property="og:type" content="website">
<meta property="og:site_name" content="OPIIUS">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${og}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="48x48" href="/assets/site/logo/favicon-48.png">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/site/logo/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/site/logo/apple-touch-icon.png">
<link rel="preload" as="image" href="/assets/site/logo/opiius-icon.webp" type="image/webp">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap">
<link rel="stylesheet" href="/assets/site/site.css?v=${ASSET_V}">
<style>/* splash styles live in the page so a stale cached stylesheet can never break it */#splash{display:none}.splash #splash{position:fixed;inset:0;z-index:1000;display:grid!important;place-items:center;background:#f6f7f9;color:#1c3448;animation:spAuto .5s ease 3.2s forwards}#splash.out{animation:spOut .55s cubic-bezier(.22,1,.36,1) forwards}.sp-in{display:flex;flex-direction:column;align-items:center;text-align:center}.sp-medal{width:160px;height:160px;object-fit:contain;filter:drop-shadow(0 22px 30px rgba(28,52,72,.35));opacity:0;transform:scale(.7) rotate(-8deg);animation:spMedal .9s cubic-bezier(.22,1.2,.36,1) .05s forwards,spFloat 3s ease-in-out 1s infinite}@keyframes spMedal{to{opacity:1;transform:none}}@keyframes spFloat{50%{transform:translateY(-6px)}}.sp-wm{height:42px;width:auto;color:#1c3448;margin-top:26px;opacity:0;transform:translateY(10px);animation:spUp .6s ease .45s forwards}.sp-tag{font:400 15px -apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif;letter-spacing:-.01em;color:rgba(28,52,72,.65);margin-top:14px;opacity:0;animation:spUp .6s ease .6s forwards}.sp-bar{width:120px;height:3px;border-radius:3px;background:rgba(28,52,72,.12);margin-top:26px;overflow:hidden;opacity:0;animation:spUp .4s ease .7s forwards}.sp-bar i{display:block;height:100%;width:40%;border-radius:3px;background:#3d6386;animation:spLoad 1.1s ease-in-out .9s infinite}@keyframes spUp{to{opacity:1;transform:none}}@keyframes spLoad{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}@keyframes spOut{to{opacity:0;transform:scale(1.04);visibility:hidden}}@keyframes spAuto{to{opacity:0;visibility:hidden}}@media(prefers-reduced-motion:reduce){.sp-medal,.sp-wm,.sp-tag,.sp-bar{opacity:1;transform:none;animation:none}.sp-bar i{animation:none;width:100%}}</style>
<script>/* OPIIUS splash: first page of each visit only */try{if(!sessionStorage.getItem("op-splash")){document.documentElement.classList.add("splash");sessionStorage.setItem("op-splash","1")}}catch(e){}</script>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}${extraHead}
</head>
<body>
<div id="splash" aria-hidden="true" style="display:none"><div class="sp-in">
  <img class="sp-medal" src="/assets/site/logo/opiius-icon.webp" width="160" height="160" alt="">${WORDMARK.replace('class="wm"', 'class="sp-wm"')}
  <div class="sp-tag">Car rentals · Assam</div><div class="sp-bar"><i></i></div>
</div></div>
${header(active)}
<main id="main">
${body}
</main>
${footer()}
${tabbar()}
<script src="/assets/opiius/config.js?v=${ASSET_V}"></script>
<script src="/assets/site/site.js?v=${ASSET_V}"></script>
<script data-goatcounter="https://opiiusonline.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
</body>
</html>
`;
}

/* ---------- shared blocks ---------- */
function carCard(c, {showAgency = false} = {}) {
  const ph = c.photo ? `<img src="${esc(c.photo)}" alt="${esc(c.sample ? "Sample photo of a " + c.name : c.a.name + "'s " + c.name)}" loading="lazy" decoding="async">${c.sample ? `<span class="badge onph sample" title="Not the agency's own car: a photo of the same model">Sample photo</span>` : ""}`
    : `<div class="nametile"><small>${esc(c.brand)}</small><b>${esc(c.nm)}</b>${c.m.kind === "bike" ? BIKE_LINE : CAR_LINE}</div>`;
  return `<article class="car"><div class="ph">${ph}${c.units > 1 ? `<span class="badge onph">${c.units} in the fleet</span>` : ""}</div>
  <div class="bd"><div class="nm"><small>${esc(c.brand)}</small><h3>${esc(c.nm)}</h3></div>
    ${showAgency ? `<p class="by">By <a href="${urlOf(agencyPath(c.a))}">${esc(c.a.name)}</a></p>` : ""}
    <div class="specs"><span>${c.m.seats} seats</span><span>${esc(c.trans)}</span><span>${esc(c.m.fuel)}</span>${c.year ? `<span>${c.year} model</span>` : ""}</div>
    <div class="ft"><div class="price"><b class="num">${inr(c.price)}</b><span>/ day</span></div><button type="button" class="btn dark sm" data-ask="${c.id}">Check availability</button></div></div></article>`;
}
function fleetBlocks(list, opts) {
  return groupsOf(list).map(x => `<section class="catblock" id="${x.g.id}"><div class="head"><div><span class="eyebrow">${esc(x.g.e)}</span><h2>${esc(x.g.t)}</h2><p>${esc(x.g.d)}</p></div>
    <span class="range num">${inr(minP(x.list))}${maxP(x.list) > minP(x.list) ? "–" + inr(maxP(x.list)) : ""} / day</span></div>
    <div class="grid">${x.list.map(c => carCard(c, opts)).join("")}</div></section>`).join("");
}
function chipsNav(list, extra = []) {
  const gs = groupsOf(list);
  return `<div class="stick"><div class="wrap"><nav class="chips" aria-label="Categories">${gs.map((x, i) => `<a class="chip" href="#${x.g.id}" data-nav="${x.g.id}" aria-current="${i === 0}">${esc(x.g.nav)}<span>${x.list.length}</span></a>`).join("")}${extra.map(([h, t]) => `<a class="chip" href="#${h}" data-nav="${h}" aria-current="false">${t}</a>`).join("")}</nav></div></div>`;
}
function askDialog(list) {
  const data = list.map(c => ({id: c.id, name: c.name, price: c.price, seats: c.m.seats, trans: c.trans, photo: c.photo, agency: c.a.id, agencyName: c.a.name, city: c.a.city}));
  return `<dialog id="ask" aria-labelledby="askT"><form class="sheet form" id="askF" method="dialog" novalidate>
  <button type="button" class="x" aria-label="Close" data-close>×</button>
  <div><h2 id="askT">Check availability</h2><p class="sub">Sent to the agency through OPIIUS · reply on WhatsApp</p></div>
  <div><label for="aCar">Car</label><select id="aCar">${groupsOf(list).map(x => `<optgroup label="${esc(x.g.t)}">${x.list.map(c => `<option value="${c.id}">${esc(c.name)} · ${inr(c.price)}/day${list.some(o => o.a.id !== c.a.id) ? " · " + esc(c.a.name) : ""}</option>`).join("")}</optgroup>`).join("")}</select></div>
  <div class="sel" id="aSel"></div>
  <div class="row2"><div><label for="aFrom">Pickup date</label><input type="date" id="aFrom" required></div><div><label for="aTo">Return date</label><input type="date" id="aTo" required></div></div>
  <div><label for="aWhere">Pickup</label><select id="aWhere"><option>At the agency</option><option>Guwahati Airport (LGBI)</option><option>Guwahati Railway Station</option><option>My hotel or home</option></select></div>
  <div><label for="aName">Your name</label><input id="aName" autocomplete="name" placeholder="Full name" required></div>
  <div class="est"><span id="aDays">Estimate</span><b class="num" id="aEst">—</b></div>
  <p class="fine">Day price × days. The agency confirms the deposit, km limit and pickup point before you book. No booking fee.</p>
  <p class="err" id="aErr" role="alert"></p>
  <button type="submit" class="btn wa block">${I.wa}Send on WhatsApp</button>
</form></dialog>
<script type="application/json" id="fleet-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}
function needOptions(selected) {
  return CATS.map(c => `<optgroup label="${esc(c.name)}">${c.subs.map(s => `<option value="${s.id}"${s.id === selected ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</optgroup>`).join("") + `<option value="other">Something else</option>`;
}
function matchForm(selected, {title = "Tell us what you need", sub = "We'll find a suitable local agency on OPIIUS and reply on WhatsApp, usually the same day.", agency = null} = {}) {
  return `<div class="panel"><h3>${esc(title)}</h3><p>${esc(sub)}</p>
  <form class="form" data-match novalidate style="margin-top:18px">${agency ? `<input type="hidden" name="agency" value="${esc(agency.id)}"><input type="hidden" name="agencyName" value="${esc(agency.name)}">` : ""}
    <div class="row2"><div><label for="mNeed">What do you need?</label><select id="mNeed" name="need">${needOptions(selected)}</select></div>
      <div><label for="mCity">Pickup city</label><select id="mCity" name="city">${CITIES_ASK.map(c => `<option>${c}</option>`).join("")}</select></div></div>
    <div class="row2"><div><label for="mFrom">From <small>(optional)</small></label><input type="date" id="mFrom" name="from"></div><div><label for="mTo">To <small>(optional)</small></label><input type="date" id="mTo" name="to"></div></div>
    <div class="row2"><div><label for="mPeople">People <small>(optional)</small></label><input id="mPeople" name="people" inputmode="numeric" placeholder="e.g. 4 adults, 2 kids"></div><div><label for="mBudget">Budget <small>(optional)</small></label><input id="mBudget" name="budget" placeholder="e.g. ₹15,000"></div></div>
    <div><label for="mName">Your name</label><input id="mName" name="name" autocomplete="name" placeholder="Full name" required></div>
    <div><label for="mMsg">Anything else? <small>(optional)</small></label><textarea id="mMsg" name="msg" placeholder="Type of car, where you're driving to, pickup point…"></textarea></div>
    <p class="err" role="alert"></p>
    <button type="submit" class="btn wa block">${I.wa}Send on WhatsApp</button>
    <p class="fine">Your request opens WhatsApp with these details and a reference number. No booking fee.</p>
  </form></div>`;
}
function agencyBand(title, text) {
  return `<section class="sec tight"><div class="wrap"><div class="band rv"><div><span class="eyebrow">For agencies</span><h2>${title}</h2><p>${text}</p></div>
  <div class="ctas"><a class="btn light" href="/for-agencies/">Showcase your agency</a><a class="btn ghost" href="/for-agencies/#plans">See plans</a></div></div></div></section>`;
}
function faqBlock(items, heading = "Questions, answered") {
  return {html: `<section class="sec mist"><div class="wrap"><div class="sec-h"><div><span class="eyebrow">FAQ</span><h2>${heading}</h2></div></div>
    <div class="faq">${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}</div></div></section>`,
    ld: {"@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map(([q, a]) => ({"@type": "Question", name: q, acceptedAnswer: {"@type": "Answer", text: a.replace(/<[^>]+>/g, "")}}))}};
}
function agencyCard(a) {
  const list = CARS.filter(c => c.a.id === a.id);
  const cover = a.cover ? `/${a.cover}` : (list.find(c => c.photo && !c.sample) || {}).photo;
  return `<a class="acard rv" href="${urlOf(agencyPath(a))}"><div class="ph">${cover ? `<img src="${esc(cover)}" alt="${esc(a.coverAlt || a.name)}" loading="lazy"${a.coverPos ? ` style="object-position:${esc(a.coverPos)}"` : ""}>` : `<div class="nametile"><small>${esc(cityName(a.city))}</small><b>${esc(a.name)}</b>${CAR_LINE}</div>`}${badge(a, "onph")}</div>
  <div class="bd"><h3>${esc(a.name)}</h3><div class="row"><span>${I.car}${esc(list.length && drv(a) ? "Self-drive & with driver" : list.length ? "Self-drive cars" : drv(a) ? "Cars with driver" : SUB[a.category] ? SUB[a.category].name : "Rentals")}</span><span>${I.pin}${esc(cityName(a.city))}</span></div>
  <div class="row"><span>${list.length ? `${plural(list.length, "model")} · ${inr(minP(list))}–${inr(maxP(list))} / day` : drv(a) ? `With driver from ${inr(drvMin(a))}/day` : ""}</span></div>
  <div class="ft"><span>View agency</span>${I.arrow.replace("<svg", '<svg width="18" height="18"')}</div></div></a>`;
}
const joinCard = `<a class="acard join rv" href="/for-agencies/"><span class="eyebrow">Your agency here</span><h3>Run a car rental agency?</h3><p>Showcase your cars to customers who are already searching. Basic listing is free.</p><span class="link">Showcase your agency ${I.arrow.replace("<svg", '<svg width="16" height="16"')}</span></a>`;

/* ======================= pages ======================= */
const sdcCities = liveCities("car");
const allCars = carsOf(c => c.m.kind === "car");
const sdcUrl = sdcCities.length ? urlOf(listingPath("self-drive-cars", sdcCities[0])) : "/rentals/";
/* "Self-drive cars" links open the agency list first; the all-cars page stays one click further */
const selfDriveUrl = "/rentals/#self-drive-cars";

/* ---------- shared page sections ---------- */
/* items: [anchor, label] or [anchor, label, need] — a "need" chip jumps to the request form with that option selected */
const stickyNav = items => `<div class="stick"><div class="wrap"><nav class="chips" aria-label="On this page">${items.map(([h, t, need], i) => `<a class="chip" href="#${h}" data-nav="${h}"${need ? ` data-need="${need}"` : ""} aria-current="${i === 0}">${t}</a>`).join("")}</nav></div></div>`;
const arrow = (n = 18) => I.arrow.replace("<svg", `<svg width="${n}" height="${n}"`);
const howItWorks = (steps, id = "how") => `<section class="sec mist" id="${id}"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">How it works</span><h2>Three steps. No guesswork.</h2></div></div>
  <ol class="steps3">${steps.map(([b, t]) => `<li class="rv"><b>${b}</b><span>${t}</span></li>`).join("")}</ol></div></section>`;
const verifyBand = (kind, noun) => `<section class="sec pine"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">What “Verified” means</span><h2>Checked by us, so you don't have to guess.</h2><p>Before a ${noun} earns the OPIIUS Verified badge, we check these. Badges are re-checked every six months and show the date.</p></div><a class="btn light" href="/verification/">Our verification standards</a></div>
  <ul class="ticks" style="columns:2 280px;column-gap:40px;display:block">${CHECKS[kind].map(t => `<li style="break-inside:avoid;margin-bottom:12px">${I.check.replace("<svg", '<svg style="color:var(--gold)"')}<span>${esc(t)}</span></li>`).join("")}</ul>
  <p style="margin-top:22px;color:rgba(255,255,255,.75)">Featured placements are paid and always labelled. <b style="color:#fff">Verification is never sold.</b></p></div></section>`;
const matchSection = (need, h, p) => `<section class="sec" id="match"><div class="wrap matchbox"><div><span class="eyebrow">Get matched</span><h2 style="font-size:clamp(26px,3.4vw,38px);font-weight:600;margin-top:8px">${h}</h2><p class="muted" style="margin-top:12px;max-width:44ch;font-size:16px">${p}</p>
  <ul class="ticks"><li>${I.check}<span>One request instead of five chats</span></li><li>${I.check}<span>A reply on WhatsApp, with an OPIIUS reference</span></li><li>${I.check}<span>No booking fee</span></li></ul></div>${matchForm(need)}</div></section>`;
const askTile = (s, tone = "") => `<a class="tile rv ${tone}" id="${s.id}" href="#match" data-need="${s.id}"><div><span class="ic">${I[s.icon]}</span><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div><div class="meta"><span>${s.meta || "Ask for this"}</span><span>${arrow()}</span></div></a>`;
const GENERAL_FAQ = [
  ["Is OPIIUS a rental company?", "No. OPIIUS is a marketplace of local rental agencies. You deal with the agency directly and pay them, at their price."],
  ["Do I pay anything to OPIIUS?", "No. Customers pay no booking fee to OPIIUS."],
  ["What does “Verified” mean?", `OPIIUS has checked the agency's business documents, the owner's identity, their vehicles and their location. <a href="/verification/">See our verification standards</a>.`],
  ["What if something goes wrong?", "Tell us on WhatsApp, quoting your OPIIUS reference. We follow up with the agency, and unresolved complaints cost them the Verified badge."]];

/* ---------- brands in the live fleet (for the moving brand line and brand pages) ---------- */
const BRAND_LIST = [...new Set(allCars.map(c => c.m.brand))].map(k => ({k, name: (O.BRANDS[k] || {name: k}).name, cars: allCars.filter(c => c.m.brand === k)}))
  .sort((a, b) => b.cars.length - a.cars.length || a.name.localeCompare(b.name));
const brandPath = k => `rentals/brands/${k}/index.html`;
const brandLogo = b => O.LOGOS[b.k] ? `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${O.LOGOS[b.k]}"/></svg>` : `<span class="wm" aria-hidden="true">${esc(b.name.split(" ")[0])}</span>`;
function brandStrip(heading = "Select from brand", sub = "Tap a brand to see its cars for rent in Assam.") {
  if (!BRAND_LIST.length) return "";
  const item = b => `<a class="brand" href="${urlOf(brandPath(b.k))}">${brandLogo(b)}<span class="bn">${esc(b.name)}</span><span class="bc">${plural(b.cars.length, "car")}</span></a>`;
  const row = BRAND_LIST.map(item).join("");
  return `<section class="brands"><div class="wrap"><div class="brands-h"><div><span class="eyebrow">Rentals</span><h2>${heading}</h2><p style="margin-top:6px">${sub} Swipe or drag to browse.</p></div>
    <div class="bnav"><button type="button" data-bscroll="-1" aria-label="Previous brands">${I.arrow.replace("<svg", '<svg style="transform:rotate(180deg)"')}</button><button type="button" data-bscroll="1" aria-label="Next brands">${I.arrow}</button></div></div></div>
  <div class="marquee" aria-label="Car brands"><div class="track">${row}${row.replace(/<a class="brand"/g, '<a class="brand" aria-hidden="true" tabindex="-1"')}${row.replace(/<a class="brand"/g, '<a class="brand" aria-hidden="true" tabindex="-1"')}${row.replace(/<a class="brand"/g, '<a class="brand" aria-hidden="true" tabindex="-1"')}</div></div></section>`;
}

/* ---------- home: video background, two ways to rent, agencies, moving brand line ----------
   The two cards use OPIIUS's own images, never an agency's photos. */
(function home() {
  const opt = (href, img, pos, ic, h, p, subs, meta, cta) => `<a class="opt2" href="${href}"><div class="ph"><img src="${img}" alt="" loading="eager" style="object-position:${pos}"></div>
    <div class="bd"><div class="top"><span class="ic">${I[ic]}</span>${meta ? `<span class="meta">${meta}</span>` : ""}</div><h2>${h}</h2><p>${p}</p>
    <ul class="subs">${subs.map(t => `<li>${esc(t)}</li>`).join("")}</ul><span class="btn primary block"><span class="lg">${cta}</span><span class="sm">Explore</span> ${arrow()}</span></div></a>`;
  const types = groupsOf(allCars).map(x => x.g.nav);
  const body = `
<section class="vhero">
  <video class="vbg" autoplay muted loop playsinline preload="auto" poster="/assets/site/media/hills.jpg" aria-hidden="true">
    <source src="/assets/site/media/hills.webm" type="video/webm"><source src="/assets/site/media/hills.mp4" type="video/mp4"></video>
  <div class="wrap in">
    <div class="vh"><span class="eyebrow">Car rentals · Assam</span>
      <h1>Rent a car from a trusted local agency.</h1>
      <p class="lede">Real photos, the owner's price and terms upfront. Ask on WhatsApp.</p></div>
    <div class="choose2">
      ${opt(selfDriveUrl, "/assets/opiius/img/home-selfdrive.jpg", "45% 60%", "car", "Self-drive cars", "Choose a local agency, then see its cars, day prices, deposit and km limit before you ask.", types, allCars.length ? `From ${inr(minP(allCars))}/day` : "", "Choose an agency")}
      ${opt(driverUrl, "/assets/opiius/img/home-driver.jpg", "52% 55%", "users", "Cars with driver", "An experienced local driver for the airport, Shillong, Kaziranga or a few days on the road.", ["Airport pickup", "Day trips", "Multi-day trips"], DRV.length ? `From ${inr(Math.min(...DRV.map(drvMin)))}/day` : "", DRV.length ? "See cars with driver" : "Ask for a car with driver")}
    </div>
    <div class="nearwrap"><a class="nearlink" href="/rentals/#near">${I.pin}Find rental agencies near me</a></div>
    <ul class="trust"><li>${I.shield}Verified agencies</li><li>${I.camera}Real photos of every car</li><li>${I.tag}Prices shown upfront</li><li>${I.check}No booking fee</li></ul>
  </div>
</section>
${brandStrip()}
<section class="sec mist"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Agencies</span><h2>Local rental agencies on OPIIUS</h2><p>Open an agency to see its whole fleet, prices and terms.</p></div><a class="btn outline" href="/rentals/">All agencies</a></div>
  <div class="agrid">${AGENCIES.map(agencyCard).join("")}${joinCard}</div>
</div></section>
${howItWorks([["Pick a car", "Real photos, day price, deposit and km limit, from a local agency."], ["Check availability", "Send your dates and pickup point on WhatsApp, with an OPIIUS reference."], ["Pick up and drive", "The agency confirms. You pay them directly. No booking fee."]])}`;
  write("index.html", layout({rel: "index.html", title: "OPIIUS · Rent a car in Assam from trusted local agencies",
    desc: `Self-drive cars and cars with driver in Assam from verified local rental agencies${allCars.length ? `, from ${inr(minP(allCars))}/day` : ""}. Real photos, clear prices, inquiries on WhatsApp.`,
    body, extraHead: '\n<link rel="preload" as="image" href="/assets/site/media/hills.jpg">',
    jsonld: [{"@context": "https://schema.org", "@type": "Organization", name: "OPIIUS", url: SITE + "/", areaServed: "Assam", address: {"@type": "PostalAddress", addressLocality: "Guwahati", addressRegion: "Assam", addressCountry: "IN"}, telephone: "+" + WA}]}));
})();

/* ---------- rentals: types of agencies, then each agency opens its whole fleet ---------- */
function agencyRow(a, kind) {
  const list = CARS.filter(c => c.a.id === a.id && (!kind || c.m.kind === kind)), pol = a.policies || {};
  const cover = a.cover ? `/${a.cover}` : (list.find(c => c.photo && !c.sample) || {}).photo;
  const autos = list.filter(c => /auto/i.test(c.trans)).length;
  const chips = [/agency/i.test(pol.deposit || "") ? "" : /^no /i.test(pol.deposit || "") ? pol.deposit : `${pol.deposit} deposit`, /agency/i.test(pol.km || "") ? "" : (pol.km || "").split(",")[0], a.delivery ? "Delivery available" : "", autos ? "Automatic available" : "", a.travel ? "Meghalaya & Arunachal allowed" : "", drv(a) ? "Cars with driver too" : ""].filter(Boolean);
  return `<a class="arow" href="${urlOf(agencyPath(a))}"><div class="ph" style="position:relative">${cover ? `<img src="${esc(cover)}" alt="${esc(a.coverAlt || a.name)}" loading="lazy"${a.coverPos ? ` style="object-position:${esc(a.coverPos)}"` : ""}>` : `<div class="nametile"><small>${esc(cityName(a.city))}</small><b>${esc(a.name)}</b>${CAR_LINE}</div>`}</div>
  <div class="bd"><div class="badges">${badge(a)}</div><h3>${esc(a.name)}</h3><p class="loc">${I.pin.replace("<svg", '<svg width="16" height="16"')}${esc(a.area ? a.area + ", " : "")}${esc(cityName(a.city))}</p>
    <div class="specs">${chips.map(t => `<span>${esc(t)}</span>`).join("")}</div><p class="fit" hidden></p>
    <div class="ft">${list.length ? `<div class="price"><b class="num">${inr(minP(list))}</b><span>– ${inr(maxP(list))} / day</span></div><span class="btn dark">View all ${list.length} ${kind === "bike" ? "bikes" : "cars"} ${arrow()}</span>` : `<span></span><span class="btn dark">View agency ${arrow()}</span>`}</div></div></a>`;
}
/* each row on /rentals/ sits in a wrapper the filter bar reads: search text, and [price, seats] for every car it offers */
const likeBtn = a => `<button type="button" class="like" data-like="${esc(a.id)}" aria-pressed="false" aria-label="Like ${esc(a.name)}" title="Like">${I.heart}</button>`;
/* where an agency is, for "Near me": its own approximate spot if known, else the centre of its town */
const spot = a => a.lat != null ? [a.lat, a.lon] : [(O.PLACES[a.city] || {}).lat, (O.PLACES[a.city] || {}).lon];
const filterRow = (a, html, cars) => `<div class="arow-w rv" data-town="${esc(a.city)}" data-ll="${spot(a).join(",")}" data-q="${esc([a.name, a.area, cityName(a.city), ...(a.driver && a.driver.areas ? [a.driver.areas] : []), ...CARS.filter(c => c.a.id === a.id).map(c => c.name), ...drvCars(a).map(c => c.name)].filter(Boolean).join(" ").toLowerCase())}" data-cars="${esc(JSON.stringify(cars))}">${html}${likeBtn(a)}</div>`;
/* the same agency in the "Cars with driver" list: its driver rates, linking to the driver section of its page */
function driverRow(a) {
  const d = a.driver, cars = drvCars(a), list = CARS.filter(c => c.a.id === a.id);
  const cover = a.cover ? `/${a.cover}` : (list.find(c => c.photo && !c.sample) || {}).photo;
  const chips = [...cars.slice(0, 4).map(c => c.name + (c.seats ? ` · ${c.seats} seats` : "")), cars.some(c => +c.airport) ? "Airport transfers" : "", cars.some(c => +c.perKm) ? "Outstation trips" : ""].filter(Boolean);
  return `<a class="arow" href="${urlOf(agencyPath(a))}#driver"><div class="ph" style="position:relative">${cover ? `<img src="${esc(cover)}" alt="${esc(a.coverAlt || a.name)}" loading="lazy"${a.coverPos ? ` style="object-position:${esc(a.coverPos)}"` : ""}>` : `<div class="nametile"><small>${esc(cityName(a.city))}</small><b>${esc(a.name)}</b>${CAR_LINE}</div>`}</div>
  <div class="bd"><div class="badges">${badge(a)}</div><h3>${esc(a.name)}</h3><p class="loc">${I.pin.replace("<svg", '<svg width="16" height="16"')}${esc(d.areas || ((a.area ? a.area + ", " : "") + cityName(a.city)))}</p>
    <div class="specs">${chips.map(t => `<span>${esc(t)}</span>`).join("")}</div><p class="fit" hidden></p>
    <div class="ft"><div class="price"><span>From</span> <b class="num">${inr(drvMin(a))}</b><span>/ day with driver</span></div><span class="btn dark">See driver rates ${arrow()}</span></div></div></a>`;
}
/* search, like and filter the agency rows (assets/site/site.js does the filtering) */
function filterBar() {
  const prices = [...allCars.map(c => c.price), ...DRV.flatMap(a => drvCars(a).map(c => +c.local))];
  const seats = [...allCars.map(c => c.m.seats), ...DRV.flatMap(a => drvCars(a).map(c => +c.seats || 0))];
  if (!prices.length) return "";
  const lo = Math.floor(Math.min(...prices) / 500) * 500, hi = Math.ceil(Math.max(...prices) / 500) * 500;
  const steps = []; for (let p = lo; p <= hi; p += 500) steps.push(p);
  const ppl = []; for (let n = 2; n <= Math.max(...seats); n++) ppl.push(n);
  const towns = [...new Set(AGENCIES.map(a => a.city))].filter(t => O.PLACES[t]);
  return `<div class="afilter" role="search" aria-label="Find an agency">
  <div class="fsearch">${I.search}<input type="search" id="fq" placeholder="Search agencies, cars or towns" aria-label="Search agencies, cars or towns" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="fsugg"><ul class="sugg" id="fsugg" role="listbox" aria-label="Suggestions" hidden></ul></div>
  <div class="fgroup"><label for="fmin">Price per day</label><div class="frange"><select id="fmin" aria-label="Lowest price per day"><option value="0">Any</option>${steps.slice(0, -1).map(p => `<option value="${p}">${inr(p)}</option>`).join("")}</select><span>to</span><select id="fmax" aria-label="Highest price per day"><option value="0">Any</option>${steps.slice(1).map(p => `<option value="${p}">${inr(p)}</option>`).join("")}</select></div></div>
  ${towns.length > 1 ? `<div class="fgroup"><label for="ftown">Town</label><select id="ftown"><option value="">All of Assam</option>${towns.map(t => `<option value="${t}">${esc(cityName(t))}</option>`).join("")}</select></div>` : ""}
  <div class="fgroup"><label for="fppl">People going</label><select id="fppl"><option value="0">Any</option>${ppl.map(n => `<option value="${n}">${n} people</option>`).join("")}</select></div>
  <button type="button" class="chip fnear" id="fnear" aria-pressed="false">${I.pin}Near me</button>
  <button type="button" class="chip fliked" id="fliked" aria-pressed="false">${I.heart}Liked<span id="flikedN">0</span></button>
</div>
<p class="fcount" id="fcount" aria-live="polite"></p>
<template id="sugg-icons"><span data-k="a">${I.home}</span><span data-k="c">${I.car}</span><span data-k="b">${I.bike}</span><span data-k="t">${I.pin}</span><span data-k="p">${I.pin}</span></template>
<script type="application/json" id="sugg-data">${JSON.stringify(suggestions()).replace(/</g, "\\u003c")}</script>`;
}
/* places people may search for, with approximate map positions, so a search for a town with no agency can show the nearest ones */
const SEARCH_PLACES = [
  ["Beltola", "Guwahati", 26.118, 91.796],
  ["Dispur", "Guwahati", 26.143, 91.790],
  ["Ganeshguri", "Guwahati", 26.149, 91.785],
  ["Six Mile", "Guwahati", 26.137, 91.806],
  ["Khanapara", "Guwahati", 26.125, 91.826],
  ["Zoo Road", "Guwahati", 26.163, 91.776],
  ["Chandmari", "Guwahati", 26.183, 91.770],
  ["Paltan Bazaar", "Guwahati", 26.180, 91.752],
  ["Pan Bazaar", "Guwahati", 26.187, 91.744],
  ["Fancy Bazaar", "Guwahati", 26.184, 91.740],
  ["Ulubari", "Guwahati", 26.170, 91.763],
  ["Christian Basti", "Guwahati", 26.157, 91.773],
  ["Bhangagarh", "Guwahati", 26.167, 91.768],
  ["Maligaon", "Guwahati", 26.162, 91.698],
  ["Jalukbari", "Guwahati", 26.155, 91.664],
  ["Adabari", "Guwahati", 26.168, 91.700],
  ["Hatigaon", "Guwahati", 26.128, 91.797],
  ["Basistha", "Guwahati", 26.107, 91.796],
  ["Lokhra", "Guwahati", 26.112, 91.756],
  ["Kahilipara", "Guwahati", 26.137, 91.774],
  ["Narengi", "Guwahati", 26.183, 91.828],
  ["Noonmati", "Guwahati", 26.192, 91.800],
  ["Geetanagar", "Guwahati", 26.172, 91.797],
  ["Panjabari", "Guwahati", 26.143, 91.835],
  ["Rukmini Gaon", "Guwahati", 26.136, 91.790],
  ["Jorabat", "Guwahati", 26.110, 91.890],
  ["Azara", "Guwahati", 26.115, 91.610],
  ["Guwahati Airport (LGBI)", "Borjhar", 26.106, 91.586],
  ["Guwahati Railway Station", "Paltan Bazaar", 26.182, 91.751],
  ["Amingaon", "North Guwahati", 26.190, 91.675],
  ["Sonapur", "Kamrup Metro", 26.100, 91.980],
  ["Nalbari", "Assam", 26.444, 91.440],
  ["Rangia", "Assam", 26.449, 91.616],
  ["Tamulpur", "Assam", 26.646, 91.573],
  ["Pathsala", "Assam", 26.505, 91.180],
  ["Barpeta", "Assam", 26.323, 91.006],
  ["Barpeta Road", "Assam", 26.503, 90.970],
  ["Bongaigaon", "Assam", 26.477, 90.558],
  ["Abhayapuri", "Assam", 26.320, 90.680],
  ["Kokrajhar", "Assam", 26.401, 90.272],
  ["Dhubri", "Assam", 26.022, 89.978],
  ["Goalpara", "Assam", 26.176, 90.626],
  ["Dudhnoi", "Assam", 25.980, 90.760],
  ["Boko", "Assam", 25.980, 91.230],
  ["Chaygaon", "Assam", 26.050, 91.380],
  ["Palasbari", "Assam", 26.120, 91.540],
  ["Hajo", "Assam", 26.245, 91.527],
  ["Sualkuchi", "Assam", 26.170, 91.570],
  ["Mangaldoi", "Assam", 26.443, 92.031],
  ["Udalguri", "Assam", 26.750, 92.100],
  ["Tezpur", "Assam", 26.633, 92.800],
  ["Biswanath Chariali", "Assam", 26.727, 93.150],
  ["Nagaon", "Assam", 26.350, 92.684],
  ["Morigaon", "Assam", 26.252, 92.342],
  ["Hojai", "Assam", 26.002, 92.857],
  ["Kaziranga", "Assam", 26.582, 93.410],
  ["Golaghat", "Assam", 26.519, 93.961],
  ["Jorhat", "Assam", 26.757, 94.203],
  ["Sivasagar", "Assam", 26.983, 94.637],
  ["North Lakhimpur", "Assam", 27.236, 94.104],
  ["Dhemaji", "Assam", 27.482, 94.580],
  ["Dibrugarh", "Assam", 27.472, 94.912],
  ["Tinsukia", "Assam", 27.489, 95.360],
  ["Diphu", "Assam", 25.843, 93.431],
  ["Haflong", "Assam", 25.164, 93.017],
  ["Silchar", "Assam", 24.833, 92.778],
  ["Karimganj", "Assam", 24.869, 92.355],
  ["Hailakandi", "Assam", 24.684, 92.561],
  ["Shillong", "Meghalaya", 25.578, 91.893],
  ["Tura", "Meghalaya", 25.514, 90.220],
  ["Itanagar", "Arunachal Pradesh", 27.084, 93.605],
  ["Tawang", "Arunachal Pradesh", 27.586, 91.869]
];
/* search suggestions: agencies (open the page), cars (filter to agencies that have one), towns (pick the town) */
function suggestions() {
  const out = AGENCIES.map(a => {const n = CARS.filter(c => c.a.id === a.id).length;
    return {k: "a", n: a.name, s: [a.area, cityName(a.city)].filter(Boolean).join(", ") + (n ? ` · ${plural(n, "vehicle")}` : ""), u: urlOf(agencyPath(a))};});
  const byModel = {};
  for (const c of CARS) (byModel[c.name] = byModel[c.name] || []).push(c);
  for (const [name, list] of Object.entries(byModel)) {
    const ags = new Set(list.map(c => c.a.id)).size;
    out.push({k: list[0].m.kind === "bike" ? "b" : "c", n: name, s: `${plural(ags, "agency", "agencies")} · from ${inr(minP(list))}/day`});
  }
  for (const t of [...new Set(AGENCIES.map(a => a.city))].filter(t => O.PLACES[t])) {
    const n = AGENCIES.filter(a => a.city === t).length;
    out.push({k: "t", n: cityName(t), v: t, s: plural(n, "agency", "agencies")});
  }
  const towns = new Set(AGENCIES.map(a => cityName(a.city)));
  for (const [n, r, la, lo] of SEARCH_PLACES) if (!towns.has(n)) out.push({k: "p", n, s: r, ll: [la, lo]});
  return out;
}
(function rentals() {
  const cat = CATS[0];
  const typeAgencies = s => s.id === "cars-with-driver" ? AGENCIES.filter(a => drv(a) || a.category === s.id)
    : AGENCIES.filter(a => s.kind ? CARS.some(c => c.a.id === a.id && c.m.kind === s.kind) : a.category === s.id);
  const faq = faqBlock([
    ["How do I book a car?", "Open an agency, pick a car and tap “Check availability”. Choose your dates and send it on WhatsApp; the agency confirms before you pay them directly."],
    ["What do I need to rent a self-drive car?", "Your original driving licence and a photo ID. Each agency's page lists exactly what it needs."],
    ["Is there a deposit and a km limit?", "Usually, yes. Each agency's page shows its deposit and km limit before you ask."],
    ["Can I take the car to Meghalaya or Arunachal?", "Check the “Out of state” line on the agency's page. Arunachal needs an Inner Line Permit."],
    ...GENERAL_FAQ]);
  const sections = cat.subs.map(s => {
    const ags = typeAgencies(s);
    return `<section class="atype" id="${s.id}"><div class="atype-h"><span class="ic">${I[s.icon]}</span><div><h2>${esc(s.name)}</h2><p>${esc(s.desc)}</p></div></div>
      ${ags.length ? `<div class="arows">${ags.map(a => s.id === "cars-with-driver" && drv(a)
          ? filterRow(a, driverRow(a), drvCars(a).map(c => [+c.local, +c.seats || 0]))
          : filterRow(a, agencyRow(a, s.kind), CARS.filter(c => c.a.id === a.id && (!s.kind || c.m.kind === s.kind)).map(c => [c.price, c.m.seats]))).join("")}</div>
        <div class="aempty anone" hidden><p>No agency here matches your filters.</p><button type="button" class="btn outline" data-fclear>Clear filters</button></div>
        ${s.kind && subLive(s).length > 1 ? `<p class="aall"><a class="link" href="${urlOf(listingPath(s.id, liveCities(s.kind)[0]))}">Or compare all ${subLive(s).length} ${s.kind === "car" ? "cars" : "vehicles"} side by side ${arrow(16)}</a></p>` : ""}`
        : `<div class="aempty"><p>Tell us your dates and where you're going, and we'll find a local agency for you.</p><a class="btn outline" href="#match" data-need="${s.id}">Ask for ${esc(s.name.toLowerCase())}</a></div>`}</section>`;
  }).join("");
  const body = `
<section class="hero slim"><div class="bg" style="background-image:url(/assets/opiius/img/cat-suv.jpg);background-position:60% 55%" aria-hidden="true"></div><div class="wrap in">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Rentals</span></nav>
  <span class="eyebrow">Rentals · Assam</span>
  <h1>Choose a rental agency</h1>
  <p class="lede">Pick the type of rental, then open an agency to see its whole fleet, prices and terms.</p>
</div></section>
${stickyNav([...cat.subs.map(s => typeAgencies(s).length ? [s.id, s.name] : ["match", s.name, s.id]), ["how", "How it works"], ["faq", "FAQ"]])}
<div class="wrap">${filterBar()}${sections}</div>
${brandStrip("Or select from brand", "See every car of a brand across agencies.")}
${howItWorks([["Choose an agency", "Each agency shows its verified badge, terms and price range."], ["Pick a car from its fleet", "Real photos, gearbox, model year and day price. Tap “Check availability”."], ["Confirm on WhatsApp", "The agency confirms the car and pickup. You pay them directly. No booking fee."]])}
<div id="faq">${faq.html}</div>
${matchSection("cars-with-driver", "Need something else?", "Need a car with driver, or a car that isn't listed? Tell us the dates and where you're going, and we'll find a local agency.")}
${agencyBand("Run a rental agency?", "Showcase your cars to customers searching for rentals in Assam: a full profile, real photos, day prices and inquiries with dates. Basic listing is free.")}`;
  write("rentals/index.html", layout({rel: "rentals/index.html", title: "Car rentals in Assam · Choose a verified local agency | OPIIUS", active: "rentals",
    desc: `Rent a car in Assam from verified local agencies${allCars.length ? `: ${plural(allCars.length, "car")} from ${inr(minP(allCars))}/day` : ""}. Open an agency to see its whole fleet, prices and terms.`,
    body, og: "/assets/opiius/img/cat-suv.jpg", jsonld: [faq.ld]}));
})();

/* ---------- brand pages ---------- */
for (const b of BRAND_LIST) {
  const rel = brandPath(b.k), list = b.cars;
  const body = `
<section class="plain-hero"><div class="wrap in">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/rentals/">Rentals</a><span>/</span><span>${esc(b.name)}</span></nav>
  <div class="bhead"><span class="blogo">${brandLogo(b)}</span><div><span class="eyebrow">${plural(list.length, "car")} · from ${inr(minP(list))}/day</span>
  <h1>${esc(b.name)} cars for rent in Assam</h1></div></div>
  <p class="lede">Every ${esc(b.name)} on OPIIUS, from verified local agencies. Tap a car to check availability on WhatsApp.</p>
</div></section>
<div class="wrap">${fleetBlocks(list, {showAgency: true})}</div>
${brandStrip("Other brands", "See every car of a brand across agencies.")}
${askDialog(list)}`;
  write(rel, layout({rel, title: `${b.name} cars for rent in Assam from ${inr(minP(list))}/day · OPIIUS`, active: "rentals",
    desc: `Rent a ${b.name} in Assam: ${list.map(c => c.nm).join(", ")}. Real photos, day prices from ${inr(minP(list))}, availability on WhatsApp.`, body}));
}

/* ---------- tours: retired (OPIIUS is rentals only); old links go to Rentals ---------- */
const redirectTo = (rel, to, title) => write(rel, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} · OPIIUS</title><link rel="canonical" href="${SITE}${to}"><meta http-equiv="refresh" content="0; url=${to}"><meta name="robots" content="noindex"></head><body><p><a href="${to}">Car rentals on OPIIUS</a></p></body></html>\n`);
redirectTo("tours/index.html", "/rentals/", "Car rentals");

/* ---------- self-drive listing per city ---------- */
for (const kind of ["car", "bike"]) for (const city of liveCities(kind)) {
  const sub = kind === "car" ? SUB["self-drive-cars"] : SUB.bikes;
  const list = carsOf(c => c.m.kind === kind && c.a.city === city);
  const ags = [...new Set(list.map(c => c.a.id))].map(id => AGENCIES.find(a => a.id === id));
  const rel = listingPath(sub.id, city), cn = cityName(city);
  const faq = faqBlock(kind === "car" ? [
    ["What do I need to rent a self-drive car?", "Your original driving licence and a government photo ID. The agency checks both at pickup."],
    ["Is there a security deposit?", "Most agencies take a refundable deposit. Each agency confirms the amount with your quote, before you book."],
    ["Is there a km limit?", "It depends on the agency and the car. The km limit is confirmed with your quote."],
    ["Can I pick up at the airport or railway station?", "Choose your pickup point when you check availability. The agency confirms whether they can deliver there."],
    ["Do I pay OPIIUS?", "No. You pay the agency directly, at the price shown. OPIIUS adds no booking fee."]] : [
    ["What do I need to rent a bike?", "Your original driving licence and a government photo ID."]]);
  const body = `
<section class="plain-hero"><div class="wrap in">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/rentals/">Rentals</a><span>/</span><span>${esc(sub.name)} in ${esc(cn)}</span></nav>
  <span class="eyebrow">${plural(list.length, kind === "car" ? "car" : "bike")} · ${plural(ags.length, "agency", "agencies")} · from ${inr(minP(list))}/day</span>
  <h1>${esc(sub.name)} in ${esc(cn)}</h1>
  <p class="lede">${kind === "car" ? "City hatchbacks, compact SUVs and 7-seaters from local agencies. Every car shows a real photo or its model, the day price and the agency behind it. Pick one and check availability on WhatsApp." : "Scooters and motorcycles from local agencies, with day prices upfront."}</p>
  <div class="ctas"><button type="button" class="btn primary" data-ask="">Check availability</button><a class="btn outline" href="#guide">Before you rent</a></div>
</div></section>
${chipsNav(list, [["guide", "Before you rent"]])}
<div class="wrap">${fleetBlocks(list, {showAgency: true})}</div>
<section class="sec" id="guide"><div class="wrap two">
  <div class="panel"><h2>Before you rent</h2><p>What to check so the trip is easy, whichever agency you choose.</p>
    <div class="kv"><div><span>Documents</span><span>Original driving licence and a government photo ID</span></div><div><span>Deposit</span><span>Ask the amount and how fast it's returned</span></div>
    <div><span>Km limit</span><span>Check the daily km and the charge per extra km</span></div><div><span>Fuel</span><span>Usually returned at the same level as pickup</span></div>
    <div><span>At pickup</span><span>Take photos of every side of the car, and the fuel and km readings</span></div><div><span>Out of state</span><span>Planning Meghalaya or Arunachal? Tell the agency when you ask</span></div></div></div>
  <div class="panel"><h2>Agencies here</h2><p>Each agency sets its own prices and terms.</p>
    <div class="kv">${ags.map(a => `<div><span><a href="${urlOf(agencyPath(a))}" style="font-weight:600;color:var(--ink)">${esc(a.name)}</a></span><span>${badge(a)}</span></div>`).join("")}</div>
    <div class="ctas"><a class="btn outline" href="/for-agencies/">List your agency here</a></div></div>
</div></section>
${faq.html}
<section class="sec" id="match"><div class="wrap matchbox"><div><span class="eyebrow">Get matched</span><h2 style="font-size:clamp(26px,3.4vw,38px);font-weight:600;margin-top:8px">Didn't find the right car?</h2><p class="muted" style="margin-top:12px">Tell us the dates and the kind of car. We'll check with local agencies and reply on WhatsApp.</p></div>${matchForm(sub.id)}</div></section>
${askDialog(list)}`;
  write(rel, layout({rel, title: `${sub.name} in ${cn} from ${inr(minP(list))}/day · OPIIUS`, active: "rentals",
    desc: `Compare ${plural(list.length, kind === "car" ? "self-drive car" : "bike")} in ${cn} from local agencies: real photos, day prices from ${inr(minP(list))}, inquiries on WhatsApp.`,
    body, og: (list.find(c => c.photo && !c.sample) || {}).photo || undefined, jsonld: [faq.ld]}));
}

/* ---------- agency profiles ---------- */
for (const a of AGENCIES) {
  const rel = agencyPath(a), list = CARS.filter(c => c.a.id === a.id), gs = groupsOf(list);
  const cover = a.cover ? "/" + a.cover : (list.find(c => c.photo && !c.sample) || {}).photo || "";
  const pol = a.policies || {}, dcars = drvCars(a), d = a.driver || {};
  const maxSeats = Math.max(0, ...list.map(c => c.m.seats), ...dcars.map(c => +c.seats || 0));
  const lowest = list.length ? minP(list) : dcars.length ? drvMin(a) : 0;
  const verifyPanel = `<div class="panel"><h2>Verification</h2>${a.verified
      ? `<p>OPIIUS checked this agency${a.verifiedOn ? " in " + esc(a.verifiedOn) : ""}.</p><ul class="ticks">${CHECKS.rentals.map(t => `<li>${I.check}<span>${esc(t)}</span></li>`).join("")}</ul>`
      : `<p>${a.founding ? `${esc(a.name)} is a founding partner on OPIIUS. ` : ""}The Verified badge is added after OPIIUS checks the permit, insurance, fleet and owner ID. <a class="link" href="/verification/">What we check</a></p>`}
      <p style="margin-top:14px"><a class="link" href="${waLink(`Hi OPIIUS, I'd like to report a problem with ${a.name}.`)}" rel="noopener">${I.flag.replace("<svg", '<svg width="16" height="16"')}Report a problem with this agency</a></p></div>`;
  const driverSec = dcars.length ? `
<section class="sec" id="driver"><div class="wrap two">
  <div class="panel"><span class="eyebrow">Cars with driver</span><h2 style="margin-top:6px">Driver rates</h2><p>${esc(a.name)} ${list.length ? "also sends" : "sends"} cars with an experienced local driver. Rates set by the agency; you pay them directly. OPIIUS adds no booking fee.</p>
    <table class="plist"><tbody><tr><th>Car</th><th>Per day</th></tr>${dcars.map(c => `<tr><td>${esc(c.name)}<small>${[c.seats ? c.seats + " seats" : "", +c.perKm ? `outstation ${inr(+c.perKm)}/km` : "", +c.airport ? `airport ${inr(+c.airport)}` : ""].filter(Boolean).join(" · ")}</small></td><td>${inr(+c.local)}/day</td></tr>`).join("")}</tbody></table>
    <div class="kv" style="margin-top:18px">
      <div><span>Local day</span><span>In the city, usually 8 hours / 80 km. The agency confirms the exact limit.</span></div>
      ${d.allowance ? `<div><span>Driver allowance</span><span>${esc(d.allowance)}</span></div>` : ""}
      ${d.areas ? `<div><span>Goes to</span><span>${esc(d.areas)}</span></div>` : ""}
      ${d.note ? `<div><span>Note</span><span>${esc(d.note)}</span></div>` : ""}</div></div>
  ${matchForm("cars-with-driver", {title: `Ask ${a.name} for a car with driver`, sub: `Share your dates and route. ${a.name} replies on WhatsApp, through OPIIUS.`, agency: a})}
</div></section>` : "";
  const body = `
<section class="hero"><div class="bg" style="background-image:url(/assets/opiius/img/hero.jpg);background-position:50% 60%" aria-hidden="true"></div>
  <div class="wrap in" style="padding-top:64px">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/agency/">Agencies</a><span>/</span><span>${esc(a.name)}</span></nav>
    <div class="ahead"><span class="mono" aria-hidden="true">${esc(initials(a.name))}</span>${badge(a)}</div>
    <h1 style="max-width:14ch">${esc(a.name)}</h1>
    <p class="lede">${esc(a.about)}</p>
    <div class="ctas">${list.length ? `<a class="btn light" href="#${gs[0].g.id}">See the fleet</a><button type="button" class="btn ghost" data-ask="">Check availability</button>${dcars.length ? `<a class="btn ghost" href="#driver">Cars with driver</a>` : ""}`
      : `<a class="btn light" href="#driver">See driver rates</a>`}<button type="button" class="btn ghost like-btn" data-like="${esc(a.id)}" aria-pressed="false">${I.heart}<span class="l0">Like</span><span class="l1">Liked</span></button></div>
    <div class="facts"><div><b class="num">${list.length || dcars.length}</b><span>${list.length ? (list.length === 1 ? "model" : "models") : (dcars.length === 1 ? "car with driver" : "cars with driver")}</span></div><div><b class="num">${inr(lowest)}</b><span>${list.length ? "lowest day price" : "lowest day rate"}</span></div>${maxSeats ? `<div><b class="num">${maxSeats}</b><span>seats, largest</span></div>` : ""}<div><b>${esc(cityName(a.city))}</b><span>pickup city</span></div></div>
  </div></section>
${chipsNav(list, [...(dcars.length ? [["driver", "Cars with driver"]] : []), ["info", list.length ? "Price list & terms" : "Verification"]])}
<div class="wrap">${fleetBlocks(list)}</div>${driverSec}
${list.length ? `<section class="sec mist" id="info" style="margin-top:72px"><div class="wrap two">
  <div class="panel"><h2>Price list</h2><p>Day prices set by ${esc(a.name)}. You pay the agency directly, at these prices. OPIIUS adds no booking fee.</p>
    <table class="plist"><tbody>${gs.map(x => `<tr><th colspan="2">${esc(x.g.t)}</th></tr>${x.list.map(c => `<tr><td>${esc(c.name)}<small>${c.m.seats} seats · ${esc(c.trans)}${c.units > 1 ? " · " + c.units + " cars" : ""}</small></td><td>${inr(c.price)}/day</td></tr>`).join("")}`).join("")}</tbody></table>
    <button type="button" class="btn outline sm no-print" style="margin-top:20px" onclick="window.print()">Print or save as PDF</button></div>
  <div style="display:grid;gap:20px">
    <div class="panel"><h2>Terms</h2><div class="kv">
      <div><span>Bring at pickup</span><span>${esc(pol.docs || "Original driving licence and a government photo ID")}</span></div>
      <div><span>Fuel</span><span>${esc(pol.fuel === "Same level as pick-up" ? "Return at the same level as pickup" : pol.fuel || "")}</span></div>
      <div><span>Deposit</span><span>${esc(/agency/i.test(pol.deposit || "") ? "Confirmed with your quote" : pol.deposit)}</span></div>
      <div><span>Km limit</span><span>${esc(/agency/i.test(pol.km || "") ? "Confirmed with your quote" : pol.km)}</span></div>
      <div><span>Cancellation</span><span>${esc(/agency/i.test(pol.cancel || "") ? "Confirmed with your quote" : pol.cancel)}</span></div>
      <div><span>Pickup</span><span>${esc((a.pickups || []).join(", "))}</span></div>
      ${a.deliveryNote ? `<div><span>Delivery</span><span>${esc(a.deliveryNote)}</span></div>` : ""}
      ${a.travel ? `<div><span>Out of state</span><span>${esc(a.travel)}</span></div>` : ""}</div></div>
    ${verifyPanel}
  </div>
</div></section>
<section class="sec"><div class="wrap" style="text-align:center;max-width:720px">
  <h2 style="font-size:clamp(28px,4.4vw,44px);font-weight:600">Know your dates? Check a car now.</h2>
  <p class="muted" style="margin-top:12px;font-size:16px">Tell us the car, the dates and where you'd like to pick it up. ${esc(a.name)} replies on WhatsApp.</p>
  <div class="ctas" style="justify-content:center"><button type="button" class="btn dark" data-ask="">Check availability</button></div>
</div></section>
${askDialog(list)}` : `<section class="sec mist" id="info"><div class="wrap" style="max-width:720px">${verifyPanel}</div></section>`}`;
  const what = list.length && dcars.length ? "Self-drive cars and cars with driver" : list.length ? "Self-drive cars" : "Cars with driver";
  const allPrices = [...list.map(c => c.price), ...dcars.map(c => +c.local)];
  write(rel, layout({rel, title: `${a.name} · ${what} in ${cityName(a.city)}${lowest ? ` from ${inr(lowest)}/day` : ""} | OPIIUS`, active: "rentals",
    desc: list.length ? `${a.name}: ${plural(list.length, "car model")} in ${cityName(a.city)}, from ${inr(minP(list))}/day${dcars.length ? ", plus cars with driver" : ""}. See the full fleet, day prices and terms, then check availability on WhatsApp.`
      : `${a.name}: cars with driver in ${cityName(a.city)}${lowest ? `, from ${inr(lowest)}/day` : ""}. See the driver rates and ask on WhatsApp.`,
    body, og: cover || undefined, jsonld: [{"@context": "https://schema.org", "@type": "AutoRental", name: a.name, url: SITE + urlOf(rel), image: cover ? SITE + cover : undefined, priceRange: allPrices.length ? `${inr(Math.min(...allPrices))}–${inr(Math.max(...allPrices))} per day` : undefined, address: {"@type": "PostalAddress", addressLocality: cityName(a.city), addressRegion: (O.PLACES[a.city] || {}).state, addressCountry: "IN"}}]}));
}

/* ---------- agencies index ---------- */
write("agency/index.html", layout({rel: "agency/index.html", title: "Rental agencies on OPIIUS · Self-drive cars and cars with driver in Assam", active: "",
  desc: "Local car rental agencies on OPIIUS: profiles with real photos, day prices and terms.",
  body: `<section class="plain-hero"><div class="wrap in"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Agencies</span></nav>
  <span class="eyebrow">${plural(AGENCIES.length, "agency", "agencies")} on OPIIUS</span><h1>Local rental agencies on OPIIUS</h1>
  <p class="lede">Every profile shows real photos, prices and terms. The Verified badge appears once OPIIUS has checked an agency's documents, owner and fleet.</p></div></section>
  <section class="sec"><div class="wrap"><div class="agrid">${AGENCIES.map(agencyCard).join("")}${joinCard}</div></div></section>
  ${agencyBand("Want your agency listed here?", "Basic listing is free. Upgrade for the Verified badge, priority placement and a monthly inquiry report.")}`}));

/* ---------- for agencies ---------- */
(function forAgencies() {
  const plans = [
    {n: "Basic", p: "Free", per: "", for: "Get listed and start receiving inquiries.", pts: ["Basic profile: name, category, area", "Your fleet with day prices", "3 photos", "Inquiries through the OPIIUS form"], cta: ["Start free", "outline"]},
    {n: "Verified", p: "₹999", per: "/month", for: "Show customers you're a checked business.", pts: ["Verified badge, after checks pass", "Full agency profile", "Full fleet page with terms", "15 photos", "WhatsApp and call buttons", "Placed above unverified listings", "Monthly inquiry count"], cta: ["Get Verified", "outline"]},
    {n: "Growth", p: "₹3,000", per: "/month", hot: true, for: "Everything you need to win more inquiries.", pts: ["Verified badge", "Full agency profile", "Priority placement in your category and city", "Fleet and service pages, written by us", "WhatsApp and call buttons", "Customer inquiry form", "40 photos and service showcase", "Reviews and testimonials", "Offer and promotion section", "Monthly inquiry report"], cta: ["Choose Growth", "primary"]},
    {n: "Featured Partner", p: "₹5,000", per: "/month", for: "The top slot, for agencies ready to lead their category.", pts: ["Everything in Growth", "Top slot in your category and city, labelled Featured", "Homepage feature rotation", "Extra pages for cars with driver and outstation trips", "3 offers and a seasonal campaign", "Monthly review call"], cta: ["Apply for Featured", "outline"]}];
  const faq = faqBlock([
    ["Do you guarantee a number of customers?", "No. OPIIUS puts your agency on pages customers use to compare local providers, and sends you every inquiry with the car, dates and pickup point. Your monthly report shows exactly what came in."],
    ["Do you take a commission on bookings?", "No. You pay a flat monthly fee (or nothing on Basic) and keep 100% of every booking."],
    ["Can I buy the Verified badge?", "No. The Verified fee covers our checks. If your business doesn't pass, you get a full refund. Featured placement is paid and always labelled; verification is earned."],
    ["Is there a contract?", "No. Plans are month to month. Cancel any month. We give 30 days' notice before any change to fees."],
    ["What do I need to send?", `Your agency details, prices and terms, and 2–3 clear daylight photos of each vehicle. Use the <a href="/onboard.html">agency form</a>, or send everything on WhatsApp.`],
    ["We also send cars with driver. Can we list that?", `Yes. Tick “We also provide cars with driver” in the <a href="/onboard.html">agency form</a> and add each car with its local day rate, outstation per-km rate and airport transfer price. Agencies that only run cars with driver can join too.`],
    ["Who receives customer inquiries?", "Inquiries arrive on the OPIIUS WhatsApp with an OPIIUS reference and are passed to you straight away. Your phone number is not published unless your plan includes call and WhatsApp buttons."]]);
  const body = `
<section class="hero"><div class="bg" style="background-image:url(/assets/opiius/img/hero.jpg);background-position:50% 60%" aria-hidden="true"></div><div class="wrap in">
  <span class="eyebrow">For car rental agencies</span>
  <h1>Get discovered by customers who are already searching.</h1>
  <p class="lede">Showcase your agency on high-intent pages, earn the Verified badge customers trust, and receive inquiries with the car, dates and pickup point. Every month you get a report of every inquiry we sent you.</p>
  <div class="ctas"><a class="btn light" href="#join">List your agency free</a><a class="btn ghost" href="${waLink("Hi OPIIUS, I run an agency and I'd like a 15-minute call about listing on OPIIUS.")}" rel="noopener">${I.wa}Book a 15-min call</a></div>
  <ul class="trust"><li>${I.check}No commission</li><li>${I.check}No contract</li><li>${I.check}Cancel any month</li></ul>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Who it's for</span><h2>Built for local rental agencies in Assam</h2></div></div>
  <div class="tiles">${[["car", "Self-drive car rentals", "Hatchbacks, SUVs and 7-seaters you rent by the day.", ""], ["users", "Cars with driver", "Taxis and chauffeur-driven cars for airport runs and trips.", "t2"], ["bike", "Bike & scooter rentals", "Scooters to Royal Enfields.", "t5"]].map(([ic, t, p, tone]) => `<div class="tile rv ${tone}" style="min-height:170px"><div><span class="ic">${I[ic]}</span><h3>${t}</h3><p>${p}</p></div></div>`).join("")}</div>
</div></section>

<section class="sec mist"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">What you get</span><h2>More visibility, more trust, more inquiries</h2></div></div>
  <div class="agrid">${[["eye", "Visibility", "Appear on the category and city pages customers use to compare providers, like self-drive cars in Guwahati or Barama."], ["shield", "A trust badge", "The OPIIUS Verified badge tells customers you're a real, checked business before they even call."], ["camera", "A professional showcase", "A full profile with your photos, fleet and prices that you can share on Instagram, WhatsApp and Google."], ["chat", "Ready-to-book inquiries", "Inquiries arrive with the car, dates and pickup point, so you spend less time answering “price?”."], ["chart", "A monthly inquiry report", "See every inquiry, with its reference, so you always know what you're paying for."], ["award", "Priority placement", "Growth and Featured partners appear above free listings. Featured slots are limited per category."]].map(([ic, t, p]) => `<div class="panel rv"><span style="display:inline-grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--brand-soft);color:var(--brand)">${I[ic].replace("<svg", '<svg width="24" height="24"')}</span><h3 style="margin-top:16px;font-size:20px">${t}</h3><p>${p}</p></div>`).join("")}</div>
</div></section>

<section class="sec" id="plans"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Plans &amp; pricing</span><h2>Start free. Upgrade when you're ready.</h2><p>Flat monthly plans. No commission on bookings, no contract.</p></div></div>
  <div class="plans">${plans.map(x => `<div class="plan ${x.hot ? "hot" : ""} rv">${x.hot ? '<span class="tag">Most popular</span>' : ""}<h3>${x.n}</h3><p class="for">${x.for}</p>
    <div class="pr"><b class="num">${x.p}</b><span>${x.per}</span></div><ul>${x.pts.map(t => `<li>${I.check}<span>${t}</span></li>`).join("")}</ul>
    <a class="btn ${x.cta[1]} block" href="${x.n === "Basic" ? "#join" : waLink(`Hi OPIIUS, I'd like the ${x.n} plan (${x.p}${x.per}) for my agency.`)}"${x.n === "Basic" ? "" : ' rel="noopener"'}>${x.cta[0]}</a></div>`).join("")}</div>
  <div class="rules3"><div><b>Verification is never sold</b>The Verified fee covers our checks. If you don't pass, you get a full refund.</div><div><b>Featured is limited and labelled</b>At most 3 Featured agencies per category per city, always marked Featured.</div><div><b>No commission, no contract</b>Keep 100% of every booking. Cancel any month.</div></div>
</div></section>

<section class="sec pine"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Why a monthly plan pays for itself</span><h2>One extra booking covers the month.</h2><p>A 3-day Innova rental or a week-long SUV booking is worth far more than ₹3,000, which is about ₹100 a day.</p></div></div>
  <div class="checks">${[["tag", "No commission", "Booking apps take a cut of every booking. OPIIUS is a flat fee and you keep 100%."], ["chart", "Proof every month", "Your inquiry report shows what came in. If the numbers don't work for you, don't renew."], ["award", "Assets you keep", "A professional profile, a fleet page and a badge you can share."], ["eye", "Pages that rank", "One agency can't rank for every search. A marketplace category page can, and you're on it."]].map(([ic, b, s]) => `<div class="check rv">${I[ic]}<b>${b}</b><span>${s}</span></div>`).join("")}</div>
</div></section>

<section class="sec" id="join"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">How to join</span><h2>Live on OPIIUS in three steps</h2></div></div>
  <ol class="steps3"><li class="rv"><b>Send your details</b><span>Fill the form for your agency type, or send everything on WhatsApp: details, prices, terms and 2–3 daylight photos per vehicle.</span></li>
    <li class="rv"><b>We set up your profile</b><span>We check your details with you, build your profile and fleet page, and schedule your verification.</span></li>
    <li class="rv"><b>Customers find you</b><span>Your profile goes live. Inquiries reach you with an OPIIUS reference, and you get a monthly report.</span></li></ol>
  <div class="ctas"><a class="btn primary" href="/onboard.html">${I.car}Add your rental agency</a>
    <a class="btn outline" href="${waLink("Hi OPIIUS, I have a question about listing my agency.")}" rel="noopener">${I.wa}Questions? Message us</a></div>
</div></section>
${faq.html}`;
  write("for-agencies/index.html", layout({rel: "for-agencies/index.html", title: "For car rental agencies · List your fleet on OPIIUS", active: "agencies",
    desc: "List your car rental agency on OPIIUS. Verified badge, priority placement, customer inquiries and a monthly inquiry report. Basic listing is free, no commission.", body, jsonld: [faq.ld]}));
})();

/* ---------- verification ---------- */
write("verification/index.html", layout({rel: "verification/index.html", title: "How OPIIUS verifies agencies · Verification standards", active: "verification",
  desc: "What the OPIIUS Verified badge means for rental agencies: the documents, owner identity, vehicles and location we check, how often we re-check, and how complaints work.",
  body: `<section class="plain-hero"><div class="wrap in"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>How we verify</span></nav>
  <span class="eyebrow">Verification standards</span><h1>Placement can be paid. Verification is earned.</h1>
  <p class="lede">The OPIIUS Verified badge means we've checked a rental agency ourselves. Here is exactly what we check, how often, and what happens if something goes wrong.</p></div></section>
<section class="sec"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Badges</span><h2>What you'll see on a profile</h2></div></div>
  <div class="agrid">
    <div class="panel rv"><span class="badge lst">${I.check}Listed on OPIIUS</span><h3 style="margin-top:14px;font-size:20px">Listed</h3><p>The owner agreed to be listed and confirmed their prices and terms. Documents not yet checked.</p></div>
    <div class="panel rv"><span class="badge fp">${I.star}Founding partner</span><h3 style="margin-top:14px;font-size:20px">Founding partner</h3><p>One of the first agencies on OPIIUS. Listed with the owner's prices and photos; verification follows.</p></div>
    <div class="panel rv"><span class="badge ver">${I.shield}Verified · Mar 2026</span><h3 style="margin-top:14px;font-size:20px">Verified</h3><p>OPIIUS checked the documents, owner, vehicles and location. The date shows when.</p></div>
    <div class="panel rv"><span class="badge feat">Featured</span><h3 style="margin-top:14px;font-size:20px">Featured</h3><p>A paid top placement, always labelled. Only Verified agencies can be Featured.</p></div>
  </div>
</div></section>
<section class="sec mist"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Checks</span><h2>What we check</h2><p>Every Verified rental agency passes these checks, through an OPIIUS visit or a video walkthrough.</p></div></div>
  <div class="scroll-x"><table class="matrix"><thead><tr><th scope="col">Category</th><th scope="col">Checks</th></tr></thead><tbody>
  ${[["Car & bike rentals", "rentals"]].map(([t, k]) => `<tr><th scope="row">${t}</th><td>${CHECKS[k].map(esc).join(" · ")}</td></tr>`).join("")}
  </tbody></table></div>
</div></section>
<section class="sec"><div class="wrap two">
  <div class="panel rv"><h2>Rules that keep it honest</h2><ul class="ticks">
    <li>${I.refresh}<span><b>Re-checked every six months.</b> The badge shows the date of the last check.</span></li>
    <li>${I.shield}<span><b>Never sold.</b> The Verified fee covers our checks; agencies that don't pass get a full refund.</span></li>
    <li>${I.award}<span><b>Featured is labelled.</b> Paid placement always says Featured and is limited to 3 per category per city.</span></li>
    <li>${I.chat}<span><b>Real reviews only.</b> Reviews come only from customers who sent an inquiry through OPIIUS, tied to its reference.</span></li>
    <li>${I.flag}<span><b>Complaints count.</b> Two unresolved complaints suspend the badge until we review them.</span></li></ul></div>
  <div class="panel rv"><h2>What a verified inquiry is</h2><p>Every request sent through OPIIUS carries a reference number (like OP-261002-K3F9Q) and the customer's car, dates and pickup point, sent from their own WhatsApp number. Agencies see real, specific requests, and customers can quote the reference if anything goes wrong.</p>
    <div class="ctas"><a class="btn wa" href="${waLink("Hi OPIIUS, I'd like to report a problem with an agency.")}" rel="noopener">${I.wa}Report an agency</a></div></div>
</div></section>`}));

/* ---------- about ---------- */
write("about/index.html", layout({rel: "about/index.html", title: "About OPIIUS · A trusted local marketplace for the Northeast",
  desc: "OPIIUS is a Guwahati-based marketplace where customers compare local car rental agencies, and agencies showcase their fleets.",
  body: `<section class="plain-hero"><div class="wrap in"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>About</span></nav>
  <span class="eyebrow">About OPIIUS</span><h1>Local agencies deserve to be found. Customers deserve to trust who they find.</h1>
  <p class="lede">Most car rental agencies in Assam are run by small local businesses that live on WhatsApp and Instagram. They're often excellent, and almost impossible to compare. OPIIUS puts them on one marketplace, with real photos, clear prices and a badge that means something.</p></div></section>
<section class="sec"><div class="wrap two">
  <div class="panel rv"><h2>What OPIIUS does</h2><ul class="ticks">
    <li>${I.check}<span>Shows local agencies with real photos, prices and terms</span></li><li>${I.check}<span>Checks agencies before they get the Verified badge</span></li>
    <li>${I.check}<span>Passes customer inquiries to agencies with a reference number</span></li><li>${I.check}<span>Follows up when a customer reports a problem</span></li></ul>
    <h3 style="margin-top:26px;font-size:20px">What OPIIUS doesn't do</h3><ul class="ticks x">
    <li>${I.x}<span>Own vehicles. The agency rents you the car and you pay them directly</span></li><li>${I.x}<span>Charge customers a booking fee</span></li><li>${I.x}<span>Sell the Verified badge</span></li></ul></div>
  <div class="panel rv"><h2>Contact</h2><div class="kv"><div><span>Based in</span><span>Guwahati, Assam</span></div><div><span>Founder</span><span>Priyangshu Nath</span></div>
    <div><span>WhatsApp</span><span><a href="${waLink("Hi OPIIUS")}" rel="noopener">${esc(PHONE)}</a></span></div><div><span>Email</span><span><a href="mailto:priyangshunath190@gmail.com">priyangshunath190@gmail.com</a></span></div></div>
    <div class="ctas"><a class="btn primary" href="/get-matched/">Get matched with an agency</a><a class="btn outline" href="/for-agencies/">List your agency</a></div></div>
</div></section>`}));

/* ---------- get matched ---------- */
write("get-matched/index.html", layout({rel: "get-matched/index.html", title: "Get matched with a trusted local agency · OPIIUS",
  desc: "Tell OPIIUS what you need: a self-drive car or a car with driver. We'll pass it to a suitable local rental agency and you'll get a reply on WhatsApp.",
  body: `<section class="sec mist" style="padding-top:64px"><div class="wrap matchbox">
  <div><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Get matched</span></nav><span class="eyebrow">Get matched</span>
    <h1 style="font-size:clamp(34px,5vw,54px);font-weight:600;margin-top:10px">Tell us what you need. We'll find the agency.</h1>
    <p class="muted" style="margin-top:16px;font-size:17px;max-width:46ch">A self-drive car or a car with driver. Share the details once and get a reply on WhatsApp.</p>
    <ol class="steps3" style="grid-template-columns:1fr;gap:12px;margin-top:26px"><li style="padding:18px"><b style="margin-top:10px">Send your request</b><span>It opens WhatsApp with your details and a reference number.</span></li><li style="padding:18px"><b style="margin-top:10px">We find a suitable agency</b><span>Your request goes to a local agency that fits.</span></li><li style="padding:18px"><b style="margin-top:10px">Get details before you commit</b><span>Price, deposit, km limit and availability on WhatsApp.</span></li></ol></div>
  ${matchForm("self-drive-cars", {title: "Your request"})}
</div></section>`}));

/* ---------- 404 and old pages ---------- */
write("404.html", layout({rel: "404.html", title: "Page not found · OPIIUS", desc: "This page isn't on OPIIUS.", noindex: true,
  body: `<section class="sec"><div class="wrap" style="max-width:720px;text-align:center"><span class="eyebrow">404</span><h1 style="font-size:clamp(34px,5vw,52px);font-weight:600;margin-top:10px">This page isn't here.</h1>
  <p class="muted" style="margin-top:14px;font-size:17px">It may have moved when we rebuilt OPIIUS. Try one of these instead.</p>
  <div class="ctas" style="justify-content:center"><a class="btn primary" href="/">Home</a><a class="btn outline" href="${selfDriveUrl}">Self-drive cars</a><a class="btn outline" href="/get-matched/">Get matched</a></div></div></section>`}));
redirectTo("tours/meghalaya.html", "/rentals/", "Car rentals");

/* ---------- sitemap ---------- */
const urls = written.filter(r => r.endsWith(".html") && r !== "404.html" && !r.startsWith("tours/")).map(urlOf);
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod>${u === "/" ? "<priority>1.0</priority>" : ""}</url>`).join("\n")}
  <url><loc>${SITE}/terms.html</loc></url>
</urlset>
`);
console.log(`Built ${written.length} pages:\n  ` + written.join("\n  "));
