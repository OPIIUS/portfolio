(function () {
  'use strict';
  var money = Pricing.money;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dt(s) { return new Date(s + 'T00:00:00Z'); }
  function addD(s, n) { var d = dt(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function fmtL(s) { var d = dt(s); return DAY[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function fmt(s) { var d = dt(s); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function lines(t) { return String(t || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function list(items) { return items.length ? '<ul>' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : ''; }
  function wa(p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return d; }

  var token = location.pathname.split('/').pop();
  var el = document.getElementById('sheet');
  fetch('/api/public/quotes/' + encodeURIComponent(token)).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Quote not found.'); return d; }); })
    .then(function (q) {
      var a = q.agency, today = new Date().toISOString().slice(0, 10), end = addD(q.start_date, q.days.length - 1);
      var expired = q.status === 'Sent' && q.valid_until < today;
      document.title = 'Quotation ' + q.number + ' · ' + a.name;
      var incl = lines(a.included);
      if (q.extras_pp) incl.push('Entry fees and listed activities');
      q.extra_lines.forEach(function (l) { incl.push(l.label); });
      el.innerHTML =
        '<div class="hd"><div><b>' + esc(a.name) + '</b><small>' + esc([a.address, a.city].filter(Boolean).join(', ')) + '</small><small>' +
          esc([a.phone, a.email].filter(Boolean).join(' · ')) + '</small>' + (a.gstin ? '<small>GSTIN ' + esc(a.gstin) + '</small>' : '') + '</div>' +
        '<div class="no"><b>Quotation ' + esc(q.number) + '</b>' + (q.status === 'Accepted' ? '<span class="stamp">Confirmed</span>' : expired ? '<span class="stamp old">Expired</span>' : '') +
          '<small>Issued ' + fmt(q.created_at.slice(0, 10)) + ' · valid until ' + fmt(q.valid_until) + '</small></div></div>' +
        '<h1>' + esc(q.package_name || 'Your trip') + '</h1>' +
        '<p class="meta">For ' + esc(q.customer_name) + ' · ' + q.pax + ' traveller' + (q.pax === 1 ? '' : 's') + (q.rooms ? ' · ' + q.rooms + ' room' + (q.rooms === 1 ? '' : 's') : '') + ' · ' + esc(q.category) + ' hotels</p>' +
        '<p class="meta">' + fmtL(q.start_date) + ' to ' + fmtL(end) + (q.vehicle_label ? ' · ' + esc(q.vehicle_label.replace(/\s*\([^)]*\)$/, '')) : '') + '</p>' +
        '<h3>Day by day</h3><table><thead><tr><th>Day</th><th>Plan</th><th>Stay</th></tr></thead><tbody>' +
        q.days.map(function (d, i) { return '<tr><td>' + (i + 1) + '<small>' + fmt(addD(q.start_date, i)) + '</small></td><td>' + esc(d.plan) + '</td><td>' + (d.hotel ? esc(d.hotel) + '<small>' + esc(d.city) + '</small>' : '—') + '</td></tr>'; }).join('') +
        '</tbody></table>' +
        '<div class="cols"><div><h3>Included</h3>' + list(incl) + '</div><div><h3>Not included</h3>' + list(lines(a.excluded)) + '</div></div>' +
        '<div class="total"><span>Total (incl. ' + q.gst_pct + '% GST)</span><span>' + money(q.total) + '</span></div>' +
        '<p class="pp">' + money(q.per_person) + ' per person · ' + money(q.advance) + ' advance to confirm' + (a.balance_due_days ? ', balance ' + a.balance_due_days + ' days before departure' : '') + '.</p>' +
        (lines(a.terms).length ? '<h3>Terms</h3>' + list(lines(a.terms)) : '') +
        '<p class="foot">Thank you for choosing ' + esc(a.name) + '.</p>' +
        '<div class="bar">' + (a.phone ? '<a class="btn pri" target="_blank" rel="noopener" href="https://wa.me/' + wa(a.phone) + '?text=' + encodeURIComponent('Hi, about quotation ' + q.number + ' for ' + q.customer_name + ': ') + '">Reply on WhatsApp</a>' : '') +
        '<button class="btn" type="button" id="printBtn">Print / save as PDF</button></div>';
      document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
    }, function (e) { el.innerHTML = '<p class="loading">' + esc(e.message) + '</p>'; });
})();
