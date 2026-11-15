/* BS Fleet Manager: small progressive enhancements. Every page works without this file. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var rupees = function (paise) { return '₹' + Math.round(paise / 100).toLocaleString('en-IN'); };

  // menu
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-nav-toggle]'); if (t) { document.body.classList.toggle('nav-open'); return; }
    if (e.target.closest('[data-nav-close]')) { document.body.classList.remove('nav-open'); return; }
    if (e.target.closest('[data-print]')) { window.print(); return; }
    // whole table row is a link, unless a link/button inside was clicked
    var tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('a, button, input, select, form, label')) location.href = tr.getAttribute('data-href');
  });
  document.addEventListener('keydown', function (e) {
    var tr = e.target.closest && e.target.closest('tr[data-href]');
    if (tr && e.key === 'Enter') location.href = tr.getAttribute('data-href');
    if (e.key === 'Escape') document.body.classList.remove('nav-open');
  });

  // confirmations and reasons, no inline JS (strict security policy)
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.hasAttribute('data-confirm') && !confirm(f.getAttribute('data-confirm'))) { e.preventDefault(); return; }
    if (f.hasAttribute('data-prompt')) {
      var r = prompt(f.getAttribute('data-prompt'));
      if (!r || !r.trim()) { e.preventDefault(); return; }
      f.elements.reason.value = r.trim();
    }
    // stop double submits (e.g. double-tapping "Save payment")
    if (f.dataset.sent) { e.preventDefault(); return; }
    f.dataset.sent = '1';
    $$('button', f).forEach(function (b) { b.disabled = true; });
    setTimeout(function () { delete f.dataset.sent; $$('button', f).forEach(function (b) { b.disabled = false; }); }, 8000);
  });

  // date range filter: show custom dates only when "Custom" is chosen
  $$('[data-range]').forEach(function (s) {
    var sync = function () { $$('[data-custom]', s.form).forEach(function (i) { i.hidden = s.value !== 'custom'; }); };
    s.addEventListener('change', sync); sync();
  });

  // booking form: suggest the rent from the vehicle's rate and the dates
  var bf = $('[data-booking-form]');
  if (bf) {
    var veh = $('[data-vehicle]', bf), st = $('[data-start]', bf), en = $('[data-end]', bf), rate = $('[data-rate]', bf), amt = $('[data-amount]', bf), hint = $('[data-suggest]', bf), km = $('input[data-km]', bf);
    var touched = amt && amt.value !== '';
    if (amt) amt.addEventListener('input', function () { touched = true; });
    var calc = function () {
      if (!veh || !st || !en || !hint) return;
      var o = veh.options[veh.selectedIndex];
      var s = new Date(st.value), t = new Date(en.value);
      if (!o || !o.value || isNaN(s) || isNaN(t) || t <= s) { hint.textContent = ''; return; }
      var days = Math.max(1, Math.ceil(Math.round((t - s) / 36e5 * 1e4) / 1e4 / 24));
      var daily = +o.dataset.daily, monthly = +o.dataset.monthly, sug, how;
      if (rate && rate.value === 'monthly' && monthly > 0) { var m = Math.max(1, Math.ceil(days / 30)); sug = m * monthly; how = m + ' month(s) × ' + rupees(monthly); }
      else if (rate && rate.value === 'fixed') { hint.textContent = days + ' day(s). Enter the agreed amount.'; return; }
      else { sug = days * daily; how = days + ' day(s) × ' + rupees(daily); }
      hint.textContent = 'Suggested: ' + rupees(sug) + ' (' + how + ')';
      if (!touched && amt && sug > 0) amt.value = Math.round(sug / 100);
      if (km && km.value === '' && +o.dataset.km > 0) km.value = o.dataset.km;
    };
    [veh, st, en, rate].forEach(function (el) { if (el) el.addEventListener('change', calc); });
    calc();
  }

  // extension: suggest the charge for the extra days
  var xe = $('[data-ext-end]'), xa = $('[data-ext-amount]');
  if (xe && xa) {
    var touchedX = false; xa.addEventListener('input', function () { touchedX = true; });
    xe.addEventListener('change', function () {
      var a = new Date(xe.dataset.oldEnd), b = new Date(xe.value);
      if (isNaN(b) || b <= a || touchedX) return;
      var d = Math.max(1, Math.ceil((b - a) / 864e5));
      xa.value = Math.round(d * +xe.dataset.perDay / 100);
    });
  }

  // return: work out extra km from the odometer
  var xk = $('[data-extra-km]');
  if (xk) {
    var form = xk.closest('form'), odo = form.elements.odometer, out = $('[data-km-note]', xk), amtK = form.elements.km_amount;
    var upd = function () {
      var driven = (+odo.value || 0) - (+xk.dataset.startOdo), free = +xk.dataset.free, extra = driven - free;
      if (!free || !out) return;
      out.textContent = 'Driven ' + Math.max(0, driven).toLocaleString('en-IN') + ' km' + (extra > 0 ? ', ' + extra.toLocaleString('en-IN') + ' km extra.' : ', within the limit.');
      if (amtK) amtK.value = extra > 0 ? Math.round(extra * +xk.dataset.rate / 100) : 0;
    };
    odo.addEventListener('input', upd); upd();
  }
})();
