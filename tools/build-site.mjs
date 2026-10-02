/* Builds the static OPIIUS marketplace pages from assets/opiius/data.js (+ partners.js, config.js).
   Run from the repo root:  node tools/build-site.mjs
   Writes: index.html, rentals/, tours/, experiences/, events/, travel-services/, agency/, for-agencies/,
   verification/, about/, get-matched/, 404.html and sitemap.xml. Only real partners (real:true) are shown. */
import fs from "node:fs";
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
const urlOf = rel => "/" + rel.replace(/index\.html$/, "");

/* ---------- icons (24px, stroke) ---------- */
const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
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
const LOGO = `<svg viewBox="0 0 38 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M2 21L11 5l6 10"/><path d="M13 21l9-16 14 16"/></svg>`;
const CAR_LINE = '<svg viewBox="0 0 200 70" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M8 52h14m36 0h76m36 0h22v-12c0-5-3-8-8-9l-28-5-22-15c-4-3-8-4-13-4H74c-6 0-11 2-15 6L44 26l-24 4c-6 1-10 5-10 11v11"/><circle cx="40" cy="52" r="12"/><circle cx="152" cy="52" r="12"/></svg>';

/* ---------- marketplace structure ---------- */
const CHECKS = {
  rentals: ["Business proof (trade licence, Udyam or GST)", "Owner's photo ID", "Rent-a-cab or rent-a-motorcycle permit", "RC and commercial insurance for every listed vehicle", "Photos of the actual fleet"],
  tours: ["Business proof (trade licence, Udyam or GST)", "Owner's photo ID", "State tourism registration where it applies", "At least two past-customer references", "RC and insurance for vehicles they own"],
  experiences: ["Business proof (trade licence, Udyam or GST)", "Owner's photo ID", "Photos of safety equipment", "Guide experience", "Any permits the activity needs"],
  events: ["Business proof (trade licence, Udyam or GST)", "Owner's photo ID", "Photos of their own inventory", "Shop or godown location"],
  "travel-services": ["Business proof (trade licence, Udyam or GST)", "Owner's photo ID", "RC, permit and insurance for transfer vehicles"]
};
const CATS = [
  {id: "rentals", name: "Rentals", short: "Rentals", icon: "car", tone: "", menu: "Cars, bikes and travellers",
    lede: "Self-drive cars, bikes and scooters, cars with a driver and tempo travellers from local agencies. See real photos and day prices before you ask.",
    agencyNoun: "rental agency", subs: [
      {id: "self-drive-cars", name: "Self-drive cars", icon: "car", desc: "Hatchbacks, compact SUVs and 7-seaters you drive yourself.", kind: "car"},
      {id: "bikes", name: "Bikes & scooters", icon: "bike", desc: "Scooters for the city, Royal Enfields for the hills.", kind: "bike"},
      {id: "cars-with-driver", name: "Cars with driver", icon: "users", desc: "Innova, Ertiga and SUVs with an experienced local driver."},
      {id: "tempo-travellers", name: "Tempo travellers & buses", icon: "van", desc: "12 to 40 seats for groups, colleges and weddings."}]},
  {id: "tours", name: "Tour packages", short: "Tours", icon: "map", tone: "t2", menu: "Meghalaya, Kaziranga, Tawang",
    lede: "Day-by-day trips across the Northeast from local operators: Meghalaya, Kaziranga, Arunachal and Sikkim, for families, couples, students and groups.",
    agencyNoun: "tour operator", subs: [
      {id: "meghalaya-tours", name: "Meghalaya", icon: "map", desc: "Shillong, Sohra, Dawki and the living root bridges."},
      {id: "kaziranga-tours", name: "Kaziranga", icon: "compass", desc: "Rhino safaris, tea gardens and Majuli add-ons."},
      {id: "arunachal-tours", name: "Arunachal & Tawang", icon: "map", desc: "Sela Pass, Tawang Monastery and Dirang. Permits arranged."},
      {id: "sikkim-tours", name: "Sikkim & Darjeeling", icon: "map", desc: "Gangtok, Tsomgo Lake and the tea hills."},
      {id: "family-honeymoon-tours", name: "Family & honeymoon trips", icon: "users", desc: "Private trips at a slower pace, hotels chosen for you."},
      {id: "group-tours", name: "Student & corporate trips", icon: "users", desc: "Group trips and offsites with one point of contact."}]},
  {id: "experiences", name: "Experiences", short: "Experiences", icon: "tent", tone: "t3", menu: "Camping, treks, rafting",
    lede: "Camping, trekking, river rafting, wildlife safaris and cultural day trips with local operators who know the terrain.",
    agencyNoun: "experience operator", subs: [
      {id: "camping", name: "Camping", icon: "tent", desc: "Lakeside and hilltop camps with tents, food and bonfires."},
      {id: "trekking", name: "Trekking", icon: "compass", desc: "Guided treks, from Nongriat's root bridges to multi-day trails."},
      {id: "rafting", name: "River rafting & kayaking", icon: "compass", desc: "Umngot, Kopili and Siang with trained guides."},
      {id: "safari", name: "Wildlife safaris", icon: "eye", desc: "Jeep and elephant safaris in Kaziranga and Manas."},
      {id: "day-trips", name: "Cultural & day trips", icon: "map", desc: "Majuli, Mawlynnong and local food and craft trails."}]},
  {id: "events", name: "Events", short: "Events", icon: "party", tone: "t4", menu: "Tent houses, décor, sound",
    lede: "Tent houses, decorators, sound and lights, generators and furniture for weddings, pujas, college fests and corporate events.",
    agencyNoun: "event agency", subs: [
      {id: "tent-house", name: "Tent houses", icon: "tent", desc: "Pandals, shamianas, chairs and tables for any function."},
      {id: "decorators", name: "Decorators", icon: "star", desc: "Wedding, birthday and puja décor, flowers and lighting."},
      {id: "sound-lights", name: "Sound & lights", icon: "bolt", desc: "DJ, PA systems, stage lighting and LED walls."},
      {id: "generators-furniture", name: "Generators & furniture", icon: "bolt", desc: "Silent gensets, sofas, stages and catering counters."}]},
  {id: "travel-services", name: "Travel services", short: "Travel services", icon: "plane", tone: "t6", menu: "Transfers, permits, guides",
    lede: "Airport and station transfers, Inner Line Permit help, local guides and ticketing from people who do it every day.",
    agencyNoun: "travel service", subs: [
      {id: "transfers", name: "Airport & station transfers", icon: "plane", desc: "Fixed-price pickups from LGBI Airport and Guwahati station."},
      {id: "permits", name: "Inner Line Permit help", icon: "doc", desc: "Arunachal and Nagaland permits, sorted before you travel."},
      {id: "guides", name: "Local guides", icon: "users", desc: "City walks, temple visits and naturalists for parks."},
      {id: "ticketing", name: "Ticketing agents", icon: "doc", desc: "Train, bus and flight bookings with a local office."}]}
];
const SUB = {};
CATS.forEach(c => c.subs.forEach(s => { SUB[s.id] = {...s, cat: c}; }));
const CITIES_ASK = ["Guwahati", "Shillong", "Kaziranga", "Tawang", "Elsewhere in the Northeast"];

/* ---------- real partners and their vehicles ---------- */
const GROUPS = [
  {id: "hatchbacks", t: "City hatchbacks", nav: "Hatchbacks", e: "5 seats · easy to park", d: "Light, economical cars for Guwahati traffic and quick runs out of town.", test: m => m.kind === "car" && m.type === "Hatchback"},
  {id: "sedans", t: "Sedans", nav: "Sedans", e: "5 seats · a proper boot", d: "Comfortable for four adults and their luggage on longer drives.", test: m => m.kind === "car" && m.type === "Sedan"},
  {id: "compact-suvs", t: "Compact SUVs", nav: "Compact SUVs", e: "5 seats · higher ground clearance", d: "A taller stance and more clearance for hill roads, still easy in the city.", test: m => m.kind === "car" && m.type !== "Hatchback" && m.type !== "Sedan" && m.seats < 6},
  {id: "seven-seaters", t: "7-seaters for families and groups", nav: "7-seaters", e: "6–7 seats · room for luggage", d: "Space for the whole family and their bags, for Meghalaya, Kaziranga and long days.", test: m => m.kind === "car" && m.seats >= 6},
  {id: "scooters", t: "Scooters", nav: "Scooters", e: "No gears · helmet included", d: "The easiest way around town.", test: m => m.kind === "bike" && m.type === "Scooter"},
  {id: "motorcycles", t: "Motorcycles", nav: "Motorcycles", e: "Geared · for the hills", d: "From commuters to Royal Enfields for the mountain roads.", test: m => m.kind === "bike" && m.type !== "Scooter"}
];
const AGENCIES = Object.entries(O.AGENCIES).filter(([, a]) => a.real && !a.demo).map(([id, a]) => ({id, ...a, slug: a.slug || id, category: a.category || "self-drive-cars"}));
const CARS = Object.values(O.LISTINGS).filter(l => AGENCIES.some(a => a.id === l.agency)).map(l => {
  const m = O.MODELS[l.model], a = AGENCIES.find(x => x.id === l.agency), b = (O.BRANDS[m.brand] || {name: ""}).name;
  const nm = (a.trims && a.trims[l.model]) || m.name;
  return {id: l.id, model: l.model, m, a, brand: b, nm, name: `${b} ${nm}`.trim(), price: l.price, units: l.units, photo: l.photo ? "/" + l.photo.replace(/^\//, "") : ""};
}).sort((x, y) => x.price - y.price || x.name.localeCompare(y.name));
const carsOf = (pred) => CARS.filter(pred);
const groupsOf = list => GROUPS.map(g => ({g, list: list.filter(c => g.test(c.m))})).filter(x => x.list.length);
const minP = list => Math.min(...list.map(c => c.price)), maxP = list => Math.max(...list.map(c => c.price));
const subLive = sub => sub.kind ? carsOf(c => c.m.kind === sub.kind) : [];
const cityName = id => (O.PLACES[id] || {name: id}).name;
const liveCities = kind => [...new Set(carsOf(c => c.m.kind === kind).map(c => c.a.city))];
const listingPath = (sub, city) => `rentals/${sub}/${city}/index.html`;
const agencyPath = a => `agency/${a.slug}/index.html`;

function badge(a, cls = "") {
  if (a.verified) return `<span class="badge ver ${cls}">${I.shield}Verified${a.verifiedOn ? " · " + esc(a.verifiedOn) : ""}</span>`;
  if (a.founding) return `<span class="badge fp ${cls}">${I.star}Founding partner</span>`;
  return `<span class="badge ${cls}" style="background:var(--mist)">Listed</span>`;
}
const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

/* ---------- layout ---------- */
const NAV = [["rentals/", "Rentals", "rentals"], ["tours/", "Tours", "tours"], ["experiences/", "Experiences", "experiences"], ["events/", "Events", "events"], ["travel-services/", "Travel services", "travel-services"], ["verification/", "How we verify", "verification"]];
function header(active) {
  return `<a class="skip" href="#main">Skip to content</a>
<header class="hdr"><div class="wrap">
  <a class="logo" href="/" aria-label="OPIIUS home">${LOGO}OPIIUS</a>
  <nav class="nav" aria-label="Main">${NAV.map(([h, t, k]) => `<a href="/${h}"${active === k ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
  <div class="cta"><a class="btn outline sm hide-m" href="/for-agencies/"${active === "agencies" ? ' aria-current="page"' : ""}>For agencies</a>
    <button type="button" class="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="mnav">${I.menu}</button></div>
</div></header>
<nav class="mnav" id="mnav" aria-label="Mobile">
  ${CATS.map(c => `<a href="/${c.id}/">${esc(c.name)}<small>${esc(c.menu)}</small></a>`).join("")}
  <a href="/verification/">How we verify</a><a href="/get-matched/">Get matched<small>Tell us what you need</small></a>
  <a class="btn primary" href="/for-agencies/">For agencies: showcase your services</a>
</nav>`;
}
function footer() {
  return `<footer class="ftr"><div class="wrap">
  <div class="cols">
    <div><a class="logo" href="/">${LOGO}OPIIUS</a><p class="about">Find trusted local agencies for rentals, tours, travel, experiences and events, all in one marketplace. Based in Guwahati, Assam.</p></div>
    <div><h4>Explore</h4><ul>
      <li><a href="/rentals/self-drive-cars/guwahati/">Self-drive cars</a></li><li><a href="/rentals/">Bikes &amp; scooters</a></li>
      <li><a href="/tours/">Tour packages</a></li><li><a href="/experiences/">Camping &amp; adventure</a></li>
      <li><a href="/events/">Tent house &amp; events</a></li><li><a href="/travel-services/">Travel services</a></li></ul></div>
    <div><h4>Agencies</h4><ul>${AGENCIES.map(a => `<li><a href="${urlOf(agencyPath(a))}">${esc(a.name)}</a></li>`).join("")}<li><a href="/agency/">All agencies</a></li><li><a href="/get-matched/">Get matched</a></li></ul></div>
    <div><h4>For agencies</h4><ul>
      <li><a href="/for-agencies/">Showcase your agency</a></li><li><a href="/for-agencies/#plans">Plans &amp; pricing</a></li>
      <li><a href="/verification/">Verification standards</a></li><li><a href="/onboard.html">Add a rental agency</a></li>
      <li><a href="/onboard-tours.html">Add a tour operator</a></li><li><a href="/terms.html#partners">Partner terms</a></li></ul></div>
    <div><h4>OPIIUS</h4><ul>
      <li><a href="/about/">About us</a></li><li><a href="/verification/">How we verify</a></li>
      <li><a href="${waLink("Hi OPIIUS, I'd like to report a problem with an agency.")}" rel="noopener">Report an agency</a></li>
      <li><a href="${waLink("Hi OPIIUS")}" rel="noopener">WhatsApp ${esc(PHONE)}</a></li><li><a href="/terms.html">Terms &amp; privacy</a></li></ul></div>
  </div>
  <div class="base"><span>© ${YEAR} OPIIUS · Guwahati, Assam</span><span><b>Featured placements are paid and always labelled. Verification is never sold.</b></span></div>
</div></footer>`;
}
function layout({rel, title, desc, active = "", body, og = "/assets/partners/real-drive-ghy/ignis.jpg", jsonld = [], noindex = false, extraHead = ""}) {
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
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#11261f"/><g fill="none" stroke="#c9a45c" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"><path d="M4 30l8-15 5 9"/><path d="M14 30l8-15 13 15"/></g></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/assets/site/site.css">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}${extraHead}
</head>
<body>
${header(active)}
<main id="main">
${body}
</main>
${footer()}
<script src="/assets/opiius/config.js"></script>
<script src="/assets/site/site.js"></script>
</body>
</html>
`;
}

/* ---------- shared blocks ---------- */
function carCard(c, {showAgency = false} = {}) {
  const ph = c.photo ? `<img src="${esc(c.photo)}" alt="${esc(c.a.name + "'s " + c.name)}" loading="lazy" decoding="async">`
    : `<div class="nametile"><small>${esc(c.brand)}</small><b>${esc(c.nm)}</b>${CAR_LINE}</div>`;
  const feat = (c.m.features || []).filter(f => f !== "AC").slice(0, 1);
  return `<article class="car"><div class="ph">${ph}${c.units > 1 ? `<span class="badge onph">${c.units} in the fleet</span>` : ""}</div>
  <div class="bd"><div class="nm"><small>${esc(c.brand)}</small><h3>${esc(c.nm)}</h3></div>
    ${showAgency ? `<p class="by">By <a href="${urlOf(agencyPath(c.a))}">${esc(c.a.name)}</a></p>` : ""}
    <div class="specs"><span>${c.m.seats} seats</span><span>${esc(c.m.fuel)}</span><span>${esc(c.m.type)}</span>${feat.map(f => `<span>${esc(f)}</span>`).join("")}</div>
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
  const data = list.map(c => ({id: c.id, name: c.name, price: c.price, seats: c.m.seats, photo: c.photo, agency: c.a.id, agencyName: c.a.name, city: c.a.city}));
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
function matchForm(selected, {title = "Tell us what you need", sub = "We'll find a suitable local agency on OPIIUS and reply on WhatsApp, usually the same day."} = {}) {
  return `<div class="panel"><h3>${esc(title)}</h3><p>${esc(sub)}</p>
  <form class="form" data-match novalidate style="margin-top:18px">
    <div class="row2"><div><label for="mNeed">What do you need?</label><select id="mNeed" name="need">${needOptions(selected)}</select></div>
      <div><label for="mCity">Where?</label><select id="mCity" name="city">${CITIES_ASK.map(c => `<option>${c}</option>`).join("")}</select></div></div>
    <div class="row2"><div><label for="mFrom">From <small>(optional)</small></label><input type="date" id="mFrom" name="from"></div><div><label for="mTo">To <small>(optional)</small></label><input type="date" id="mTo" name="to"></div></div>
    <div class="row2"><div><label for="mPeople">People <small>(optional)</small></label><input id="mPeople" name="people" inputmode="numeric" placeholder="e.g. 4 adults, 2 kids"></div><div><label for="mBudget">Budget <small>(optional)</small></label><input id="mBudget" name="budget" placeholder="e.g. ₹15,000"></div></div>
    <div><label for="mName">Your name</label><input id="mName" name="name" autocomplete="name" placeholder="Full name" required></div>
    <div><label for="mMsg">Anything else? <small>(optional)</small></label><textarea id="mMsg" name="msg" placeholder="Route, places you want to see, type of car, event size…"></textarea></div>
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
  const cover = a.cover ? `/${a.cover}` : (list.find(c => c.photo) || {}).photo;
  return `<a class="acard rv" href="${urlOf(agencyPath(a))}"><div class="ph">${cover ? `<img src="${esc(cover)}" alt="${esc(a.coverAlt || a.name)}" loading="lazy">` : ""}${badge(a, "onph")}</div>
  <div class="bd"><h3>${esc(a.name)}</h3><div class="row"><span>${I.car}${esc(SUB[a.category] ? SUB[a.category].name : "Rentals")}</span><span>${I.pin}${esc(cityName(a.city))}</span></div>
  <div class="row"><span>${plural(list.length, "model")} · ${inr(minP(list))}–${inr(maxP(list))} / day</span></div>
  <div class="ft"><span>View agency</span>${I.arrow.replace("<svg", '<svg width="18" height="18"')}</div></div></a>`;
}
const joinCard = `<a class="acard join rv" href="/for-agencies/"><span class="eyebrow">Your agency here</span><h3>Run a rental, tour or event agency?</h3><p>Showcase your services to customers who are already searching. Basic listing is free.</p><span class="link">Showcase your agency ${I.arrow.replace("<svg", '<svg width="16" height="16"')}</span></a>`;

/* ======================= pages ======================= */
const sdcCities = liveCities("car");
const allCars = carsOf(c => c.m.kind === "car");
const sdcUrl = sdcCities.length ? urlOf(listingPath("self-drive-cars", sdcCities[0])) : "/rentals/";

/* ---------- home ---------- */
(function home() {
  const what = [
    ["self-drive-cars", "Self-drive car", sdcUrl],
    ["bikes", "Bike or scooter", liveCities("bike").length ? urlOf(listingPath("bikes", liveCities("bike")[0])) : ""],
    ["cars-with-driver", "Car with driver", ""], ["meghalaya-tours", "Tour package", ""], ["camping", "Camping & adventure", ""],
    ["tent-house", "Tent house & events", ""], ["transfers", "Airport transfer", ""]];
  const tiles = [
    {h: sdcUrl, t: "Self-drive cars", p: "Hatchbacks, compact SUVs and 7-seaters you drive yourself.", ic: "car", meta: allCars.length ? `${plural(allCars.length, "car")} · from ${inr(minP(allCars))}/day` : "Explore", img: (allCars.find(c => c.photo && c.model === "i20") || allCars.find(c => c.photo) || {}).photo},
    {h: "/rentals/#bikes", t: "Bikes & scooters", p: "Scooters for the city, Royal Enfields for the hills.", ic: "bike", meta: "Explore", tone: "t5"},
    {h: "/tours/", t: "Tour packages", p: "Meghalaya, Kaziranga, Tawang and Sikkim, day by day.", ic: "map", meta: "Explore", tone: "t2"},
    {h: "/experiences/", t: "Camping & adventure", p: "Camps, treks, rafting and safaris with local operators.", ic: "tent", meta: "Explore", tone: "t3"},
    {h: "/events/", t: "Tent house & events", p: "Pandals, décor, sound and furniture for every function.", ic: "party", meta: "Explore", tone: "t4"},
    {h: "/travel-services/", t: "Travel services", p: "Airport transfers, permit help and local guides.", ic: "plane", meta: "Explore", tone: "t6"}];
  const featured = allCars.filter(c => c.photo).slice(0, 3);
  const faq = faqBlock([
    ["Is OPIIUS a travel agency?", "No. OPIIUS is a marketplace of local agencies. You deal with the agency directly and pay them, at their price."],
    ["What does “Verified” mean?", `It means OPIIUS has checked the agency's business documents, the owner's identity, their vehicles or equipment, and their location. <a href="/verification/">See our verification standards</a>.`],
    ["Do I pay anything to OPIIUS?", "No. Customers pay no booking fee to OPIIUS."],
    ["Are featured agencies better?", "Featured agencies pay for top placement and are always labelled. Only Verified agencies can be Featured."],
    ["What if something goes wrong?", `Tell us on WhatsApp from the agency's page. We follow up with the agency, and unresolved complaints cost them the Verified badge.`],
    ["Can I list my agency?", `Yes. Basic listing is free. <a href="/for-agencies/">See how it works</a>.`]]);
  const body = `
<section class="hero"><div class="bg" style="background-image:url(/assets/partners/real-drive-ghy/ignis.jpg);background-position:60% 62%" role="img" aria-label="A Real Drive car on a Meghalaya hill road"></div>
  <div class="wrap in">
    <span class="eyebrow">Trusted local agencies · Guwahati &amp; the Northeast</span>
    <h1>Find trusted local agencies for rentals, tours and events.</h1>
    <p class="lede">Compare self-drive cars, tour packages, camping trips and event services from local agencies. See real photos and clear prices, then send your inquiry straight to the agency.</p>
    <form class="search" id="hsearch" role="search">
      <label><span>What do you need?</span><select name="what" aria-label="What do you need">${what.map(([k, t, u]) => `<option value="${u || "/get-matched/?need=" + k}">${esc(t)}</option>`).join("")}</select></label>
      <label><span>Where?</span><select name="where" aria-label="Where"><option>Guwahati</option></select></label>
      <button class="btn primary" type="submit">Find agencies</button>
    </form>
    <ul class="trust"><li>${I.shield}Agencies checked before they're Verified</li><li>${I.camera}Real photos</li><li>${I.tag}Prices shown upfront</li><li>${I.check}No booking fee</li></ul>
    <p class="note">Own an agency? <a href="/for-agencies/">Showcase your services →</a></p>
  </div></section>

<section class="sec"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Explore by category</span><h2>What are you planning?</h2><p>Rentals, tours, adventures and event services from local businesses, in one place.</p></div></div>
  <div class="tiles">${tiles.map(t => `<a class="tile rv ${t.tone || ""} ${t.img ? "has-img" : ""}" href="${t.h}">${t.img ? `<img src="${esc(t.img)}" alt="" loading="lazy">` : ""}<div><span class="ic">${I[t.ic]}</span><h3>${t.t}</h3><p>${t.p}</p></div><div class="meta"><span>${t.meta}</span><span>${I.arrow.replace("<svg", '<svg width="18" height="18"')}</span></div></a>`).join("")}</div>
</div></section>

<section class="sec mist"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">On OPIIUS</span><h2>Local agencies you can contact today</h2><p>Every profile shows real photos, day prices and terms. The Verified badge appears once OPIIUS has checked the agency's documents.</p></div><a class="link" href="/agency/">All agencies ${I.arrow.replace("<svg", '<svg width="16" height="16"')}</a></div>
  <div class="agrid">${AGENCIES.map(agencyCard).join("")}${joinCard}</div>
</div></section>

${featured.length ? `<section class="sec"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Self-drive cars in Guwahati</span><h2>Popular right now</h2><p>Real cars from local agencies, with the day price upfront.</p></div><a class="link" href="${sdcUrl}">See all ${allCars.length} cars ${I.arrow.replace("<svg", '<svg width="16" height="16"')}</a></div>
  <div class="grid">${featured.map(c => carCard(c, {showAgency: true})).join("")}</div>
</div></section>` : ""}

<section class="sec mist"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">How it works</span><h2>Three steps. No guesswork.</h2></div></div>
  <ol class="steps3"><li class="rv"><b>Compare local agencies</b><span>See real photos, price ranges, deposits and terms side by side.</span></li>
    <li class="rv"><b>Send one inquiry</b><span>Your dates, group size and budget go straight to the agency with an OPIIUS reference.</span></li>
    <li class="rv"><b>Get a reply on WhatsApp</b><span>Confirm with the agency and pay them directly. No booking fee.</span></li></ol>
</div></section>

<section class="sec pine"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">What “Verified” means</span><h2>Checked by us, so you don't have to guess.</h2><p>Before an agency earns the OPIIUS Verified badge, we check four things. Badges are re-checked every six months and show the date.</p></div><a class="btn light" href="/verification/">Our verification standards</a></div>
  <div class="checks">${[["doc", "Business documents", "A registered, legitimate business."], ["id", "Owner identity", "A real person stands behind it."], ["car", "Vehicles & equipment", "Registration, insurance and photos of what you'll actually get."], ["home", "Location", "We visit or walk through it on video."]].map(([ic, b, s]) => `<div class="check rv">${I[ic]}<b>${b}</b><span>${s}</span></div>`).join("")}</div>
  <p style="margin-top:26px;color:rgba(255,255,255,.75)">Featured placements are paid and always labelled. <b style="color:#fff">Verification is never sold.</b></p>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Why OPIIUS</span><h2>Why not just search on Google or Instagram?</h2></div></div>
  <table class="vs rv"><thead><tr><th scope="col">Random search</th><th scope="col">OPIIUS</th></tr></thead><tbody>
  ${[["An unknown business behind a phone number", "Agencies we've met, with documents checked for the Verified badge"], ["Stock photos, or none", "Real photos of the actual vehicles"], ["“DM for price”", "Day prices and terms upfront"], ["Five chats to compare", "Compare side by side, send one inquiry"], ["Nowhere to complain", "Report an agency. We follow up"]].map(([a, b]) => `<tr><td>${a}</td><td>${I.check}${b}</td></tr>`).join("")}
  </tbody></table>
</div></section>

<section class="sec mist" id="match"><div class="wrap matchbox">
  <div><span class="eyebrow">Get matched</span><h2 style="font-size:clamp(28px,3.8vw,42px);font-weight:800;margin-top:8px">Not sure who to pick? Tell us what you need.</h2>
    <p class="muted" style="margin-top:14px;font-size:16px;max-width:46ch">Share your dates, group size and budget. We'll pass your request to a suitable local agency and you'll get a reply on WhatsApp.</p>
    <ul class="ticks"><li>${I.check}<span>Rentals, tours, camping, events and transfers</span></li><li>${I.check}<span>One request instead of five chats</span></li><li>${I.check}<span>No booking fee</span></li></ul></div>
  ${matchForm("self-drive-cars")}
</div></section>

${agencyBand("Run a rental, tour, adventure or event agency?", "Get discovered by customers who are already searching. Showcase your services on category pages, earn the Verified badge customers trust, and receive inquiries with dates, group size and budget. No commission. No contract.")}
${faq.html}
${askDialog(CARS)}`;
  write("index.html", layout({rel: "index.html", title: "OPIIUS · Trusted local agencies for rentals, tours and events in the Northeast",
    desc: "Compare self-drive cars, tour packages, camping trips and event services from local agencies in Guwahati and the Northeast. Real photos, clear prices, inquiries on WhatsApp.",
    body, jsonld: [{"@context": "https://schema.org", "@type": "Organization", name: "OPIIUS", url: SITE + "/", areaServed: "Northeast India", address: {"@type": "PostalAddress", addressLocality: "Guwahati", addressRegion: "Assam", addressCountry: "IN"}, telephone: "+" + WA}, faq.ld]}));
})();

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
    <div class="kv">${ags.map(a => `<div><span><a href="${urlOf(agencyPath(a))}" style="font-weight:700;color:var(--ink)">${esc(a.name)}</a></span><span>${badge(a)}</span></div>`).join("")}</div>
    <div class="ctas"><a class="btn outline" href="/for-agencies/">List your agency here</a></div></div>
</div></section>
${faq.html}
<section class="sec" id="match"><div class="wrap matchbox"><div><span class="eyebrow">Get matched</span><h2 style="font-size:clamp(26px,3.4vw,38px);font-weight:800;margin-top:8px">Didn't find the right car?</h2><p class="muted" style="margin-top:12px">Tell us the dates and the kind of car. We'll check with local agencies and reply on WhatsApp.</p></div>${matchForm(sub.id)}</div></section>
${askDialog(list)}`;
  write(rel, layout({rel, title: `${sub.name} in ${cn} from ${inr(minP(list))}/day · OPIIUS`, active: "rentals",
    desc: `Compare ${plural(list.length, kind === "car" ? "self-drive car" : "bike")} in ${cn} from local agencies: real photos, day prices from ${inr(minP(list))}, inquiries on WhatsApp.`,
    body, og: (list.find(c => c.photo) || {}).photo || undefined, jsonld: [faq.ld]}));
}

/* ---------- category hubs ---------- */
for (const cat of CATS) {
  const rel = `${cat.id}/index.html`;
  const subCards = cat.subs.map(s => {
    const live = subLive(s), cities = s.kind ? liveCities(s.kind) : [];
    if (live.length && cities.length) return `<a class="tile rv ${cat.tone}" id="${s.id}" href="${urlOf(listingPath(s.id, cities[0]))}"><div><span class="ic">${I[s.icon]}</span><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div><div class="meta"><span>${plural(live.length, s.kind)} · from ${inr(minP(live))}/day</span><span>${I.arrow.replace("<svg", '<svg width="18" height="18"')}</span></div></a>`;
    return `<a class="tile rv ${cat.tone}" id="${s.id}" href="#match" data-need="${s.id}"><div><span class="ic">${I[s.icon]}</span><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div><div class="meta"><span>Ask for this</span><span>${I.arrow.replace("<svg", '<svg width="18" height="18"')}</span></div></a>`;
  }).join("");
  const ags = AGENCIES.filter(a => SUB[a.category] && SUB[a.category].cat.id === cat.id);
  const body = `
<section class="hero slim"><div class="bg" style="background:linear-gradient(150deg,#1d4b3f 0%,#0d1f19 70%)"></div><div class="wrap in">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>${esc(cat.name)}</span></nav>
  <span class="eyebrow">${esc(cat.name)} · Guwahati &amp; the Northeast</span>
  <h1>${esc(cat.id === "rentals" ? "Rentals from local agencies" : cat.id === "tours" ? "Tour packages from local operators" : cat.id === "experiences" ? "Camping, treks and adventures" : cat.id === "events" ? "Tent houses and event services" : "Transfers, permits and local guides")}</h1>
  <p class="lede">${esc(cat.lede)}</p>
  <div class="ctas"><a class="btn light" href="#match">Tell us what you need</a><a class="btn ghost" href="/for-agencies/">List your ${esc(cat.agencyNoun)}</a></div>
</div></section>
<section class="sec"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Browse</span><h2>What are you looking for?</h2><p>${ags.length ? "Open a category to compare agencies and prices, or send one request and we'll find the right agency." : `Send one request and we'll connect you with a suitable local ${esc(cat.agencyNoun)}. You'll get a reply on WhatsApp.`}</p></div></div>
  <div class="tiles">${subCards}</div>
</div></section>
${ags.length ? `<section class="sec mist"><div class="wrap"><div class="sec-h"><div><span class="eyebrow">On OPIIUS</span><h2>Agencies in this category</h2></div></div><div class="agrid">${ags.map(agencyCard).join("")}${joinCard}</div></div></section>` : ""}
<section class="sec ${ags.length ? "" : "mist"}"><div class="wrap two">
  <div class="panel rv"><span class="eyebrow">Verification</span><h2 style="margin-top:8px">What we check before a ${esc(cat.agencyNoun)} is Verified</h2>
    <ul class="ticks">${CHECKS[cat.id].map(t => `<li>${I.check}<span>${esc(t)}</span></li>`).join("")}</ul>
    <p class="muted" style="margin-top:16px">Badges are re-checked every six months. <a class="link" href="/verification/">Full standards</a></p></div>
  <div class="panel rv"><span class="eyebrow">How it works</span><h2 style="margin-top:8px">One request, a reply on WhatsApp</h2>
    <ol class="steps3" style="grid-template-columns:1fr;gap:12px;margin-top:16px"><li style="padding:18px"><b style="margin-top:10px">Tell us what you need</b><span>Dates, place, group size and budget.</span></li><li style="padding:18px"><b style="margin-top:10px">We find the right agency</b><span>Your request goes to a suitable local ${esc(cat.agencyNoun)} with an OPIIUS reference.</span></li><li style="padding:18px"><b style="margin-top:10px">They reply with details</b><span>Prices, inclusions and availability, before you commit.</span></li></ol></div>
</div></section>
<section class="sec ${ags.length ? "mist" : ""}" id="match"><div class="wrap matchbox"><div><span class="eyebrow">Get matched</span><h2 style="font-size:clamp(26px,3.4vw,38px);font-weight:800;margin-top:8px">Tell us what you need</h2><p class="muted" style="margin-top:12px;max-width:44ch">Share the details once. We'll pass them to a suitable local ${esc(cat.agencyNoun)} and you'll get a reply on WhatsApp.</p></div>${matchForm(cat.subs[0].id)}</div></section>
${agencyBand(`Run a ${esc(cat.agencyNoun)}?`, `Showcase your services to customers searching for ${esc(cat.name.toLowerCase())} in the Northeast. A full profile, photos, packages and inquiries with dates and budget. Basic listing is free.`)}
${cat.id === "rentals" && CARS.length ? askDialog(CARS) : ""}`;
  write(rel, layout({rel, title: `${cat.name} in Guwahati & the Northeast · OPIIUS`, active: cat.id, desc: cat.lede, body}));
}

/* ---------- agency profiles ---------- */
for (const a of AGENCIES) {
  const rel = agencyPath(a), list = CARS.filter(c => c.a.id === a.id), gs = groupsOf(list);
  const cover = a.cover ? "/" + a.cover : (list.find(c => c.photo) || {}).photo || "";
  const maxSeats = Math.max(...list.map(c => c.m.seats));
  const pol = a.policies || {};
  const body = `
<section class="hero">${cover ? `<div class="bg" style="background-image:url(${esc(cover)});background-position:55% 62%" role="img" aria-label="${esc(a.coverAlt || a.name)}"></div>` : `<div class="bg" style="background:linear-gradient(150deg,#1d4b3f,#0d1f19)"></div>`}
  <div class="wrap in" style="padding-top:64px">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/agency/">Agencies</a><span>/</span><span>${esc(a.name)}</span></nav>
    <div class="ahead"><span class="mono" aria-hidden="true">${esc(initials(a.name))}</span>${badge(a)}</div>
    <h1 style="max-width:14ch">${esc(a.name)}</h1>
    <p class="lede">${esc(a.about)}</p>
    <div class="ctas"><a class="btn light" href="#${gs[0] ? gs[0].g.id : "info"}">See the fleet</a><button type="button" class="btn ghost" data-ask="">Check availability</button></div>
    <div class="facts"><div><b class="num">${list.length}</b><span>${list.length === 1 ? "model" : "models"}</span></div><div><b class="num">${inr(minP(list))}</b><span>lowest day price</span></div><div><b class="num">${maxSeats}</b><span>seats, largest</span></div><div><b>${esc(cityName(a.city))}</b><span>pickup city</span></div></div>
  </div></section>
${chipsNav(list, [["info", "Price list & terms"]])}
<div class="wrap">${fleetBlocks(list)}</div>
<section class="sec mist" id="info" style="margin-top:72px"><div class="wrap two">
  <div class="panel"><h2>Price list</h2><p>Day prices set by ${esc(a.name)}. You pay the agency directly, at these prices. OPIIUS adds no booking fee.</p>
    <table class="plist"><tbody>${gs.map(x => `<tr><th colspan="2">${esc(x.g.t)}</th></tr>${x.list.map(c => `<tr><td>${esc(c.name)}<small>${c.m.seats} seats${c.units > 1 ? " · " + c.units + " cars" : ""}</small></td><td>${inr(c.price)}/day</td></tr>`).join("")}`).join("")}</tbody></table>
    <button type="button" class="btn outline sm no-print" style="margin-top:20px" onclick="window.print()">Print or save as PDF</button></div>
  <div style="display:grid;gap:20px">
    <div class="panel"><h2>Terms</h2><div class="kv">
      <div><span>Bring at pickup</span><span>${esc(pol.docs || "Original driving licence and a government photo ID")}</span></div>
      <div><span>Fuel</span><span>${esc(pol.fuel === "Same level as pick-up" ? "Return at the same level as pickup" : pol.fuel || "")}</span></div>
      <div><span>Deposit</span><span>${esc(/agency/i.test(pol.deposit || "") ? "Confirmed with your quote" : pol.deposit)}</span></div>
      <div><span>Km limit</span><span>${esc(/agency/i.test(pol.km || "") ? "Confirmed with your quote" : pol.km)}</span></div>
      <div><span>Cancellation</span><span>${esc(/agency/i.test(pol.cancel || "") ? "Confirmed with your quote" : pol.cancel)}</span></div>
      <div><span>Pickup</span><span>${esc((a.pickups || []).join(", "))}</span></div></div></div>
    <div class="panel"><h2>Verification</h2>${a.verified
      ? `<p>OPIIUS checked this agency${a.verifiedOn ? " in " + esc(a.verifiedOn) : ""}.</p><ul class="ticks">${CHECKS.rentals.map(t => `<li>${I.check}<span>${esc(t)}</span></li>`).join("")}</ul>`
      : `<p>${a.founding ? `${esc(a.name)} is a founding partner on OPIIUS. ` : ""}The Verified badge is added after OPIIUS checks the permit, insurance, fleet and owner ID. <a class="link" href="/verification/">What we check</a></p>`}
      <p style="margin-top:14px"><a class="link" href="${waLink(`Hi OPIIUS, I'd like to report a problem with ${a.name}.`)}" rel="noopener">${I.flag.replace("<svg", '<svg width="16" height="16"')}Report a problem with this agency</a></p></div>
  </div>
</div></section>
<section class="sec"><div class="wrap" style="text-align:center;max-width:720px">
  <h2 style="font-size:clamp(28px,4.4vw,44px);font-weight:800">Know your dates? Check a car now.</h2>
  <p class="muted" style="margin-top:12px;font-size:16px">Tell us the car, the dates and where you'd like to pick it up. ${esc(a.name)} replies on WhatsApp.</p>
  <div class="ctas" style="justify-content:center"><button type="button" class="btn dark" data-ask="">Check availability</button></div>
</div></section>
${askDialog(list)}`;
  write(rel, layout({rel, title: `${a.name} · Self-drive cars in ${cityName(a.city)} from ${inr(minP(list))}/day | OPIIUS`, active: "rentals",
    desc: `${a.name}: ${plural(list.length, "car model")} in ${cityName(a.city)}, from ${inr(minP(list))}/day. See the full fleet, day prices and terms, then check availability on WhatsApp.`,
    body, og: cover || undefined, jsonld: [{"@context": "https://schema.org", "@type": "AutoRental", name: a.name, url: SITE + urlOf(rel), image: cover ? SITE + cover : undefined, priceRange: `${inr(minP(list))}–${inr(maxP(list))} per day`, address: {"@type": "PostalAddress", addressLocality: cityName(a.city), addressRegion: (O.PLACES[a.city] || {}).state, addressCountry: "IN"}}]}));
}

/* ---------- agencies index ---------- */
write("agency/index.html", layout({rel: "agency/index.html", title: "Agencies on OPIIUS · Local rental, tour and event agencies", active: "",
  desc: "Local agencies on OPIIUS: profiles with real photos, day prices and terms.",
  body: `<section class="plain-hero"><div class="wrap in"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Agencies</span></nav>
  <span class="eyebrow">${plural(AGENCIES.length, "agency", "agencies")} on OPIIUS</span><h1>Local agencies on OPIIUS</h1>
  <p class="lede">Every profile shows real photos, prices and terms. The Verified badge appears once OPIIUS has checked an agency's documents, owner and fleet.</p></div></section>
  <section class="sec"><div class="wrap"><div class="agrid">${AGENCIES.map(agencyCard).join("")}${joinCard}</div></div></section>
  ${agencyBand("Want your agency listed here?", "Basic listing is free. Upgrade for the Verified badge, priority placement and a monthly inquiry report.")}`}));

/* ---------- for agencies ---------- */
(function forAgencies() {
  const plans = [
    {n: "Basic", p: "Free", per: "", for: "Get listed and start receiving inquiries.", pts: ["Basic profile: name, category, area", "1 service or package", "3 photos", "Inquiries through the OPIIUS form"], cta: ["Start free", "outline"]},
    {n: "Verified", p: "₹999", per: "/month", for: "Show customers you're a checked business.", pts: ["Verified badge, after checks pass", "Full agency profile", "2 package or service pages", "15 photos", "WhatsApp and call buttons", "Placed above unverified listings", "Monthly inquiry count"], cta: ["Get Verified", "outline"]},
    {n: "Growth", p: "₹3,000", per: "/month", hot: true, for: "Everything you need to win more inquiries.", pts: ["Verified badge", "Full agency profile", "Priority placement in your category and city", "3–5 package or service pages, written by us", "WhatsApp and call buttons", "Customer inquiry form", "40 photos and service showcase", "Reviews and testimonials", "Offer and promotion section", "Monthly inquiry report"], cta: ["Choose Growth", "primary"]},
    {n: "Featured Partner", p: "₹5,000", per: "/month", for: "The top slot, for agencies ready to lead their category.", pts: ["Everything in Growth", "Top slot in your category and city, labelled Featured", "Homepage feature rotation", "Up to 10 package pages", "3 offers and a seasonal campaign", "Monthly review call"], cta: ["Apply for Featured", "outline"]}];
  const faq = faqBlock([
    ["Do you guarantee a number of customers?", "No. OPIIUS puts your agency on pages customers use to compare local providers, and sends you every inquiry with dates, group size and budget. Your monthly report shows exactly what came in."],
    ["Do you take a commission on bookings?", "No. You pay a flat monthly fee (or nothing on Basic) and keep 100% of every booking."],
    ["Can I buy the Verified badge?", "No. The Verified fee covers our checks. If your business doesn't pass, you get a full refund. Featured placement is paid and always labelled; verification is earned."],
    ["Is there a contract?", "No. Plans are month to month. Cancel any month. We give 30 days' notice before any change to fees."],
    ["What do I need to send?", `Your agency details, prices and terms, and 2–3 clear daylight photos of each vehicle or package. Rental agencies can use the <a href="/onboard.html">rental form</a>, tour operators the <a href="/onboard-tours.html">tours form</a>. Everyone else can message us on WhatsApp.`],
    ["Who receives customer inquiries?", "Inquiries arrive on the OPIIUS WhatsApp with an OPIIUS reference and are passed to you straight away. Your phone number is not published unless your plan includes call and WhatsApp buttons."]]);
  const body = `
<section class="hero"><div class="bg" style="background-image:url(/assets/partners/real-drive-ghy/i20.jpg);background-position:50% 60%" role="img" aria-label="A partner car at night in Guwahati"></div><div class="wrap in">
  <span class="eyebrow">For rental, tour, experience and event agencies</span>
  <h1>Get discovered by customers who are already searching.</h1>
  <p class="lede">Showcase your agency on high-intent pages, earn the Verified badge customers trust, and receive inquiries with dates, group size and budget. Every month you get a report of every inquiry we sent you.</p>
  <div class="ctas"><a class="btn light" href="#join">List your agency free</a><a class="btn ghost" href="${waLink("Hi OPIIUS, I run an agency and I'd like a 15-minute call about listing on OPIIUS.")}" rel="noopener">${I.wa}Book a 15-min call</a></div>
  <ul class="trust"><li>${I.check}No commission</li><li>${I.check}No contract</li><li>${I.check}Cancel any month</li></ul>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Who it's for</span><h2>Built for local agencies across the Northeast</h2></div></div>
  <div class="tiles">${[["car", "Car rental agencies", "Self-drive and with-driver fleets.", ""], ["bike", "Bike & scooter rentals", "Scooters to Royal Enfields.", "t5"], ["map", "Tour package agencies", "Meghalaya, Kaziranga, Tawang and beyond.", "t2"], ["tent", "Camping & adventure", "Camps, treks, rafting and safaris.", "t3"], ["party", "Tent house & event agencies", "Pandals, décor, sound and furniture.", "t4"], ["plane", "Local travel services", "Transfers, permits, guides and ticketing.", "t6"]].map(([ic, t, p, tone]) => `<div class="tile rv ${tone}" style="min-height:170px"><div><span class="ic">${I[ic]}</span><h3>${t}</h3><p>${p}</p></div></div>`).join("")}</div>
</div></section>

<section class="sec mist"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">What you get</span><h2>More visibility, more trust, more inquiries</h2></div></div>
  <div class="agrid">${[["eye", "Visibility", "Appear on the category and city pages customers use to compare providers, like self-drive cars in Guwahati."], ["shield", "A trust badge", "The OPIIUS Verified badge tells customers you're a real, checked business before they even call."], ["camera", "A professional showcase", "A full profile with your photos, packages and prices that you can share on Instagram, WhatsApp and Google."], ["chat", "Ready-to-book inquiries", "Inquiries arrive with dates, group size and budget, so you spend less time answering “price?”."], ["chart", "A monthly inquiry report", "See every inquiry, with its reference, so you always know what you're paying for."], ["award", "Priority placement", "Growth and Featured partners appear above free listings. Featured slots are limited per category."]].map(([ic, t, p]) => `<div class="panel rv"><span style="display:inline-grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--brand-soft);color:var(--brand)">${I[ic].replace("<svg", '<svg width="24" height="24"')}</span><h3 style="margin-top:16px;font-size:20px">${t}</h3><p>${p}</p></div>`).join("")}</div>
</div></section>

<section class="sec" id="plans"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Plans &amp; pricing</span><h2>Start free. Upgrade when you're ready.</h2><p>Flat monthly plans. No commission on bookings, no contract.</p></div></div>
  <div class="plans">${plans.map(x => `<div class="plan ${x.hot ? "hot" : ""} rv">${x.hot ? '<span class="tag">Most popular</span>' : ""}<h3>${x.n}</h3><p class="for">${x.for}</p>
    <div class="pr"><b class="num">${x.p}</b><span>${x.per}</span></div><ul>${x.pts.map(t => `<li>${I.check}<span>${t}</span></li>`).join("")}</ul>
    <a class="btn ${x.cta[1]} block" href="${x.n === "Basic" ? "#join" : waLink(`Hi OPIIUS, I'd like the ${x.n} plan (${x.p}${x.per}) for my agency.`)}"${x.n === "Basic" ? "" : ' rel="noopener"'}>${x.cta[0]}</a></div>`).join("")}</div>
  <div class="rules3"><div><b>Verification is never sold</b>The Verified fee covers our checks. If you don't pass, you get a full refund.</div><div><b>Featured is limited and labelled</b>At most 3 Featured agencies per category per city, always marked Featured.</div><div><b>No commission, no contract</b>Keep 100% of every booking. Cancel any month.</div></div>
</div></section>

<section class="sec pine"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Why a monthly plan pays for itself</span><h2>One extra booking covers the month.</h2><p>A 3-day Innova rental or one family Meghalaya package is worth far more than ₹3,000, which is about ₹100 a day.</p></div></div>
  <div class="checks">${[["tag", "No commission", "Booking apps take a cut of every booking. OPIIUS is a flat fee and you keep 100%."], ["chart", "Proof every month", "Your inquiry report shows what came in. If the numbers don't work for you, don't renew."], ["award", "Assets you keep", "A professional profile, written package pages and a badge you can share."], ["eye", "Pages that rank", "One agency can't rank for every search. A marketplace category page can, and you're on it."]].map(([ic, b, s]) => `<div class="check rv">${I[ic]}<b>${b}</b><span>${s}</span></div>`).join("")}</div>
</div></section>

<section class="sec" id="join"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">How to join</span><h2>Live on OPIIUS in three steps</h2></div></div>
  <ol class="steps3"><li class="rv"><b>Send your details</b><span>Fill the form for your agency type, or send everything on WhatsApp: details, prices, terms and 2–3 daylight photos per vehicle or package.</span></li>
    <li class="rv"><b>We set up your profile</b><span>We check your details with you, build your profile and package pages, and schedule your verification.</span></li>
    <li class="rv"><b>Customers find you</b><span>Your profile goes live. Inquiries reach you with an OPIIUS reference, and you get a monthly report.</span></li></ol>
  <div class="ctas"><a class="btn primary" href="/onboard.html">${I.car}Add a rental agency</a><a class="btn outline" href="/onboard-tours.html">${I.map}Add a tour operator</a>
    <a class="btn outline" href="${waLink("Hi OPIIUS, I'd like to list my agency. Business type: ")}" rel="noopener">${I.wa}Other agencies: message us</a></div>
</div></section>
${faq.html}`;
  write("for-agencies/index.html", layout({rel: "for-agencies/index.html", title: "For agencies · Showcase your services on OPIIUS", active: "agencies",
    desc: "Showcase your rental, tour, experience or event agency on OPIIUS. Verified badge, priority placement, customer inquiries and a monthly inquiry report. Basic listing is free.", body, jsonld: [faq.ld]}));
})();

/* ---------- verification ---------- */
write("verification/index.html", layout({rel: "verification/index.html", title: "How OPIIUS verifies agencies · Verification standards", active: "verification",
  desc: "What the OPIIUS Verified badge means: the documents, owner identity, vehicles, equipment and location we check, how often we re-check, and how complaints work.",
  body: `<section class="plain-hero"><div class="wrap in"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>How we verify</span></nav>
  <span class="eyebrow">Verification standards</span><h1>Placement can be paid. Verification is earned.</h1>
  <p class="lede">The OPIIUS Verified badge means we've checked an agency ourselves. Here is exactly what we check, how often, and what happens if something goes wrong.</p></div></section>
<section class="sec"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">Badges</span><h2>What you'll see on a profile</h2></div></div>
  <div class="agrid">
    <div class="panel rv"><span class="badge" style="background:var(--mist)">Listed</span><h3 style="margin-top:14px;font-size:20px">Listed</h3><p>The owner agreed to be listed and confirmed their prices and terms. Documents not yet checked.</p></div>
    <div class="panel rv"><span class="badge fp">${I.star}Founding partner</span><h3 style="margin-top:14px;font-size:20px">Founding partner</h3><p>One of the first agencies on OPIIUS. Listed with the owner's prices and photos; verification follows.</p></div>
    <div class="panel rv"><span class="badge ver">${I.shield}Verified · Mar 2026</span><h3 style="margin-top:14px;font-size:20px">Verified</h3><p>OPIIUS checked the documents, owner, vehicles or equipment, and location. The date shows when.</p></div>
    <div class="panel rv"><span class="badge feat">Featured</span><h3 style="margin-top:14px;font-size:20px">Featured</h3><p>A paid top placement, always labelled. Only Verified agencies can be Featured.</p></div>
  </div>
</div></section>
<section class="sec mist"><div class="wrap">
  <div class="sec-h"><div><span class="eyebrow">By category</span><h2>What we check</h2><p>Every Verified agency passes the checks for its category, through an OPIIUS visit or a video walkthrough.</p></div></div>
  <div class="scroll-x"><table class="matrix"><thead><tr><th scope="col">Category</th><th scope="col">Checks</th></tr></thead><tbody>
  ${[["Car & bike rentals", "rentals"], ["Tour operators", "tours"], ["Experiences", "experiences"], ["Tent house & events", "events"], ["Travel services", "travel-services"]].map(([t, k]) => `<tr><th scope="row">${t}</th><td>${CHECKS[k].map(esc).join(" · ")}</td></tr>`).join("")}
  </tbody></table></div>
</div></section>
<section class="sec"><div class="wrap two">
  <div class="panel rv"><h2>Rules that keep it honest</h2><ul class="ticks">
    <li>${I.refresh}<span><b>Re-checked every six months.</b> The badge shows the date of the last check.</span></li>
    <li>${I.shield}<span><b>Never sold.</b> The Verified fee covers our checks; agencies that don't pass get a full refund.</span></li>
    <li>${I.award}<span><b>Featured is labelled.</b> Paid placement always says Featured and is limited to 3 per category per city.</span></li>
    <li>${I.chat}<span><b>Real reviews only.</b> Reviews come only from customers who sent an inquiry through OPIIUS, tied to its reference.</span></li>
    <li>${I.flag}<span><b>Complaints count.</b> Two unresolved complaints suspend the badge until we review them.</span></li></ul></div>
  <div class="panel rv"><h2>What a verified inquiry is</h2><p>Every request sent through OPIIUS carries a reference number (like OP-261002-K3F9Q) and the customer's dates, group size or car, sent from their own WhatsApp number. Agencies see real, specific requests, and customers can quote the reference if anything goes wrong.</p>
    <div class="ctas"><a class="btn wa" href="${waLink("Hi OPIIUS, I'd like to report a problem with an agency.")}" rel="noopener">${I.wa}Report an agency</a></div></div>
</div></section>`}));

/* ---------- about ---------- */
write("about/index.html", layout({rel: "about/index.html", title: "About OPIIUS · A trusted local marketplace for the Northeast",
  desc: "OPIIUS is a Guwahati-based marketplace where customers compare local rental, tour, experience and event agencies, and agencies showcase their services.",
  body: `<section class="plain-hero"><div class="wrap in"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>About</span></nav>
  <span class="eyebrow">About OPIIUS</span><h1>Local agencies deserve to be found. Customers deserve to trust who they find.</h1>
  <p class="lede">Most rentals, tours and event services in the Northeast are run by small local businesses that live on WhatsApp and Instagram. They're often excellent, and almost impossible to compare. OPIIUS puts them on one marketplace, with real photos, clear prices and a badge that means something.</p></div></section>
<section class="sec"><div class="wrap two">
  <div class="panel rv"><h2>What OPIIUS does</h2><ul class="ticks">
    <li>${I.check}<span>Shows local agencies with real photos, prices and terms</span></li><li>${I.check}<span>Checks agencies before they get the Verified badge</span></li>
    <li>${I.check}<span>Passes customer inquiries to agencies with a reference number</span></li><li>${I.check}<span>Follows up when a customer reports a problem</span></li></ul>
    <h3 style="margin-top:26px;font-size:20px">What OPIIUS doesn't do</h3><ul class="ticks x">
    <li>${I.x}<span>Own vehicles or run trips. The agency provides the service and you pay them directly</span></li><li>${I.x}<span>Charge customers a booking fee</span></li><li>${I.x}<span>Sell the Verified badge</span></li></ul></div>
  <div class="panel rv"><h2>Contact</h2><div class="kv"><div><span>Based in</span><span>Guwahati, Assam</span></div><div><span>Founder</span><span>Priyangshu Nath</span></div>
    <div><span>WhatsApp</span><span><a href="${waLink("Hi OPIIUS")}" rel="noopener">${esc(PHONE)}</a></span></div><div><span>Email</span><span><a href="mailto:priyangshunath190@gmail.com">priyangshunath190@gmail.com</a></span></div></div>
    <div class="ctas"><a class="btn primary" href="/get-matched/">Get matched with an agency</a><a class="btn outline" href="/for-agencies/">List your agency</a></div></div>
</div></section>`}));

/* ---------- get matched ---------- */
write("get-matched/index.html", layout({rel: "get-matched/index.html", title: "Get matched with a trusted local agency · OPIIUS",
  desc: "Tell OPIIUS what you need: a car, a tour, a camp, a tent house or a transfer. We'll pass it to a suitable local agency and you'll get a reply on WhatsApp.",
  body: `<section class="sec mist" style="padding-top:64px"><div class="wrap matchbox">
  <div><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Get matched</span></nav><span class="eyebrow">Get matched</span>
    <h1 style="font-size:clamp(34px,5vw,54px);font-weight:800;margin-top:10px">Tell us what you need. We'll find the agency.</h1>
    <p class="muted" style="margin-top:16px;font-size:17px;max-width:46ch">Rentals, tour packages, camping, tent houses or an airport pickup. Share the details once and get a reply on WhatsApp.</p>
    <ol class="steps3" style="grid-template-columns:1fr;gap:12px;margin-top:26px"><li style="padding:18px"><b style="margin-top:10px">Send your request</b><span>It opens WhatsApp with your details and a reference number.</span></li><li style="padding:18px"><b style="margin-top:10px">We find a suitable agency</b><span>Your request goes to a local agency that fits.</span></li><li style="padding:18px"><b style="margin-top:10px">Get details before you commit</b><span>Prices, inclusions and availability on WhatsApp.</span></li></ol></div>
  ${matchForm("self-drive-cars", {title: "Your request"})}
</div></section>`}));

/* ---------- 404 and old pages ---------- */
write("404.html", layout({rel: "404.html", title: "Page not found · OPIIUS", desc: "This page isn't on OPIIUS.", noindex: true,
  body: `<section class="sec"><div class="wrap" style="max-width:720px;text-align:center"><span class="eyebrow">404</span><h1 style="font-size:clamp(34px,5vw,52px);font-weight:800;margin-top:10px">This page isn't here.</h1>
  <p class="muted" style="margin-top:14px;font-size:17px">It may have moved when we rebuilt OPIIUS. Try one of these instead.</p>
  <div class="ctas" style="justify-content:center"><a class="btn primary" href="/">Home</a><a class="btn outline" href="${sdcUrl}">Self-drive cars</a><a class="btn outline" href="/get-matched/">Get matched</a></div></div></section>`}));
write("tours/meghalaya.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Meghalaya tours · OPIIUS</title><link rel="canonical" href="${SITE}/tours/"><meta http-equiv="refresh" content="0; url=/tours/"><meta name="robots" content="noindex"></head><body><p><a href="/tours/">Meghalaya tours on OPIIUS</a></p></body></html>\n`);

/* ---------- sitemap ---------- */
const urls = written.filter(r => r.endsWith(".html") && r !== "404.html" && !r.startsWith("tours/meghalaya")).map(urlOf);
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod>${u === "/" ? "<priority>1.0</priority>" : ""}</url>`).join("\n")}
  <url><loc>${SITE}/terms.html</loc></url>
</urlset>
`);
console.log(`Built ${written.length} pages:\n  ` + written.join("\n  "));
