/* Tour Desk front end. Plain JS, no build step. All inline handlers are avoided (strict CSP):
   clicks use [data-act], forms use [data-form], links use hash routes. */
(function () {
  'use strict';

  var B = null;          // bootstrap data: user, agency, hotels, vehicles, packages, options, today
  var ACT = {};          // click actions
  var FORMS = {};        // form submit handlers
  var money = Pricing.money;

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function attr(s) { return esc(s); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function dt(s) { return new Date(s + 'T00:00:00Z'); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addD(s, n) { var d = dt(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function diff(a, b) { return Math.round((dt(b) - dt(a)) / 864e5); }
  function fmt(s) { if (!s) return '—'; var d = dt(s); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function fmtL(s) { if (!s) return '—'; var d = dt(s); return DAY[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (d.getUTCFullYear() !== dt(B.today).getUTCFullYear() ? ' ' + d.getUTCFullYear() : ''); }
  function rel(s) { var n = diff(B.today, s); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n < 0 ? (-n) + ' days ago' : 'in ' + n + ' days'; }
  function isOwner() { return B && B.user.role === 'owner'; }
  function hotel(id) { return B.hotels.find(function (h) { return h.id === id; }); }
  function vehicle(id) { return B.vehicles.find(function (v) { return v.id === id; }); }
  function cities() {
    var s = {};
    B.hotels.forEach(function (h) { if (h.active) s[h.city] = 1; });
    B.packages.forEach(function (p) { p.days.forEach(function (d) { if (d.city) s[d.city] = 1; }); });
    return Object.keys(s).sort();
  }
  function waNumber(p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return d; }
  function pill(st) {
    var c = { New: 'p-blue', Quoted: 'p-violet', 'Follow-up': 'p-amber', Won: 'p-green', Lost: 'p-grey', Sent: 'p-violet', Accepted: 'p-green',
      Cancelled: 'p-grey', Upcoming: 'p-blue', 'On trip': 'p-green', Completed: 'p-grey' }[st] || 'p-grey';
    return '<span class="pill ' + c + '">' + esc(st) + '</span>';
  }
  function opts(list, sel, labelFn) {
    return list.map(function (v) { var val = typeof v === 'object' ? v.value : v, lab = typeof v === 'object' ? v.label : v;
      return '<option value="' + attr(val) + '"' + (String(val) === String(sel) ? ' selected' : '') + '>' + esc(labelFn ? labelFn(v) : lab) + '</option>'; }).join('');
  }
  function toast(m, bad) { var t = $('toast'); t.textContent = m; t.classList.toggle('bad', !!bad); t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, bad ? 5000 : 2800); }

  function api(method, url, body) {
    var o = { method: method, headers: { 'X-Requested-With': 'tourdesk' }, credentials: 'same-origin' };
    if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(url, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && url !== '/api/login' && url !== '/api/session') { showAuth(); throw new Error('Please sign in again.'); }
        if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        return data;
      });
    }, function () { throw new Error('Could not reach the server. Check your internet connection.'); });
  }

  function formData(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
      else o[el.name] = el.value;
    });
    return o;
  }
  function busy(form, on) { Array.prototype.forEach.call(form.querySelectorAll('button[type=submit]'), function (b) { b.disabled = on; }); }
  function submitWith(form, promise, errEl) {
    busy(form, true);
    if (errEl) errEl.textContent = '';
    return promise.then(function (r) { busy(form, false); return r; }, function (e) {
      busy(form, false);
      if (errEl) errEl.textContent = e.message; else toast(e.message, true);
      throw e;
    });
  }

  /* ---------------- modal ---------------- */
  var lastFocus = null;
  function modal(html, wide) {
    lastFocus = document.activeElement;
    $('modalRoot').innerHTML = '<div class="modal" data-act="modal-bg"><div class="dialog' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    var first = $('modalRoot').querySelector('input:not([type=hidden]),select,textarea,button');
    if (first) first.focus();
    return $('modalRoot').querySelector('.dialog');
  }
  function closeModal() { $('modalRoot').innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  ACT['modal-bg'] = function (el, e) { if (e.target === el) closeModal(); };
  ACT['close'] = closeModal;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('modalRoot').innerHTML) closeModal(); });

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (a && ACT[a.dataset.act]) { if (a.tagName === 'A' || a.tagName === 'BUTTON') e.preventDefault(); ACT[a.dataset.act](a, e); return; }
    var h = e.target.closest('[data-href]');
    if (h && !e.target.closest('a,button,input,select,textarea,label')) location.hash = h.dataset.href;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var h = e.target.closest && e.target.closest('[data-href]');
    if (h && e.target === h) location.hash = h.dataset.href;
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.dataset.form && FORMS[f.dataset.form]) { e.preventDefault(); FORMS[f.dataset.form](f); }
  });
  document.addEventListener('change', function (e) { var el = e.target.closest('[data-change]'); if (el && ACT[el.dataset.change]) ACT[el.dataset.change](el, e); });
  document.addEventListener('input', function (e) { var el = e.target.closest('[data-input]'); if (el && ACT[el.dataset.input]) ACT[el.dataset.input](el, e); });

  /* ---------------- auth screens ---------------- */
  function showOnly(id) { ['boot', 'login', 'setup', 'shell'].forEach(function (x) { $(x).hidden = x !== id; }); }
  function showAuth() {
    return api('GET', '/api/session').then(function (s) {
      if (s.needs_setup) { showOnly('setup'); $('suCode').focus(); return; }
      $('loginAgency').textContent = s.agency_name;
      showOnly('login'); $('liEmail').focus();
    });
  }
  FORMS.login = function (f) {
    submitWith(f, api('POST', '/api/login', formData(f)), $('loginErr')).then(function () { f.reset(); start(); }, function () {});
  };
  FORMS.setup = function (f) {
    submitWith(f, api('POST', '/api/setup', formData(f)), $('setupErr')).then(function () { location.hash = '#/settings/agency'; start(); }, function () {});
  };
  ACT.logout = function () { api('POST', '/api/logout', {}).then(function () { B = null; showAuth(); }); };

  function loadBoot() {
    return api('GET', '/api/bootstrap').then(function (b) {
      B = b;
      $('agencyName').textContent = b.agency.name;
      $('agencyCity').textContent = (b.agency.city ? b.agency.city + ' · ' : '') + 'Tour Desk';
      $('agencyMark').textContent = (b.agency.name.match(/\b\w/g) || ['T', 'D']).slice(0, 2).join('').toUpperCase();
      $('whoName').textContent = b.user.name + (b.user.role === 'owner' ? ' · owner' : '');
      document.title = b.agency.name + ' · Tour Desk';
    });
  }
  function start() {
    showOnly('boot');
    return loadBoot().then(function () { showOnly('shell'); route(); }, function (e) {
      if (!B) { $('boot').textContent = e.message; }
    });
  }

  /* ---------------- router ---------------- */
  var ROUTES = [
    [/^\/today$/, viewToday, 'today'],
    [/^\/enquiries$/, viewEnquiries, 'enquiries'],
    [/^\/enquiry\/(\d+)$/, viewEnquiry, 'enquiries'],
    [/^\/quote\/new$/, viewQuoteNew, 'quote-new'],
    [/^\/quote\/(\d+)$/, viewQuote, 'quotes'],
    [/^\/quotes$/, viewQuotes, 'quotes'],
    [/^\/trips$/, viewTrips, 'trips'],
    [/^\/trip\/(\d+)$/, viewTrip, 'trips'],
    [/^\/fleet$/, viewFleet, 'fleet'],
    [/^\/money$/, viewMoney, 'money'],
    [/^\/settings(?:\/(\w+))?$/, viewSettings, 'settings'],
  ];
  var QS = {};
  function route() {
    if (!B) return;
    var h = location.hash.replace(/^#/, '') || '/today';
    var qi = h.indexOf('?'), path = qi >= 0 ? h.slice(0, qi) : h;
    QS = {};
    if (qi >= 0) h.slice(qi + 1).split('&').forEach(function (p) { var kv = p.split('='); QS[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    for (var i = 0; i < ROUTES.length; i++) {
      var m = path.match(ROUTES[i][0]);
      if (m) {
        var navKey = ROUTES[i][2];
        document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.dataset.nav === navKey); });
        closeModal();
        var v = $('view');
        v.innerHTML = '<div class="loading">Loading…</div>';
        window.scrollTo(0, 0);
        Promise.resolve(ROUTES[i][1].apply(null, m.slice(1))).catch(function (e) {
          v.innerHTML = '<div class="card"><h2>Could not load this page</h2><p class="muted">' + esc(e.message) + '</p><button class="btn" data-act="reload">Try again</button></div>';
        });
        refreshBadge();
        return;
      }
    }
    location.hash = '#/today';
  }
  ACT.reload = function () { route(); };
  window.addEventListener('hashchange', route);
  function refreshBadge() {
    api('GET', '/api/enquiries?status=New').then(function (r) { $('ctEnq').textContent = r.rows.length || ''; }, function () {});
  }
  function render(html) { $('view').innerHTML = html; }

  /* ---------------- TODAY ---------------- */
  function viewToday() {
    return api('GET', '/api/dashboard').then(function (d) {
      var h = new Date().getHours();
      var k = d.kpis;
      var setup = '';
      if (isOwner() && (!B.hotels.length || !B.vehicles.length || !B.packages.length)) {
        setup = '<div class="card setup" style="margin-bottom:16px"><h2>Finish setting up</h2><ol>' +
          li(B.agency.gstin || B.agency.phone, 'Add your agency details and GSTIN', '#/settings/agency') +
          li(B.hotels.length, 'Add the hotels you use, with room rates', '#/settings/hotels') +
          li(B.vehicles.length, 'Add your vehicles and drivers', '#/settings/vehicles') +
          li(B.packages.length, 'Add your packages (day-by-day plans)', '#/settings/packages') +
          '</ol></div>';
      }
      function li(done, text, href) { return '<li class="' + (done ? 'done' : '') + '"><a href="' + href + '">' + esc(text) + '</a></li>'; }
      render('<div class="head"><div><h1>' + (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + esc(B.user.name.split(' ')[0]) + '</h1>' +
        '<p class="lead">' + fmtL(d.today) + ' · ' + k.on_road + ' group' + (k.on_road === 1 ? '' : 's') + ' on the road, ' + k.follow_ups + ' follow-up' + (k.follow_ups === 1 ? '' : 's') + ' due.</p></div>' +
        '<div class="btns"><button class="btn" data-act="new-enquiry">+ New enquiry</button><a class="btn pri" href="#/quote/new">New quote</a></div></div>' + setup +
        '<div class="kpis">' + [
          [k.new_enquiries, 'New enquiries', k.new_enquiries > 0], [k.follow_ups, 'Follow-ups due', k.follow_ups > 0], [k.on_road, 'Groups on the road'],
          [k.departures_7d, 'Departures this week'], [money(k.booked_month), 'Booked this month'], [money(k.to_collect), 'Balance to collect'],
        ].map(function (x) { return '<div class="kpi' + (x[2] ? ' warn' : '') + '"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
        '<div class="grid2"><div class="stack">' +
          '<div class="card"><h2>Follow up today</h2>' + (d.follow_ups.length ? d.follow_ups.map(function (e) {
            return '<div class="row link" data-href="#/enquiry/' + e.id + '" tabindex="0"><div class="m"><b>' + esc(e.name) + (e.destination ? ' · ' + esc(e.destination) : '') + '</b><span>' + pill(e.status) + ' ' +
              esc((e.notes || '').split('\n')[0] || e.source) + (e.next_follow_up < d.today ? ' · <span class="red">overdue ' + rel(e.next_follow_up) + '</span>' : '') + '</span></div>' +
              '<div class="btns"><a class="btn sm" href="#/quote/new?enq=' + e.id + '">Quote</a><button class="btn sm" data-act="followed" data-id="' + e.id + '">Done</button></div></div>';
          }).join('') : '<div class="empty">No follow-ups due. Nice.</div>') + '</div>' +
          '<div class="card"><h2>Needs attention</h2>' + (d.alerts.length ? d.alerts.map(function (a) {
            return '<div class="alert link ' + (a.level === 'red' ? 'r' : 'a') + '" data-href="#/trip/' + a.trip_id + '" tabindex="0">' + esc(a.text) + '</div>';
          }).join('') : '<div class="alert g">Everything is on track.</div>') + '</div>' +
        '</div><div class="stack">' +
          '<div class="card"><h2>On the road today</h2>' + (d.on_road.length ? d.on_road.map(function (t) {
            var n = diff(t.start_date, d.today), day = t.days[n] || {};
            return '<div class="row link" data-href="#/trip/' + t.id + '" tabindex="0"><div class="m"><b>' + esc(t.customer_name) + ' · Day ' + (n + 1) + ' of ' + t.days.length + '</b><span>' + esc(day.plan || '') +
              (day.hotel ? ' · night at ' + esc(day.hotel) : '') + '</span><span>' + esc(t.vehicle_label || 'No vehicle') + (t.vehicle && t.vehicle.driver_name ? ' · ' + esc(t.vehicle.driver_name) + (t.vehicle.driver_phone ? ' ' + esc(t.vehicle.driver_phone) : '') : '') + '</span></div>' + pill('On trip') + '</div>';
          }).join('') : '<div class="empty">No groups on the road today.</div>') + '</div>' +
          '<div class="card"><h2>Departing in the next 7 days</h2>' + (d.upcoming.length ? d.upcoming.map(function (t) {
            return '<div class="row link" data-href="#/trip/' + t.id + '" tabindex="0"><div class="m"><b>' + esc(t.customer_name) + ' · ' + t.pax + ' pax</b><span>' + fmtL(t.start_date) + ' (' + rel(t.start_date) + ') · ' + esc(t.package_name) + '</span><span>' + esc(t.vehicle_label || 'No vehicle') + '</span></div>' +
              (t.hotels_confirmed ? '<span class="pill p-green">Hotels OK</span>' : '<span class="pill p-red">Hotels pending</span>') + '</div>';
          }).join('') : '<div class="empty">No departures in the next 7 days.</div>') + '</div>' +
        '</div></div>');
    });
  }
  ACT.followed = function (el) {
    api('POST', '/api/enquiries/' + el.dataset.id + '/followed-up', {}).then(function (e) { toast('Next follow-up set for ' + fmtL(e.next_follow_up)); route(); }, function (e) { toast(e.message, true); });
  };

  /* ---------------- ENQUIRIES ---------------- */
  var EF = 'Open', ESEARCH = '';
  function viewEnquiries() {
    return api('GET', '/api/enquiries?status=' + encodeURIComponent(EF) + '&q=' + encodeURIComponent(ESEARCH)).then(function (r) {
      var c = r.counts, open = (c.New || 0) + (c.Quoted || 0) + (c['Follow-up'] || 0);
      render('<div class="head"><div><h1>Enquiries</h1><p class="lead">Every enquiry from WhatsApp, calls, Instagram and your website, with the next follow-up date.</p></div>' +
        '<div class="btns"><button class="btn pri" data-act="new-enquiry">+ New enquiry</button></div></div>' +
        '<div class="chips">' + ['Open'].concat(B.options.enquiry_status).map(function (s) {
          var n = s === 'Open' ? open : (c[s] || 0);
          return '<button class="chip' + (EF === s ? ' on' : '') + '" data-act="enq-filter" data-s="' + attr(s) + '">' + esc(s) + ' · ' + n + '</button>';
        }).join('') + '<input type="search" placeholder="Search name, phone, trip" aria-label="Search enquiries" value="' + attr(ESEARCH) + '" data-input="enq-search" id="enqSearch"></div>' +
        '<div class="card tw"><table><thead><tr><th>Customer</th><th>Trip wanted</th><th>Pax</th><th>Source</th><th>Received</th><th>Status</th><th>Next follow-up</th><th></th></tr></thead><tbody>' +
        (r.rows.length ? r.rows.map(function (e) {
          return '<tr class="link" data-href="#/enquiry/' + e.id + '"><td><b>' + esc(e.name) + '</b><span class="sub">' + esc(e.phone) + ' · ' + esc(e.ref) + '</span></td><td>' + esc(e.destination) +
            (e.notes ? '<span class="sub">' + esc(e.notes.split('\n')[0]).slice(0, 80) + '</span>' : '') + '</td><td>' + e.pax + '</td><td>' + esc(e.source) + '</td><td>' + fmt(e.created_at.slice(0, 10)) + '</td><td>' + pill(e.status) + '</td>' +
            '<td>' + (e.next_follow_up ? '<span class="' + (e.next_follow_up < B.today ? 'red b' : '') + '">' + fmt(e.next_follow_up) + '</span>' : '—') + '</td>' +
            '<td>' + (e.status === 'Won' || e.status === 'Lost' ? '' : '<a class="btn sm pri" href="#/quote/new?enq=' + e.id + '">Build quote</a>') + '</td></tr>';
        }).join('') : '<tr><td colspan="8" class="empty">' + (ESEARCH ? 'No enquiries match your search.' : 'Nothing here yet. Add your first enquiry.') + '</td></tr>') + '</tbody></table></div>');
      if (ESEARCH) { var s = $('enqSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    });
  }
  ACT['enq-filter'] = function (el) { EF = el.dataset.s; route(); };
  var searchT;
  ACT['enq-search'] = function (el) { clearTimeout(searchT); searchT = setTimeout(function () { ESEARCH = el.value.trim(); route(); }, 350); };

  function enquiryForm(e) {
    e = e || { name: '', phone: '', source: 'WhatsApp', destination: '', pax: 2, travel_date: '', status: 'New', next_follow_up: B.today, notes: '' };
    return '<div class="fgrid c2">' +
      '<div class="f"><label for="eName">Customer name</label><input id="eName" name="name" required value="' + attr(e.name) + '"></div>' +
      '<div class="f"><label for="ePhone">Phone</label><input id="ePhone" name="phone" inputmode="tel" value="' + attr(e.phone) + '"></div>' +
      '<div class="f wide"><label for="eDest">Trip wanted</label><input id="eDest" name="destination" placeholder="e.g. Meghalaya, 4 days, Dawki boating" value="' + attr(e.destination) + '"></div>' +
      '<div class="f"><label for="ePax">Travellers</label><input id="ePax" name="pax" type="number" min="1" max="200" value="' + attr(e.pax) + '"></div>' +
      '<div class="f"><label for="eDate">Travel date (if known)</label><input id="eDate" name="travel_date" type="date" value="' + attr(e.travel_date || '') + '"></div>' +
      '<div class="f"><label for="eSrc">Source</label><select id="eSrc" name="source">' + opts(B.options.sources, e.source) + '</select></div>' +
      '<div class="f"><label for="eSt">Status</label><select id="eSt" name="status">' + opts(B.options.enquiry_status, e.status) + '</select></div>' +
      '<div class="f"><label for="eFu">Next follow-up</label><input id="eFu" name="next_follow_up" type="date" value="' + attr(e.next_follow_up || '') + '"></div>' +
      '<div class="f wide"><label for="eNotes">Notes</label><textarea id="eNotes" name="notes">' + esc(e.notes) + '</textarea></div></div>';
  }
  ACT['new-enquiry'] = function () {
    modal('<form data-form="enquiry-new" novalidate><h2>New enquiry</h2>' + enquiryForm() + '<p class="err" id="mErr"></p>' +
      '<div class="btns"><button type="button" class="btn" data-act="close">Cancel</button><button type="button" class="btn" data-act="enq-save-quote">Save and build quote</button><button class="btn pri" type="submit">Save enquiry</button></div></form>');
  };
  function saveNewEnquiry(f, thenQuote) {
    return submitWith(f, api('POST', '/api/enquiries', formData(f)), $('mErr')).then(function (e) {
      closeModal(); toast(e.ref + ' saved');
      location.hash = thenQuote ? '#/quote/new?enq=' + e.id : '#/enquiry/' + e.id;
    }, function () {});
  }
  FORMS['enquiry-new'] = function (f) { saveNewEnquiry(f, false); };
  ACT['enq-save-quote'] = function (el) { saveNewEnquiry(el.closest('form'), true); };

  function viewEnquiry(id) {
    return api('GET', '/api/enquiries/' + id).then(function (e) {
      var open = ['New', 'Quoted', 'Follow-up'].indexOf(e.status) >= 0;
      render('<div class="head"><div><p class="lead" style="margin:0"><a href="#/enquiries">Enquiries</a> · ' + esc(e.ref) + '</p><h1>' + esc(e.name) + ' ' + pill(e.status) + '</h1>' +
        '<p class="lead">' + esc(e.destination || 'Trip not described yet') + ' · ' + e.pax + ' pax · from ' + esc(e.source) + ' on ' + fmt(e.created_at.slice(0, 10)) + '</p></div>' +
        '<div class="btns">' + (e.phone ? '<a class="btn" href="https://wa.me/' + waNumber(e.phone) + '" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="tel:' + attr(e.phone.replace(/\s/g, '')) + '">Call</a>' : '') +
        (open ? '<button class="btn" data-act="followed" data-id="' + e.id + '">Followed up</button><a class="btn pri" href="#/quote/new?enq=' + e.id + '">Build quote</a>' : '') + '</div></div>' +
        '<div class="grid2"><form class="card" data-form="enquiry-edit" data-id="' + e.id + '" novalidate><h2>Details</h2>' + enquiryForm(e) + '<p class="err" id="eErr"></p>' +
        '<div class="btns" style="margin-top:14px"><button class="btn pri" type="submit">Save changes</button></div></form>' +
        '<div class="card"><h2>Quotes</h2>' + (e.quotes.length ? e.quotes.map(function (q) {
          return '<div class="row link" data-href="#/quote/' + q.id + '" tabindex="0"><div class="m"><b>' + esc(q.number) + ' · ' + money(q.total) + '</b><span>' + fmt(q.created_at.slice(0, 10)) + '</span></div>' + pill(q.status) + '</div>';
        }).join('') : '<div class="empty">No quotes yet.</div>') + '</div></div>');
    });
  }
  FORMS['enquiry-edit'] = function (f) {
    submitWith(f, api('PUT', '/api/enquiries/' + f.dataset.id, formData(f)), $('eErr')).then(function () { toast('Saved'); route(); }, function () {});
  };

  /* ---------------- QUOTE BUILDER ---------------- */
  var Q = null;
  function pickHotel(city, cat) {
    var list = B.hotels.filter(function (h) { return h.active && h.city === city && h.category === cat; }).sort(function (a, b) { return a.rate - b.rate; });
    return list.length ? list[0].id : null;
  }
  function pickVehicle(pax) {
    var ok = B.vehicles.filter(function (v) { return v.active && v.seats >= pax; }).sort(function (a, b) { return a.rate - b.rate; });
    return ok.length ? ok[0].id : null;
  }
  function loadPackage(p) {
    Q.package_id = p ? p.id : '';
    Q.package_name = p ? p.name : 'Custom trip';
    Q.extras_pp = p ? p.extras_pp : 0;
    Q.days = (p ? p.days : [{ plan: 'Day 1', city: cities()[0] || '' }]).map(function (d) { return { plan: d.plan, city: d.city || '', hotel_id: d.city ? pickHotel(d.city, Q.category) : null }; });
  }
  function viewQuoteNew() {
    var enqId = Number(QS.enq) || null;
    var go = function (e) {
      var a = B.agency, pax = e ? e.pax : 2;
      Q = { enquiry_id: e ? e.id : null, customer_name: e ? e.name : '', phone: e ? e.phone : '', pax: pax, rooms: Math.max(1, Math.ceil(pax / 2)),
        start_date: e && e.travel_date && e.travel_date >= B.today ? e.travel_date : addD(B.today, 14), category: 'Deluxe',
        vehicle_mode: 'own', vehicle_id: pickVehicle(pax), vehicle_label: '', vehicle_rate: 0, extra_lines: [],
        markup_pct: a.markup_pct, gst_pct: a.gst_pct, t0: Date.now() };
      var active = B.packages.filter(function (p) { return p.active; });
      var guess = e ? active.find(function (p) { return p.name.toLowerCase().split(/[^a-z]+/).some(function (w) { return w.length > 4 && e.destination.toLowerCase().indexOf(w) >= 0; }); }) : null;
      loadPackage(guess || active[0] || null);
      if (!Q.vehicle_id) Q.vehicle_mode = B.vehicles.some(function (v) { return v.active; }) ? 'own' : 'hired';
      renderBuilder(e);
    };
    if (enqId) return api('GET', '/api/enquiries/' + enqId).then(go);
    go(null);
  }
  function renderBuilder(e) {
    lastClashKey = ''; clash = null;
    var active = B.packages.filter(function (p) { return p.active; });
    render('<div class="head"><div><h1>New quote</h1><p class="lead">' + (e ? 'For enquiry ' + esc(e.ref) + '. ' : '') + 'Pick a package and hotel category. The price works itself out.</p></div></div>' +
      '<div class="qb"><div class="stack">' +
      '<div class="card"><h2>Customer</h2><div class="fgrid">' +
        '<div class="f"><label for="qName">Name</label><input id="qName" data-input="q-field" data-k="customer_name" value="' + attr(Q.customer_name) + '"></div>' +
        '<div class="f"><label for="qPhone">Phone</label><input id="qPhone" inputmode="tel" data-input="q-field" data-k="phone" value="' + attr(Q.phone) + '"></div>' +
        '<div class="f"><label for="qPax">Travellers</label><input id="qPax" type="number" min="1" max="200" data-input="q-pax" value="' + Q.pax + '"></div>' +
        '<div class="f"><label for="qStart">Start date</label><input id="qStart" type="date" data-change="q-date" value="' + Q.start_date + '"></div>' +
      '</div></div>' +
      '<div class="card"><div class="head" style="align-items:center;margin-bottom:12px"><h2 style="margin:0">Itinerary</h2><div class="seg" role="group" aria-label="Hotel category">' +
        B.options.categories.map(function (c) { return '<button type="button" data-act="q-cat" data-c="' + c + '" class="' + (Q.category === c ? 'on' : '') + '" aria-pressed="' + (Q.category === c) + '">' + c + '</button>'; }).join('') + '</div></div>' +
        '<div class="fgrid c3" style="margin-bottom:10px">' +
          '<div class="f"><label for="qPkg">Package</label><select id="qPkg" data-change="q-pkg">' + active.map(function (p) { return '<option value="' + p.id + '"' + (p.id === Q.package_id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
            '<option value=""' + (!Q.package_id ? ' selected' : '') + '>Custom trip</option></select></div>' +
          '<div class="f"><label for="qRooms">Rooms</label><input id="qRooms" type="number" min="0" max="100" data-input="q-num" data-k="rooms" value="' + Q.rooms + '"></div>' +
          '<div class="f"><label for="qVeh">Vehicle</label><select id="qVeh" data-change="q-veh"></select></div>' +
        '</div><div id="qHired"></div>' +
        '<div class="days" id="qDays"></div>' +
        '<div class="btns" style="margin-top:10px"><button type="button" class="btn sm" data-act="q-add-day">+ Add a day</button></div>' +
        '<datalist id="cityList">' + cities().map(function (c) { return '<option value="' + attr(c) + '">'; }).join('') + '</datalist></div>' +
      '<div class="card"><h2>Pricing</h2><div class="fgrid c3">' +
        '<div class="f"><label for="qExtra">Entry fees &amp; activities per person (₹)</label><input id="qExtra" type="number" min="0" step="100" data-input="q-num" data-k="extras_pp" value="' + Q.extras_pp + '"></div>' +
        '<div class="f"><label for="qMarkup">Your markup (%)</label><input id="qMarkup" type="number" min="0" max="200" data-input="q-num" data-k="markup_pct" value="' + Q.markup_pct + '"></div>' +
        '<div class="f"><label for="qGst">GST (%)</label><input id="qGst" type="number" min="0" max="28" data-input="q-num" data-k="gst_pct" value="' + Q.gst_pct + '"></div>' +
        '</div><div class="lines" id="qLines"></div><div class="btns" style="margin-top:10px"><button type="button" class="btn sm" data-act="q-add-line">+ Add an extra item</button><span class="hint" style="margin:0">Permits, boating, guide fees: a fixed amount for the whole group.</span></div></div>' +
      '</div><div class="card sum" id="qSum"></div></div>');
    renderVehOpts(); renderHired(); renderDays(); renderLines(); renderSum();
  }
  function renderVehOpts() {
    var own = B.vehicles.filter(function (v) { return v.active; });
    $('qVeh').innerHTML = own.map(function (v) {
      var fit = v.seats >= Q.pax;
      return '<option value="' + v.id + '"' + (Q.vehicle_mode === 'own' && v.id === Q.vehicle_id ? ' selected' : '') + (fit ? '' : ' disabled') + '>' + esc(v.type) + ' · ' + esc(v.reg) + ' (' + v.seats + ' seats) · ' + money(v.rate) + '/day' + (fit ? '' : ' – too small') + '</option>';
    }).join('') + '<option value="hired"' + (Q.vehicle_mode === 'hired' ? ' selected' : '') + '>Hired from outside…</option><option value="none"' + (Q.vehicle_mode === 'none' ? ' selected' : '') + '>No vehicle</option>';
  }
  function renderHired() {
    $('qHired').innerHTML = Q.vehicle_mode === 'hired' ? '<div class="fgrid c2" style="margin-bottom:10px"><div class="f"><label for="qVl">Hired vehicle</label><input id="qVl" placeholder="e.g. Innova from Das Travels" data-input="q-field" data-k="vehicle_label" value="' + attr(Q.vehicle_label) + '"></div>' +
      '<div class="f"><label for="qVr">Rate per day (₹)</label><input id="qVr" type="number" min="0" step="100" data-input="q-num" data-k="vehicle_rate" value="' + Q.vehicle_rate + '"></div></div>' : '';
  }
  function renderDays() {
    $('qDays').innerHTML = Q.days.map(function (d, i) {
      var hs = B.hotels.filter(function (h) { return h.active && h.city === d.city && h.category === Q.category; }).sort(function (a, b) { return a.rate - b.rate; });
      var cityHas = B.hotels.some(function (h) { return h.active && h.city === d.city; });
      return '<div class="d"><span class="n">D' + (i + 1) + '</span>' +
        '<input class="dt" aria-label="Day ' + (i + 1) + ' plan" data-input="q-day-plan" data-i="' + i + '" value="' + attr(d.plan) + '">' +
        '<input class="dc" aria-label="Day ' + (i + 1) + ' overnight city" list="cityList" placeholder="Night in (city)" data-change="q-day-city" data-i="' + i + '" value="' + attr(d.city) + '">' +
        '<select class="dh" aria-label="Day ' + (i + 1) + ' hotel" data-change="q-day-hotel" data-i="' + i + '"><option value="">No hotel</option>' +
          hs.map(function (h) { return '<option value="' + h.id + '"' + (h.id === d.hotel_id ? ' selected' : '') + '>' + esc(h.name) + ' · ' + money(h.rate) + '/room</option>'; }).join('') +
          (d.city && !hs.length ? '<option disabled>' + (cityHas ? 'No ' + Q.category + ' hotel in ' + esc(d.city) : 'No hotels in ' + esc(d.city) + ' yet') + '</option>' : '') + '</select>' +
        (Q.days.length > 1 ? '<button type="button" class="x" title="Remove day" aria-label="Remove day ' + (i + 1) + '" data-act="q-del-day" data-i="' + i + '">×</button>' : '<span></span>') + '</div>';
    }).join('');
  }
  function renderLines() {
    $('qLines').innerHTML = Q.extra_lines.map(function (l, i) {
      return '<div class="l"><input aria-label="Extra item" placeholder="e.g. Tawang inner line permit" data-input="q-line" data-i="' + i + '" data-k="label" value="' + attr(l.label) + '">' +
        '<input type="number" min="0" step="100" aria-label="Amount" placeholder="Amount ₹" data-input="q-line" data-i="' + i + '" data-k="amount" value="' + attr(l.amount) + '">' +
        '<button type="button" class="x" aria-label="Remove item" data-act="q-del-line" data-i="' + i + '">×</button></div>';
    }).join('');
  }
  function quotePayload() {
    return {
      enquiry_id: Q.enquiry_id, customer_name: Q.customer_name, phone: Q.phone, pax: Q.pax, rooms: Q.rooms, start_date: Q.start_date, category: Q.category,
      package_name: Q.package_name, vehicle_id: Q.vehicle_mode === 'own' ? Q.vehicle_id : null,
      vehicle_label: Q.vehicle_mode === 'hired' ? (Q.vehicle_label || 'Hired vehicle') : '', vehicle_rate: Q.vehicle_mode === 'hired' ? Q.vehicle_rate : 0,
      extras_pp: Q.extras_pp, markup_pct: Q.markup_pct, gst_pct: Q.gst_pct,
      days: Q.days.map(function (d) { return { plan: d.plan, city: d.city, hotel_id: d.hotel_id }; }),
      extra_lines: Q.extra_lines.filter(function (l) { return l.label || l.amount; }),
    };
  }
  var clashT, lastClashKey = '', clash = null;
  function checkClash() {
    var key = [Q.vehicle_mode, Q.vehicle_id, Q.start_date, Q.days.length].join('|');
    if (key === lastClashKey) return;
    lastClashKey = key; clash = null;
    clearTimeout(clashT);
    if (Q.vehicle_mode !== 'own' || !Q.vehicle_id) return;
    clashT = setTimeout(function () {
      var p = quotePayload(); p.customer_name = p.customer_name || 'x';
      api('POST', '/api/quotes/preview', p).then(function (r) { clash = r.clash; renderSum(true); }, function () {});
    }, 400);
  }
  function renderSum(fromClash) {
    if (!fromClash) checkClash();
    var v = Q.vehicle_mode === 'own' ? vehicle(Q.vehicle_id) : null;
    var t = Pricing.compute({
      days: Q.days.map(function (d) { var h = hotel(d.hotel_id); return { rate: h ? h.rate : 0 }; }),
      rooms: Q.rooms, pax: Q.pax, vehicle_rate: v ? v.rate : Q.vehicle_mode === 'hired' ? Q.vehicle_rate : 0,
      extras_pp: Q.extras_pp, extra_lines: Q.extra_lines, markup_pct: Q.markup_pct, gst_pct: Q.gst_pct,
    });
    var adv = Pricing.advance(t.total, B.agency.advance_pct);
    var secs = Math.round((Date.now() - Q.t0) / 1000);
    $('qSum').innerHTML = '<h2>Price</h2>' +
      '<div class="l"><span>Hotels · ' + t.nights + ' night' + (t.nights === 1 ? '' : 's') + ' × ' + Q.rooms + ' room' + (Q.rooms === 1 ? '' : 's') + ' · ' + Q.category + '</span><span>' + money(t.hotel) + '</span></div>' +
      '<div class="l"><span>' + esc(v ? v.type : Q.vehicle_mode === 'hired' ? (Q.vehicle_label || 'Hired vehicle') : 'No vehicle') + ' · ' + Q.days.length + ' day' + (Q.days.length === 1 ? '' : 's') + '</span><span>' + money(t.vehicle) + '</span></div>' +
      '<div class="l"><span>Entry fees, activities &amp; extras</span><span>' + money(t.extras) + '</span></div>' +
      '<div class="l"><span>Markup ' + Q.markup_pct + '%</span><span>' + money(t.markup) + '</span></div>' +
      '<div class="l"><span>GST ' + Q.gst_pct + '%</span><span>' + money(t.gst) + '</span></div>' +
      '<div class="l t"><span>Quote total</span><span>' + money(t.total) + '</span></div>' +
      '<div class="l pp"><span>Per person</span><span>' + money(t.per_person) + '</span></div>' +
      '<div class="l pp"><span>Advance to confirm (' + B.agency.advance_pct + '%)</span><span>' + money(adv) + '</span></div>' +
      '<div class="l pr"><span>Your margin on this trip</span><span>' + money(t.markup) + '</span></div>' +
      (clash ? '<div class="alert r">' + esc((v ? v.type + ' ' + v.reg : 'This vehicle') + ' is already booked for ' + clash.customer_name + ' (' + clash.number + ') from ' + fmt(clash.start_date) + ' to ' + fmt(clash.end_date) + '. Pick another vehicle before confirming.') + '</div>' : '') +
      (Q.pax > 0 && v && v.seats < Q.pax ? '<div class="alert a">' + esc(v.type) + ' has only ' + v.seats + ' seats.</div>' : '') +
      '<p class="err" id="qErr"></p>' +
      '<div class="btns" style="margin-top:14px"><button type="button" class="btn pri" data-act="q-save">Save quote</button></div>' +
      '<p class="hint">Saving gives you a quotation link to send on WhatsApp and a printable PDF. Started ' + (secs < 60 ? secs + ' sec' : Math.floor(secs / 60) + ' min') + ' ago.</p>';
  }
  function int(v) { var n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }
  ACT['q-field'] = function (el) { Q[el.dataset.k] = el.value; if (el.dataset.k === 'vehicle_label') renderSum(); };
  ACT['q-num'] = function (el) { Q[el.dataset.k] = int(el.value); renderSum(); };
  ACT['q-pax'] = function (el) {
    Q.pax = Math.max(1, int(el.value)); Q.rooms = Math.max(1, Math.ceil(Q.pax / 2)); $('qRooms').value = Q.rooms;
    var v = vehicle(Q.vehicle_id);
    if (Q.vehicle_mode === 'own' && (!v || v.seats < Q.pax)) { Q.vehicle_id = pickVehicle(Q.pax); if (!Q.vehicle_id) Q.vehicle_mode = 'hired'; renderHired(); }
    renderVehOpts(); renderSum();
  };
  ACT['q-date'] = function (el) { if (el.value) { Q.start_date = el.value; renderSum(); } };
  ACT['q-cat'] = function (el) {
    Q.category = el.dataset.c;
    Q.days.forEach(function (d) { d.hotel_id = d.city ? pickHotel(d.city, Q.category) : null; });
    document.querySelectorAll('[data-act="q-cat"]').forEach(function (b) { var on = b.dataset.c === Q.category; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    renderDays(); renderSum();
  };
  ACT['q-pkg'] = function (el) {
    var p = B.packages.find(function (x) { return String(x.id) === el.value; }) || null;
    loadPackage(p); $('qExtra').value = Q.extras_pp; renderDays(); renderSum();
  };
  ACT['q-veh'] = function (el) {
    if (el.value === 'hired' || el.value === 'none') { Q.vehicle_mode = el.value; }
    else { Q.vehicle_mode = 'own'; Q.vehicle_id = int(el.value); }
    renderHired(); renderSum();
  };
  ACT['q-day-plan'] = function (el) { Q.days[el.dataset.i].plan = el.value; };
  ACT['q-day-city'] = function (el) { var d = Q.days[el.dataset.i]; d.city = el.value.trim(); d.hotel_id = d.city ? pickHotel(d.city, Q.category) : null; renderDays(); renderSum(); };
  ACT['q-day-hotel'] = function (el) { Q.days[el.dataset.i].hotel_id = el.value ? int(el.value) : null; renderSum(); };
  ACT['q-add-day'] = function () { var last = Q.days[Q.days.length - 1]; Q.days.push({ plan: 'Day ' + (Q.days.length + 1), city: last ? last.city : '', hotel_id: last ? last.hotel_id : null }); renderDays(); renderSum(); };
  ACT['q-del-day'] = function (el) { Q.days.splice(int(el.dataset.i), 1); renderDays(); renderSum(); };
  ACT['q-add-line'] = function () { Q.extra_lines.push({ label: '', amount: 0 }); renderLines(); var ins = $('qLines').querySelectorAll('input'); ins[ins.length - 2].focus(); };
  ACT['q-del-line'] = function (el) { Q.extra_lines.splice(int(el.dataset.i), 1); renderLines(); renderSum(); };
  ACT['q-line'] = function (el) { var l = Q.extra_lines[el.dataset.i]; l[el.dataset.k] = el.dataset.k === 'amount' ? int(el.value) : el.value; if (el.dataset.k === 'amount') renderSum(); };
  ACT['q-save'] = function (el) {
    if (!Q.customer_name.trim()) { $('qErr').textContent = "Add the customer's name first."; $('qName').focus(); return; }
    el.disabled = true;
    api('POST', '/api/quotes', quotePayload()).then(function (q) { toast(q.number + ' saved'); location.hash = '#/quote/' + q.id; },
      function (e) { el.disabled = false; $('qErr').textContent = e.message; });
  };

  /* ---------------- QUOTE DETAIL ---------------- */
  function quoteLink(q) { return location.origin + '/q/' + q.public_token; }
  function waText(q) {
    return 'Namaskar ' + q.customer_name + ',\n\nHere is your quotation ' + q.number + ' from ' + B.agency.name + ' for ' + (q.package_name || 'your trip') + ', ' +
      q.pax + ' travellers, starting ' + fmtL(q.start_date) + '.\n\nTotal: ' + money(q.total) + ' (' + money(q.totals.per_person) + ' per person, incl. GST)\n' +
      'Advance to confirm: ' + money(q.advance) + '\n\nFull day-by-day plan: ' + quoteLink(q) + '\n\n' + B.agency.name + (B.agency.phone ? ' · ' + B.agency.phone : '');
  }
  function viewQuote(id) {
    return api('GET', '/api/quotes/' + id).then(function (q) {
      var t = q.totals;
      render('<div class="head"><div><p class="lead" style="margin:0"><a href="#/quotes">Quotes</a>' + (q.enquiry_id ? ' · <a href="#/enquiry/' + q.enquiry_id + '">Enquiry</a>' : '') + '</p>' +
        '<h1>' + esc(q.number) + ' · ' + esc(q.customer_name) + ' ' + pill(q.status) + '</h1><p class="lead">' + esc(q.package_name) + ' · ' + q.pax + ' pax · ' + q.rooms + ' rooms · ' + esc(q.category) + ' · ' + fmtL(q.start_date) + ' to ' + fmtL(addD(q.start_date, q.days.length - 1)) + '</p></div>' +
        '<div class="btns">' + (q.status === 'Sent' ? '<button class="btn" data-act="quote-cancel" data-id="' + q.id + '">Cancel quote</button><button class="btn ok" data-act="quote-confirm" data-id="' + q.id + '">Advance received: confirm trip</button>' : '') +
        (q.trip ? '<a class="btn pri" href="#/trip/' + q.trip.id + '">Open trip ' + esc(q.trip.number) + '</a>' : '') + '</div></div>' +
        '<div class="grid2"><div class="stack"><div class="card"><h2>Send to customer</h2>' +
          '<div class="btns">' + (q.phone ? '<a class="btn pri" target="_blank" rel="noopener" href="https://wa.me/' + waNumber(q.phone) + '?text=' + encodeURIComponent(waText(q)) + '">Send on WhatsApp</a>' : '') +
          '<button class="btn" data-act="copy" data-text="' + attr(waText(q)) + '">Copy message</button><button class="btn" data-act="copy" data-text="' + attr(quoteLink(q)) + '">Copy link</button>' +
          '<a class="btn" target="_blank" rel="noopener" href="/q/' + attr(q.public_token) + '">Open quotation / PDF</a></div>' +
          '<p class="hint">The link shows the customer the plan, hotels and total price. It never shows your costs or margin. Valid until ' + fmtL(q.valid_until) + '.</p></div>' +
          '<div class="card tw"><h2>Day by day</h2><table><thead><tr><th>Day</th><th>Plan</th><th>Stay</th><th class="num">Rate</th></tr></thead><tbody>' +
          q.days.map(function (d, i) { return '<tr><td>' + (i + 1) + '<span class="sub">' + fmt(addD(q.start_date, i)) + '</span></td><td>' + esc(d.plan) + '</td><td>' + (d.hotel ? esc(d.hotel) + '<span class="sub">' + esc(d.city) + '</span>' : '—') + '</td><td class="num">' + (d.rate ? money(d.rate) : '') + '</td></tr>'; }).join('') +
          '</tbody></table></div></div>' +
        '<div class="card sum"><h2>Price</h2>' +
          '<div class="l"><span>Hotels · ' + t.nights + ' nights × ' + q.rooms + ' rooms</span><span>' + money(t.hotel) + '</span></div>' +
          '<div class="l"><span>' + esc(q.vehicle_label || 'No vehicle') + '</span><span>' + money(t.vehicle) + '</span></div>' +
          '<div class="l"><span>Entry fees &amp; extras' + (q.extra_lines.length ? ' (' + q.extra_lines.map(function (l) { return esc(l.label); }).join(', ') + ')' : '') + '</span><span>' + money(t.extras) + '</span></div>' +
          '<div class="l"><span>Markup ' + q.markup_pct + '%</span><span>' + money(t.markup) + '</span></div>' +
          '<div class="l"><span>GST ' + q.gst_pct + '%</span><span>' + money(t.gst) + '</span></div>' +
          '<div class="l t"><span>Quote total</span><span>' + money(q.total) + '</span></div>' +
          '<div class="l pp"><span>Per person</span><span>' + money(t.per_person) + '</span></div>' +
          '<div class="l pp"><span>Advance to confirm</span><span>' + money(q.advance) + '</span></div>' +
          '<div class="l pr"><span>Your margin</span><span>' + money(t.markup) + '</span></div></div></div>');
      CURQ = q;
    });
  }
  var CURQ = null;
  ACT.copy = function (el) {
    var text = el.dataset.text;
    var done = function () { toast('Copied'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy not allowed. Select the text instead.', true); } ta.remove(); }
  };
  ACT['quote-cancel'] = function (el) {
    modal('<h2>Cancel this quote?</h2><p>The customer link will stop working. The enquiry stays open.</p><div class="btns"><button class="btn" data-act="close">Keep it</button><button class="btn danger" data-act="quote-cancel-go" data-id="' + el.dataset.id + '">Cancel quote</button></div>');
  };
  ACT['quote-cancel-go'] = function (el) { api('POST', '/api/quotes/' + el.dataset.id + '/cancel', {}).then(function () { closeModal(); toast('Quote cancelled'); route(); }, function (e) { toast(e.message, true); }); };
  ACT['quote-confirm'] = function (el) {
    var q = CURQ;
    modal('<form data-form="confirm-trip" data-id="' + el.dataset.id + '" novalidate><h2>Confirm trip for ' + esc(q.customer_name) + '</h2>' +
      '<p class="muted">This books the trip, blocks ' + esc(q.vehicle_label || 'no vehicle') + ' on the calendar and records the advance.</p><div class="fgrid c2">' +
      '<div class="f"><label for="cAdv">Advance received (₹)</label><input id="cAdv" name="advance" type="number" min="0" value="' + q.advance + '"></div>' +
      '<div class="f"><label for="cOn">Received on</label><input id="cOn" name="paid_on" type="date" value="' + B.today + '"></div>' +
      '<div class="f"><label for="cM">Method</label><select id="cM" name="method">' + opts(B.options.methods, 'UPI') + '</select></div>' +
      '<div class="f"><label for="cRef">Reference (UTR, cheque no.)</label><input id="cRef" name="reference"></div></div>' +
      '<p class="err" id="mErr"></p><div class="btns"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn ok" type="submit">Confirm trip</button></div></form>');
  };
  FORMS['confirm-trip'] = function (f) {
    var b = formData(f); b.advance = b.advance || 0;
    submitWith(f, api('POST', '/api/quotes/' + f.dataset.id + '/confirm', b), $('mErr')).then(function (t) { closeModal(); toast(t.number + ' confirmed'); location.hash = '#/trip/' + t.id; }, function () {});
  };

  function viewQuotes() {
    return api('GET', '/api/quotes').then(function (rows) {
      render('<div class="head"><div><h1>Quotes</h1><p class="lead">Every quotation you have sent, newest first.</p></div><div class="btns"><a class="btn pri" href="#/quote/new">New quote</a></div></div>' +
        '<div class="card tw"><table><thead><tr><th>Quote</th><th>Customer</th><th>Trip</th><th>Starts</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (q) {
          return '<tr class="link" data-href="#/quote/' + q.id + '"><td><b>' + esc(q.number) + '</b><span class="sub">' + fmt(q.created_at.slice(0, 10)) + '</span></td><td>' + esc(q.customer_name) + '<span class="sub">' + esc(q.phone) + '</span></td>' +
            '<td>' + esc(q.package_name) + '<span class="sub">' + q.pax + ' pax</span></td><td>' + fmt(q.start_date) + '</td><td class="num">' + money(q.total) + '</td><td>' + pill(q.status === 'Sent' && q.valid_until < B.today ? 'Expired' : q.status) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" class="empty">No quotes yet.</td></tr>') + '</tbody></table></div>');
    });
  }

  /* ---------------- TRIPS ---------------- */
  var TF = 'Upcoming';
  function viewTrips() {
    return api('GET', '/api/trips?filter=' + encodeURIComponent(TF)).then(function (r) {
      render('<h1>Trips</h1><p class="lead">Confirmed bookings, with hotel confirmations, vehicle, driver and payment status.</p>' +
        '<div class="chips">' + ['Upcoming', 'On trip', 'Completed', 'Cancelled', 'All'].map(function (g) { return '<button class="chip' + (TF === g ? ' on' : '') + '" data-act="trip-filter" data-s="' + g + '">' + g + ' · ' + (r.counts[g] || 0) + '</button>'; }).join('') + '</div>' +
        '<div class="card tw"><table><thead><tr><th>Trip</th><th>Customer</th><th>Dates</th><th>Vehicle</th><th>Hotels</th><th class="num">Value</th><th class="num">Balance</th></tr></thead><tbody>' +
        (r.rows.length ? r.rows.map(function (t) {
          return '<tr class="link" data-href="#/trip/' + t.id + '"><td><b>' + esc(t.number) + '</b> ' + pill(t.state) + '</td><td>' + esc(t.customer_name) + '<span class="sub">' + esc(t.package_name) + ' · ' + t.pax + ' pax</span></td>' +
            '<td>' + fmt(t.start_date) + ' → ' + fmt(t.end_date) + '<span class="sub">' + rel(t.start_date) + '</span></td><td>' + esc(t.vehicle_label || '—') + (t.vehicle && t.vehicle.driver_name ? '<span class="sub">' + esc(t.vehicle.driver_name) + '</span>' : '') + '</td>' +
            '<td>' + (t.state === 'Cancelled' ? '—' : t.hotels_confirmed ? '<span class="pill p-green">Confirmed</span>' : '<span class="pill p-red">Pending</span>') + '</td>' +
            '<td class="num">' + money(t.total) + '</td><td class="num ' + (t.balance > 0 ? 'red b' : 'green') + '">' + money(t.balance) + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="empty">No trips here.</td></tr>') + '</tbody></table></div>');
    });
  }
  ACT['trip-filter'] = function (el) { TF = el.dataset.s; route(); };

  var CURT = null;
  function viewTrip(id) {
    return api('GET', '/api/trips/' + id).then(function (t) {
      CURT = t;
      var live = t.state !== 'Cancelled';
      var own = B.vehicles.filter(function (v) { return v.active || v.id === t.vehicle_id; });
      render('<div class="head"><div><p class="lead" style="margin:0"><a href="#/trips">Trips</a> · <a href="#/quote/' + t.quote.id + '">' + esc(t.quote.number) + '</a></p>' +
        '<h1>' + esc(t.number) + ' · ' + esc(t.customer_name) + ' ' + pill(t.state) + '</h1><p class="lead">' + esc(t.package_name) + ' · ' + t.pax + ' pax · ' + t.rooms + ' rooms · ' + esc(t.category) + ' · ' + fmtL(t.start_date) + ' to ' + fmtL(t.end_date) + ' (' + rel(t.start_date) + ')</p></div>' +
        '<div class="btns">' + (t.phone ? '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/' + waNumber(t.phone) + '">WhatsApp customer</a>' : '') +
        '<a class="btn" target="_blank" rel="noopener" href="/q/' + attr(t.quote.public_token) + '">Quotation</a>' +
        (live && isOwner() ? '<button class="btn danger" data-act="trip-cancel">Cancel trip</button>' : '') + '</div></div>' +
        '<div class="kpis k4"><div class="kpi"><b>' + money(t.total) + '</b><span>Trip value</span></div><div class="kpi"><b>' + money(t.received) + '</b><span>Received</span></div>' +
        '<div class="kpi' + (t.balance > 0 ? ' warn' : '') + '"><b>' + money(t.balance) + '</b><span>Balance from customer</span></div>' +
        '<div class="kpi"><b>' + money(t.supplier_due) + '</b><span>Still to pay hotels, driver &amp; fees</span></div></div>' +
        '<div class="grid2"><div class="stack">' +
          '<div class="card"><h2>Operations</h2>' +
            (live ? '<label class="check"><input type="checkbox" data-change="trip-hotels"' + (t.hotels_confirmed ? ' checked' : '') + '> All hotels confirmed</label>' : '') +
            '<div class="f" style="margin-top:12px"><label for="tVeh">Vehicle</label><select id="tVeh" data-change="trip-veh"' + (live ? '' : ' disabled') + '>' +
              own.map(function (v) { return '<option value="' + v.id + '"' + (v.id === t.vehicle_id ? ' selected' : '') + '>' + esc(v.type) + ' · ' + esc(v.reg) + ' (' + v.seats + ' seats) · ' + esc(v.driver_name || 'no driver') + '</option>'; }).join('') +
              '<option value="hired"' + (!t.vehicle_id ? ' selected' : '') + '>' + esc(!t.vehicle_id && t.vehicle_label ? t.vehicle_label : 'Hired from outside') + '</option></select>' +
              (t.vehicle && t.vehicle.driver_phone ? '<p class="hint">Driver: ' + esc(t.vehicle.driver_name) + ' · <a href="tel:' + attr(t.vehicle.driver_phone.replace(/\s/g, '')) + '">' + esc(t.vehicle.driver_phone) + '</a></p>' : '') + '</div>' +
            '<form data-form="trip-notes" style="margin-top:12px" novalidate><div class="f"><label for="tNotes">Notes</label><textarea id="tNotes" name="notes">' + esc(t.notes) + '</textarea></div>' +
            (live ? '<div class="btns" style="margin-top:8px"><button class="btn sm" type="submit">Save notes</button></div>' : '') + '</form></div>' +
          '<div class="card tw"><h2>Day by day</h2><table><thead><tr><th>Day</th><th>Plan</th><th>Stay</th></tr></thead><tbody>' +
            t.days.map(function (d, i) { return '<tr><td>' + (i + 1) + '<span class="sub">' + fmtL(addD(t.start_date, i)) + '</span></td><td>' + esc(d.plan) + '</td><td>' + (d.hotel ? esc(d.hotel) + '<span class="sub">' + esc(d.city) + '</span>' : '—') + '</td></tr>'; }).join('') +
          '</tbody></table></div></div>' +
        '<div class="stack"><div class="card"><div class="head" style="align-items:center"><h2 style="margin:0">Payments</h2>' +
          (live ? '<div class="btns"><button class="btn sm" data-act="pay-add" data-dir="in">+ Received</button><button class="btn sm" data-act="pay-add" data-dir="out">+ Paid out</button></div>' : '') + '</div>' +
          '<div class="tw"><table><thead><tr><th>Date</th><th>Details</th><th class="num">Amount</th>' + (isOwner() ? '<th></th>' : '') + '</tr></thead><tbody>' +
          (t.payments.length ? t.payments.map(function (p) {
            return '<tr><td>' + fmt(p.paid_on) + '</td><td>' + (p.direction === 'in' ? 'From ' : 'To ') + esc(p.party || (p.direction === 'in' ? 'customer' : 'supplier')) +
              '<span class="sub">' + esc(p.method) + (p.reference ? ' · ' + esc(p.reference) : '') + (p.by_name ? ' · by ' + esc(p.by_name) : '') + '</span></td>' +
              '<td class="num ' + (p.direction === 'in' ? 'green' : '') + '">' + (p.direction === 'in' ? '+' : '−') + money(p.amount) + '</td>' +
              (isOwner() ? '<td><button class="x" aria-label="Delete payment" title="Delete payment" data-act="pay-del" data-id="' + p.id + '">×</button></td>' : '') + '</tr>';
          }).join('') : '<tr><td colspan="4" class="empty">No payments yet.</td></tr>') + '</tbody></table></div>' +
          (isOwner() && t.profit !== undefined ? '<p class="hint">Your margin on this trip: <b class="green">' + money(t.profit) + '</b> (after GST ' + money(t.gst_amount) + ' and costs ' + money(t.cost) + ').</p>' : '') +
        '</div></div></div>');
    });
  }
  ACT['trip-hotels'] = function (el) {
    api('PUT', '/api/trips/' + CURT.id, { hotels_confirmed: el.checked }).then(function () { toast(el.checked ? 'Hotels marked confirmed' : 'Hotels marked pending'); }, function (e) { el.checked = !el.checked; toast(e.message, true); });
  };
  ACT['trip-veh'] = function (el) {
    var body = el.value === 'hired' ? { vehicle_id: null, vehicle_label: 'Hired vehicle' } : { vehicle_id: int(el.value) };
    api('PUT', '/api/trips/' + CURT.id, body).then(function (t) { toast('Vehicle changed to ' + t.vehicle_label); route(); }, function (e) { toast(e.message, true); route(); });
  };
  FORMS['trip-notes'] = function (f) { submitWith(f, api('PUT', '/api/trips/' + CURT.id, { notes: f.notes.value })).then(function () { toast('Notes saved'); }, function () {}); };
  ACT['pay-add'] = function (el) {
    var dir = el.dataset.dir, t = CURT;
    modal('<form data-form="pay" data-dir="' + dir + '" novalidate><h2>' + (dir === 'in' ? 'Payment received from customer' : 'Payment to hotel, driver or supplier') + '</h2><div class="fgrid c2">' +
      '<div class="f"><label for="pAmt">Amount (₹)</label><input id="pAmt" name="amount" type="number" min="1" required value="' + (dir === 'in' && t.balance > 0 ? t.balance : '') + '"></div>' +
      '<div class="f"><label for="pOn">Date</label><input id="pOn" name="paid_on" type="date" value="' + B.today + '"></div>' +
      '<div class="f"><label for="pM">Method</label><select id="pM" name="method">' + opts(B.options.methods, 'UPI') + '</select></div>' +
      '<div class="f"><label for="pRef">Reference</label><input id="pRef" name="reference" placeholder="UTR, cheque no."></div>' +
      '<div class="f wide"><label for="pParty">' + (dir === 'in' ? 'Received from' : 'Paid to') + '</label><input id="pParty" name="party" list="partyList" value="' + attr(dir === 'in' ? t.customer_name : '') + '">' +
      '<datalist id="partyList">' + (dir === 'out' ? t.days.filter(function (d) { return d.hotel; }).map(function (d) { return '<option value="' + attr(d.hotel) + '">'; }).join('') + (t.vehicle && t.vehicle.driver_name ? '<option value="' + attr(t.vehicle.driver_name) + '">' : '') : '') + '</datalist></div></div>' +
      '<p class="err" id="mErr"></p><div class="btns"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn pri" type="submit">Record payment</button></div></form>');
  };
  FORMS.pay = function (f) {
    var b = formData(f); b.direction = f.dataset.dir;
    submitWith(f, api('POST', '/api/trips/' + CURT.id + '/payments', b), $('mErr')).then(function () { closeModal(); toast(money(b.amount) + ' recorded'); route(); }, function () {});
  };
  ACT['pay-del'] = function (el) {
    modal('<h2>Delete this payment?</h2><p>Only do this if it was entered by mistake. The deletion is kept in the activity log.</p><div class="btns"><button class="btn" data-act="close">Keep it</button><button class="btn danger" data-act="pay-del-go" data-id="' + el.dataset.id + '">Delete payment</button></div>');
  };
  ACT['pay-del-go'] = function (el) { api('DELETE', '/api/payments/' + el.dataset.id).then(function () { closeModal(); toast('Payment deleted'); route(); }, function (e) { toast(e.message, true); }); };
  ACT['trip-cancel'] = function () {
    modal('<form data-form="trip-cancel" novalidate><h2>Cancel ' + esc(CURT.number) + '?</h2><p class="muted">The vehicle is freed on the calendar. Payments stay on record so you can refund or keep the cancellation charge.</p>' +
      '<div class="f"><label for="cR">Reason</label><input id="cR" name="reason" placeholder="e.g. Customer cancelled, flight changed"></div>' +
      '<p class="err" id="mErr"></p><div class="btns"><button type="button" class="btn" data-act="close">Keep trip</button><button class="btn danger" type="submit">Cancel trip</button></div></form>');
  };
  FORMS['trip-cancel'] = function (f) { submitWith(f, api('POST', '/api/trips/' + CURT.id + '/cancel', formData(f)), $('mErr')).then(function () { closeModal(); toast('Trip cancelled'); route(); }, function () {}); };

  /* ---------------- FLEET ---------------- */
  var FFROM = null;
  function viewFleet() {
    var from = FFROM || B.today;
    return api('GET', '/api/fleet?from=' + from + '&days=14').then(function (r) {
      var days = []; for (var i = 0; i < r.days; i++) days.push(addD(r.from, i));
      var head = '<tr><th>Vehicle</th><th>Driver</th>' + days.map(function (d) { var x = dt(d); return '<th class="c' + (d === B.today ? ' today' : '') + '" style="text-align:center">' + DAY[x.getUTCDay()].slice(0, 2) + '<br>' + x.getUTCDate() + '</th>'; }).join('') + '<th class="num">Busy</th></tr>';
      var body = r.vehicles.map(function (v) {
        var busy = 0;
        var cells = days.map(function (d) {
          var t = r.trips.find(function (x) { return x.vehicle_id === v.id && d >= x.start_date && d <= x.end_date; });
          if (t) { busy++; return '<td class="c"><span class="busy' + (B.today >= t.start_date && B.today <= t.end_date ? ' on' : '') + '" title="' + attr(t.customer_name + ' · ' + t.number) + '" data-href="#/trip/' + t.id + '">' + esc(t.customer_name.split(' ')[0]) + '</span></td>'; }
          return '<td class="c"><span class="free">free</span></td>';
        }).join('');
        return '<tr><td><b>' + esc(v.type) + '</b><span class="sub">' + esc(v.reg) + ' · ' + v.seats + ' seats</span></td><td>' + esc(v.driver_name || '—') + (v.driver_phone ? '<span class="sub">' + esc(v.driver_phone) + '</span>' : '') + '</td>' + cells + '<td class="num">' + Math.round(busy / r.days * 100) + '%</td></tr>';
      }).join('');
      render('<div class="head"><div><h1>Vehicles &amp; drivers</h1><p class="lead">Who is driving what, day by day. Double bookings are blocked when you confirm a trip.</p></div>' +
        '<div class="btns"><button class="btn" data-act="fleet-move" data-n="-14">← Earlier</button><button class="btn" data-act="fleet-move" data-n="0">Today</button><button class="btn" data-act="fleet-move" data-n="14">Later →</button></div></div>' +
        '<div class="card tw"><table class="fleet">' + head + (body || '<tr><td colspan="17" class="empty">No vehicles yet. ' + (isOwner() ? '<a href="#/settings/vehicles">Add your vehicles</a>.' : 'Ask the owner to add them.') + '</td></tr>') + '</table></div>');
    });
  }
  ACT['fleet-move'] = function (el) { var n = int(el.dataset.n); FFROM = n === 0 ? null : addD(FFROM || B.today, n); route(); };

  /* ---------------- MONEY ---------------- */
  function viewMoney() {
    return api('GET', '/api/money').then(function (m) {
      var k = m.kpis;
      render('<h1>Payments</h1><p class="lead">What customers still owe you, what you owe hotels and drivers, and what each trip earned.</p>' +
        '<div class="kpis ' + (k.profit_month !== undefined ? 'k4' : 'k3') + '"><div class="kpi"><b>' + money(k.received_month) + '</b><span>Received this month</span></div>' +
        '<div class="kpi' + (k.to_collect > 0 ? ' warn' : '') + '"><b>' + money(k.to_collect) + '</b><span>Still to collect</span></div>' +
        '<div class="kpi"><b>' + money(k.supplier_due) + '</b><span>Due to hotels &amp; drivers</span></div>' +
        (k.profit_month !== undefined ? '<div class="kpi"><b>' + money(k.profit_month) + '</b><span>Margin on this month\'s trips</span></div>' : '') + '</div>' +
        '<div class="grid2"><div class="card"><h2>Customers yet to pay</h2>' + (m.to_collect.length ? m.to_collect.map(function (t) {
          return '<div class="row link" data-href="#/trip/' + t.id + '" tabindex="0"><div class="m"><b>' + esc(t.customer_name) + ' · ' + money(t.balance) + '</b><span>' + esc(t.number) + ' · trip ' + rel(t.start_date) + ' · paid ' + money(t.received) + ' of ' + money(t.total) + '</span></div>' + pill(t.state) + '</div>';
        }).join('') : '<div class="empty">Everyone has paid.</div>') + '</div>' +
        '<div class="card"><h2>You owe hotels &amp; drivers</h2>' + (m.supplier_due.length ? m.supplier_due.map(function (t) {
          return '<div class="row link" data-href="#/trip/' + t.id + '" tabindex="0"><div class="m"><b>' + esc(t.customer_name) + ' · ' + money(t.supplier_due) + '</b><span>' + esc(t.number) + ' · trip ' + rel(t.start_date) + ' · paid ' + money(t.paid_out) + ' of ' + money(t.cost) + '</span></div></div>';
        }).join('') : '<div class="empty">Nothing due to suppliers this week.</div>') + '</div></div>' +
        '<div class="card tw" style="margin-top:16px"><h2>Recent payments</h2><table><thead><tr><th>Date</th><th>Trip</th><th>Details</th><th class="num">Amount</th></tr></thead><tbody>' +
        (m.recent.length ? m.recent.map(function (p) { return '<tr class="link" data-href="#/trip/' + p.trip_id + '"><td>' + fmt(p.paid_on) + '</td><td>' + esc(p.number) + '<span class="sub">' + esc(p.customer_name) + '</span></td><td>' + (p.direction === 'in' ? 'From ' : 'To ') + esc(p.party) + '<span class="sub">' + esc(p.method) + (p.reference ? ' · ' + esc(p.reference) : '') + '</span></td><td class="num ' + (p.direction === 'in' ? 'green' : '') + '">' + (p.direction === 'in' ? '+' : '−') + money(p.amount) + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="empty">No payments yet.</td></tr>') + '</tbody></table></div>' +
        (m.profit ? '<div class="card tw" style="margin-top:16px"><h2>Profit by trip</h2><table><thead><tr><th>Trip</th><th>Customer</th><th>Starts</th><th class="num">Customer pays</th><th class="num">GST</th><th class="num">Hotels, car, fees</th><th class="num">You keep</th></tr></thead><tbody>' +
          (m.profit.length ? m.profit.map(function (t) { return '<tr class="link" data-href="#/trip/' + t.id + '"><td>' + esc(t.number) + '</td><td>' + esc(t.customer_name) + '</td><td>' + fmt(t.start_date) + '</td><td class="num">' + money(t.total) + '</td><td class="num">' + money(t.gst_amount) + '</td><td class="num">' + money(t.cost) + '</td><td class="num green b">' + money(t.profit) + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="empty">No trips yet.</td></tr>') + '</tbody></table></div>' : ''));
    });
  }

  /* ---------------- SETTINGS ---------------- */
  var STABS = [['agency', 'Agency', 1], ['hotels', 'Hotels', 1], ['vehicles', 'Vehicles', 1], ['packages', 'Packages', 1], ['users', 'Users', 1], ['data', 'Backup & log', 1], ['account', 'My account', 0]];
  function viewSettings(tab) {
    var tabs = STABS.filter(function (t) { return isOwner() || !t[2]; });
    tab = tabs.some(function (t) { return t[0] === tab; }) ? tab : tabs[0][0];
    var head = '<h1>Settings</h1><p class="lead">' + (isOwner() ? 'Your agency details, rates and team.' : 'Your account.') + '</p><div class="chips">' +
      tabs.map(function (t) { return '<a class="chip' + (t[0] === tab ? ' on' : '') + '" href="#/settings/' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</div>';
    return ({ agency: setAgency, hotels: setHotels, vehicles: setVehicles, packages: setPackages, users: setUsers, data: setData, account: setAccount })[tab](head);
  }
  function setAgency(head) {
    var a = B.agency;
    function fld(k, label, type, extra) { return '<div class="f' + (extra || '') + '"><label for="ag_' + k + '">' + label + '</label><input id="ag_' + k + '" name="' + k + '" type="' + (type || 'text') + '" value="' + attr(a[k]) + '"></div>'; }
    function area(k, label, hint) { return '<div class="f wide"><label for="ag_' + k + '">' + label + '</label><textarea id="ag_' + k + '" name="' + k + '" rows="4">' + esc(a[k]) + '</textarea>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>'; }
    render(head + '<form class="card" data-form="agency" novalidate><h2>Agency details</h2><p class="hint" style="margin:-6px 0 12px">These appear on every quotation.</p><div class="fgrid">' +
      fld('name', 'Agency name', 'text', ' wide') + fld('city', 'City') + fld('phone', 'Phone') + fld('email', 'Email', 'email') + fld('gstin', 'GSTIN') + fld('address', 'Address', 'text', ' wide') +
      '</div><h2 style="margin-top:20px">Defaults</h2><div class="fgrid">' +
      fld('markup_pct', 'Default markup %', 'number') + fld('gst_pct', 'GST %', 'number') + fld('advance_pct', 'Advance to confirm %', 'number') + fld('quote_valid_days', 'Quote valid for (days)', 'number') +
      fld('balance_due_days', 'Balance due before travel (days)', 'number') +
      '</div><h2 style="margin-top:20px">Quotation text</h2><div class="fgrid">' +
      area('included', 'Included', 'One item per line.') + area('excluded', 'Not included', 'One item per line.') + area('terms', 'Terms', 'One per line.') +
      '</div><p class="err" id="agErr"></p><div class="btns" style="margin-top:14px"><button class="btn pri" type="submit">Save</button></div></form>');
  }
  FORMS.agency = function (f) {
    submitWith(f, api('PUT', '/api/agency', formData(f)), $('agErr')).then(function () { return loadBoot(); }).then(function () { toast('Agency details saved'); route(); }, function () {});
  };

  function setHotels(head) {
    var by = {};
    B.hotels.forEach(function (h) { (by[h.city] = by[h.city] || []).push(h); });
    render(head + '<div class="head"><p class="muted" style="margin:0">Rates are per room per night. Changing a rate only affects new quotes.</p><button class="btn pri" data-act="hotel-edit">+ Add hotel</button></div>' +
      (Object.keys(by).length ? Object.keys(by).sort().map(function (c) {
        return '<div class="card tw" style="margin-top:14px"><h2>' + esc(c) + '</h2><table><thead><tr><th>Hotel</th><th>Category</th><th class="num">Rate / room / night</th><th>Phone</th><th></th></tr></thead><tbody>' +
          by[c].map(function (h) { return '<tr class="' + (h.active ? '' : 'muted') + '"><td><b>' + esc(h.name) + '</b>' + (h.active ? '' : ' <span class="pill p-grey">Hidden</span>') + '</td><td>' + esc(h.category) + '</td><td class="num">' + money(h.rate) + '</td><td>' + esc(h.phone) + '</td><td class="num"><button class="btn sm" data-act="hotel-edit" data-id="' + h.id + '">Edit</button></td></tr>'; }).join('') +
          '</tbody></table></div>';
      }).join('') : '<div class="card empty" style="margin-top:14px">No hotels yet. Add the hotels you book, one row per hotel and category.</div>'));
  }
  ACT['hotel-edit'] = function (el) {
    var h = el.dataset.id ? hotel(int(el.dataset.id)) : { city: '', category: 'Deluxe', name: '', rate: '', phone: '', active: 1 };
    modal('<form data-form="hotel" data-id="' + (h.id || '') + '" novalidate><h2>' + (h.id ? 'Edit hotel' : 'Add hotel') + '</h2><div class="fgrid c2">' +
      '<div class="f"><label for="hN">Hotel name</label><input id="hN" name="name" required value="' + attr(h.name) + '"></div>' +
      '<div class="f"><label for="hC">City</label><input id="hC" name="city" list="hCities" required value="' + attr(h.city) + '"><datalist id="hCities">' + cities().map(function (c) { return '<option value="' + attr(c) + '">'; }).join('') + '</datalist></div>' +
      '<div class="f"><label for="hCat">Category</label><select id="hCat" name="category">' + opts(B.options.categories, h.category) + '</select></div>' +
      '<div class="f"><label for="hR">Rate per room per night (₹)</label><input id="hR" name="rate" type="number" min="0" step="50" required value="' + attr(h.rate) + '"></div>' +
      '<div class="f"><label for="hP">Hotel phone</label><input id="hP" name="phone" value="' + attr(h.phone) + '"></div>' +
      '<div class="f" style="justify-content:flex-end"><label class="check"><input type="checkbox" name="active"' + (h.active ? ' checked' : '') + '> Use in new quotes</label></div></div>' +
      '<p class="err" id="mErr"></p><div class="btns"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn pri" type="submit">Save hotel</button></div></form>');
  };
  FORMS.hotel = function (f) { saveRef(f, 'hotels', 'Hotel saved'); };
  function saveRef(f, path, msg) {
    var id = f.dataset.id;
    submitWith(f, api(id ? 'PUT' : 'POST', '/api/' + path + (id ? '/' + id : ''), refBody(f)), $('mErr')).then(function () { closeModal(); return loadBoot(); }).then(function () { toast(msg); route(); }, function () {});
  }
  function refBody(f) { return formData(f); }

  function setVehicles(head) {
    render(head + '<div class="head"><p class="muted" style="margin:0">Your own vehicles. Hired vehicles can be added directly on a quote.</p><button class="btn pri" data-act="veh-edit">+ Add vehicle</button></div>' +
      '<div class="card tw" style="margin-top:14px"><table><thead><tr><th>Vehicle</th><th>Registration</th><th>Seats</th><th class="num">Rate / day</th><th>Driver</th><th></th></tr></thead><tbody>' +
      (B.vehicles.length ? B.vehicles.map(function (v) { return '<tr class="' + (v.active ? '' : 'muted') + '"><td><b>' + esc(v.type) + '</b>' + (v.active ? '' : ' <span class="pill p-grey">Hidden</span>') + '</td><td>' + esc(v.reg) + '</td><td>' + v.seats + '</td><td class="num">' + money(v.rate) + '</td><td>' + esc(v.driver_name) + '<span class="sub">' + esc(v.driver_phone) + '</span></td><td class="num"><button class="btn sm" data-act="veh-edit" data-id="' + v.id + '">Edit</button></td></tr>'; }).join('')
        : '<tr><td colspan="6" class="empty">No vehicles yet.</td></tr>') + '</tbody></table></div>');
  }
  ACT['veh-edit'] = function (el) {
    var v = el.dataset.id ? vehicle(int(el.dataset.id)) : { type: '', reg: '', seats: 6, rate: '', driver_name: '', driver_phone: '', active: 1 };
    modal('<form data-form="vehicle" data-id="' + (v.id || '') + '" novalidate><h2>' + (v.id ? 'Edit vehicle' : 'Add vehicle') + '</h2><div class="fgrid c2">' +
      '<div class="f"><label for="vT">Vehicle type</label><input id="vT" name="type" list="vTypes" required value="' + attr(v.type) + '"><datalist id="vTypes"><option value="Innova Crysta"><option value="Ertiga"><option value="Swift Dzire"><option value="Tempo Traveller"><option value="Scorpio"><option value="Bolero"></datalist></div>' +
      '<div class="f"><label for="vR">Registration number</label><input id="vR" name="reg" required value="' + attr(v.reg) + '"></div>' +
      '<div class="f"><label for="vS">Seats (passengers)</label><input id="vS" name="seats" type="number" min="1" max="60" required value="' + attr(v.seats) + '"></div>' +
      '<div class="f"><label for="vRate">Rate per day (₹)</label><input id="vRate" name="rate" type="number" min="0" step="100" required value="' + attr(v.rate) + '"></div>' +
      '<div class="f"><label for="vD">Driver name</label><input id="vD" name="driver_name" value="' + attr(v.driver_name) + '"></div>' +
      '<div class="f"><label for="vDP">Driver phone</label><input id="vDP" name="driver_phone" value="' + attr(v.driver_phone) + '"></div>' +
      '<div class="f wide"><label class="check"><input type="checkbox" name="active"' + (v.active ? ' checked' : '') + '> In service (shown on quotes and the calendar)</label></div></div>' +
      '<p class="err" id="mErr"></p><div class="btns"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn pri" type="submit">Save vehicle</button></div></form>');
  };
  FORMS.vehicle = function (f) { saveRef(f, 'vehicles', 'Vehicle saved'); };

  function setPackages(head) {
    render(head + '<div class="head"><p class="muted" style="margin:0">Your standard itineraries. Each day has a plan and the city for that night.</p><button class="btn pri" data-act="pkg-edit">+ Add package</button></div>' +
      '<div class="card" style="margin-top:14px">' + (B.packages.length ? B.packages.map(function (p) {
        return '<div class="row"><div class="m"><b>' + esc(p.name) + (p.active ? '' : ' <span class="pill p-grey">Hidden</span>') + '</b><span>' + p.days.length + ' days · ' +
          esc(p.days.map(function (d) { return d.city; }).filter(Boolean).filter(function (c, i, a) { return a.indexOf(c) === i; }).join(' → ') || 'no overnight stops') + ' · fees ' + money(p.extras_pp) + ' per person</span></div>' +
          '<button class="btn sm" data-act="pkg-edit" data-id="' + p.id + '">Edit</button></div>';
      }).join('') : '<div class="empty">No packages yet.</div>') + '</div>');
  }
  var PK = null;
  ACT['pkg-edit'] = function (el) {
    var p = el.dataset.id ? B.packages.find(function (x) { return x.id === int(el.dataset.id); }) : { name: '', extras_pp: 0, active: 1, days: [{ plan: '', city: '' }, { plan: '', city: '' }] };
    PK = { id: p.id, days: p.days.map(function (d) { return { plan: d.plan, city: d.city }; }) };
    modal('<form data-form="package" novalidate><h2>' + (p.id ? 'Edit package' : 'Add package') + '</h2><div class="fgrid c2">' +
      '<div class="f wide"><label for="pkN">Package name</label><input id="pkN" name="name" required placeholder="e.g. Shillong – Cherrapunji – Dawki (4D/3N)" value="' + attr(p.name) + '"></div>' +
      '<div class="f"><label for="pkE">Entry fees &amp; activities per person (₹)</label><input id="pkE" name="extras_pp" type="number" min="0" step="100" value="' + attr(p.extras_pp) + '"></div>' +
      '<div class="f" style="justify-content:flex-end"><label class="check"><input type="checkbox" name="active"' + (p.active ? ' checked' : '') + '> Show in new quotes</label></div></div>' +
      '<h3 style="margin-top:16px">Days</h3><p class="hint" style="margin-top:0">Leave the city empty on the last day if there is no overnight stay.</p><div class="days pkgdays" id="pkDays"></div>' +
      '<div class="btns" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn sm" data-act="pk-add">+ Add a day</button></div>' +
      '<datalist id="pkCities">' + cities().map(function (c) { return '<option value="' + attr(c) + '">'; }).join('') + '</datalist>' +
      '<p class="err" id="mErr"></p><div class="btns"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn pri" type="submit">Save package</button></div></form>', true);
    renderPkDays();
  };
  function renderPkDays() {
    $('pkDays').innerHTML = PK.days.map(function (d, i) {
      return '<div class="d"><span class="n">D' + (i + 1) + '</span><input class="dt" aria-label="Day ' + (i + 1) + ' plan" placeholder="e.g. Guwahati → Shillong, Umiam Lake" data-input="pk-day" data-i="' + i + '" data-k="plan" value="' + attr(d.plan) + '">' +
        '<input class="dc" aria-label="Day ' + (i + 1) + ' overnight city" list="pkCities" placeholder="Night in (city)" data-input="pk-day" data-i="' + i + '" data-k="city" value="' + attr(d.city) + '">' +
        (PK.days.length > 1 ? '<button type="button" class="x" aria-label="Remove day ' + (i + 1) + '" data-act="pk-del" data-i="' + i + '">×</button>' : '<span></span>') + '</div>';
    }).join('');
  }
  ACT['pk-day'] = function (el) { PK.days[el.dataset.i][el.dataset.k] = el.value; };
  ACT['pk-add'] = function () { PK.days.push({ plan: '', city: '' }); renderPkDays(); var ins = $('pkDays').querySelectorAll('.dt'); ins[ins.length - 1].focus(); };
  ACT['pk-del'] = function (el) { PK.days.splice(int(el.dataset.i), 1); renderPkDays(); };
  FORMS.package = function (f) {
    var b = formData(f);
    b.days = PK.days.map(function (d, i) { return { plan: d.plan.trim() || 'Day ' + (i + 1), city: d.city.trim() }; });
    submitWith(f, api(PK.id ? 'PUT' : 'POST', '/api/packages' + (PK.id ? '/' + PK.id : ''), b), $('mErr')).then(function () { closeModal(); return loadBoot(); }).then(function () { toast('Package saved'); route(); }, function () {});
  };

  function setUsers(head) {
    return api('GET', '/api/users').then(function (users) {
      render(head + '<div class="head"><p class="muted" style="margin:0">Staff can manage enquiries, quotes, trips and payments. Only owners can change settings, cancel trips, delete payments and see profit.</p><button class="btn pri" data-act="user-edit">+ Add user</button></div>' +
        '<div class="card tw" style="margin-top:14px"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
        users.map(function (u) { return '<tr><td><b>' + esc(u.name) + '</b>' + (u.id === B.user.id ? ' <span class="pill p-blue">You</span>' : '') + '</td><td>' + esc(u.email) + '</td><td>' + (u.role === 'owner' ? 'Owner' : 'Staff') + '</td><td>' + (u.active ? '<span class="pill p-green">Active</span>' : '<span class="pill p-grey">Removed</span>') + '</td>' +
          '<td class="num"><button class="btn sm" data-act="user-edit" data-id="' + u.id + '" data-name="' + attr(u.name) + '" data-role="' + u.role + '" data-active="' + u.active + '" data-email="' + attr(u.email) + '">Edit</button></td></tr>'; }).join('') +
        '</tbody></table></div>');
    });
  }
  ACT['user-edit'] = function (el) {
    var d = el.dataset, isNew = !d.id;
    modal('<form data-form="user" data-id="' + (d.id || '') + '" novalidate><h2>' + (isNew ? 'Add user' : 'Edit ' + esc(d.name)) + '</h2><div class="fgrid c2">' +
      '<div class="f"><label for="uN">Name</label><input id="uN" name="name" required value="' + attr(d.name || '') + '"></div>' +
      (isNew ? '<div class="f"><label for="uE">Email</label><input id="uE" name="email" type="email" required></div>' : '<div class="f"><label>Email</label><input value="' + attr(d.email) + '" disabled></div>') +
      '<div class="f"><label for="uR">Role</label><select id="uR" name="role">' + opts([{ value: 'staff', label: 'Staff' }, { value: 'owner', label: 'Owner' }], d.role || 'staff') + '</select></div>' +
      '<div class="f"><label for="uP">' + (isNew ? 'Password' : 'New password (leave empty to keep)') + '</label><input id="uP" name="password" type="password" autocomplete="new-password" minlength="8"></div>' +
      (isNew ? '' : '<div class="f wide"><label class="check"><input type="checkbox" name="active"' + (d.active === '1' ? ' checked' : '') + '> Can sign in</label></div>') + '</div>' +
      '<p class="hint">Share the password with them in person or on WhatsApp. Changing it signs them out everywhere.</p>' +
      '<p class="err" id="mErr"></p><div class="btns"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn pri" type="submit">Save</button></div></form>');
  };
  FORMS.user = function (f) {
    var b = formData(f), id = f.dataset.id;
    if (id && !b.password) delete b.password;
    submitWith(f, api(id ? 'PUT' : 'POST', '/api/users' + (id ? '/' + id : ''), b), $('mErr')).then(function () { closeModal(); toast('User saved'); route(); }, function () {});
  };

  function setData(head) {
    return api('GET', '/api/audit').then(function (log) {
      render(head + '<div class="grid2"><div class="card"><h2>Backups</h2><p class="muted">Tour Desk makes a backup every day on the server and keeps the last 14. You can also download a copy any time.</p>' +
        '<div class="btns"><a class="btn pri" href="/api/backup" download>Download full backup</a><a class="btn" href="/api/export" download>Download data as JSON</a></div>' +
        '<p class="hint">Keep a copy on your own computer or Google Drive every week.</p></div>' +
        '<div class="card"><h2>Quotation link preview</h2><p class="muted">Customers see your agency name, GSTIN, the day-by-day plan, hotels and the total. They never see your costs or margin.</p></div></div>' +
        '<div class="card tw" style="margin-top:16px"><h2>Activity log</h2><table><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>' +
        log.map(function (a) { return '<tr><td>' + esc(a.at.replace('T', ' ').slice(0, 16)) + ' UTC</td><td>' + esc(a.user_name || '—') + '</td><td>' + esc(a.action + ' ' + a.entity + (a.entity_id ? ' #' + a.entity_id : '') + (a.detail ? ': ' + a.detail : '')) + '</td></tr>'; }).join('') +
        '</tbody></table></div>');
    });
  }

  function setAccount(head) {
    render(head + '<div class="grid2"><form class="card" data-form="password" novalidate><h2>Change password</h2>' +
      '<div class="f"><label for="pw0">Current password</label><input id="pw0" name="current" type="password" autocomplete="current-password" required></div>' +
      '<div class="f" style="margin-top:10px"><label for="pw1">New password</label><input id="pw1" name="password" type="password" autocomplete="new-password" minlength="8" required></div>' +
      '<p class="err" id="pwErr"></p><div class="btns" style="margin-top:12px"><button class="btn pri" type="submit">Change password</button></div></form>' +
      '<div class="card"><h2>' + esc(B.user.name) + '</h2><p class="muted">' + esc(B.user.email) + ' · ' + (isOwner() ? 'Owner' : 'Staff') + '</p><button class="btn" data-act="logout">Sign out</button></div></div>');
  }
  FORMS.password = function (f) { submitWith(f, api('POST', '/api/me/password', formData(f)), $('pwErr')).then(function () { f.reset(); toast('Password changed'); }, function () {}); };

  /* ---------------- go ---------------- */
  api('GET', '/api/session').then(function (s) { if (s.user) start(); else showAuth(); }, function (e) { $('boot').textContent = e.message; });
})();
