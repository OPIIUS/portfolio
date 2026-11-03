/* OPIIUS Signature: shared behaviour for OPIIUS-built sites (nav, reveal, ring, badge, confirmation sheet). */
(function () {
  var d = document, $ = function (s, r) { return (r || d).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };
  d.documentElement.classList.add("js");
  window.O = { $: $, $$: $$ };

  /* the glowing ring, drawn in each site's own brand colours */
  var ring = '<svg viewBox="0 0 600 600" aria-hidden="true"><defs>' +
    '<linearGradient id="oG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:#fff"/><stop offset=".25" style="stop-color:var(--brand-2)"/><stop offset=".5" style="stop-color:var(--brand)"/><stop offset=".68" style="stop-color:var(--brand-deep)"/><stop offset=".85" style="stop-color:var(--brand)"/><stop offset="1" style="stop-color:#fff"/></linearGradient>' +
    '<linearGradient id="oC" x1="1" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--brand)"/><stop offset=".4" style="stop-color:var(--brand-deep)"/><stop offset=".7" style="stop-color:var(--brand)"/><stop offset="1" style="stop-color:var(--brand-2)"/></linearGradient>' +
    '<filter id="oS" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter><filter id="oE" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs>' +
    '<g class="spin"><circle cx="300" cy="300" r="215" fill="none" stroke="url(#oG)" stroke-width="140" filter="url(#oS)" opacity=".9"/>' +
    '<circle cx="300" cy="300" r="215" fill="none" stroke="url(#oC)" stroke-width="64" filter="url(#oE)"/>' +
    '<circle cx="300" cy="300" r="260" fill="none" stroke="#fff" stroke-width="6" opacity=".7" filter="url(#oE)"/>' +
    '<circle cx="300" cy="300" r="178" fill="none" stroke="#fff" stroke-width="3" opacity=".45" filter="url(#oE)"/></g></svg>';
  $$(".o-ring").forEach(function (el) { el.innerHTML = ring; });

  /* the "Made by OPIIUS" badge (sample sites only) */
  if (d.body.dataset.sample !== undefined) {
    var b = d.createElement("a");
    b.className = "o-badge"; b.href = "https://opiius.online/#book"; b.target = "_blank"; b.rel = "noopener";
    b.innerHTML = '<img src="/assets/site/logo/opiius-mark.svg" alt=""><span></span> · <small>made by OPIIUS</small>';
    b.querySelector("span").textContent = d.body.dataset.sample || "Sample site";
    d.body.appendChild(b);
    var sb = function () { b.classList.toggle("show", scrollY > innerHeight * 0.6); };
    sb(); addEventListener("scroll", sb, { passive: true });
  }

  /* nav: shadow on scroll + phone menu */
  var nav = $(".o-nav"), menu = $(".o-menu");
  if (nav) {
    var onS = function () { nav.classList.toggle("up", scrollY > 20); };
    onS(); addEventListener("scroll", onS, { passive: true });
    if (menu) {
      menu.addEventListener("click", function () { menu.setAttribute("aria-expanded", nav.classList.toggle("open")); });
      $$(".o-links a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); }); });
    }
  }

  /* entrance + reveal */
  $$(".o-st").forEach(function (el, i) { el.style.setProperty("--i", i); });
  if ("IntersectionObserver" in window) {
    var ro = new IntersectionObserver(function (es) {
      var k = 0;
      es.forEach(function (e) { if (e.isIntersecting) { e.target.style.setProperty("--d", Math.min(k++, 6) * .07 + "s"); e.target.classList.add("in"); ro.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    O.reveal = function (r) { $$(".o-rv:not(.in)", r).forEach(function (el) { ro.observe(el); }); };
  } else O.reveal = function (r) { $$(".o-rv", r).forEach(function (el) { el.classList.add("in"); }); };
  O.reveal();

  /* confirmation sheet: O.confirm(title, text, summary) */
  O.confirm = function (title, text, summary) {
    var s = d.createElement("div");
    s.className = "o-sheet"; s.setAttribute("role", "dialog"); s.setAttribute("aria-modal", "true");
    s.innerHTML = '<div class="box"><div class="ok">✓</div><h3></h3><p class="t"></p><div class="sum"></div>' +
      '<p class="note">This is a sample site. On your own OPIIUS site, this arrives on your WhatsApp and email instantly.</p>' +
      '<button class="o-btn solid block" type="button">Close</button></div>';
    $("h3", s).textContent = title; $(".t", s).textContent = text; $(".sum", s).textContent = summary;
    var close = function () { s.remove(); };
    $("button", s).addEventListener("click", close);
    s.addEventListener("click", function (e) { if (e.target === s) close(); });
    d.body.appendChild(s); $("button", s).focus();
  };
  O.ref = function (p) { return p + "-" + Math.random().toString(36).slice(2, 7).toUpperCase(); };
  O.inr = function (n) { return "₹" + Number(n).toLocaleString("en-IN"); };
})();
