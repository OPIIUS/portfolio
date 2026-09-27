// Tour Desk pricing engine. Loaded by the server (require) and the browser (<script>), so the
// live preview and the saved quote always agree. All amounts are whole rupees.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function int(n) { n = Math.round(Number(n)); return Number.isFinite(n) ? n : 0; }

  // q: { days:[{rate}], rooms, pax, vehicle_rate, extras_pp, extra_lines:[{amount}], markup_pct, gst_pct }
  // Each day's `rate` is the per-room nightly rate of that night's hotel, or 0 when there is no hotel.
  function compute(q) {
    var days = q.days || [];
    var rooms = Math.max(0, int(q.rooms));
    var pax = Math.max(1, int(q.pax));
    var hotel = 0, nights = 0;
    days.forEach(function (d) { var r = int(d.rate); if (r > 0) { hotel += r * rooms; nights++; } });
    var vehicle = Math.max(0, int(q.vehicle_rate)) * days.length;
    var extras = Math.max(0, int(q.extras_pp)) * pax;
    (q.extra_lines || []).forEach(function (l) { extras += Math.max(0, int(l.amount)); });
    var cost = hotel + vehicle + extras;
    var markup = Math.round(cost * Math.max(0, int(q.markup_pct)) / 100);
    var subtotal = cost + markup;
    var gst = Math.round(subtotal * Math.max(0, int(q.gst_pct)) / 100);
    var total = subtotal + gst;
    return {
      nights: nights, hotel: hotel, vehicle: vehicle, extras: extras, cost: cost,
      markup: markup, subtotal: subtotal, gst: gst, total: total,
      per_person: Math.round(total / pax),
    };
  }

  // Advance to confirm, rounded up to the nearest ₹100.
  function advance(total, pct) { return Math.ceil(int(total) * Math.max(0, int(pct)) / 100 / 100) * 100; }

  function money(n) {
    n = int(n);
    return (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN');
  }

  return { compute: compute, advance: advance, money: money, int: int };
});
