<?php
defined('APP') or exit;

function mask($s) { $s = (string)$s; return $s === '' ? '—' : (can('customer_sensitive') ? $s : str_repeat('•', max(0, mb_strlen($s) - 4)) . mb_substr($s, -4)); }

function customer_from_post($existing = null) {
    $d = [];
    $d['name'] = mb_substr(post('name'), 0, 120);
    if ($d['name'] === '') throw new UserError('Enter the customer\'s name.');
    $d['phone'] = preg_replace('/[^\d+]/', '', post('phone'));
    if (!preg_match('/^\+?\d{10,13}$/', $d['phone'])) throw new UserError('Enter a valid phone number: 10 to 13 digits, with or without the country code (e.g. +44).');
    $d['alt_phone'] = preg_replace('/[^\d+]/', '', post('alt_phone')) ?: null;
    $d['email'] = post('email');
    if ($d['email'] !== '' && !filter_var($d['email'], FILTER_VALIDATE_EMAIL)) throw new UserError('Check the email address.');
    $d['address'] = mb_substr(post('address'), 0, 1000);
    $d['notes'] = mb_substr(post('notes'), 0, 2000);
    $d['flagged'] = post('flagged') === '1' ? 1 : 0;
    if (can('customer_sensitive') || !$existing) {
        $d['dl_number'] = strtoupper(mb_substr(post('dl_number'), 0, 40));
        $exp = parse_date(post('dl_expiry')); if ($exp === false) throw new UserError('Check the licence expiry date.'); $d['dl_expiry'] = $exp;
        $d['id_type'] = in_array(post('id_type'), id_types(), true) ? post('id_type') : null;
        $d['id_number'] = mb_substr(post('id_number'), 0, 40);
        $d['id_verified'] = post('id_verified') === '1' ? 1 : 0;
    }
    $dup = val('SELECT id FROM customers WHERE phone = ? AND id <> ? AND archived = 0', [$d['phone'], $existing['id'] ?? 0]);
    if ($dup) throw new UserError('A customer with this phone number already exists. Open that customer instead.');
    return $d;
}

function customer_form($c, $action) {
    $c = $c ?: []; $g = fn($k) => old($k, $c[$k] ?? '');
    $sens = can('customer_sensitive') || empty($c['id']);
    $h = form_open($action, 'class="card stack"', true) . '<div class="grid3">'
        . field('Full name *', inp('name', $g('name'), 'text', 'required')) . field('Phone *', inp('phone', $g('phone'), 'tel', 'required placeholder="10-digit mobile"'))
        . field('Other phone', inp('alt_phone', $g('alt_phone'), 'tel')) . field('Email', inp('email', $g('email'), 'email')) . '</div>'
        . field('Address', txt('address', $g('address')));
    if ($sens) $h .= '<h3>Licence and ID</h3><div class="grid3">' . field('Driving licence number', inp('dl_number', $g('dl_number'), 'text', 'autocapitalize="characters"'))
        . field('Licence valid until', inp('dl_expiry', $g('dl_expiry'), 'date')) . field('ID type', sel('id_type', id_types(), $g('id_type'), '', '—'))
        . field('ID number', inp('id_number', $g('id_number'))) . '</div><label class="check"><input type="checkbox" name="id_verified" value="1"' . ($g('id_verified') ? ' checked' : '') . '> I have checked the original licence and ID</label>'
        . field('Upload licence / ID photo or PDF', '<input type="file" name="id_file" accept="image/*,application/pdf">', 'Stored privately. Only people with ID access can open it.');
    else $h .= '<p class="muted small">Licence and ID details are hidden for your account.</p>';
    $h .= field('Notes', txt('notes', $g('notes'))) . '<label class="check"><input type="checkbox" name="flagged" value="1"' . ($g('flagged') ? ' checked' : '') . '> Flag this customer (problems in the past: be careful)</label>'
        . '<div class="row"><button class="btn primary">Save customer</button><a class="btn ghost" href="' . e(empty($c['id']) ? url('customers') : url('customer', ['id' => $c['id']])) . '">Cancel</a></div></form>';
    return $h;
}

function customer_summary() {
    $out = [];
    foreach (bookings_where("b.status <> 'cancelled'") as $b) {
        $id = $b['customer_id'];
        $out[$id] ??= ['rentals' => 0, 'balance' => 0, 'overdue_return' => false, 'overdue_pay' => false, 'last' => null];
        if (in_array($b['status'], ['active', 'completed'], true)) $out[$id]['rentals']++;
        $out[$id]['balance'] += max(0, $b['balance']);
        if ($b['view_status'] === 'overdue') $out[$id]['overdue_return'] = true;
        if ($b['pay_status'] === 'overdue') $out[$id]['overdue_pay'] = true;
        $out[$id]['last'] = max($out[$id]['last'] ?? '', $b['start_at']);
    }
    return $out;
}

function page_customers() {
    require_perm('customers');
    $sum = customer_summary(); $qs = get('q'); $f = get('f');
    $list = rows('SELECT * FROM customers WHERE archived = 0 ORDER BY name');
    $issues = array_flip(array_column(rows("SELECT DISTINCT customer_id FROM customer_notes WHERE kind IN ('complaint', 'issue')"), 'customer_id'));
    $list = array_filter($list, function ($c) use ($qs, $f, $sum, $issues) {
        $s = $sum[$c['id']] ?? ['rentals' => 0, 'balance' => 0, 'overdue_return' => false];
        if ($qs !== '' && stripos($c['name'] . ' ' . $c['phone'] . ' ' . $c['alt_phone'], $qs) === false) return false;
        return match ($f) { 'repeat' => $s['rentals'] >= 2, 'owes' => $s['balance'] > 0, 'overdue' => $s['overdue_return'], 'issues' => $c['flagged'] || isset($issues[$c['id']]), default => true };
    });
    $h = page_head('Customers', count($list) . ' shown', btn('Add customer', url('customer_new'), 'primary'));
    $h .= '<div class="chips">';
    $filters = ['' => 'All', 'repeat' => 'Repeat customers', 'overdue' => 'Overdue rentals', 'issues' => 'Past issues'];
    if (can('payments')) $filters = array_slice($filters, 0, 2, true) + ['owes' => 'Owe money'] + array_slice($filters, 2, null, true);
    foreach ($filters as $k => $l) $h .= '<a class="chip' . ($f === $k ? ' on' : '') . '" href="' . e(url('customers', ['f' => $k, 'q' => $qs])) . '">' . e($l) . '</a>';
    $h .= '</div><form class="filters" method="get"><input type="hidden" name="p" value="customers"><input type="hidden" name="f" value="' . e($f) . '"><input type="search" name="q" value="' . e($qs) . '" placeholder="Search name or phone"><button class="btn">Search</button></form>';
    $trs = [];
    foreach ($list as $c) {
        $s = $sum[$c['id']] ?? ['rentals' => 0, 'balance' => 0, 'overdue_return' => false, 'last' => null];
        $tags = ($c['flagged'] ? badge('Flagged', 'red') : '') . ($s['overdue_return'] ? badge('Vehicle overdue', 'red') : '') . ($s['rentals'] >= 2 ? badge('Repeat', 'blue') : '') . (!$c['id_verified'] ? badge('ID not checked', 'amber') : '');
        $trs[] = tr(['<b>' . e($c['name']) . '</b><small>' . e($c['phone']) . '</small>', $s['rentals'], can('payments') ? ($s['balance'] > 0 ? '<b class="red">' . money($s['balance']) . '</b>' : money(0)) : '—', $s['last'] ? e(fmt_d($s['last'])) : '—', $tags ?: '—'], url('customer', ['id' => $c['id']]));
    }
    $h .= '<div class="card flush">' . table(['Customer', 'Rentals', 'Owes', 'Last rental', ''], $trs, 'No customers yet.') . '</div>';
    render_page('Customers', $h, 'customers');
}

function page_customer_new() {
    require_perm('customers');
    if (is_post()) {
        $d = customer_from_post() + ['created_by' => current_user()['id'], 'created_at' => now(), 'updated_at' => now()];
        $id = insert('customers', $d);
        handle_upload('id_file', 'customer_id', $id);
        audit('create', 'customer', $id, ['name' => $d['name']]);
        flash('success', 'Customer added.');
        if (get('then') === 'booking') redirect('booking_new', ['customer_id' => $id, 'vehicle_id' => get('vehicle_id')]);
        redirect('customer', ['id' => $id]);
    }
    render_page('Add customer', page_head('Add customer') . customer_form(null, 'create'), 'customers');
}

function page_customer() {
    require_perm('customers');
    $id = (int)get('id');
    $c = row('SELECT * FROM customers WHERE id = ?', [$id]);
    if (!$c) throw new UserError('Customer not found.');
    if (is_post()) {
        $a = post('action');
        if ($a === 'update') {
            $d = customer_from_post($c);
            update('customers', $id, $d + ['updated_at' => now()]);
            if (can('customer_sensitive')) handle_upload('id_file', 'customer_id', $id);
            audit('update', 'customer', $id, array_keys(array_filter($d, fn($v, $k) => (string)$v !== (string)$c[$k], ARRAY_FILTER_USE_BOTH)));
            flash('success', 'Customer saved.');
        }
        if ($a === 'note') {
            $kind = in_array(post('kind'), ['note', 'complaint', 'issue'], true) ? post('kind') : 'note';
            if (post('body') === '') throw new UserError('Write the note first.');
            insert('customer_notes', ['customer_id' => $id, 'kind' => $kind, 'body' => mb_substr(post('body'), 0, 2000), 'created_by' => current_user()['id'], 'created_at' => now()]);
            audit('note', 'customer', $id, $kind);
            flash('success', 'Saved.');
        }
        redirect('customer', ['id' => $id]);
    }
    if (is_post() === false && get('tab') === 'edit') { render_page('Edit customer', page_head('Edit ' . $c['name']) . customer_form($c, 'update'), 'customers'); return; }

    $bk = bookings_where('b.customer_id = ?', [$id]);
    $owes = array_sum(array_map(fn($b) => max(0, $b['balance']), $bk));
    $paid = array_sum(array_column($bk, 'paid'));
    $trips = array_filter($bk, fn($b) => in_array($b['status'], ['active', 'completed'], true));
    $active = array_values(array_filter($bk, fn($b) => $b['status'] === 'active'));
    $cars = array_count_values(array_filter(array_map(fn($b) => $b['reg_no'] ? $b['reg_no'] . ' · ' . $b['vehicle_name'] : null, $trips)));
    $acts = (can('bookings') ? btn('New rental', url('booking_new', ['customer_id' => $id]), 'primary') : '') . btn('Edit', url('customer', ['id' => $id, 'tab' => 'edit']))
        . '<a class="btn ghost" href="tel:' . e($c['phone']) . '">Call</a><a class="btn ghost" target="_blank" rel="noopener" href="' . e(wa_link($c['phone'], 'Hello ' . $c['name'] . ', ')) . '">WhatsApp</a>';
    $h = page_head($c['name'], e($c['phone']) . ($c['flagged'] ? ' ' . badge('Flagged', 'red') : '') . ($c['id_verified'] ? ' ' . badge('ID checked', 'green') : ' ' . badge('ID not checked', 'amber')), $acts);
    foreach ($active as $a) $h .= '<div class="flash ' . ($a['view_status'] === 'overdue' ? 'error' : 'info') . '">Has <b>' . e($a['reg_no']) . '</b> now (rental <a href="' . e(url('booking', ['id' => $a['id']])) . '">' . e($a['code']) . '</a>), returns ' . e(fmt_dt($a['end_at'])) . ($a['view_status'] === 'overdue' ? ': overdue by ' . e(human_duration(ts(now()) - ts($a['end_at']))) : '') . '.</div>';
    $dmgCount = (int)val('SELECT COUNT(*) FROM damages WHERE customer_id = ?', [$id]);
    $h .= '<div class="stats">' . tile('Times rented', count($trips), null, '', count(array_filter($trips, fn($b) => $b['status'] === 'completed')) . ' completed')
        . (can('payments') ? tile('Total paid', money($paid), null, 'good') . tile('Remaining due', money($owes), url('money_due'), $owes > 0 ? 'bad' : '') : '') . tile('Damage records', $dmgCount, null, $dmgCount ? 'warn' : '') . '</div>';
    if ($cars) $h .= '<div class="card"><h3>Cars rented</h3><p>' . implode(' · ', array_map(fn($car, $n) => e($car) . ($n > 1 ? ' <span class="muted">×' . $n . '</span>' : ''), array_keys($cars), $cars)) . '</p></div>';
    $h .= '<div class="grid2"><div class="card"><h3>Details</h3><dl class="kv"><dt>Phone</dt><dd>' . e($c['phone']) . ($c['alt_phone'] ? ', ' . e($c['alt_phone']) : '') . '</dd><dt>Email</dt><dd>' . e($c['email'] ?: '—') . '</dd><dt>Address</dt><dd>' . nl2br(e($c['address'] ?: '—')) . '</dd>'
        . '<dt>Licence</dt><dd>' . e(mask($c['dl_number'])) . ($c['dl_expiry'] ? ' · valid till ' . e(fmt_d($c['dl_expiry'])) . ($c['dl_expiry'] < today() ? ' ' . badge('Expired', 'red') : '') : '') . '</dd>'
        . '<dt>ID</dt><dd>' . e($c['id_type'] ?: '') . ' ' . e(mask($c['id_number'])) . '</dd></dl>';
    if (can('customer_sensitive')) foreach (rows("SELECT * FROM files WHERE entity = 'customer_id' AND entity_id = ? AND deleted = 0", [$id]) as $f) $h .= '<p><a href="' . e(url('file', ['id' => $f['id']])) . '" target="_blank">' . e($f['orig_name']) . '</a></p>';
    $h .= ($c['notes'] ? '<p class="note">' . nl2br(e($c['notes'])) . '</p>' : '') . '</div>';
    $h .= '<div class="card"><h3>Notes and complaints</h3>' . form_open('note', 'class="stack"') . '<div class="row">' . sel('kind', ['note' => 'Note', 'complaint' => 'Complaint', 'issue' => 'Rental issue']) . '</div>' . txt('body', '', 'placeholder="e.g. Returned car with low fuel"') . '<button class="btn">Add</button></form><ul class="timeline">';
    foreach (rows('SELECT n.*, u.name AS by_name FROM customer_notes n LEFT JOIN users u ON u.id = n.created_by WHERE customer_id = ? ORDER BY n.id DESC', [$id]) as $n)
        $h .= '<li>' . badge(ucfirst($n['kind']), $n['kind'] === 'note' ? 'grey' : 'red') . ' ' . nl2br(e($n['body'])) . '<small>' . e(fmt_dt($n['created_at'])) . ' · ' . e($n['by_name']) . '</small></li>';
    $h .= '</ul></div></div>';
    $trs = [];
    foreach ($bk as $b) $trs[] = tr(['<b>' . e($b['code']) . '</b>', e($b['reg_no'] ?: '—'), e(fmt_d($b['start_at'])) . '<small>to ' . e(fmt_d($b['end_at'])) . '</small>', badge(BOOKING_STATUS_LABEL[$b['view_status']], tone_for($b['view_status'])),
        can('payments') ? money($b['total']) : '—', can('payments') ? money($b['paid']) : '—', can('payments') ? ($b['balance'] > 0 ? '<b class="red">' . money($b['balance']) . '</b>' : badge(PAY_STATUS_LABEL[$b['pay_status']], tone_for($b['pay_status']))) : '—'], url('booking', ['id' => $b['id']]));
    $h .= '<h2>Previous trips</h2><div class="card flush">' . table(['Rental', 'Car', 'Dates', 'Status', 'Total', 'Paid', 'Remaining'], $trs, 'No rentals yet.') . '</div>';
    require_once __DIR__ . '/damage.php';
    $h .= '<h2>Damage records</h2><div class="card">' . damage_list(damage_rows('d.customer_id = ?', [$id]), 'customer') . '</div>';
    if (can('payments')) {
        $trs = [];
        foreach (rows("SELECT p.*, b.code FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.customer_id = ? ORDER BY p.paid_at DESC, p.id DESC", [$id]) as $p)
            $trs[] = tr([e(fmt_dt($p['paid_at'])), e($p['code']), e(PAY_KIND_LABEL[$p['kind']]), ($p['voided'] ? '<s>' . money($p['amount']) . '</s> ' . badge('Voided', 'grey') : money($p['amount'])), e($p['method']), e($p['reference'] ?: '—'), '<a href="' . e(url('receipt', ['id' => $p['id']])) . '" target="_blank">' . e($p['receipt_no']) . '</a>']);
        $h .= '<h2>Payment history</h2><div class="card flush">' . table(['Date', 'Rental', 'Type', 'Amount', 'Method', 'Reference', 'Receipt'], $trs, 'No payments yet.') . '</div>';
    }
    render_page($c['name'], $h, 'customers');
}
