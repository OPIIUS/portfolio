/* OPIIUS customer marketplace: hash-routed single page app over window.OP (data.js).
   Views are pure functions returning {title, section, html, mount}. Filters live in the URL so every result page
   is shareable and the back button returns to the same search. Saved items, compare and booking requests are kept
   in this browser only (demo): nothing is sent anywhere. */
(function(){
"use strict";
const O=window.OP;
const {PLACES,RENTAL_CITIES,DESTINATIONS,DEST_FACTS,BRANDS,MODELS,AGENCIES,LISTINGS,OPERATORS,PACKAGES,DIRECTORY,REVIEW_BANK}=O;

/* ================= utilities ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const inr=n=>"₹"+Math.round(n).toLocaleString("en-IN");
const pad=n=>String(n).padStart(2,"0");
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
const toLocal=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDay=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDT=s=>{const d=new Date(s);return isNaN(d)?"":d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})+", "+d.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})};
const fmtD=s=>{const d=new Date(s);return isNaN(d)?"":d.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})};
const daysBetween=(a,b)=>Math.max(1,Math.ceil((new Date(b)-new Date(a))/864e5));
const initials=n=>n.split(/[\s&.-]+/).filter(w=>/^[A-Za-z]/.test(w)).slice(0,2).map(w=>w[0].toUpperCase()).join("");
const plural=(n,w,p)=>`${n} ${n===1?w:(p||w+"s")}`;
const store={get(k,d){try{const v=localStorage.getItem("opiius:"+k);return v?JSON.parse(v):d}catch(e){return d}},
             set(k,v){try{localStorage.setItem("opiius:"+k,JSON.stringify(v))}catch(e){}}};
const newId=()=>{const d=new Date();return `OP-${String(d.getFullYear()).slice(2)}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.floor(100+Math.random()*900)}`};
const placeName=id=>PLACES[id]?(PLACES[id].short||PLACES[id].name):id;

/* ================= icons ================= */
const sv=(d,extra="")=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I={
  search:sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  heart:sv('<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 5 6.3 5c2 0 3.2 1.1 3.9 2.2h3.6C14.5 6.1 15.7 5 17.7 5 21 5 22.8 8.3 21.2 11.4 19 15.6 12 20 12 20z"/>'),
  car:sv('<path d="M5 16l1.6-5.1A2 2 0 0 1 8.5 9.5h7a2 2 0 0 1 1.9 1.4L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="20" r="1"/><circle cx="16.5" cy="20" r="1"/>'),
  peak:sv('<path d="M3 20l6.5-11 4 6.5 2.5-4 5 8.5z"/><circle cx="17" cy="6" r="1.8"/>'),
  compass:sv('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  bag:sv('<rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/>'),
  user:sv('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5"/>'),
  arrow:sv('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back:sv('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  x:sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  check:sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  no:sv('<path d="M7 7l10 10M17 7L7 17"/>'),
  star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z"/></svg>',
  shield:sv('<path d="M12 3l7 3v5.5c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  filter:sv('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  sort:sv('<path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/>'),
  pin:sv('<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  down:sv('<path d="M6 9l6 6 6-6"/>'),
  cal:sv('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
  ext:sv('<path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  msg:sv('<path d="M4 5h16v11H9l-5 4z"/>'),
  info:sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  logo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M4 18l5.5-9.5 3.4 5.6 2-3.3L19.5 18z"/><rect x="4" y="19.2" width="15.5" height="1.6" rx=".8" fill="#34c38f"/></svg>'
};

/* ================= landscape art (our own destination language) ================= */
const ARTS={
  guwahati:{sky:["#f6d3a8","#e89c78"],ridges:["#9fb3a4","#6f8f7e","#3f6553","#20392f"],river:"#d9a888",sun:"#fff1d6"},
  shillong:{sky:["#dfe9ee","#b9ccd6"],ridges:["#9fb7b5","#6c9690","#3c6d62","#1d3f36"],pines:true,sun:"#f5f7f6"},
  kaziranga:{sky:["#f3e2b3","#dcbf7c"],ridges:["#c9c07f","#a8a25e","#7b8a45","#4d6331"],flat:true,trees:true,sun:"#fff6dc"},
  sohra:{sky:["#d6e3e3","#aac4c2"],ridges:["#86ab9d","#4f8571","#2a5f4b","#153a2d"],falls:true,mist:true},
  dawki:{sky:["#d9efe9","#a6d6cc"],ridges:["#8fc1a9","#53967a","#2d6b54"],river:"#3fb5a6",clear:true,sun:"#f4fbf8"},
  mawlynnong:{sky:["#e3eed9","#bcd5a6"],ridges:["#9cbf84","#6c9a58","#3f6d36","#21401e"],pines:true},
  tawang:{sky:["#cfd6ee","#8d98c7"],ridges:["#eef1f8","#9aa4c8","#5d6795","#2e3560"],peaks:true,sun:"#fdf7ea"},
  meghalaya:{sky:["#d4e4e6","#9dbdbd"],ridges:["#a6c4bb","#6b9b8b","#3d705d","#1c4234"],mist:true,falls:true,river:"#6cc2b4"}
};
function rng(seed){let s=0;for(const c of seed)s=(s*31+c.charCodeAt(0))>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296)}
function ridgePath(r,W,H,base,amp,sharp,flat){
  const pts=[];let y=base;const step=sharp?55:40;
  for(let x=-20;x<=W+40;x+=step){y=base+(r()-.5)*amp*(flat?.25:1)+(sharp&&pts.length%2?-amp*.9:0);pts.push([x,Math.max(H*.12,y)])}
  let d=`M-20 ${H} L${pts[0][0]} ${pts[0][1]}`;
  for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i];d+=sharp?` L${x1} ${y1}`:` Q${x0} ${y0} ${(x0+x1)/2} ${(y0+y1)/2}`}
  return d+` L${W+40} ${H} Z`;
}
function art(key,label=""){
  const a=ARTS[key]||ARTS.meghalaya, r=rng(key), W=800, H=500, id="g"+key+Math.floor(r()*1e6);
  const n=a.ridges.length;
  let s=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label||placeName(key))}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a.sky[0]}"/><stop offset="1" stop-color="${a.sky[1]}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${id})"/>`;
  if(a.sun)s+=`<circle cx="${560+r()*120}" cy="${110+r()*40}" r="46" fill="${a.sun}" opacity=".9"/>`;
  a.ridges.forEach((c,i)=>{
    const base=H*(.34+i*.14), amp=(a.peaks&&i<2)?150:70-i*8;
    s+=`<path d="${ridgePath(r,W,H,base,amp,a.peaks&&i<2,a.flat&&i>0)}" fill="${c}"/>`;
    if(a.pines&&i===n-2){for(let k=0;k<22;k++){const x=r()*W,y=base+10+r()*40,h=16+r()*18;s+=`<path d="M${x} ${y-h} L${x-6} ${y} L${x+6} ${y}Z" fill="${a.ridges[n-1]}" opacity=".85"/>`}}
    if(a.mist&&i===1)s+=`<rect x="0" y="${base+10}" width="${W}" height="60" fill="#fff" opacity=".28"/>`;
    if(a.falls&&i===1){/* a tiered plunge falls set into the second ridge, off to the right so it never sits behind headlines */
      const x=600+r()*90,t=base-24,b=base+H*.2;
      s+=`<path d="M${x} ${t} C${x+2} ${t+40} ${x-6} ${b-40} ${x-12} ${b} L${x+20} ${b} C${x+16} ${b-40} ${x+12} ${t+40} ${x+10} ${t}Z" fill="#fff" opacity=".78"/>
      <path d="M${x+3} ${t+6} L${x+1} ${b-6}" stroke="#dfeeee" stroke-width="1.5" opacity=".9"/><path d="M${x+8} ${t+10} L${x+11} ${b-4}" stroke="#dfeeee" stroke-width="1" opacity=".8"/>
      <ellipse cx="${x+4}" cy="${b}" rx="34" ry="9" fill="#fff" opacity=".55"/>`;
    }
  });
  if(a.trees){for(let k=0;k<7;k++){const x=40+r()*720,y=H*.72+r()*30,h=30+r()*25;s+=`<rect x="${x-2}" y="${y-h*.4}" width="4" height="${h*.5}" fill="#2f3f22"/><circle cx="${x}" cy="${y-h*.55}" r="${h*.32}" fill="#3e5a2b"/>`}}
  if(a.river)s+=`<path d="M0 ${H*.86} Q${W*.3} ${H*.8} ${W*.55} ${H*.87} T${W} ${H*.84} L${W} ${H} L0 ${H}Z" fill="${a.river}" opacity="${a.clear?.95:.85}"/>`;
  if(a.clear)s+=`<path d="M${W*.42} ${H*.9} l40 0 l-8 8 l-28 0z" fill="#1d4a44" opacity=".7"/>`;
  return s+`</svg>`;
}
const artBox=(key,extra="")=>`<div class="art" ${extra}>${art(key)}</div>`;

/* ================= state ================= */
const defDates=()=>{const a=new Date();a.setDate(a.getDate()+1);a.setHours(10,0,0,0);const b=new Date(a);b.setDate(b.getDate()+2);return [toLocal(a),toLocal(b)]};
const S={
  saved:new Set(store.get("saved",[])),
  bookings:store.get("bookings",[]),
  compare:store.get("compare",[]),
  prefs:store.get("prefs",{city:"guwahati"}),
  dates:defDates(), trav:2, shown:12, openGroups:new Set(["price","type"]),
  last:{rentals:"#/rentals/search",tours:"#/tours/search"}, scroll:{}, prevPath:"/"
};
const saveState=()=>{store.set("saved",[...S.saved]);store.set("bookings",S.bookings);store.set("compare",S.compare);store.set("prefs",S.prefs)};

/* ================= derived data helpers ================= */
const ALL_L=Object.values(LISTINGS);
const vinfo=l=>{const m=MODELS[l.model], a=AGENCIES[l.agency];return {l,m,a,b:BRANDS[m.brand],name:`${BRANDS[m.brand].name} ${m.name}`}};
const agencyListings=id=>ALL_L.filter(l=>l.agency===id);
const agencyUnits=id=>agencyListings(id).reduce((s,l)=>s+l.units,0);
const seatBucket=s=>s>=7?"7+":String(s);
const locOf=a=>a.area&&a.area!==placeName(a.city)?`${a.area}, ${placeName(a.city)}`:placeName(a.city);
const recScore=l=>{const a=AGENCIES[l.agency];return (a.real?1.2:0)+(l.rating||4.4)*2+Math.log10((l.trips||0)+10)};
/* Business model: the customer pays the agency's own price (never more than booking direct). A small advance is paid
   online to lock the booking; OPIIUS keeps its commission from that advance and the rest is paid to the agency/operator. */
const MODEL={rentAdv:.10,rentMin:300,tourAdv:.20,rentCom:.10,tourCom:.10};
const rentAdvance=t=>Math.min(t,Math.max(MODEL.rentMin,Math.round(t*MODEL.rentAdv/10)*10));
const tourAdvance=t=>Math.round(t*MODEL.tourAdv/10)*10;
const promise=(kind,ver)=>`<ul class="promise">${ver?`<li>${I.shield}<span><b>Verified ${kind==="rent"?"agency":"operator"}</b> ${kind==="rent"?"Permit, insurance and fleet checked by OPIIUS":"Registration and past trips checked by OPIIUS"}</span></li>`:""}<li>${I.check}<span><b>Same price as booking direct</b> No markup, no hidden fees</span></li><li>${I.star}<span><b>OPIIUS Promise</b> If they cancel on you, we find a replacement or refund your advance in full</span></li></ul>`;
const pkgMatchesDest=(p,d)=>p.dest===d||p.stops.includes(d)||(d==="meghalaya"&&PLACES[p.dest]&&PLACES[p.dest].state==="Meghalaya");
const pkgList=()=>Object.entries(PACKAGES).map(([id,p])=>({id,...p}));
const durBucket=d=>d<=2?"1-2":d<=4?"3-4":d<=7?"5-7":"7+";

/* ================= small components ================= */
const stars=(r,n,cls="")=>r?`<span class="stars ${cls}">${I.star}${r.toFixed(1)}${n!=null?`<span class="n">(${n})</span>`:""}</span>`:`<span class="stars ${cls}"><span class="bdg soft">New</span></span>`;
const demoBadge=o=>o.real?`<span class="bdg real">Founding partner</span>`:o.demo?`<span class="bdg demo" title="Sample listing shown to explain OPIIUS">DEMO</span>`:"";
const verBadge=o=>o.verified?`<span class="bdg ver">${I.shield}Verified</span>`:"";
const avatar=(name,hue,cls="")=>`<span class="av ${cls}" style="background:hsl(${hue} 38% 34%)">${esc(initials(name))}</span>`;
const heartBtn=(key,label)=>`<button type="button" class="heart" data-save="${key}" aria-pressed="${S.saved.has(key)}" aria-label="${S.saved.has(key)?"Remove from":"Save to"} wishlist: ${esc(label)}">${I.heart}</button>`;
const modelImg=(m,alt,extra="")=>m.photo?`<img src="${m.photo}" alt="${esc(alt)}" loading="lazy" decoding="async" class="${m.studio?"studio":""}" ${extra}>`:`<div class="art">${art(m.kind==="bike"?"tawang":"shillong",alt)}</div>`;
const LOGO_WM={royalenfield:'<span class="wm serif">ROYAL ENFIELD</span>',mahindra:'<span class="wm">mahindra</span>'};
const brandMark=id=>O.LOGOS[id]?`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${O.LOGOS[id]}"/></svg>`:(LOGO_WM[id]||`<span class="wm">${esc(BRANDS[id].name)}</span>`);

function vehCard(l,opts={}){
  const v=vinfo(l), m=v.m, a=v.a, d=opts.days||daysBetween(S.dates[0],S.dates[1]);
  return `<article class="card rise" style="--i:${opts.i||0}">
    <a class="media" href="#/vehicle/${l.id}" data-vt="veh-${l.id}" aria-label="${esc(v.name)} from ${esc(a.name)}">${modelImg(m,v.name,`data-vtimg="veh-${l.id}"`)}
      <span class="tl">${demoBadge(a)}</span></a>
    ${heartBtn("v:"+l.id,v.name)}
    <a class="body" href="#/vehicle/${l.id}" style="text-decoration:none">
      <div class="t"><h3>${esc(v.name)}</h3>${stars(l.rating,l.trips?null:null)}</div>
      <div class="spec">${m.type} · ${m.trans} · ${m.seats} seats${l.trips?` · ${l.trips} trips`:""}</div>
      <div class="by">${avatar(a.name,a.hue)}<span>${esc(a.name)}</span>${a.verified?`<span class="bdg ver">${I.shield}Verified</span>`:""}</div>
      <div class="price"><b class="num">${inr(l.price)}</b><span>/ day</span><span class="tot">${inr(l.price*d)} for ${plural(d,"day")}</span></div>
    </a>
    ${opts.nocmp?"":`<label class="cmp"><input type="checkbox" data-cmp="${l.id}" ${S.compare.includes(l.id)?"checked":""}> Compare</label>`}
  </article>`;
}
function agencyCard(id,i=0){
  const a=AGENCIES[id], ls=agencyListings(id), th=ls.map(l=>MODELS[l.model]).filter(m=>m.photo).slice(0,3);
  const lo=Math.min(...ls.map(l=>l.price));
  return `<a class="acard rise" style="--i:${i}" href="#/agency/${id}">
    <div class="top">${avatar(a.name,a.hue)}<div style="min-width:0"><b>${esc(a.name)}</b><span>${esc(locOf(a))}</span></div></div>
    <div class="thumbs">${th.map(m=>`<span><img src="${m.photo}" alt="" loading="lazy" class="${m.studio?"studio":""}"></span>`).join("")}</div>
    <div class="facts">${stars(a.rating,a.reviews||null)}<span><b>${agencyUnits(id)}</b> vehicles</span><span>from <b>${inr(lo)}</b>/day</span></div>
    <div class="tags">${demoBadge(a)}${verBadge(a)}${a.delivery?'<span class="bdg soft">Delivery</span>':""}</div>
  </a>`;
}
function operatorCard(id,i=0){
  const o=OPERATORS[id], ps=pkgList().filter(p=>p.op===id), lo=Math.min(...ps.map(p=>p.price));
  return `<a class="acard rise" style="--i:${i}" href="#/operator/${id}">
    <div class="top">${avatar(o.name,o.hue)}<div style="min-width:0"><b>${esc(o.name)}</b><span>Based in ${esc(placeName(o.base))}</span></div></div>
    <div class="facts">${stars(o.rating,o.reviews)}<span><b>${ps.length}</b> packages</span><span>from <b>${inr(lo)}</b></span></div>
    <div class="tags">${demoBadge(o)}${verBadge(o)}</div></a>`;
}
function pkgCard(p,opts={}){
  const o=OPERATORS[p.op], trav=opts.trav||S.trav, stops=[...new Set(p.stops.filter(s=>s!=="guwahati"&&!PLACES[s].point||["umiam","laitlum","nongriat","shnongpdeng","sela"].includes(s)))].slice(0,4);
  return `<article class="card pcard rise" style="--i:${opts.i||0}">
    <a class="media" href="#/package/${p.id}" aria-label="${esc(p.title)}">${artBox(ARTS[p.dest]?p.dest:"meghalaya")}${pkgPhoto(p)?`<img class="art" src="${pkgPhoto(p)}" alt="" loading="lazy" style="object-fit:cover;width:100%;height:100%">`:""}<span class="tl">${demoBadge(o)}</span><span class="dur">${p.days} days · ${p.nights} ${p.nights===1?"night":"nights"}</span></a>
    ${heartBtn("p:"+p.id,p.title)}
    <a class="body" href="#/package/${p.id}" style="text-decoration:none">
      <div class="t"><h3>${esc(p.title)}</h3>${stars(p.rating)}</div>
      <div class="stops">${stops.map(placeName).map(esc).join(" · ")}</div>
      <div class="by">${avatar(o.name,o.hue)}<span>${esc(o.name)}</span>${o.verified?`<span class="bdg ver">${I.shield}Verified</span>`:""}</div>
      <div class="price"><b class="num">${inr(p.price)}</b><span>/ person</span><span class="tot">${inr(p.price*trav)} for ${plural(trav,"traveller")}</span></div>
    </a></article>`;
}
function placeTile(id,sub,href,i=0){
  const photo=destPhoto(id)?`<img class="art" src="${destPhoto(id)}" alt="" loading="lazy" style="object-fit:cover;width:100%;height:100%">`:"";
  return `<a class="ptile rise" style="--i:${i}" href="${href}">${artBox(PLACES[id].art||id)}${photo}<b>${esc(placeName(id))}</b><span>${esc(sub)}</span></a>`;
}
function empty(title,text,action=""){return `<div class="empty">${I.compass.replace("<svg",'<svg width="34" height="34"')}<h3>${esc(title)}</h3><p>${text}</p>${action}</div>`}

/* ================= router ================= */
function parse(){const h=location.hash.slice(1)||"/";const i=h.indexOf("?");return {path:(i<0?h:h.slice(0,i))||"/",q:new URLSearchParams(i<0?"":h.slice(i+1))}}
const ROUTES=[
  [/^\/$/,()=>vHome()],
  [/^\/rentals$/,()=>vRentals()],
  [/^\/rentals\/search$/,(m,q)=>vRentalResults(q)],
  [/^\/rentals\/in\/([\w-]+)$/,(m,q)=>{q.set("city",m[1]);return vRentalResults(q,true)}],
  [/^\/vehicle\/([\w-]+)$/,m=>vVehicle(m[1])],
  [/^\/agencies$/,(m,q)=>vAgencies(q)],
  [/^\/agency\/([\w-]+)$/,m=>vAgency(m[1])],
  [/^\/brand\/([\w-]+)$/,(m,q)=>vBrand(m[1],q)],
  [/^\/tours$/,()=>vTours()],
  [/^\/tours\/search$/,(m,q)=>vTourResults(q)],
  [/^\/destination\/([\w-]+)$/,m=>vDestination(m[1])],
  [/^\/package\/([\w-]+)$/,m=>vPackage(m[1])],
  [/^\/operator\/([\w-]+)$/,m=>vOperator(m[1])],
  [/^\/explore$/,()=>vExplore()],
  [/^\/saved$/,(m,q)=>vSaved(q)],
  [/^\/bookings$/,(m,q)=>vBookings(q)],
  [/^\/booking\/([\w-]+)$/,m=>vBooking(m[1])],
  [/^\/profile$/,()=>vProfile()],
  [/^\/compare$/,()=>vCompare()],
  [/^\/partners$/,()=>vPartners()]
];
let current=null;
function render(){
  const {path,q}=parse();
  let v=null;
  for(const [re,fn] of ROUTES){const m=path.match(re);if(m){v=fn(m,q);break}}
  if(!v)v=vNotFound();
  current={path,view:v};
  const el=$("#view");
  el.innerHTML=`<div class="view-in ${v.cls||""}">${v.html}</div>`;
  document.title=v.title?`${v.title} · OPIIUS`:"OPIIUS · Rentals and tours in the Northeast";
  $$("[data-nav]").forEach(a=>a.setAttribute("aria-current",a.dataset.nav===v.section?"page":"false"));
  document.body.classList.toggle("at-home",v.section==="home");document.body.classList.toggle("overhero",v.section==="home"||!!v.hero);document.body.classList.toggle("scrolled",scrollY>40);
  if(v.mount)v.mount();
  updateBadges(); renderTray();
}
function navigate(){
  const {path}=parse(), prev=S.prevPath, fromDetail=/^\/(vehicle|package|agency|operator|booking|destination|brand)\//.test(prev);
  if(/^\/(rentals\/search|rentals\/in|tours\/search)/.test(prev))S.scroll[prev]=scrollY;
  const go=()=>{render(); const key=path; if(fromDetail&&S.scroll[key]!=null)scrollTo(0,S.scroll[key]);else scrollTo(0,0)};
  S.prevPath=path;
  if(document.startViewTransition&&!reduced)document.startViewTransition(go);else go();
}
function replaceQuery(q){const {path}=parse();const s=q.toString();history.replaceState(null,"","#"+path+(s?"?"+s:""));S.shown=12;if(current&&current.view.update)current.view.update()}
function listParam(q,k){return (q.get(k)||"").split(",").filter(Boolean)}

/* ================= HOME: photo hero, two doors, destinations ================= */
const IMG_HOME="assets/opiius/img/";
const phPanel=src=>`<div class="phx" aria-hidden="true"><img class="soft" src="${src}" alt=""><img class="sharp" src="${src}" alt=""></div>`;
const HOME_DEST=["meghalaya","shillong","dawki","kaziranga","sohra","tawang"];
const destPhoto=d=>HOME_DEST.includes(d)?`${IMG_HOME}d-${d}.jpg`:null;
/* a package's photo: one of its photographed stops, varied per package so neighbouring cards differ */
const pkgPhoto=p=>{const c=[...new Set([p.dest,...p.stops])].filter(d=>destPhoto(d)&&d!=="meghalaya");if(!c.length)return destPhoto(p.dest);
  let h=0;for(const ch of p.id)h=(h*31+ch.charCodeAt(0))>>>0;return destPhoto(c[h%c.length])};
/* full-bleed photo hero shared by the section pages; the header floats over it (view.hero) */
const pageHero=(img,eyebrow,title,sub,{vt="",tall=false,extra=""}={})=>`<section class="pghero ${tall?"tall":""}" ${vt?`style="view-transition-name:${vt}"`:""}>${phPanel(IMG_HOME+img)}
  <div class="wrap">${eyebrow?`<span class="eyebrow">${eyebrow}</span>`:""}<h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:""}${extra}</div></section>`;
function vHome(){
  const tomorrow=toDay(new Date(Date.now()+864e5));
  const where=`<option value="">Anywhere in the Northeast</option><optgroup label="Destinations">${DESTINATIONS.map(d=>`<option value="${d}">${esc(placeName(d))}</option>`).join("")}</optgroup><optgroup label="Rent a vehicle in">${RENTAL_CITIES.filter(c=>!DESTINATIONS.includes(c)).map(c=>`<option value="${c}">${esc(placeName(c))}</option>`).join("")}</optgroup>`;
  const trust=[[I.shield,"Trusted partners","Verified agencies & operators"],[I.check,"Clear terms","Deposit, km & fuel up front"],[I.msg,"Talk to them first","Enquire before you book"],[I.star,"Best prices","Compare & save"],[I.heart,"Save & plan","Wishlist your favourites"]];
  return {title:"",section:"home",cls:"at-home-main",html:`
  <section class="hhero">${phPanel(IMG_HOME+"hero.jpg")}
    <div class="wrap">
      <span class="eyebrow">Travel, rentals &amp; experiences</span>
      <h1>Where do you want to go today?</h1>
      <p class="sub">Book vehicles, discover tour packages and explore the most beautiful places in the Northeast, all in one place.</p>
      <form class="hsb" id="hform" autocomplete="off">
        <div class="f">${I.pin}<div><label for="h-where">Where are you going?</label><select id="h-where">${where}</select></div></div>
        <div class="f">${I.cal}<div><label for="h-date">When?</label><input type="date" id="h-date" value="${tomorrow}" min="${toDay(new Date())}"></div></div>
        <div class="f">${I.user}<div><label for="h-trav">Travellers</label><select id="h-trav">${[1,2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${n===S.trav?"selected":""}>${n} ${n===1?"adult":"adults"}</option>`).join("")}</select></div></div>
        <button type="submit">${I.search}Search</button>
      </form>
    </div>
    <span class="script" aria-hidden="true">More journeys,<br>more stories</span>
  </section>
  <div class="wrap">
    <section class="hsec"><div class="pdoors">
      <a class="pdoor" href="#/rentals" style="view-transition-name:door-rentals">${phPanel(IMG_HOME+"door-rent.jpg")}
        <div class="in"><span class="ic">${I.car}</span><h2>Rentals</h2><h3>Cars &amp; Bikes</h3><p>Find the perfect ride from trusted rental agencies.</p><span class="obtn">Explore Rentals ${I.arrow}</span></div></a>
      <a class="pdoor tour" href="#/tours" style="view-transition-name:door-tours">${phPanel(IMG_HOME+"door-tour.jpg")}
        <div class="in"><span class="ic">${I.peak}</span><h2>Tours</h2><h3>Tour Packages</h3><p>Discover amazing destinations and compare tour packages.</p><span class="obtn">Explore Tours ${I.arrow}</span></div></a>
    </div></section>
    <section class="hsec">
      <div class="shead"><div><h2>Popular Destinations</h2><p>Explore top places and plan your next adventure</p></div><a href="#/explore">View all destinations ${I.arrow}</a></div>
      <div class="dphotos">${HOME_DEST.map(d=>`<a class="dphoto" href="#/destination/${d}"><img src="${IMG_HOME}d-${d}.jpg" alt="" loading="lazy" decoding="async"><b>${esc(placeName(d))}</b></a>`).join("")}</div>
    </section>
  </div>
  <section class="trust"><div class="wrap">${trust.map(([ic,t,d])=>`<div class="t">${ic}<b>${t}</b><span>${d}</span></div>`).join("")}</div></section>
  <div class="banners">
    <a class="banner" href="#/rentals">${phPanel(IMG_HOME+"ban-rent.jpg")}<div class="in"><small>Drive your freedom</small><h2>Rent a Vehicle</h2><p>Cars, bikes and scooters from local agencies, prices side by side.</p><span class="obtn">Browse Rentals ${I.arrow}</span></div></a>
    <a class="banner tour" href="#/tours">${phPanel(IMG_HOME+"ban-tour.jpg")}<div class="in"><small>Explore the extraordinary</small><h2>Book a Tour</h2><p>Curated packages for every kind of traveller, from weekend getaways to week-long trips.</p><span class="obtn">Explore Tours ${I.arrow}</span></div></a>
  </div>`,
  mount(){
    $("#hform").addEventListener("submit",e=>{e.preventDefault();
      const w=$("#h-where").value,d=$("#h-date").value;S.trav=+$("#h-trav").value||2;
      if(d){const f=new Date(d+"T10:00"),t=new Date(f);t.setDate(t.getDate()+2);S.dates=[toLocal(f),toLocal(t)]}
      if(!w){location.hash="#/tours/search?"+new URLSearchParams({date:d,trav:S.trav});return}
      location.hash=DESTINATIONS.includes(w)?`#/destination/${w}`:`#/rentals/search?city=${w}&from=${encodeURIComponent(S.dates[0])}&to=${encodeURIComponent(S.dates[1])}`;
    });
  }};
}

/* ================= RENTALS landing ================= */
function citySelect(id,val){return `<select id="${id}">${RENTAL_CITIES.map(c=>`<option value="${c}" ${c===val?"selected":""}>${esc(placeName(c))}, ${esc(PLACES[c].state)}</option>`).join("")}</select>`}
function rentalSearchForm(city,cat="all"){
  return `<form class="sbox" id="rform" autocomplete="off">
    <div class="seg" role="group" aria-label="Vehicle type">${[["all","All vehicles"],["car","Cars"],["bike","Bikes & scooters"]].map(([k,l])=>`<button type="button" data-rcat="${k}" aria-pressed="${k===cat}">${l}</button>`).join("")}</div>
    <input type="hidden" id="r-cat" value="${cat}">
    <div class="sgrid">
      <div class="sf"><label for="r-city">Where?</label>${citySelect("r-city",city)}</div>
      <div class="sf"><label for="r-from">Pickup</label><input type="datetime-local" id="r-from" value="${S.dates[0]}"></div>
      <div class="sf"><label for="r-to">Return</label><input type="datetime-local" id="r-to" value="${S.dates[1]}"></div>
      <button class="sgo" type="submit">${I.search}Search</button>
    </div></form>`;
}
function vRentals(){
  const city=S.prefs.city||"guwahati";
  const popular=ALL_L.filter(l=>AGENCIES[l.agency].city===city).sort((a,b)=>recScore(b)-recScore(a)).filter((l,i,arr)=>arr.findIndex(x=>x.model===l.model)===i).slice(0,8);
  const ags=Object.keys(AGENCIES).filter(id=>AGENCIES[id].city===city).sort((a,b)=>(AGENCIES[b].real?1:0)-(AGENCIES[a].real?1:0)||(AGENCIES[b].rating||0)-(AGENCIES[a].rating||0)).slice(0,6);
  return {title:"Rentals",section:"rentals",hero:true,html:`${pageHero("hero.jpg","Car &amp; bike rentals","Your journey<br>starts here","Reliable vehicles from trusted local agencies for unforgettable journeys.",{vt:"door-rentals",tall:true})}<div class="wrap">
    ${rentalSearchForm(city)}
    <section class="sec"><div class="sec-h"><div><h2>Popular rentals</h2><p>Highly rated in ${esc(placeName(city))}, one per model.</p></div><a class="btn sm more" href="#/rentals/in/${city}">View all rentals ${I.arrow}</a></div>
      <div class="row-scroll">${popular.filter(l=>MODELS[l.model].photo).slice(0,4).map((l,i)=>vehCard(l,{i,nocmp:true})).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Rent a vehicle in</h2><p>Pick a place to see every agency's vehicles there.</p></div></div>
      <div class="tiles">${RENTAL_CITIES.map((c,i)=>{const n=ALL_L.filter(l=>AGENCIES[l.agency].city===c).length;return placeTile(c,n?`${plural(n,"vehicle")} listed`:"Get vehicles from Shillong",`#/rentals/in/${c}`,i)}).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Explore by brand</h2><p>See which agencies carry the model you want.</p></div></div>
      <div class="brands">${Object.keys(BRANDS).map(b=>{const n=new Set(ALL_L.filter(l=>MODELS[l.model].brand===b).map(l=>l.model)).size;return `<a class="btile" href="#/brand/${b}">${brandMark(b)}<span>${esc(BRANDS[b].name)}</span><small>${plural(n,"model")}</small></a>`}).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Rental agencies in ${esc(placeName(city))}</h2><p>Every agency has its own page with fleet, policies and reviews.</p></div><a class="btn sm more" href="#/agencies?city=${city}">All agencies ${I.arrow}</a></div>
      <div class="grid">${ags.map(agencyCard).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>How renting on OPIIUS works</h2></div></div>
      <div class="steps3"><div><b>1. Compare</b><span>Same car, different agencies, prices and terms.</span></div><div><b>2. Request</b><span>Pick dates and send a booking request.</span></div><div><b>3. Agency confirms</b><span>Availability, deposit and pickup are confirmed.</span></div><div><b>4. Drive</b><span>Show your licence, pay the agency and go.</span></div></div></section>
  </div>`,mount(){bindRentalForm()}};
}
function bindRentalForm(){
  const f=$("#rform");if(!f)return;
  f.addEventListener("submit",e=>{e.preventDefault();
    const from=$("#r-from").value,to=$("#r-to").value;
    if(from&&to&&new Date(to)<=new Date(from)){toast("Return must be after pickup.");return}
    if(from&&to)S.dates=[from,to];
    const city=$("#r-city").value;S.prefs.city=city;saveState();
    const q=new URLSearchParams();q.set("city",city);q.set("from",S.dates[0]);q.set("to",S.dates[1]);const c=$("#r-cat").value;if(c!=="all")q.set("cat",c);
    closeSheet();location.hash="#/rentals/search?"+q.toString();
  });
}

/* ================= RENTAL results ================= */
function rf(q){
  const from=q.get("from")||S.dates[0],to=q.get("to")||S.dates[1];S.dates=[from,to];
  return {city:q.get("city")||S.prefs.city||"guwahati",from,to,cat:q.get("cat")||"all",type:listParam(q,"type"),brand:listParam(q,"brand"),trans:listParam(q,"trans"),
    fuel:listParam(q,"fuel"),seats:listParam(q,"seats"),agency:listParam(q,"agency"),feat:listParam(q,"feat"),pickup:listParam(q,"pickup"),
    rating:+q.get("rating")||0,pmin:+q.get("pmin")||0,pmax:+q.get("pmax")||0,model:q.get("model")||"",sort:q.get("sort")||"rec"};
}
const PMIN=300,PMAX=5000;
function rMatch(l,f,skip){
  const m=MODELS[l.model],a=AGENCIES[l.agency];
  if(a.city!==f.city)return false;
  if(skip!=="cat"&&f.cat!=="all"&&m.kind!==f.cat)return false;
  if(skip!=="type"&&f.type.length&&!f.type.includes(m.type))return false;
  if(skip!=="brand"&&f.brand.length&&!f.brand.includes(m.brand))return false;
  if(skip!=="trans"&&f.trans.length&&!f.trans.includes(m.trans))return false;
  if(skip!=="fuel"&&f.fuel.length&&!f.fuel.includes(m.fuel))return false;
  if(skip!=="seats"&&f.seats.length&&!f.seats.includes(seatBucket(m.seats)))return false;
  if(skip!=="agency"&&f.agency.length&&!f.agency.includes(l.agency))return false;
  if(skip!=="feat"&&f.feat.length&&!f.feat.every(x=>m.features.includes(x)))return false;
  if(skip!=="pickup"&&f.pickup.length&&!a.pickups.some(p=>f.pickup.includes(p)))return false;
  if(skip!=="rating"&&f.rating&&!((l.rating||0)>=f.rating))return false;
  if(skip!=="price"&&((f.pmin&&l.price<f.pmin)||(f.pmax&&l.price>f.pmax)))return false;
  if(f.model&&l.model!==f.model)return false;
  return true;
}
function rSorted(list,sort){
  const s=[...list];
  if(sort==="plow")s.sort((a,b)=>a.price-b.price);
  else if(sort==="phigh")s.sort((a,b)=>b.price-a.price);
  else if(sort==="rating")s.sort((a,b)=>(b.rating||0)-(a.rating||0)||b.trips-a.trips);
  else{
    /* recommended: best-scored first, but one listing per model per round so the first page shows variety */
    s.sort((a,b)=>(recScore(b)-(MODELS[b.model].photo?0:2))-(recScore(a)-(MODELS[a.model].photo?0:2)));
    const rounds=[],seen={};s.forEach(l=>{const r=seen[l.model]=(seen[l.model]||0)+1;(rounds[r-1]=rounds[r-1]||[]).push(l)});
    return rounds.flat();
  }
  return s;
}
function facet(f,key,getVals){const base=ALL_L.filter(l=>rMatch(l,f,key)),c={};base.forEach(l=>getVals(l).forEach(v=>c[v]=(c[v]||0)+1));return c}
function fGroup(key,title,optsHtml,activeCount){
  return `<details class="fgrp" data-g="${key}" ${S.openGroups.has(key)?"open":""}><summary>${esc(title)}${activeCount?`<em>${activeCount} selected</em>`:""}${I.down}</summary>${optsHtml}</details>`;
}
function checks(key,vals,counts,sel,label=v=>v){
  const all=[...new Set([...vals])];
  return `<div class="fopts">${all.map(v=>{const n=counts[v]||0,on=sel.includes(v);return `<label class="fopt ${!n&&!on?"dis":""}"><input type="checkbox" data-fk="${key}" value="${esc(v)}" ${on?"checked":""} ${!n&&!on?"disabled":""}>${esc(label(v))}<small>${n}</small></label>`}).join("")}</div>`;
}
function dualRange(lo,hi,min,max,step,fmt){
  const pc=v=>((v-min)/(max-min)*100);
  return `<div class="prange"><span id="pr-lo">${fmt(lo)}</span><span id="pr-hi">${fmt(hi)}${hi>=max?"+":""}</span></div>
    <div class="dual" data-min="${min}" data-max="${max}"><span class="track"></span><span class="fill" style="left:${pc(lo)}%;right:${100-pc(hi)}%"></span>
      <input type="range" aria-label="Minimum price" data-range="lo" min="${min}" max="${max}" step="${step}" value="${lo}">
      <input type="range" aria-label="Maximum price" data-range="hi" min="${min}" max="${max}" step="${step}" value="${hi}"></div>`;
}
function rentalFilters(f){
  const T=["Hatchback","Sedan","SUV","MUV","Scooter","Motorcycle"];
  const typeC=facet(f,"type",l=>[MODELS[l.model].type]), types=T.filter(t=>typeC[t]||f.type.includes(t));
  const brandC=facet(f,"brand",l=>[MODELS[l.model].brand]), brands=Object.keys(BRANDS).filter(b=>brandC[b]||f.brand.includes(b));
  const transC=facet(f,"trans",l=>[MODELS[l.model].trans]), fuelC=facet(f,"fuel",l=>[MODELS[l.model].fuel]), seatC=facet(f,"seats",l=>[seatBucket(MODELS[l.model].seats)]);
  const agC=facet(f,"agency",l=>[l.agency]), ags=Object.keys(AGENCIES).filter(a=>AGENCIES[a].city===f.city);
  const featC=facet(f,"feat",l=>MODELS[l.model].features), feats=["AC","Bluetooth","GPS","Sunroof","4x4","Rear AC vents","High ground clearance","Helmet included"].filter(x=>featC[x]||f.feat.includes(x));
  const pickC=facet(f,"pickup",l=>AGENCIES[l.agency].pickups), picks=[...new Set(ags.flatMap(a=>AGENCIES[a].pickups))];
  const lo=f.pmin||PMIN,hi=f.pmax||PMAX;
  const nActive=["type","brand","trans","fuel","seats","agency","feat","pickup"].reduce((s,k)=>s+f[k].length,0)+(f.rating?1:0)+(f.pmin||f.pmax?1:0);
  return `<div data-panel="rent">
    <div class="fclear"><b>Filters</b>${nActive?`<button type="button" class="link" data-clear>Clear all</button>`:""}</div>
    ${fGroup("price","Price per day",dualRange(lo,hi,PMIN,PMAX,100,inr),f.pmin||f.pmax?1:0)}
    ${fGroup("type","Vehicle type",checks("type",types,typeC,f.type),f.type.length)}
    ${fGroup("brand","Brand",checks("brand",brands,brandC,f.brand,b=>BRANDS[b].name),f.brand.length)}
    ${fGroup("trans","Transmission",checks("trans",["Automatic","Manual"],transC,f.trans),f.trans.length)}
    ${fGroup("fuel","Fuel",checks("fuel",["Petrol","Diesel","EV","Hybrid"],fuelC,f.fuel),f.fuel.length)}
    ${fGroup("seats","Seats",`<div class="fchips">${["2","4","5","6","7+"].map(s=>`<button type="button" class="chip" data-fk-toggle="seats" data-v="${s}" aria-pressed="${f.seats.includes(s)}" ${!seatC[s]&&!f.seats.includes(s)?"disabled style='opacity:.4'":""}>${s}</button>`).join("")}</div>`,f.seats.length)}
    ${fGroup("agency","Rental agency",checks("agency",ags,agC,f.agency,a=>AGENCIES[a].name+(AGENCIES[a].demo?" (demo)":"")),f.agency.length)}
    ${fGroup("rating","Rating",`<div class="fchips">${[["0","Any"],["4","4.0+"],["4.5","4.5+"]].map(([v,l])=>`<button type="button" class="chip" data-fset="rating" data-v="${v}" aria-pressed="${String(f.rating||0)===v}">${v!=="0"?"★ ":""}${l}</button>`).join("")}</div>`,f.rating?1:0)}
    ${fGroup("pickup","Pickup location",checks("pickup",picks,pickC,f.pickup),f.pickup.length)}
    ${fGroup("feat","Features",checks("feat",feats,featC,f.feat),f.feat.length)}
  </div>`;
}
const SORTS_R=[["rec","Recommended"],["plow","Price: low to high"],["phigh","Price: high to low"],["rating","Highest rated"]];
function vRentalResults(q,byCity){
  const f=rf(q);
  const view={title:`Rentals in ${placeName(f.city)}`,section:"rentals",
    html:`<div class="rbar"><div class="wrap">
      <button type="button" class="rsum" data-edit="rent"><div style="min-width:0"><b>${esc(placeName(f.city))}</b><br><span>${fmtDT(f.from)} → ${fmtDT(f.to)}</span></div><i>${I.search}</i></button>
      <div class="sorts" id="sorts"></div>
      <div class="mob"><button type="button" class="btn sm" data-sheet="filters">${I.filter}Filters<span id="fcount"></span></button><button type="button" class="btn sm" data-sheet="sort">${I.sort}Sort</button></div>
    </div></div>
    <div class="wrap results">
      <aside class="fpanel side" id="fside" aria-label="Filters"></aside>
      <section aria-live="polite"><div id="rintro"></div><div class="rhead"><h1 id="rtitle"></h1><span class="c" id="rcount"></span></div><div class="active-f" id="ractive"></div><div id="rlist"></div></section>
    </div>`,
    update(){
      const {q}=parse(), f=rf(q), list=rSorted(ALL_L.filter(l=>rMatch(l,f)),f.sort), d=daysBetween(f.from,f.to);
      S.last.rentals=location.hash;
      const kind=f.cat==="car"?"Cars":f.cat==="bike"?"Bikes & scooters":"Vehicles";
      $("#rtitle").textContent=`${f.model?BRANDS[MODELS[f.model].brand].name+" "+MODELS[f.model].name:kind} in ${placeName(f.city)}`;
      $("#rcount").textContent=`${plural(list.length,"vehicle")} from ${plural(new Set(list.map(l=>l.agency)).size,"agency","agencies")} · ${plural(d,"day")}`;
      $("#sorts").innerHTML=SORTS_R.map(([k,l])=>`<button type="button" class="chip" data-fset="sort" data-v="${k}" aria-pressed="${f.sort===k}">${l}</button>`).join("");
      $("#fside").innerHTML=rentalFilters(f);
      const chips=[];["type","trans","fuel","seats","feat","pickup"].forEach(k=>f[k].forEach(v=>chips.push([k,v,v])));
      f.brand.forEach(v=>chips.push(["brand",v,BRANDS[v].name]));f.agency.forEach(v=>chips.push(["agency",v,AGENCIES[v].name]));
      if(f.rating)chips.push(["rating","","★ "+f.rating+"+"]);if(f.pmin||f.pmax)chips.push(["price","",`${inr(f.pmin||PMIN)} to ${inr(f.pmax||PMAX)}`]);
      if(f.cat!=="all")chips.push(["cat","",f.cat==="car"?"Cars":"Bikes & scooters"]);if(f.model)chips.push(["model","",MODELS[f.model].name]);
      $("#ractive").innerHTML=chips.map(([k,v,l])=>`<button type="button" data-unset="${k}" data-v="${esc(v)}">${esc(l)} ${I.x.replace("<svg",'<svg width="12" height="12"')}</button>`).join("");
      const fc=$("#fcount");if(fc)fc.textContent=chips.length?` (${chips.length})`:"";
      const pl=PLACES[f.city];
      $("#rintro").innerHTML=byCity||!list.length?`<div class="intro">${artBox(pl.art||f.city)}<div><b>Renting in ${esc(placeName(f.city))}</b><p>${esc(pl.about)}${pl.pickups.length?" Pickup points include "+esc(pl.pickups.slice(0,3).join(", "))+".":""}</p></div></div>`:"";
      if(!list.length){
        const near=pl.nearest;
        $("#rlist").innerHTML=empty(near?`No agencies in ${placeName(f.city)} yet`:"No vehicles match these filters",
          near?`Most travellers rent in ${esc(placeName(near))} and drive to ${esc(placeName(f.city))}.`:"Try removing a filter or widening the price range.",
          near?`<a class="btn dark" href="#/rentals/in/${near}">See vehicles in ${esc(placeName(near))}</a>`:`<button type="button" class="btn dark" data-clear>Clear filters</button>`);
      } else {
        const shown=list.slice(0,S.shown);
        $("#rlist").innerHTML=`<div class="grid">${shown.map((l,i)=>vehCard(l,{i:i%12,days:d})).join("")}</div>${list.length>S.shown?`<div class="more-row"><button type="button" class="btn" data-more>Show ${Math.min(12,list.length-S.shown)} more</button></div>`:""}`;
      }
      if($("#sheet-root .sheet[data-kind=filters]"))fillFilterSheet();
    },
    mount(){this.update()}
  };
  return view;
}

/* ================= VEHICLE detail ================= */
function gallery(slides,vt){
  return `<div class="gallery"><div class="gtrack" id="gtrack">${slides.map((s,i)=>`<div class="gslide" data-gal="${i}">${s}</div>`).join("")}</div>
    ${slides.length>1?`<div class="gdots">${slides.map((_,i)=>`<i class="${i?"":"on"}"></i>`).join("")}</div><span class="gcount">1 / ${slides.length}</span>`:""}</div>`;
}
function vVehicle(id){
  const l=LISTINGS[id];if(!l)return vNotFound();
  const v=vinfo(l),m=v.m,a=v.a,city=a.city,d=daysBetween(S.dates[0],S.dates[1]);
  const others=ALL_L.filter(x=>x.model===l.model&&x.id!==l.id&&AGENCIES[x.agency].city===city).sort((x,y)=>x.price-y.price);
  const photo=m.photo?(m.studio?`<img src="${m.photo}" alt="${esc(v.name)}" class="studio" style="view-transition-name:veh-${l.id}">`:`<img src="${m.photo}" alt="" class="bgblur"><img src="${m.photo}" alt="${esc(v.name)}" class="fit" style="view-transition-name:veh-${l.id}">`):`<div class="art">${art("tawang",v.name)}</div>`;
  const slides=[photo];
  if(m.photo&&m.studio)slides.push(`<div class="art">${art(PLACES[city].art||city)}</div><img src="${m.photo}" alt="" class="studio" style="mix-blend-mode:normal;filter:drop-shadow(0 18px 16px rgba(0,0,0,.35))">`);
  const pol=a.policies, feats=m.features;
  return {title:v.name,section:"rentals",cls:"has-mcta",html:`<div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${S.last.rentals}" data-back>${I.back.replace("<svg",'<svg width="16" height="16"')} Back to results</a><span>/</span><a href="#/rentals/in/${city}">${esc(placeName(city))}</a><span>/</span><span>${esc(v.name)}</span></nav>
    <div class="dtitle"><div><h1>${esc(v.name)}</h1><div class="meta">${stars(l.rating,l.trips?l.trips+" trips":null)}<span>${esc(locOf(a))}</span>${demoBadge(a)}</div></div>
      <div class="acts">${heartBtn("v:"+l.id,v.name).replace('class="heart"','class="btn sm" style="position:static;width:auto;box-shadow:none"').replace(`${I.heart}</button>`,`${I.heart}Save</button>`)}</div></div>
    ${gallery(slides)}
    <div class="dlay"><div>
      <div class="dsec"><div class="chk">${[`${m.trans}`,`${m.seats} seats`,`${m.fuel}`,m.type,...feats].map(x=>`<div>${I.check}${esc(x)}</div>`).join("")}</div></div>
      <div class="dsec"><h2>About this vehicle</h2><p>${esc(m.about)} ${l.year?`This one is a ${l.year} model.`:""}</p></div>
      <div class="dsec"><h2>Rental information</h2><div class="info">
        <div><small>Pickup</small><b>${esc(a.pickups.join(" · "))}</b></div><div><small>Security deposit</small><b>${esc(pol.deposit)}</b></div>
        <div><small>Mileage</small><b>${esc(pol.km)}</b></div><div><small>Fuel policy</small><b>${esc(pol.fuel)}</b></div>
        <div><small>Cancellation</small><b>${esc(pol.cancel)}</b></div><div><small>Documents</small><b>${esc(pol.docs)}</b></div></div></div>
      <div class="dsec"><h2>Provided by</h2><div class="provider">${avatar(a.name,a.hue,"lg")}<div class="who"><b>${esc(a.name)}</b><div class="facts">${stars(a.rating,a.reviews||null)}${a.bookings?`<span>${a.bookings.toLocaleString("en-IN")} bookings</span>`:""}<span>${agencyUnits(l.agency)} vehicles</span><span>Since ${a.since}</span></div><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${demoBadge(a)}${verBadge(a)}</div></div><a class="btn" href="#/agency/${l.agency}">View agency</a></div></div>
      ${others.length?`<div class="dsec"><h2>Same vehicle, other agencies</h2><p class="muted" style="margin-bottom:12px">Compare the ${esc(v.name)} across ${esc(placeName(city))}.</p><div class="others">${others.map(x=>{const xa=AGENCIES[x.agency],diff=x.price-l.price;return `<a class="orow" href="#/vehicle/${x.id}">${avatar(xa.name,xa.hue)}<div><b>${esc(xa.name)}</b><span>${esc(xa.area)} · ${esc(xa.policies.km)}</span></div>${stars(x.rating)}<div class="p"><b>${inr(x.price)}</b><span style="display:block;color:${diff<0?"var(--ok)":"var(--dim)"}">${diff<0?inr(-diff)+" less":diff>0?inr(diff)+" more":"Same price"}</span></div></a>`}).join("")}</div></div>`:""}
      <div class="dsec" style="border:0"><h2>Reviews of ${esc(a.name)}</h2>${reviewsHtml(l.agency,a)}</div>
    </div>
    <aside class="book side" id="bookp">${bookPanelVehicle(l)}</aside></div></div>
    <div class="mcta"><div class="p"><b>${inr(l.price)}</b> / day<span>${inr(l.price*d)} for ${plural(d,"day")}</span></div><button type="button" class="btn brand" data-book="${l.id}">Reserve</button></div>`,
    mount(){bindGallery()}};
}
function reviewsHtml(id,a){
  if(!a.reviews)return `<p class="muted">No reviews yet. ${a.real?esc(a.name)+" is new on OPIIUS.":""}</p>`;
  const r=rng(id);const picks=[...REVIEW_BANK].sort(()=>r()-.5).slice(0,4);
  return `<p class="muted" style="margin-bottom:14px">${stars(a.rating,a.reviews)} · Sample reviews for this demo agency</p><div class="reviews">${picks.map(([n,t])=>`<div class="rev"><div class="who"><i>${esc(n[0])}</i><div><b>${esc(n)}</b><div class="muted" style="font-size:12.5px">Rented in ${esc(placeName(a.city))}</div></div></div><p>${esc(t)}</p></div>`).join("")}</div>`;
}
function bookPanelVehicle(l){
  const v=vinfo(l),a=v.a,d=daysBetween(S.dates[0],S.dates[1]);
  return `<div class="pp"><b class="num">${inr(l.price)}</b><span>/ day</span></div>
    <div class="bfields"><div><label for="b-from">Pickup</label><input type="datetime-local" id="b-from" value="${S.dates[0]}"></div><div><label for="b-to">Return</label><input type="datetime-local" id="b-to" value="${S.dates[1]}"></div>
      <div class="full"><label for="b-pick">Pickup location</label><select id="b-pick">${a.pickups.map(p=>`<option>${esc(p)}</option>`).join("")}</select></div></div>
    <div class="bsum" id="bsum"><div><span>${inr(l.price)} × ${plural(d,"day")}</span><span>${inr(l.price*d)}</span></div>
      <div><span>Refundable deposit</span><span>${esc(a.policies.deposit.split(" · ")[0])}</span></div>
      <div class="tot"><span>Total</span><span>${inr(l.price*d)}</span></div>
      <div class="now"><span>Pay now to confirm</span><span>${inr(rentAdvance(l.price*d))}</span></div><div><span>Pay ${esc(a.name)} at pickup</span><span>${inr(l.price*d-rentAdvance(l.price*d))}</span></div></div>
    <button type="button" class="btn brand block" data-book="${l.id}">Reserve</button>
    <p class="bnote">Free cancellation up to 24 hours before pickup. The deposit is paid to the agency at pickup and refunded on return.</p>${promise("rent",a.verified)}`;
}

/* ================= AGENCIES ================= */
function vAgencies(q){
  const city=q.get("city")||"all";
  const ids=Object.keys(AGENCIES).filter(id=>city==="all"||AGENCIES[id].city===city).sort((a,b)=>(AGENCIES[b].real?1:0)-(AGENCIES[a].real?1:0)||(AGENCIES[b].rating||0)-(AGENCIES[a].rating||0));
  const dir=city==="all"||city==="guwahati";
  return {title:"Rental agencies",section:"rentals",html:`<div class="wrap">
    <div class="ptitle"><span class="eyebrow">Rentals</span><h1>Rental agencies</h1><p>Browse agencies, then their fleets. Every vehicle on OPIIUS belongs to an agency.</p></div>
    <div class="tabs">${["all",...RENTAL_CITIES].filter(c=>c==="all"||Object.values(AGENCIES).some(a=>a.city===c)).map(c=>`<a class="chip ${c===city?"on":""}" href="#/agencies${c==="all"?"":"?city="+c}">${c==="all"?"All places":esc(placeName(c))}</a>`).join("")}</div>
    <div class="grid">${ids.map(agencyCard).join("")}</div>
    ${dir?`<section class="sec"><div class="sec-h"><div><h2>More agencies in Guwahati</h2><p>Real Guwahati rental companies that are not on OPIIUS yet. Details come from their own public websites; contact them directly.</p></div></div>
      <div class="dirlist">${DIRECTORY.map(d=>`<div class="dir"><b>${esc(d.name)}</b><p>${esc(d.about)}</p><div class="row"><span class="bdg soft">${d.kinds.map(k=>k==="car"?"Cars":"Bikes").join(" · ")}</span><span class="bdg soft">Not on OPIIUS</span><a class="link" style="margin-left:auto;font-size:13px" href="${d.url}" target="_blank" rel="noopener">Website ↗</a></div></div>`).join("")}</div></section>`:""}
  </div>`};
}
function vAgency(id){
  const a=AGENCIES[id];if(!a)return vNotFound();
  const ls=agencyListings(id).sort((x,y)=>recScore(y)-recScore(x)), types=[...new Set(ls.map(l=>MODELS[l.model].type))];
  const lo=Math.min(...ls.map(l=>l.price));
  return {title:a.name,section:"rentals",html:`<div class="wrap">
    <nav class="crumbs"><a href="#/agencies?city=${a.city}">Agencies in ${esc(placeName(a.city))}</a><span>/</span><span>${esc(a.name)}</span></nav>
    <div class="cover">${artBox(PLACES[a.city].art||a.city)}</div>
    <div class="vhead">${avatar(a.name,a.hue,"lg")}<div><h1>${esc(a.name)}</h1><div class="meta"><span>${I.pin.replace("<svg",'<svg width="15" height="15"')} ${esc(locOf(a))}</span>${stars(a.rating,a.reviews||null)}${demoBadge(a)}${verBadge(a)}</div></div>
      <div class="acts">${heartBtn("a:"+id,a.name).replace('class="heart"','class="btn sm" style="position:static;width:auto;box-shadow:none"').replace(`${I.heart}</button>`,`${I.heart}Save</button>`)}<button type="button" class="btn sm dark" data-enquire-agency="${id}">${I.msg}Enquire</button></div></div>
    <div class="stats"><div><b>${a.rating?a.rating.toFixed(1):"New"}</b><span>${a.reviews?plural(a.reviews,"review"):"No reviews yet"}</span></div><div><b>${a.bookings?a.bookings.toLocaleString("en-IN"):"New"}</b><span>bookings</span></div><div><b>${agencyUnits(id)}</b><span>vehicles</span></div><div><b>${inr(lo)}</b><span>lowest day price</span></div></div>
    <div class="dlay" style="grid-template-columns:1fr 340px"><div>
      <div class="dsec"><h2>About</h2><p>${esc(a.about)}</p></div>
      <div class="dsec"><h2>Fleet</h2><div class="fchips" style="margin:0 0 16px" id="afilter"><button type="button" class="chip" data-atype="" aria-pressed="true">All (${ls.length})</button>${types.map(t=>`<button type="button" class="chip" data-atype="${t}" aria-pressed="false">${t} (${ls.filter(l=>MODELS[l.model].type===t).length})</button>`).join("")}</div>
        <div class="grid" id="afleet">${ls.map((l,i)=>vehCard(l,{i})).join("")}</div></div>
      <div class="dsec" style="border:0"><h2>Reviews</h2>${reviewsHtml(id,a)}</div>
    </div><aside>
      <div class="book" style="position:sticky"><h2 style="font-size:18px">Policies</h2><div class="bsum">
        <div><span>Deposit</span><span style="text-align:right">${esc(a.policies.deposit)}</span></div><div><span>Mileage</span><span style="text-align:right">${esc(a.policies.km)}</span></div>
        <div><span>Fuel</span><span style="text-align:right">${esc(a.policies.fuel)}</span></div><div><span>Cancellation</span><span style="text-align:right">${esc(a.policies.cancel)}</span></div></div>
        <h2 style="font-size:18px;margin-top:6px">Pickup locations</h2><div class="bsum">${a.pickups.map(p=>`<div><span>${I.pin.replace("<svg",'<svg width="15" height="15"')} ${esc(p)}</span></div>`).join("")}</div>
        <p class="bnote">${esc(a.policies.docs)} needed at pickup.</p></div>
    </aside></div></div>`,
    mount(){$("#afilter").addEventListener("click",e=>{const b=e.target.closest("[data-atype]");if(!b)return;$$("#afilter .chip").forEach(c=>c.setAttribute("aria-pressed",c===b));
      const t=b.dataset.atype;$("#afleet").innerHTML=ls.filter(l=>!t||MODELS[l.model].type===t).map((l,i)=>vehCard(l,{i})).join("")})}};
}

/* ================= BRAND ================= */
function vBrand(id){
  const br=BRANDS[id];if(!br)return vNotFound();
  const models=Object.keys(MODELS).filter(k=>MODELS[k].brand===id);
  return {title:`${br.name} rentals`,section:"rentals",html:`<div class="wrap">
    <nav class="crumbs"><a href="#/rentals">Rentals</a><span>/</span><span>${esc(br.name)}</span></nav>
    <div class="ptitle" style="display:flex;gap:18px;align-items:center"><div class="btile" style="width:96px;min-height:96px;flex:none">${brandMark(id)}</div><div><h1>${esc(br.name)} rentals</h1><p>${plural(models.length,"model")} from agencies across the Northeast. Pick a model to compare agencies.</p></div></div>
    ${models.map(mid=>{const m=MODELS[mid],ls=ALL_L.filter(l=>l.model===mid).sort((a,b)=>a.price-b.price);if(!ls.length)return "";
      const cities=[...new Set(ls.map(l=>AGENCIES[l.agency].city))];
      return `<section class="sec" style="padding-top:36px"><div class="provider" style="align-items:stretch">
        <div style="position:relative;width:min(320px,100%);aspect-ratio:4/3;border-radius:18px;overflow:hidden;background:var(--mist);flex:none">${modelImg(m,br.name+" "+m.name).replace('loading="lazy"','loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:'+(m.studio?"contain;padding:8%;mix-blend-mode:multiply":"cover")+'"')}</div>
        <div class="who"><h2 style="font-size:24px;font-weight:800">${esc(br.name)} ${esc(m.name)}</h2><div class="facts">${m.type} · ${m.trans} · ${m.seats} seats · ${m.fuel}</div>
          <p class="muted" style="margin:8px 0 12px">Offered by ${plural(ls.length,"agency","agencies")} in ${cities.map(placeName).join(", ")}, from ${inr(ls[0].price)}/day.</p>
          <div class="others">${ls.slice(0,4).map(x=>{const xa=AGENCIES[x.agency];return `<a class="orow" href="#/vehicle/${x.id}">${avatar(xa.name,xa.hue)}<div><b>${esc(xa.name)}</b><span>${esc(locOf(xa))}</span></div>${stars(x.rating)}<div class="p"><b>${inr(x.price)}</b><span style="display:block">/ day</span></div></a>`}).join("")}</div>
          ${ls.length>4?`<a class="btn sm" style="margin-top:10px" href="#/rentals/search?city=${cities[0]}&model=${mid}">All ${ls.length} offers</a>`:""}</div></div></section>`}).join("")}
  </div>`};
}

/* ================= TOURS landing ================= */
function tourSearchForm(p={}){
  const dest=p.dest||"",date=p.date||toDay(new Date(Date.now()+21*864e5));
  return `<form class="sbox" id="tform" autocomplete="off"><div class="sgrid t5">
    <div class="sf"><label for="t-dest">Where?</label><select id="t-dest"><option value="">Anywhere in the Northeast</option>${DESTINATIONS.map(d=>`<option value="${d}" ${d===dest?"selected":""}>${esc(placeName(d))}</option>`).join("")}</select></div>
    <div class="sf"><label for="t-date">When?</label><input type="date" id="t-date" value="${date}"></div>
    <div class="sf"><label>Travellers</label><div class="stepper"><button type="button" data-trav="-1" aria-label="Fewer travellers">−</button><b id="t-trav">${S.trav}</b><button type="button" data-trav="1" aria-label="More travellers">+</button></div></div>
    <div class="sf"><label for="t-bud">Budget per person</label><select id="t-bud"><option value="">Any budget</option><option value="0-10000">Under ₹10,000</option><option value="10000-20000">₹10,000 to ₹20,000</option><option value="20000-30000">₹20,000 to ₹30,000</option><option value="30000-">₹30,000+</option></select></div>
    <button class="sgo" type="submit">${I.search}Explore packages</button></div></form>`;
}
function bindTourForm(){
  const f=$("#tform");if(!f)return;
  f.addEventListener("submit",e=>{e.preventDefault();const q=new URLSearchParams();
    const d=$("#t-dest").value;if(d)q.set("dest",d);q.set("date",$("#t-date").value);q.set("trav",S.trav);
    const b=$("#t-bud").value;if(b){const [lo,hi]=b.split("-");if(+lo)q.set("pmin",lo);if(hi)q.set("pmax",hi)}
    closeSheet();location.hash="#/tours/search?"+q.toString()});
}
function vTours(){
  const top=pkgList().sort((a,b)=>b.rating*Math.log10(b.reviews+10)-a.rating*Math.log10(a.reviews+10)).slice(0,8);
  const styles=[["Weekend","Short breaks from Guwahati"],["Honeymoon","Private and romantic"],["Adventure","Treks, rivers and passes"],["Family","Easy days for all ages"],["Budget","Great value trips"],["Luxury","Premium stays"]];
  return {title:"Tours",section:"tours",hero:true,html:`${pageHero("ban-tour.jpg","Tour packages","Curated journeys<br>for every traveller","Discover unique experiences, from nature escapes to cultural adventures, with local operators.",{vt:"door-tours",tall:true})}<div class="wrap">
    ${tourSearchForm()}
    <section class="sec"><div class="sec-h"><div><h2>Featured tour packages</h2><p>Top rated by travellers across operators.</p></div><a class="btn sm more" href="#/tours/search">View all tours ${I.arrow}</a></div>
      <div class="grid">${top.slice(0,4).map((p,i)=>pkgCard(p,{i})).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Explore destinations</h2></div><a class="btn sm more" href="#/explore">Explore all ${I.arrow}</a></div>
      <div class="dtiles">${["meghalaya","tawang","kaziranga","dawki","sohra"].map((d,i)=>{const n=pkgList().filter(p=>pkgMatchesDest(p,d)).length;return placeTile(d,`${plural(n,"package")} · ${PLACES[d].tagline}`,`#/destination/${d}`,i)}).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Trips for every kind of traveller</h2></div></div>
      <div class="fchips">${styles.map(([t,s])=>`<a class="chip" href="#/tours/search?type=${t}" title="${esc(s)}">${esc(t)}</a>`).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>More popular packages</h2></div><a class="btn sm more" href="#/tours/search">All packages ${I.arrow}</a></div>
      <div class="grid">${top.slice(4).map((p,i)=>pkgCard(p,{i})).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Tour operators</h2><p>Every package comes from a local operator with its own profile.</p></div></div>
      <div class="grid">${Object.keys(OPERATORS).map(operatorCard).join("")}</div></section>
  </div>`,mount(){bindTourForm()}};
}

/* ================= TOUR results ================= */
function tf(q){
  S.trav=Math.max(1,+q.get("trav")||S.trav);
  return {dest:listParam(q,"dest"),date:q.get("date")||"",trav:S.trav,pmin:+q.get("pmin")||0,pmax:+q.get("pmax")||0,dur:listParam(q,"dur"),type:listParam(q,"type"),
    act:listParam(q,"act"),op:listParam(q,"op"),inc:listParam(q,"inc"),rating:+q.get("rating")||0,sort:q.get("sort")||"rec"};
}
const TMIN=5000,TMAX=50000;
function tMatch(p,f,skip){
  if(skip!=="dest"&&f.dest.length&&!f.dest.some(d=>pkgMatchesDest(p,d)))return false;
  if(skip!=="price"&&((f.pmin&&p.price<f.pmin)||(f.pmax&&p.price>f.pmax)))return false;
  if(skip!=="dur"&&f.dur.length&&!f.dur.includes(durBucket(p.days)))return false;
  if(skip!=="type"&&f.type.length&&!f.type.some(t=>p.types.includes(t)))return false;
  if(skip!=="act"&&f.act.length&&!f.act.some(a=>p.acts.includes(a)))return false;
  if(skip!=="op"&&f.op.length&&!f.op.includes(p.op))return false;
  if(skip!=="inc"&&f.inc.length&&!f.inc.every(x=>p.inc.includes(x)))return false;
  if(skip!=="rating"&&f.rating&&p.rating<f.rating)return false;
  return true;
}
function tFacet(f,key,get){const c={};pkgList().filter(p=>tMatch(p,f,key)).forEach(p=>get(p).forEach(v=>c[v]=(c[v]||0)+1));return c}
function tourFilters(f){
  const dC=tFacet(f,"dest",p=>DESTINATIONS.filter(d=>pkgMatchesDest(p,d))), durC=tFacet(f,"dur",p=>[durBucket(p.days)]), tyC=tFacet(f,"type",p=>p.types),
        aC=tFacet(f,"act",p=>p.acts), oC=tFacet(f,"op",p=>[p.op]), iC=tFacet(f,"inc",p=>p.inc);
  const lo=f.pmin||TMIN,hi=f.pmax||TMAX;
  const nActive=["dest","dur","type","act","op","inc"].reduce((s,k)=>s+f[k].length,0)+(f.rating?1:0)+(f.pmin||f.pmax?1:0);
  return `<div data-panel="tour"><div class="fclear"><b>Filters</b>${nActive?`<button type="button" class="link" data-clear>Clear all</button>`:""}</div>
    ${fGroup("price","Price per person",dualRange(lo,hi,TMIN,TMAX,1000,inr),f.pmin||f.pmax?1:0)}
    ${fGroup("dur","Duration",checks("dur",["1-2","3-4","5-7","7+"],durC,f.dur,v=>v+" days"),f.dur.length)}
    ${fGroup("type","Trip type",checks("type",["Adventure","Family","Honeymoon","Weekend","Group","Luxury","Budget","Solo"],tyC,f.type),f.type.length)}
    ${fGroup("dest","Destination",checks("dest",DESTINATIONS,dC,f.dest,placeName),f.dest.length)}
    ${fGroup("act","Activities",checks("act",["Waterfalls","Trekking","Camping","Sightseeing","Boating","Wildlife","Culture"],aC,f.act),f.act.length)}
    ${fGroup("op","Tour operator",checks("op",Object.keys(OPERATORS),oC,f.op,o=>OPERATORS[o].name+" (demo)"),f.op.length)}
    ${fGroup("rating","Rating",`<div class="fchips">${[["0","Any"],["4","4.0+"],["4.5","4.5+"]].map(([v,l])=>`<button type="button" class="chip" data-fset="rating" data-v="${v}" aria-pressed="${String(f.rating||0)===v}">${v!=="0"?"★ ":""}${l}</button>`).join("")}</div>`,f.rating?1:0)}
    ${fGroup("inc","Includes",checks("inc",["Hotel","Meals","Transport","Guide","Activities"],iC,f.inc),f.inc.length)}
  </div>`;
}
const SORTS_T=[["rec","Recommended"],["plow","Price: low to high"],["short","Shortest"],["rating","Highest rated"]];
function vTourResults(q){
  return {title:"Tour packages",section:"tours",html:`<div class="rbar"><div class="wrap">
      <button type="button" class="rsum" data-edit="tour"><div style="min-width:0"><b id="tsum-d"></b><br><span id="tsum-s"></span></div><i>${I.search}</i></button>
      <div class="sorts" id="sorts"></div>
      <div class="mob"><button type="button" class="btn sm" data-sheet="filters">${I.filter}Filters<span id="fcount"></span></button><button type="button" class="btn sm" data-sheet="sort">${I.sort}Sort</button></div></div></div>
    <div class="wrap results"><aside class="fpanel side" id="fside" aria-label="Filters"></aside>
      <section aria-live="polite"><div class="rhead"><h1 id="rtitle"></h1><span class="c" id="rcount"></span></div><div class="active-f" id="ractive"></div><div id="rlist"></div></section></div>`,
    update(){
      const {q}=parse(),f=tf(q);S.last.tours=location.hash;
      let list=pkgList().filter(p=>tMatch(p,f));
      if(f.sort==="plow")list.sort((a,b)=>a.price-b.price);else if(f.sort==="short")list.sort((a,b)=>a.days-b.days||a.price-b.price);
      else if(f.sort==="rating")list.sort((a,b)=>b.rating-a.rating);else list.sort((a,b)=>b.rating*Math.log10(b.reviews+10)-a.rating*Math.log10(a.reviews+10));
      const place=f.dest.length===1?placeName(f.dest[0]):"Northeast";
      $("#tsum-d").textContent=f.dest.length?f.dest.map(placeName).join(", "):"Anywhere";
      $("#tsum-s").textContent=`${f.date?fmtD(f.date)+" · ":""}${plural(f.trav,"traveller")}`;
      $("#rtitle").textContent=`${place} tour packages`;
      $("#rcount").textContent=`${plural(list.length,"package")} from ${plural(new Set(list.map(p=>p.op)).size,"operator")}`;
      $("#sorts").innerHTML=SORTS_T.map(([k,l])=>`<button type="button" class="chip" data-fset="sort" data-v="${k}" aria-pressed="${f.sort===k}">${l}</button>`).join("");
      $("#fside").innerHTML=tourFilters(f);
      const chips=[];f.dest.forEach(v=>chips.push(["dest",v,placeName(v)]));f.dur.forEach(v=>chips.push(["dur",v,v+" days"]));["type","act","inc"].forEach(k=>f[k].forEach(v=>chips.push([k,v,v])));
      f.op.forEach(v=>chips.push(["op",v,OPERATORS[v].name]));if(f.rating)chips.push(["rating","","★ "+f.rating+"+"]);if(f.pmin||f.pmax)chips.push(["price","",`${inr(f.pmin||TMIN)} to ${inr(f.pmax||TMAX)}`]);
      $("#ractive").innerHTML=chips.map(([k,v,l])=>`<button type="button" data-unset="${k}" data-v="${esc(v)}">${esc(l)} ${I.x.replace("<svg",'<svg width="12" height="12"')}</button>`).join("");
      const fc=$("#fcount");if(fc)fc.textContent=chips.length?` (${chips.length})`:"";
      $("#rlist").innerHTML=list.length?`<div class="grid">${list.slice(0,S.shown).map((p,i)=>pkgCard(p,{i:i%12,trav:f.trav})).join("")}</div>${list.length>S.shown?`<div class="more-row"><button type="button" class="btn" data-more>Show more</button></div>`:""}`
        :empty("No packages match","Try a different budget or remove a filter.",`<button type="button" class="btn dark" data-clear>Clear filters</button>`);
      if($("#sheet-root .sheet[data-kind=filters]"))fillFilterSheet();
    },mount(){this.update()}};
}

/* ================= DESTINATION ================= */
function vDestination(id){
  const p=PLACES[id];if(!p||p.point)return vNotFound();
  const facts=DEST_FACTS[id]||{}, pk=pkgList().filter(x=>pkgMatchesDest(x,id)).sort((a,b)=>b.rating-a.rating);
  const rentCity=RENTAL_CITIES.includes(id)&&ALL_L.some(l=>AGENCIES[l.agency].city===id)?id:(p.nearest||"guwahati");
  const nRent=ALL_L.filter(l=>AGENCIES[l.agency].city===rentCity).length;
  const subs=id==="meghalaya"?["shillong","sohra","dawki","mawlynnong"]:[];
  return {title:p.name,section:"tours",html:`<div class="wrap">
    <nav class="crumbs"><a href="#/tours">Tours</a><span>/</span><span>${esc(p.name)}</span></nav>
    <section class="dhero">${artBox(p.art||id)}${p.photo?`<img class="art ph" style="z-index:-2" src="${p.photo}" alt="" onerror="this.remove()">`:""}
      <div class="in"><span class="eyebrow" style="color:rgba(255,255,255,.8)">${esc(p.state)}</span><h1>${esc(p.name)}</h1><p>${esc(p.about)}</p>
        <div class="acts"><a class="btn" href="#/tours/search?dest=${id}">${plural(pk.length,"package")}</a><a class="btn" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.6)" href="#/rentals/in/${rentCity}">Rent a vehicle</a>${heartBtn("d:"+id,p.name).replace('class="heart"','class="btn" style="position:static;width:auto;box-shadow:none;background:transparent;color:#fff;border-color:rgba(255,255,255,.6)"').replace(`${I.heart}</button>`,`${I.heart}Save</button>`)}</div></div>
      ${p.photoCredit?`<span class="credit">Photo: ${esc(p.photoCredit)}</span>`:""}</section>
    <div class="facts4"><div><small>Best time</small><b>${esc(facts.best||"")}</b></div><div><small>Ideal trip</small><b>${esc(facts.time||"")}</b></div><div><small>Getting there</small><b>${esc(facts.from||"")}</b></div><div><small>Good to know</small><b>${esc(facts.note||"")}</b></div></div>
    ${subs.length?`<section class="sec"><div class="sec-h"><div><h2>Places in ${esc(p.name)}</h2></div></div><div class="tiles" style="grid-template-columns:repeat(4,1fr)">${subs.map((s,i)=>placeTile(s,PLACES[s].tagline,`#/destination/${s}`,i)).join("")}</div></section>`:""}
    <section class="sec"><div class="sec-h"><div><h2>Tour packages</h2><p>${pk.length?`Compare ${plural(pk.length,"package")} from ${plural(new Set(pk.map(x=>x.op)).size,"operator")}.`:"No packages here yet."}</p></div>${pk.length?`<a class="btn sm more" href="#/tours/search?dest=${id}">Filter and sort ${I.arrow}</a>`:""}</div>
      <div class="grid">${pk.slice(0,6).map((x,i)=>pkgCard(x,{i})).join("")}</div></section>
    <section class="sec"><div class="xsell"><div><b>Prefer to drive yourself?</b><p>${plural(nRent,"vehicle")} from agencies in ${esc(placeName(rentCity))}${rentCity!==id?`, the usual base for ${esc(p.name)}`:""}.</p></div><a class="btn dark" href="#/rentals/in/${rentCity}">Rent in ${esc(placeName(rentCity))}</a></div></section>
  </div>`};
}

/* ================= PACKAGE ================= */
function routeMap(stops){
  const pts=[];stops.forEach(s=>{if(!pts.length||pts[pts.length-1]!==s)pts.push(s)});
  const uniq=[...new Set(pts)], P=uniq.map(s=>PLACES[s]), W=640,H=360,padX=70,padY=46;
  const lats=P.map(p=>p.lat),lons=P.map(p=>p.lon);let [a0,a1,o0,o1]=[Math.min(...lats),Math.max(...lats),Math.min(...lons),Math.max(...lons)];
  const sp=Math.max(a1-a0,(o1-o0)*.62,.35);const cy=(a0+a1)/2,cx=(o0+o1)/2;
  const sc=Math.min((W-2*padX)/(sp/.62),(H-2*padY)/sp);
  const xy=s=>{const p=PLACES[s];return [W/2+(p.lon-cx)*sc,H/2-(p.lat-cy)*sc]};
  let d="";pts.forEach((s,i)=>{const [x,y]=xy(s);d+=(i?" L":"M")+x.toFixed(1)+" "+y.toFixed(1)});
  return `<div class="map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route map: ${esc(pts.map(placeName).join(" to "))}">
    <defs><pattern id="mg" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#d9dfd6" stroke-width="1"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#mg)"/>
    <path d="${d}" fill="none" stroke="#0e6a4e" stroke-width="3" stroke-dasharray="8 7" stroke-linecap="round" stroke-linejoin="round"/>
    ${uniq.map((s,i)=>{const [x,y]=xy(s),main=!PLACES[s].point;return `<g><circle cx="${x}" cy="${y}" r="${main?8:5}" fill="${i===0?"#121613":"#fff"}" stroke="#0e6a4e" stroke-width="3"/>
      <text x="${x+12}" y="${y+4}" font-family="Manrope,sans-serif" font-size="${main?14:12}" font-weight="${main?800:600}" fill="#121613" paint-order="stroke" stroke="#f1f4ef" stroke-width="4">${esc(placeName(s))}</text></g>`}).join("")}
  </svg></div>`;
}
function vPackage(id){
  const p=PACKAGES[id];if(!p)return vNotFound();
  const pk={id,...p},o=OPERATORS[p.op],trav=S.trav;
  const same=pkgList().filter(x=>x.id!==id&&(x.dest===p.dest||pkgMatchesDest(x,p.dest))).sort((a,b)=>Math.abs(a.days-p.days)-Math.abs(b.days-p.days)).slice(0,3);
  const rentCity=RENTAL_CITIES.includes(p.dest)&&ALL_L.some(l=>AGENCIES[l.agency].city===p.dest)?p.dest:(PLACES[p.dest].nearest||"guwahati");
  const ALLINC=["Hotel","Meals","Transport","Guide","Activities"],LBL={Hotel:"Accommodation",Meals:"Meals",Transport:"Transportation",Guide:"Local guide",Activities:"Activities and tickets"};
  return {title:p.title,section:"tours",cls:"has-mcta",html:`<div class="wrap">
    <nav class="crumbs"><a href="${S.last.tours}">Back to packages</a><span>/</span><a href="#/destination/${p.dest}">${esc(placeName(p.dest))}</a><span>/</span><span>${esc(p.title)}</span></nav>
    <section class="dhero" style="min-height:clamp(300px,38vw,440px)">${artBox(ARTS[p.dest]?p.dest:"meghalaya")}<div class="in"><span class="eyebrow" style="color:rgba(255,255,255,.85)">${p.days} days · ${p.nights} ${p.nights===1?"night":"nights"}</span><h1 style="font-size:clamp(32px,4.6vw,58px)">${esc(p.title)}</h1><p>${esc(p.blurb)}</p></div></section>
    <div class="dtitle" style="margin-top:18px"><div class="meta" style="margin:0">${stars(p.rating,p.reviews)}<span>${esc([...new Set(p.stops)].map(placeName).join(" · "))}</span>${demoBadge(o)}</div>
      <div class="acts">${heartBtn("p:"+id,p.title).replace('class="heart"','class="btn sm" style="position:static;width:auto;box-shadow:none"').replace(`${I.heart}</button>`,`${I.heart}Save</button>`)}</div></div>
    <div class="dlay"><div>
      <div class="dsec"><h2>Itinerary</h2><div class="itin">${p.itin.map(([t,dsc],i)=>`<div class="iday"><span class="n">${i+1}</span><div><b>Day ${i+1} · ${esc(t)}</b><p>${esc(dsc)}</p></div></div>`).join("")}</div></div>
      <div class="dsec"><h2>What's included</h2><div class="chk">${ALLINC.filter(x=>p.inc.includes(x)).map(x=>`<div>${I.check}${LBL[x]}</div>`).join("")}</div>
        <h2 style="margin-top:22px">Not included</h2><div class="chk">${[...ALLINC.filter(x=>!p.inc.includes(x)).map(x=>LBL[x]),...p.notInc.filter(x=>!Object.values(LBL).includes(x))].filter((x,i,a)=>a.indexOf(x)===i).map(x=>`<div class="no">${I.no}${esc(x)}</div>`).join("")}</div></div>
      <div class="dsec"><h2>Route</h2>${routeMap(p.stops)}</div>
      <div class="dsec"><h2>Tour operator</h2><div class="provider">${avatar(o.name,o.hue,"lg")}<div class="who"><b>${esc(o.name)}</b><div class="facts">${stars(o.rating,o.reviews)}<span>${o.trips.toLocaleString("en-IN")} trips</span><span>Since ${o.since}</span></div><div style="margin-top:8px;display:flex;gap:6px">${demoBadge(o)}${verBadge(o)}</div></div><a class="btn" href="#/operator/${p.op}">View operator</a></div></div>
      ${same.length?`<div class="dsec"><h2>Compare similar packages</h2><div class="others">${same.map(x=>{const xo=OPERATORS[x.op];return `<a class="orow" href="#/package/${x.id}">${avatar(xo.name,xo.hue)}<div><b>${esc(x.title)}</b><span>${x.days}D/${x.nights}N · ${esc(xo.name)}</span></div>${stars(x.rating)}<div class="p"><b>${inr(x.price)}</b><span style="display:block">/ person</span></div></a>`}).join("")}</div></div>`:""}
      <div class="dsec" style="border:0"><div class="xsell"><div><b>Add a rental for extra days?</b><p>Vehicles from agencies in ${esc(placeName(rentCity))}.</p></div><a class="btn dark" href="#/rentals/in/${rentCity}">Browse rentals</a></div></div>
    </div>
    <aside class="book side">${bookPanelTour(pk)}</aside></div></div>
    <div class="mcta"><div class="p"><b>${inr(p.price)}</b> / person<span id="m-tot">${inr(p.price*trav)} for ${plural(trav,"traveller")}</span></div><button type="button" class="btn brand" data-book-tour="${id}">Reserve</button></div>`};
}
function bookPanelTour(p){
  const date=toDay(new Date(Date.now()+21*864e5));
  return `<div class="pp"><b class="num">${inr(p.price)}</b><span>/ person</span></div>
    <div class="bfields"><div><label for="bt-date">Start date</label><input type="date" id="bt-date" value="${date}"></div><div><label>Travellers</label><div class="stepper"><button type="button" data-btrav="-1" aria-label="Fewer">−</button><b id="bt-trav">${S.trav}</b><button type="button" data-btrav="1" aria-label="More">+</button></div></div></div>
    <div class="bsum"><div><span>${inr(p.price)} × <span id="bt-n">${plural(S.trav,"traveller")}</span></span><span id="bt-tot">${inr(p.price*S.trav)}</span></div><div class="tot"><span>Total</span><span id="bt-tot2">${inr(p.price*S.trav)}</span></div>
      <div class="now"><span>Pay now to confirm (20%)</span><span id="bt-now">${inr(tourAdvance(p.price*S.trav))}</span></div><div><span>Pay before the trip</span><span id="bt-later">${inr(p.price*S.trav-tourAdvance(p.price*S.trav))}</span></div></div>
    <button type="button" class="btn brand block" data-book-tour="${p.id}">Reserve</button>
    <p class="bnote">Free cancellation up to 7 days before the trip.</p>${promise("tour",OPERATORS[p.op].verified)}`;
}

/* ================= OPERATOR ================= */
function vOperator(id){
  const o=OPERATORS[id];if(!o)return vNotFound();
  const ps=pkgList().filter(p=>p.op===id).sort((a,b)=>a.days-b.days);
  return {title:o.name,section:"tours",html:`<div class="wrap">
    <nav class="crumbs"><a href="#/tours">Tours</a><span>/</span><span>${esc(o.name)}</span></nav>
    <div class="cover">${artBox(PLACES[o.base].art||o.base)}</div>
    <div class="vhead">${avatar(o.name,o.hue,"lg")}<div><h1>${esc(o.name)}</h1><div class="meta"><span>Based in ${esc(placeName(o.base))}</span>${stars(o.rating,o.reviews)}${demoBadge(o)}${verBadge(o)}</div></div>
      <div class="acts">${o.agency?`<a class="btn sm" href="#/agency/${o.agency}">Their rentals</a>`:""}<button type="button" class="btn sm dark" data-enquire-op="${id}">${I.msg}Enquire</button></div></div>
    <div class="stats"><div><b>${o.rating.toFixed(1)}</b><span>${plural(o.reviews,"review")}</span></div><div><b>${o.trips.toLocaleString("en-IN")}</b><span>trips run</span></div><div><b>${ps.length}</b><span>packages</span></div><div><b>${o.since}</b><span>operating since</span></div></div>
    <div class="dsec" style="margin-top:24px"><h2>About</h2><p>${esc(o.about)}</p></div>
    <section class="sec" style="padding-top:28px"><div class="sec-h"><div><h2>Packages</h2></div></div><div class="grid">${ps.map((p,i)=>pkgCard(p,{i})).join("")}</div></section>
  </div>`};
}

/* ================= EXPLORE ================= */
function vExplore(){
  const REG=[["all","All"],["Meghalaya","Meghalaya"],["Assam","Assam"],["Arunachal Pradesh","Arunachal Pradesh"]];
  const ds=HOME_DEST;
  return {title:"Explore",section:"explore",hero:true,html:`${pageHero("door-tour.jpg","","Explore incredible<br>destinations","Discover hidden gems, popular getaways and plan your next adventure.",{extra:`<button type="button" class="hbar" data-open-search>${I.search}<span>Search destinations, cities, vehicles or trips…</span></button>`})}
  <div class="wrap">
    <section class="sec" style="padding-top:34px"><div class="sec-h"><div><h2>Explore by region</h2></div></div>
      <div class="fchips" id="xreg">${REG.map(([k,l],i)=>`<button type="button" class="chip ${i?"":"on"}" data-region="${k}">${l}</button>`).join("")}</div></section>
    <section class="sec" style="padding-top:22px"><div class="sec-h"><div><h2>Popular destinations</h2></div><a class="btn sm more" href="#/tours/search">All tour packages ${I.arrow}</a></div>
      <div class="xgrid">${ds.map(d=>`<a class="xtile" data-state="${esc(PLACES[d].state)}" href="#/destination/${d}">${destPhoto(d)?`<img src="${destPhoto(d)}" alt="" loading="lazy">`:artBox(PLACES[d].art||d)}<b>${esc(placeName(d))}</b><span>${esc(PLACES[d].tagline)}</span></a>`).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Rent a vehicle in</h2></div></div><div class="tiles">${RENTAL_CITIES.map((c,i)=>placeTile(c,PLACES[c].state,`#/rentals/in/${c}`,i)).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Brands</h2></div></div><div class="brands">${Object.keys(BRANDS).map(b=>`<a class="btile" href="#/brand/${b}">${brandMark(b)}<span>${esc(BRANDS[b].name)}</span></a>`).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Rental agencies</h2></div><a class="btn sm more" href="#/agencies">All agencies ${I.arrow}</a></div><div class="row-scroll">${Object.keys(AGENCIES).slice(0,8).map(agencyCard).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Tour operators</h2></div></div><div class="row-scroll">${Object.keys(OPERATORS).map(operatorCard).join("")}</div></section>
  </div>`,
  mount(){$("#xreg").addEventListener("click",e=>{const b=e.target.closest("[data-region]");if(!b)return;const r=b.dataset.region;
    $$("#xreg .chip").forEach(c=>c.classList.toggle("on",c===b));$$(".xtile").forEach(t=>t.hidden=r!=="all"&&t.dataset.state!==r)})}};
}

/* ================= SAVED ================= */
function vSaved(q){
  const tab=q.get("tab")||"vehicles";
  const keys=[...S.saved], of=p=>keys.filter(k=>k.startsWith(p)).map(k=>k.slice(2));
  const tabs=[["vehicles","Saved rentals","v:"],["packages","Saved tours","p:"],["destinations","Saved destinations","d:"],["agencies","Agencies","a:"]];
  let body="";
  if(tab==="vehicles"){const ls=of("v:").map(id=>LISTINGS[id]).filter(Boolean);body=ls.length?`<div class="grid">${ls.map((l,i)=>vehCard(l,{i})).join("")}</div>`:empty("No saved vehicles","Tap the heart on any vehicle to save it here.",`<a class="btn dark" href="#/rentals">Browse rentals</a>`)}
  if(tab==="agencies"){const ids=of("a:").filter(id=>AGENCIES[id]);body=ids.length?`<div class="grid">${ids.map(agencyCard).join("")}</div>`:empty("No saved agencies","Save an agency from its page to find it again quickly.",`<a class="btn dark" href="#/agencies">Browse agencies</a>`)}
  if(tab==="packages"){const ps=of("p:").filter(id=>PACKAGES[id]).map(id=>({id,...PACKAGES[id]}));body=ps.length?`<div class="grid">${ps.map((p,i)=>pkgCard(p,{i})).join("")}</div>`:empty("No saved packages","Save packages to compare them later.",`<a class="btn dark" href="#/tours">Browse tours</a>`)}
  if(tab==="destinations"){const ds=of("d:").filter(id=>PLACES[id]);body=ds.length?`<div class="tiles">${ds.map((d,i)=>placeTile(d,PLACES[d].tagline,`#/destination/${d}`,i)).join("")}</div>`:empty("No saved destinations","Save a destination to plan it later.",`<a class="btn dark" href="#/explore">Explore destinations</a>`)}
  const sd=of("d:").filter(d=>DESTINATIONS.includes(d));
  return {title:"Wishlist",section:"saved",hero:true,html:`${pageHero("ban-tour.jpg","","My wishlist","Your saved rentals, tours and destinations for future adventures. Kept on this device.")}<div class="wrap">
    <div class="tabs" style="margin-top:26px">${tabs.map(([k,l,p])=>`<a class="chip ${k===tab?"on":""}" href="#/saved?tab=${k}">${l} (${of(p).length})</a>`).join("")}</div>${body}
    <div class="plan">${I.compass}<div><b>Plan your next trip</b><span>${sd.length?`See tour packages that cover your saved destinations.`:`Save a few destinations, then see which packages cover them.`}</span></div><a class="btn dark" href="#/tours/search${sd.length?"?dest="+sd.join(","):""}">Start planning ${I.arrow}</a></div></div>`};
}

/* ================= BOOKINGS ================= */
function bookingSummary(b){
  if(b.kind==="rental"){const l=LISTINGS[b.ref];if(!l)return null;const v=vinfo(l);return {title:v.name,sub:`${esc(v.a.name)} · ${fmtDT(b.from)} → ${fmtDT(b.to)}`,img:v.m.photo,studio:v.m.studio,href:"#/vehicle/"+b.ref}}
  const p=PACKAGES[b.ref];if(!p)return null;return {title:p.title,sub:`${esc(OPERATORS[p.op].name)} · ${fmtD(b.date)} · ${plural(b.trav,"traveller")}`,art:ARTS[p.dest]?p.dest:"meghalaya",href:"#/package/"+b.ref};
}
function vBookings(q){
  const tab=q&&q.get("tab")==="past"?"past":"upcoming", now=Date.now();
  const past=b=>b.status==="cancelled"||new Date(b.kind==="rental"?b.to:b.date+"T23:59")<now;
  const all=[...S.bookings].reverse(), up=all.filter(b=>!past(b)), pa=all.filter(past), list=tab==="past"?pa:up;
  const row=b=>{const s=bookingSummary(b);if(!s)return "";const rental=b.kind==="rental",cx=b.status==="cancelled";
    const when=rental?`${fmtDT(b.from)} → ${fmtDT(b.to)} (${plural(daysBetween(b.from,b.to),"day")})`:`${fmtD(b.date)} · ${PACKAGES[b.ref].days} days`;
    const route=rental?`${esc(AGENCIES[LISTINGS[b.ref].agency].name)} · pickup at ${esc(b.pickup||"agency office")}`:PACKAGES[b.ref].stops.filter(x=>!PLACES[x].point).map(placeName).map(esc).join(" → ");
    const who=rental?`${esc(s.title)}`:`${plural(b.trav,"traveller")}`;
    return `<article class="bcard"><a class="th" href="#/booking/${b.id}">${s.img?`<img src="${s.img}" alt="" class="${s.studio?"studio":""}">`:PACKAGES[b.ref]&&pkgPhoto({id:b.ref,...PACKAGES[b.ref]})?`<img src="${pkgPhoto({id:b.ref,...PACKAGES[b.ref]})}" alt="">`:`<span class="art">${art(s.art)}</span>`}</a>
      <div class="bi"><div class="bt"><b>${esc(rental?s.title:s.title)}</b><span class="status ${cx?"":"ok"}">${cx?"Cancelled":"Reserved"}</span></div>
        <div class="bl">${I.cal}<span>${when}</span></div><div class="bl">${I.pin}<span>${route}</span></div><div class="bl">${rental?I.car:I.user}<span>${who} · <span class="mono">${b.id}</span></span></div></div>
      <div class="ba"><a class="btn dark sm" href="#/booking/${b.id}">View details</a><a class="btn sm" href="${s.href}">${cx?"Book again":"Modify"}</a>${cx?"":`<button type="button" class="btn sm" data-cancel="${b.id}">Cancel</button>`}</div></article>`};
  return {title:"Bookings",section:"bookings",hero:true,html:`${pageHero("door-rent.jpg","","My bookings","Track your trips, manage your requests and get ready for your next adventure. In this demo they stay on your device.")}<div class="wrap">
    <div class="utabs"><a href="#/bookings" class="${tab==="upcoming"?"on":""}">Upcoming trips (${up.length})</a><a href="#/bookings?tab=past" class="${tab==="past"?"on":""}">Past &amp; cancelled (${pa.length})</a></div>
    ${list.length?`<div class="blist">${list.map(row).join("")}</div>`
      :empty(tab==="past"?"Nothing here yet":"No upcoming trips",tab==="past"?"Cancelled and completed requests show up here.":"When you request a vehicle or a tour, it shows up here.",`<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><a class="btn dark" href="#/rentals">Rent a vehicle</a><a class="btn" href="#/tours">Explore tours</a></div>`)}</div>`};
}
function vBooking(id){
  const b=S.bookings.find(x=>x.id===id);if(!b)return vNotFound();
  const s=bookingSummary(b);if(!s)return vNotFound();
  const rental=b.kind==="rental", vendor=rental?AGENCIES[LISTINGS[b.ref].agency].name:OPERATORS[PACKAGES[b.ref].op].name;
  const rows=rental?[["Vehicle",s.title],["Agency",vendor],["Pickup",fmtDT(b.from)],["Return",fmtDT(b.to)],["Pickup at",b.pickup],["Total",inr(b.total)],["Paid now (demo)",inr(rentAdvance(b.total))],["Pay at pickup",inr(b.total-rentAdvance(b.total))]]
    :[["Package",s.title],["Operator",vendor],["Start date",fmtD(b.date)],["Travellers",String(b.trav)],["Total",inr(b.total)],["Paid now (demo)",inr(tourAdvance(b.total))],["Pay before the trip",inr(b.total-tourAdvance(b.total))]];
  return {title:"Booking "+id,section:"bookings",html:`<div class="wrap"><div class="confirm">
    <div class="ck">${b.status==="cancelled"?I.no:I.check}</div><h1>${b.status==="cancelled"?"Booking cancelled":"Booking reserved"}</h1>
    <p class="muted" style="margin-top:8px">${b.status==="cancelled"?"This request has been cancelled.":`Advance of ${inr(rental?rentAdvance(b.total):tourAdvance(b.total))} paid (demo). ${esc(vendor)} confirms within 30 minutes and you pay the remaining ${inr(b.total-(rental?rentAdvance(b.total):tourAdvance(b.total)))} ${rental?"at pickup":"before the trip"}. Same price as booking direct.`}</p>
    <div class="ticket"><div><span>Request</span><span class="mono">${id}</span></div>${rows.map(([k,v])=>`<div><span>${k}</span><span>${esc(v)}</span></div>`).join("")}</div>
    ${b.status!=="cancelled"?`<div class="steps3"><div><b>Reserved</b><span>Advance paid</span></div><div><b>Confirmation</b><span>${esc(vendor)} replies</span></div><div><b>${rental?"Pickup":"Trip day"}</b><span>${rental?"Show licence and ID":"Meet your guide"}</span></div><div><b>Review</b><span>Rate your experience</span></div></div>`:""}
    <p class="bnote" style="margin-top:18px">Demo: no payment was taken and nothing was sent anywhere.</p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:18px;flex-wrap:wrap"><a class="btn dark" href="#/bookings">All bookings</a><a class="btn" href="${s.href}">View listing</a>${b.status!=="cancelled"?`<button type="button" class="btn ghost" data-cancel="${id}">Cancel request</button>`:""}</div>
  </div></div>`};
}

/* ================= PROFILE ================= */
function vProfile(){
  return {title:"Profile",section:"profile",html:`<div class="wrap"><div class="ptitle"><h1>Profile</h1></div><div class="prof">
    <div class="pcardx"><span class="avatar">G</span><div><b style="font-size:18px">Guest traveller</b><p class="muted">Sign-in is coming soon. For now your saved items and requests stay on this device.</p></div>
      <div class="sf" style="padding:0;border:0;width:100%"><label for="pf-city">Home city for rentals</label>${citySelect("pf-city",S.prefs.city||"guwahati").replace('<select','<select style="border:1px solid var(--line2);border-radius:12px;padding:10px"')}</div></div>
    <div class="plinks"><a href="#/bookings">Your bookings<span>${plural(S.bookings.length,"request")}</span></a><a href="#/saved">Saved<span>${plural(S.saved.size,"item")}</span></a>
      <a href="#/partners">List your agency or tours on OPIIUS<span>For businesses</span></a><button type="button" data-reset>Clear data on this device<span>Saved items, compare and bookings</span></button></div></div></div>`,
    mount(){$("#pf-city").addEventListener("change",e=>{S.prefs.city=e.target.value;saveState();toast("Home city updated")})}};
}

/* ================= PARTNERS: the business model, for agency and operator owners ================= */
function vPartners(){
  const plans=[
    {n:"Partner",p:"₹0",per:"/ month",tag:"Start here",com:"10% per booking",pts:["Your own agency page, fleet and reviews","Verified badge after a permit and insurance check","Bookings arrive with the advance already paid","Pay only when OPIIUS brings you a booking"]},
    {n:"Partner Pro",p:"₹999",per:"/ month",tag:"Most popular",hot:true,com:"8% per booking",pts:["Everything in Partner","OPIIUS Desk: fleet calendar, no double bookings, deposits and dues","Instant booking, so you rank higher","Repeat customers who rebook on OPIIUS: 5%"]},
    {n:"Featured",p:"₹1,999",per:"/ month add-on",tag:"3 slots per city",com:"On top of either plan",pts:["Top of results in your city, labelled Featured","Home page and destination page placement","Only 3 per city and category, so it stays worth it","Cancel any month"]}];
  const steps=[["List free","We visit, photograph your fleet and build your page. Takes a day."],["Travellers reserve","They pay a small advance online: 10% for rentals, 20% for tours."],["You confirm","You get the booking on WhatsApp or OPIIUS Desk. Accept within 30 minutes."],["Get paid","The customer pays you the rest at pickup. Tour advances are settled to you weekly."]];
  const rules=[["Ranked on quality, not on who pays","Results are ordered by response time, cancellations, reviews and price. Featured slots are limited and always labelled."],["No race to the bottom","Your price is your price. Customers pay exactly what they would pay you directly, so there is no reason to go around you."],["Limited partners per city","We add agencies only where there is demand, so every partner gets enough bookings to be worth it."],["Your customers stay yours","Every renter's name and number is shared with you after confirmation. Repeat bookings on OPIIUS cost you less."]];
  return {title:"For agencies and operators",section:"",hero:true,html:`${pageHero("door-rent.jpg","For rental agencies &amp; tour operators","Get more bookings.<br>Pay only when they arrive.","OPIIUS brings travellers to local agencies and operators across the Northeast. No listing fee. You pay a commission only on bookings we send you.")}
  <div class="wrap">
    <section class="sec"><div class="sec-h"><div><h2>How it works</h2></div></div>
      <div class="steps3">${steps.map(([t,d],i)=>`<div><b>${i+1}. ${t}</b><span>${d}</span></div>`).join("")}</div></section>
    <section class="sec"><div class="sec-h"><div><h2>Simple pricing</h2><p>Start free. Upgrade when OPIIUS is bringing you steady bookings.</p></div></div>
      <div class="plans">${plans.map(x=>`<div class="plan-c ${x.hot?"hot":""}"><span class="ptag">${x.tag}</span><h3>${x.n}</h3><div class="pp"><b>${x.p}</b><span>${x.per}</span></div><div class="pcom">${x.com}</div><ul>${x.pts.map(t=>`<li>${I.check}<span>${t}</span></li>`).join("")}</ul></div>`).join("")}</div>
      <div class="founding">${I.star}<div><b>Founding partner offer</b><span>The first 10 agencies in each city pay 0% commission for their first 3 months.</span></div></div></section>
    <section class="sec"><div class="sec-h"><div><h2>What you'd earn</h2><p>Move the sliders to match your month.</p></div></div>
      <div class="calc">
        <div class="cin"><label>Bookings from OPIIUS per month <b id="c-n-v">15</b></label><input type="range" id="c-n" min="1" max="60" value="15">
          <label>Average booking value <b id="c-v-v">₹6,000</b></label><input type="range" id="c-v" min="1000" max="30000" step="500" value="6000">
          <label>Plan</label><div class="fchips" id="c-plan"><button type="button" class="chip on" data-pl="p">Partner</button><button type="button" class="chip" data-pl="pro">Partner Pro</button></div></div>
        <div class="cout"><div><span>Extra revenue for you</span><b id="c-rev"></b></div><div><span>OPIIUS fee</span><b id="c-fee"></b></div><div class="big"><span>You keep</span><b id="c-keep"></b></div><p class="bnote" id="c-note"></p></div>
      </div></section>
    <section class="sec"><div class="sec-h"><div><h2>Fair for every partner</h2></div></div>
      <div class="rules">${rules.map(([t,d])=>`<div>${I.shield}<b>${t}</b><span>${d}</span></div>`).join("")}</div></section>
    <section class="sec"><div class="joinbar"><div><b>Become a founding partner</b><span>We'll show you OPIIUS with your own vehicles or packages.</span></div><a class="btn brand" href="business.html#enquire-sec">Talk to us</a><a class="btn" href="business.html">See OPIIUS Desk</a></div></section>
  </div>`,
  mount(){
    let plan="p";const n=$("#c-n"),v=$("#c-v");
    const upd=()=>{const N=+n.value,V=+v.value,rev=N*V,com=plan==="pro"?.08:.10,fee=Math.round(rev*com)+(plan==="pro"?999:0);
      $("#c-n-v").textContent=N;$("#c-v-v").textContent=inr(V);$("#c-rev").textContent=inr(rev);$("#c-fee").textContent=inr(fee);$("#c-keep").textContent=inr(rev-fee);
      $("#c-note").textContent=`${plan==="pro"?"8% commission + ₹999 Desk":"10% commission, no monthly fee"}. During the founding offer the commission is 0%.`};
    n.addEventListener("input",upd);v.addEventListener("input",upd);
    $("#c-plan").addEventListener("click",e=>{const b=e.target.closest("[data-pl]");if(!b)return;plan=b.dataset.pl;$$("#c-plan .chip").forEach(c=>c.classList.toggle("on",c===b));upd()});upd();
  }};
}

/* ================= COMPARE ================= */
function vCompare(){
  const ls=S.compare.map(id=>LISTINGS[id]).filter(Boolean);
  if(ls.length<2)return {title:"Compare",section:"rentals",html:`<div class="wrap"><div class="ptitle"><h1>Compare vehicles</h1></div>${empty("Pick at least two vehicles","Tick “Compare” on vehicle cards to add up to three.",`<a class="btn dark" href="${S.last.rentals}">Back to results</a>`)}</div>`};
  const d=daysBetween(S.dates[0],S.dates[1]),V=ls.map(vinfo),minP=Math.min(...ls.map(l=>l.price)),maxR=Math.max(...ls.map(l=>l.rating||0));
  const row=(label,fn)=>`<tr><th scope="row">${label}</th>${V.map(fn).map(c=>`<td>${c}</td>`).join("")}</tr>`;
  return {title:"Compare",section:"rentals",html:`<div class="wrap"><div class="ptitle"><h1>Compare vehicles</h1><p>Prices for ${plural(d,"day")}, ${fmtDT(S.dates[0])} to ${fmtDT(S.dates[1])}.</p></div>
    <div class="ctable"><table><thead><tr><th></th>${V.map(v=>`<th scope="col"><div class="ci">${v.m.photo?`<img src="${v.m.photo}" alt="" class="${v.m.studio?"studio":""}">`:""}</div><a href="#/vehicle/${v.l.id}" style="font-size:15px">${esc(v.name)}</a><div class="muted" style="font-weight:500;font-size:13px">${esc(v.a.name)}</div></th>`).join("")}</tr></thead><tbody>
      ${row("Price / day",v=>`<span class="${v.l.price===minP?"best":""}">${inr(v.l.price)}</span>`)}
      ${row(`Total, ${plural(d,"day")}`,v=>inr(v.l.price*d))}
      ${row("Type",v=>v.m.type)}${row("Seats",v=>v.m.seats)}${row("Transmission",v=>v.m.trans)}${row("Fuel",v=>v.m.fuel)}
      ${row("Rating",v=>v.l.rating?`<span class="${v.l.rating===maxR?"best":""}">★ ${v.l.rating.toFixed(1)}</span>`:"New")}
      ${row("Deposit",v=>esc(v.a.policies.deposit))}${row("Mileage",v=>esc(v.a.policies.km))}${row("Pickup",v=>esc(v.a.pickups[0]))}
      ${row("",v=>`<a class="btn sm brand" href="#/vehicle/${v.l.id}">View</a> <button type="button" class="btn sm ghost" data-cmp-rm="${v.l.id}">Remove</button>`)}
    </tbody></table></div></div>`};
}
function vNotFound(){return {title:"Not found",section:"",html:`<div class="wrap" style="padding-block:60px">${empty("We couldn't find that page","It may have moved. Start again from the home page.",`<a class="btn dark" href="#/">Go home</a>`)}</div>`}}

/* ================= sheets ================= */
function openSheet(kind,title,body,foot="",wide=false){
  const root=$("#sheet-root");
  root.innerHTML=`<div class="sheet-back" data-x></div><div class="sheet ${wide?"wide":""} ${kind==="search"?"gsearch":""}" data-kind="${kind}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h3>${esc(title)}</h3><button type="button" class="x" data-x aria-label="Close">${I.x}</button></header><div class="sb">${body}</div>${foot?`<footer>${foot}</footer>`:""}</div>`;
  document.body.style.overflow="hidden";
  requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.add("sheet-open")));
  setTimeout(()=>{const f=root.querySelector("input,select,button:not(.x)");f&&f.focus({preventScroll:true})},120);
}
function closeSheet(){const root=$("#sheet-root");if(!root.innerHTML)return;root.classList.remove("sheet-open");document.body.style.overflow="";setTimeout(()=>{if(!root.classList.contains("sheet-open"))root.innerHTML=""},350)}
function fillFilterSheet(){
  const sh=$("#sheet-root .sheet[data-kind=filters]");if(!sh)return;
  const {path,q}=parse(),rent=path.startsWith("/rentals");
  sh.querySelector(".sb").innerHTML=rent?rentalFilters(rf(q)):tourFilters(tf(q));
  const n=rent?ALL_L.filter(l=>rMatch(l,rf(q))).length:pkgList().filter(p=>tMatch(p,tf(q))).length;
  sh.querySelector("footer").innerHTML=`<button type="button" class="link" data-clear>Clear all</button><button type="button" class="btn dark" style="margin-left:auto" data-x>Show ${n} ${rent?"vehicles":"packages"}</button>`;
}
function openBooking(listingId){
  const l=LISTINGS[listingId],v=vinfo(l),from=($("#b-from")||{}).value||S.dates[0],to=($("#b-to")||{}).value||S.dates[1];
  if(new Date(to)<=new Date(from)){toast("Return must be after pickup.");return}
  S.dates=[from,to];const d=daysBetween(from,to),pick=($("#b-pick")||{}).value||v.a.pickups[0];
  openSheet("book","Reserve",`<div class="provider" style="padding:12px;margin-bottom:14px"><div style="position:relative;width:96px;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:var(--mist)">${v.m.photo?`<img src="${v.m.photo}" alt="" class="${v.m.studio?"studio":""}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${v.m.studio?"contain":"cover"};${v.m.studio?"mix-blend-mode:multiply;padding:6%":""}">`:""}</div><div class="who"><b>${esc(v.name)}</b><div class="facts"><span>${esc(v.a.name)}</span></div></div></div>
    <div class="bsum"><div><span>Pickup</span><span>${fmtDT(from)}</span></div><div><span>Return</span><span>${fmtDT(to)}</span></div><div><span>Pickup at</span><span style="text-align:right">${esc(pick)}</span></div>
      <div><span>${inr(l.price)} × ${plural(d,"day")}</span><span>${inr(l.price*d)}</span></div><div><span>Refundable deposit</span><span style="text-align:right">${esc(v.a.policies.deposit)}</span></div>
      <div class="tot"><span>Total</span><span>${inr(l.price*d)}</span></div><div class="now"><span>Pay now to confirm</span><span>${inr(rentAdvance(l.price*d))}</span></div><div><span>Pay at pickup</span><span>${inr(l.price*d-rentAdvance(l.price*d))}</span></div></div>
    <div class="sf" style="padding:14px 0 0;border:0"><label for="bk-note">Message to ${esc(v.a.name)} (optional)</label><textarea id="bk-note" rows="3" style="border:1px solid var(--line2);border-radius:12px;padding:10px;resize:vertical" placeholder="Arrival time, trip plan or questions"></textarea></div>
    <p class="bnote" style="margin-top:10px">Demo: no payment is taken and nothing is sent. Live, you pay the advance by UPI or card and the agency's number is shared once it's confirmed.</p>`,
    `<button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn brand" style="margin-left:auto" data-confirm-rent="${listingId}" data-pick="${esc(pick)}">Pay ${inr(rentAdvance(l.price*d))} (demo)</button>`);
}
function openTourBooking(pid){
  const p=PACKAGES[pid],o=OPERATORS[p.op],date=($("#bt-date")||{}).value||toDay(new Date(Date.now()+21*864e5));
  openSheet("book","Reserve",`<div class="bsum"><div><span>Package</span><span style="text-align:right">${esc(p.title)}</span></div><div><span>Operator</span><span>${esc(o.name)}</span></div>
      <div><span>Start date</span><span>${fmtD(date)}</span></div><div><span>Travellers</span><span>${S.trav}</span></div><div><span>${inr(p.price)} × ${plural(S.trav,"traveller")}</span><span>${inr(p.price*S.trav)}</span></div>
      <div class="tot"><span>Total</span><span>${inr(p.price*S.trav)}</span></div><div class="now"><span>Pay now to confirm (20%)</span><span>${inr(tourAdvance(p.price*S.trav))}</span></div></div>
    <div class="sf" style="padding:14px 0 0;border:0"><label for="bk-note">Message to ${esc(o.name)} (optional)</label><textarea id="bk-note" rows="3" style="border:1px solid var(--line2);border-radius:12px;padding:10px;resize:vertical" placeholder="Room preferences, ages of children, special requests"></textarea></div>
    <p class="bnote" style="margin-top:10px">Demo: no payment is taken and nothing is sent.</p>`,
    `<button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn brand" style="margin-left:auto" data-confirm-tour="${pid}" data-date="${date}">Pay ${inr(tourAdvance(p.price*S.trav))} (demo)</button>`);
}
function openEnquiry(name){
  openSheet("enq",`Enquire with ${name}`,`<div class="sf" style="padding:0;border:0"><label for="enq-t">Your question</label><textarea id="enq-t" rows="4" style="border:1px solid var(--line2);border-radius:12px;padding:10px;resize:vertical" placeholder="Ask about availability, delivery or custom trips"></textarea></div><p class="bnote" style="margin-top:10px">Demo: nothing is sent.</p>`,
    `<button type="button" class="btn ghost" data-x>Cancel</button><button type="button" class="btn dark" style="margin-left:auto" data-enq-send>Send</button>`);
}
function openEditSearch(kind){
  if(kind==="rent"){const {q}=parse(),f=rf(q);openSheet("edit","Edit search",rentalSearchForm(f.city,f.cat).replace('class="sbox"','class="sbox" style="margin:0;width:100%;box-shadow:none;border:0;padding:0"'));bindRentalForm()}
  else{const {q}=parse(),f=tf(q);openSheet("edit","Edit search",tourSearchForm({dest:f.dest[0],date:f.date}).replace('class="sbox"','class="sbox" style="margin:0;width:100%;box-shadow:none;border:0;padding:0"'));bindTourForm()}
}

/* ================= global search ================= */
function openSearch(){
  openSheet("search","Search OPIIUS",`<div class="gs-in">${I.search}<input type="search" id="gs" placeholder="Try “SUV in Shillong”, “Royal Enfield” or “Meghalaya 4 days”" aria-label="Search"></div><div id="gsr">${searchResults("")}</div>`,"",true);
  $("#gs").addEventListener("input",e=>{$("#gsr").innerHTML=searchResults(e.target.value)});
  $("#gs").addEventListener("keydown",e=>{if(e.key==="Enter"){const a=$("#gsr a");if(a){closeSheet();location.hash=a.getAttribute("href")}}});
}
function smartRoute(qs){
  const q=qs.toLowerCase();if(!q.trim())return null;
  const city=RENTAL_CITIES.find(c=>q.includes(c)||q.includes(placeName(c).toLowerCase()));
  const tourish=/(trip|tour|package|honeymoon|weekend|holiday|days?|nights?|visit)/.test(q);
  const dest=DESTINATIONS.find(d=>q.includes(d)||q.includes(placeName(d).toLowerCase()));
  if(tourish){const p=new URLSearchParams();if(dest)p.set("dest",dest);const n=(q.match(/(\d)\s*(day|d\b)/)||[])[1];if(n)p.set("dur",durBucket(+n));if(/weekend/.test(q))p.set("type","Weekend");if(/honeymoon/.test(q))p.set("type","Honeymoon");
    return {href:"#/tours/search?"+p,label:`Tour packages${dest?" in "+placeName(dest):""}${n?", "+n+" days":""}`}}
  const p=new URLSearchParams();p.set("city",city||S.prefs.city||"guwahati");
  if(/(bike|scoot|scooty|enfield|bullet|motorcycle|activa)/.test(q))p.set("cat","bike");else if(/(car|suv|seater|hatch|muv)/.test(q))p.set("cat","car");
  const type=/suv/.test(q)?"SUV":/hatch/.test(q)?"Hatchback":/(7|seven|6|six).?seat|muv|family/.test(q)?"MUV":/scoot|scooty/.test(q)?"Scooter":"";if(type)p.set("type",type);
  const under=q.replace(/,/g,"").match(/(under|below|less than)\s*₹?\s*(\d+)/);if(under)p.set("pmax",under[2]);
  if(/automatic/.test(q))p.set("trans","Automatic");
  const mk=Object.keys(MODELS).find(k=>q.includes(k)||q.includes(MODELS[k].name.toLowerCase()));if(mk)p.set("model",mk);
  const bk=!mk&&Object.keys(BRANDS).find(k=>q.includes(k)||q.includes(BRANDS[k].name.toLowerCase()));if(bk)p.set("brand",bk);
  if(p.toString()==="city="+(city||S.prefs.city||"guwahati")&&!city)return null;
  return {href:"#/rentals/search?"+p,label:`${mk?BRANDS[MODELS[mk].brand].name+" "+MODELS[mk].name+" in ":bk?BRANDS[bk].name+" in ":"Rentals in "}${placeName(p.get("city"))}${type?" · "+type:""}${under?" · under "+inr(+under[2]):""}`};
}
function searchResults(qs){
  const q=qs.trim().toLowerCase(), item=(href,icon,t,s)=>`<a class="gs-item" href="${href}" data-close-after><span class="ic">${icon}</span><div><b>${esc(t)}</b><span>${esc(s)}</span></div></a>`;
  if(!q){return `<div class="gs-grp"><h4>Popular</h4>${item("#/rentals/in/guwahati",I.car,"Rent in Guwahati","Cars, bikes and scooters")}${item("#/destination/meghalaya",I.peak,"Meghalaya","Tours and places")}${item("#/brand/royalenfield",I.car,"Royal Enfield","Bikes from several agencies")}${item("#/destination/tawang",I.peak,"Tawang","Over Sela Pass")}</div>`}
  const m=s=>s.toLowerCase().includes(q)||q.split(/\s+/).every(w=>s.toLowerCase().includes(w));
  const smart=smartRoute(qs), groups=[];
  if(smart)groups.push(["Best match",[item(smart.href,I.search,smart.label,"Open results")]]);
  const places=[...new Set([...RENTAL_CITIES,...DESTINATIONS])].filter(p=>m(PLACES[p].name+" "+PLACES[p].state));
  if(places.length)groups.push(["Places",places.slice(0,5).map(p=>DESTINATIONS.includes(p)?item(`#/destination/${p}`,I.pin,PLACES[p].name,"Destination · "+PLACES[p].state):item(`#/rentals/in/${p}`,I.pin,PLACES[p].name,"Rentals"))]);
  const models=Object.entries(MODELS).filter(([k,x])=>m(BRANDS[x.brand].name+" "+x.name+" "+x.type));
  if(models.length)groups.push(["Vehicles",models.slice(0,5).map(([k,x])=>{const n=ALL_L.filter(l=>l.model===k).length;return `<a class="gs-item" href="#/brand/${x.brand}" data-close-after><span class="ic">${x.photo?`<img src="${x.photo}" alt="">`:I.car}</span><div><b>${esc(BRANDS[x.brand].name+" "+x.name)}</b><span>${x.type} · ${plural(n,"offer")}</span></div></a>`})]);
  const brands=Object.entries(BRANDS).filter(([k,b])=>m(b.name));if(brands.length)groups.push(["Brands",brands.map(([k,b])=>item(`#/brand/${k}`,I.car,b.name,"All models"))]);
  const ags=Object.entries(AGENCIES).filter(([k,a])=>m(a.name+" "+a.area));if(ags.length)groups.push(["Agencies",ags.slice(0,4).map(([k,a])=>item(`#/agency/${k}`,I.shield,a.name,locOf(a)))]);
  const pk=pkgList().filter(p=>m(p.title+" "+p.stops.map(placeName).join(" ")+" "+p.types.join(" ")));if(pk.length)groups.push(["Packages",pk.slice(0,4).map(p=>item(`#/package/${p.id}`,I.peak,p.title,`${p.days}D/${p.nights}N · from ${inr(p.price)}`))]);
  const ops=Object.entries(OPERATORS).filter(([k,o])=>m(o.name));if(ops.length)groups.push(["Operators",ops.map(([k,o])=>item(`#/operator/${k}`,I.shield,o.name,"Tour operator"))]);
  return groups.length?groups.map(([h,items])=>`<div class="gs-grp"><h4>${h}</h4>${items.join("")}</div>`).join(""):`<p class="muted" style="margin-top:16px">No matches. Try a place, a vehicle or a trip length.</p>`;
}

/* ================= gallery & lightbox ================= */
function bindGallery(){
  const tr=$("#gtrack");if(!tr)return;
  tr.addEventListener("scroll",()=>{const i=Math.round(tr.scrollLeft/tr.clientWidth);$$(".gdots i").forEach((d,k)=>d.classList.toggle("on",k===i));const c=$(".gcount");if(c)c.textContent=`${i+1} / ${tr.children.length}`},{passive:true});
}

/* ================= wishlist, compare, badges, toast ================= */
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),2600)}
function updateBadges(){
  $$("[data-count=saved]").forEach(e=>{e.textContent=S.saved.size||"";e.hidden=!S.saved.size});
  $$("[data-count=bookings]").forEach(e=>{const n=S.bookings.filter(b=>b.status!=="cancelled").length;e.textContent=n||"";e.hidden=!n});
}
function renderTray(){
  const t=$("#tray"),ls=S.compare.map(id=>LISTINGS[id]).filter(Boolean),show=ls.length>0&&current&&current.path!=="/compare";
  t.classList.toggle("on",show);
  t.innerHTML=`<span style="font-weight:700;font-size:14px">Compare (${ls.length}/3)</span><span class="th">${ls.map(l=>{const m=MODELS[l.model];return `<span>${m.photo?`<img src="${m.photo}" alt="">`:""}</span>`}).join("")}</span>
    <button type="button" class="btn sm" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.35)" data-cmp-clear>Clear</button><a class="btn sm brand" href="#/compare" ${ls.length<2?'aria-disabled="true" style="opacity:.5;pointer-events:none"':""}>Compare</a>`;
}

/* ================= event delegation ================= */
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-save],[data-cmp-rm],[data-cmp-clear],[data-sheet],[data-fset],[data-fk-toggle],[data-unset],[data-clear],[data-more],[data-edit],[data-open-search],[data-book],[data-book-tour],[data-confirm-rent],[data-confirm-tour],[data-x],[data-rcat],[data-trav],[data-btrav],[data-cancel],[data-reset],[data-enquire-agency],[data-enquire-op],[data-enq-send],[data-close-after],[data-gal],[data-back]");
  if(!t)return;
  if(t.dataset.save){e.preventDefault();const k=t.dataset.save;S.saved.has(k)?S.saved.delete(k):S.saved.add(k);saveState();
    $$(`[data-save="${k}"]`).forEach(b=>{b.setAttribute("aria-pressed",S.saved.has(k));b.classList.remove("pop");void b.offsetWidth;b.classList.add("pop")});
    toast(S.saved.has(k)?"Saved to your wishlist":"Removed from your wishlist");updateBadges();return}
  if(t.dataset.cmpRm){S.compare=S.compare.filter(x=>x!==t.dataset.cmpRm);saveState();render();return}
  if(t.hasAttribute("data-cmp-clear")){S.compare=[];saveState();$$("[data-cmp]").forEach(c=>c.checked=false);renderTray();return}
  if(t.dataset.sheet==="filters"){const {path,q}=parse();openSheet("filters","Filters","","<span></span>",false);fillFilterSheet();return}
  if(t.dataset.sheet==="sort"){const {path,q}=parse(),rent=path.startsWith("/rentals"),cur=q.get("sort")||"rec";
    openSheet("sort","Sort by",`<div class="fopts">${(rent?SORTS_R:SORTS_T).map(([k,l])=>`<label class="fopt"><input type="radio" name="srt" data-fset="sort" data-v="${k}" ${k===cur?"checked":""}>${l}</label>`).join("")}</div>`);return}
  if(t.dataset.fset){const {q}=parse();const v=t.dataset.v;(v&&v!=="0"&&!(t.dataset.fset==="sort"&&v==="rec"))?q.set(t.dataset.fset,v):q.delete(t.dataset.fset);replaceQuery(q);if(t.dataset.fset==="sort"&&$("#sheet-root .sheet[data-kind=sort]"))closeSheet();return}
  if(t.dataset.fkToggle){const {q}=parse(),k=t.dataset.fkToggle,arr=listParam(q,k),v=t.dataset.v,i=arr.indexOf(v);i<0?arr.push(v):arr.splice(i,1);arr.length?q.set(k,arr.join(",")):q.delete(k);replaceQuery(q);return}
  if(t.dataset.unset){const {q}=parse(),k=t.dataset.unset;if(k==="price"){q.delete("pmin");q.delete("pmax")}else if(["rating","cat","model"].includes(k))q.delete(k);else{const arr=listParam(q,k).filter(x=>x!==t.dataset.v);arr.length?q.set(k,arr.join(",")):q.delete(k)}replaceQuery(q);return}
  if(t.hasAttribute("data-clear")){const {path,q}=parse(),keep=new URLSearchParams();["city","from","to","date","trav","sort"].forEach(k=>q.get(k)&&keep.set(k,q.get(k)));replaceQuery(keep);return}
  if(t.hasAttribute("data-more")){S.shown+=12;current.view.update();return}
  if(t.dataset.edit){openEditSearch(t.dataset.edit);return}
  if(t.hasAttribute("data-open-search")){openSearch();return}
  if(t.dataset.book){openBooking(t.dataset.book);return}
  if(t.dataset.bookTour){openTourBooking(t.dataset.bookTour);return}
  if(t.dataset.confirmRent){const l=LISTINGS[t.dataset.confirmRent],d=daysBetween(S.dates[0],S.dates[1]);const b={id:newId(),kind:"rental",ref:l.id,from:S.dates[0],to:S.dates[1],pickup:t.dataset.pick,total:l.price*d,note:($("#bk-note")||{}).value||"",status:"requested",created:Date.now()};
    S.bookings.push(b);saveState();closeSheet();location.hash="#/booking/"+b.id;return}
  if(t.dataset.confirmTour){const p=PACKAGES[t.dataset.confirmTour];const b={id:newId(),kind:"tour",ref:t.dataset.confirmTour,date:t.dataset.date,trav:S.trav,total:p.price*S.trav,note:($("#bk-note")||{}).value||"",status:"requested",created:Date.now()};
    S.bookings.push(b);saveState();closeSheet();location.hash="#/booking/"+b.id;return}
  if(t.hasAttribute("data-x")){closeSheet();return}
  if(t.dataset.rcat){$$("[data-rcat]").forEach(b=>b.setAttribute("aria-pressed",b===t));$("#r-cat").value=t.dataset.rcat;return}
  if(t.dataset.trav){S.trav=Math.min(12,Math.max(1,S.trav+(+t.dataset.trav)));$$("#t-trav").forEach(x=>x.textContent=S.trav);return}
  if(t.dataset.btrav){S.trav=Math.min(12,Math.max(1,S.trav+(+t.dataset.btrav)));const p=PACKAGES[parse().path.split("/")[2]];
    $("#bt-trav").textContent=S.trav;$("#bt-n").textContent=plural(S.trav,"traveller");$("#bt-tot").textContent=inr(p.price*S.trav);$("#bt-tot2").textContent=inr(p.price*S.trav);$("#bt-now").textContent=inr(tourAdvance(p.price*S.trav));$("#bt-later").textContent=inr(p.price*S.trav-tourAdvance(p.price*S.trav));const mt=$("#m-tot");if(mt)mt.textContent=`${inr(p.price*S.trav)} for ${plural(S.trav,"traveller")}`;return}
  if(t.dataset.cancel){const b=S.bookings.find(x=>x.id===t.dataset.cancel);if(b){b.status="cancelled";saveState();render();toast("Request cancelled")}return}
  if(t.hasAttribute("data-reset")){S.saved.clear();S.compare=[];S.bookings=[];saveState();render();toast("Cleared data on this device");return}
  if(t.dataset.enquireAgency){openEnquiry(AGENCIES[t.dataset.enquireAgency].name);return}
  if(t.dataset.enquireOp){openEnquiry(OPERATORS[t.dataset.enquireOp].name);return}
  if(t.hasAttribute("data-enq-send")){closeSheet();toast("Demo: your question was not sent");return}
  if(t.hasAttribute("data-close-after")){closeSheet();return}
  if(t.dataset.gal!=null&&t.closest("#gtrack")){const img=t.querySelector("img");if(img)openSheet("lightbox","Photo",`<div style="position:relative;background:var(--mist);border-radius:16px;overflow:hidden"><img src="${img.getAttribute("src")}" alt="${esc(img.alt)}" style="width:100%;height:auto;${img.classList.contains("studio")?"mix-blend-mode:multiply;padding:6%":""}"></div>`,"",true);return}
  if(t.hasAttribute("data-back")&&history.length>1&&S.prevFrom&&S.prevFrom.startsWith("#/rentals")){e.preventDefault();history.back();return}
});
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.cmp){const id=t.dataset.cmp;if(t.checked){if(S.compare.length>=3){t.checked=false;toast("You can compare up to 3 vehicles");return}S.compare.push(id)}else S.compare=S.compare.filter(x=>x!==id);saveState();renderTray();return}
  if(t.dataset.fk){const {q}=parse(),k=t.dataset.fk,arr=listParam(q,k),i=arr.indexOf(t.value);t.checked?(i<0&&arr.push(t.value)):(i>=0&&arr.splice(i,1));arr.length?q.set(k,arr.join(",")):q.delete(k);replaceQuery(q);return}
  if(t.dataset.range){const dual=t.closest(".dual"),los=dual.querySelector("[data-range=lo]"),his=dual.querySelector("[data-range=hi]"),min=+dual.dataset.min,max=+dual.dataset.max,{q}=parse();
    +los.value>min?q.set("pmin",los.value):q.delete("pmin");+his.value<max?q.set("pmax",his.value):q.delete("pmax");replaceQuery(q);return}
  if(t.name==="srt"){const {q}=parse();t.dataset.v==="rec"?q.delete("sort"):q.set("sort",t.dataset.v);replaceQuery(q);closeSheet();return}
  if(t.id==="b-from"||t.id==="b-to"){const f=$("#b-from").value,to=$("#b-to").value;if(f&&to&&new Date(to)>new Date(f)){S.dates=[f,to];const l=LISTINGS[parse().path.split("/")[2]];$("#bookp").innerHTML=bookPanelVehicle(l);const d=daysBetween(f,to);const mc=$(".mcta .p span");if(mc)mc.textContent=`${inr(l.price*d)} for ${plural(d,"day")}`}else toast("Return must be after pickup.");return}
});
document.addEventListener("input",e=>{
  const t=e.target;if(!t.dataset.range)return;
  const dual=t.closest(".dual"),los=dual.querySelector("[data-range=lo]"),his=dual.querySelector("[data-range=hi]"),min=+dual.dataset.min,max=+dual.dataset.max;
  if(+los.value>+his.value){if(t===los)los.value=his.value;else his.value=los.value}
  const pc=v=>((v-min)/(max-min)*100),fill=dual.querySelector(".fill");fill.style.left=pc(+los.value)+"%";fill.style.right=(100-pc(+his.value))+"%";
  const panel=dual.closest("details");panel.querySelector("#pr-lo").textContent=inr(+los.value);panel.querySelector("#pr-hi").textContent=inr(+his.value)+(+his.value>=max?"+":"");
});
document.addEventListener("toggle",e=>{const g=e.target.closest&&e.target.closest("details.fgrp");if(!g)return;g.open?S.openGroups.add(g.dataset.g):S.openGroups.delete(g.dataset.g)},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();if((e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName))||(e.key==="k"&&(e.metaKey||e.ctrlKey))){e.preventDefault();openSearch()}});
/* shared-element hint: name the tapped vehicle image so it can morph into the detail gallery */
document.addEventListener("pointerdown",e=>{const a=e.target.closest("a[data-vt]");if(!a)return;$$("[data-vtimg]").forEach(i=>i.style.viewTransitionName="");const img=a.querySelector("[data-vtimg]");if(img)img.style.viewTransitionName=a.dataset.vt},true);
addEventListener("scroll",()=>document.body.classList.toggle("scrolled",scrollY>40),{passive:true});
window.addEventListener("hashchange",()=>{S.prevFrom=S.lastHash;S.lastHash=location.hash;closeSheet();navigate()});

S.lastHash=location.hash;S.prevPath=parse().path;
render();
})();
