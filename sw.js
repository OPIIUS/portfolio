/* OPIIUS app service worker (written by tools/build-site.mjs) */
const V = "op-ea3d4ae6";
const SHELL = ["/", "/rentals/", "/get-matched/", "/offline.html", "/assets/site/site.css?v=ea3d4ae6", "/assets/site/site.js?v=ea3d4ae6", "/assets/opiius/config.js?v=ea3d4ae6", "/assets/site/logo/opiius-icon-96.png", "/assets/site/logo/opiius-icon.webp", "/assets/site/media/contour.svg", "/assets/site/media/lights.jpg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/dashboard")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match("/offline.html"))));
    return;
  }
  if (/\.(css|js|png|jpe?g|webp|svg|woff2?|mp4|webm)$/.test(u.pathname)) {
    if (/\.(mp4|webm)$/.test(u.pathname)) return;
    e.respondWith(caches.match(r).then(m => { const net = fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; }).catch(() => m); return m || net; }));
  }
});
