<?php
defined('APP') or exit;

function page_dashboard() {
    $u = current_user();
    $vcount = (int)val('SELECT COUNT(*) FROM vehicles WHERE archived = 0');
    $hour = (int)date('G', strtotime(now()));
    $h = page_head(($hour < 12 ? 'Good morning' : ($hour < 17 ? 'Good afternoon' : 'Good evening')) . ', ' . explode(' ', $u['name'])[0], e(date('l, d F Y', strtotime(now()))),
        (can('bookings') ? btn('New booking', url('booking_new'), 'primary') : '') . (can('fleet_edit') ? btn('Add vehicle', url('vehicle_new')) : ''));
    if (!$vcount) {
        $h .= '<div class="card hero-empty"><h2>Welcome. Let\'s set up your fleet.</h2><ol class="steps"><li>' . (is_owner() ? '<a href="' . e(url('settings')) . '">Check business details</a> (name, phone, address for receipts)' : 'Ask the owner to finish setup') . '</li><li>' . (can('fleet_edit') ? '<a href="' . e(url('vehicle_new')) . '">Add your vehicles</a>' : 'Vehicles') . ', then their insurance, PUC and RC</li><li>Add customers and bookings as they come in</li>' . (is_owner() ? '<li><a href="' . e(url('settings', ['tab' => 'team'])) . '">Add staff accounts</a> and the <a href="' . e(url('settings', ['tab' => 'integrations'])) . '">cron job</a></li>' : '') . '</ol><p class="muted small">All numbers on this dashboard come from what you enter. Nothing is made up.</p></div>';
        render_page('Dashboard', $h, 'dashboard'); return;
    }
    $map = can('fleet') ? fleet_status_map() : [];
    $vehicles = []; foreach (rows('SELECT id, archived FROM vehicles') as $v) if (!$v['archived']) $vehicles[$v['id']] = true;
    $cnt = array_count_values(array_map(fn($m) => $m['status'], array_intersect_key($map, $vehicles)));
    if (can('fleet')) $h .= '<div class="stats">' . tile('Available now', ($cnt['available'] ?? 0) . '<small>/' . $vcount . '</small>', url('fleet', ['status' => 'available']), 'good')
        . tile('Out on rent', $cnt['rented'] ?? 0, url('rentals'), '') . tile('Overdue returns', $cnt['overdue'] ?? 0, url('rentals'), ($cnt['overdue'] ?? 0) ? 'bad' : '')
        . tile('Booked (next 24h)', $cnt['booked'] ?? 0, url('fleet', ['status' => 'booked'])) . tile('Maintenance / off', ($cnt['maintenance'] ?? 0) + ($cnt['unavailable'] ?? 0), url('fleet', ['status' => 'maintenance']), ($cnt['maintenance'] ?? 0) ? 'warn' : '') . '</div>';

    if (can('payments')) {
        $t = today(); $m = substr($t, 0, 7) . '-01';
        $rent = fn($from) => (int)val("SELECT COALESCE(SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END),0) FROM payments WHERE voided = 0 AND kind IN ('rental','refund') AND paid_at >= ?", [$from . ' 00:00:00']);
        $open = bookings_where("b.status <> 'inquiry'");
        $owed = array_sum(array_map(fn($b) => max(0, $b['balance']), $open));
        $over = array_sum(array_map(fn($b) => $b['overdue_days'] ? $b['balance'] : 0, $open));
        $held = array_sum(array_column($open, 'deposit_held'));
        $h .= '<div class="stats">' . tile('Rent collected today', money($rent($t)), url('payments', ['range' => 'today']), 'good') . tile('This month', money($rent($m)), url('payments'))
            . tile('Customers owe you', money($owed), url('outstanding'), $owed ? 'warn' : '', $over ? money($over) . ' overdue' : 'nothing overdue') . tile('Deposits held', money($held), null, '', 'refundable, not income')
            . (can('expenses') ? tile('Expenses this month', money((int)val('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE voided = 0 AND expense_date >= ?', [$m])), url('expenses')) : '') . '</div>';
    }

    $h .= '<div class="grid2">';
    if (can('bookings')) {
        $dayEnd = today() . ' 23:59:59';
        $picks = bookings_where("b.status = 'confirmed' AND b.start_at <= ?", [$dayEnd], 'b.start_at ASC');
        $rets = bookings_where("b.status = 'active' AND b.end_at <= ?", [$dayEnd], 'b.end_at ASC');
        $li = fn($b, $when, $late = false) => '<li><a href="' . e(url('booking', ['id' => $b['id']])) . '"><b>' . e($b['reg_no'] ?: 'No vehicle yet') . '</b> · ' . e($b['customer_name']) . '<small class="' . ($late ? 'red' : '') . '">' . e($when) . '</small></a></li>';
        $h .= '<div class="card"><h3>Today</h3><h4>Pickups</h4>' . ($picks ? '<ul class="list">' . implode('', array_map(fn($b) => $li($b, (ts($b['start_at']) < ts(now()) ? 'was due ' : '') . fmt_dt($b['start_at']), ts($b['start_at']) < ts(now()) - 3600), $picks)) . '</ul>' : '<p class="muted">No pickups left today.</p>')
            . '<h4>Returns</h4>' . ($rets ? '<ul class="list">' . implode('', array_map(fn($b) => $li($b, ($b['view_status'] === 'overdue' ? 'overdue ' . human_duration(ts(now()) - ts($b['end_at'])) : 'due ' . date('g:i A', strtotime($b['end_at']))), $b['view_status'] === 'overdue'), $rets)) . '</ul>' : '<p class="muted">No returns due today.</p>') . '</div>';
    }
    $alerts = array_slice(visible_notifications(), 0, 8);
    $h .= '<div class="card"><div class="row between"><h3>Needs attention</h3><a href="' . e(url('alerts')) . '">All alerts</a></div>' . ($alerts ? '<ul class="alerts">' . implode('', array_map('alert_li', $alerts)) . '</ul>' : '<p class="muted">All clear. Nothing needs attention.</p>') . '</div>';
    $h .= '</div>';
    if (can('fleet') && can('bookings')) {
        $out = array_filter($map, fn($m) => $m['active']);
        if ($out) {
            $trs = [];
            foreach ($out as $vid => $m) { $a = $m['active']; $trs[] = tr(['<b>' . e($a['reg_no']) . '</b><small>' . e($a['vehicle_name']) . '</small>', e($a['customer_name']) . '<small>' . e($a['customer_phone']) . '</small>', e(fmt_dt($a['actual_start'])), e(fmt_dt($a['end_at'])), badge(VEHICLE_STATUS_LABEL[$m['status']], tone_for($m['status']))], url('booking', ['id' => $a['id']])); }
            $h .= '<h2>Who has which vehicle</h2><div class="card flush">' . table(['Vehicle', 'Customer', 'Since', 'Due back', 'Status'], $trs) . '</div>';
        }
    }
    render_page('Dashboard', $h, 'dashboard');
}

function alert_li($n) {
    return '<li class="sev-' . e($n['severity']) . '"><a href="' . e($n['link'] ?: url('alerts')) . '"><b>' . e($n['title']) . '</b><small>' . e($n['message']) . '</small></a></li>';
}

function page_alerts() {
    if (is_post()) {
        $n = row('SELECT * FROM notifications WHERE id = ? AND resolved_at IS NULL', [(int)post('id')]);
        if ($n && (!$n['perm'] || can($n['perm']))) {
            q('UPDATE notifications SET resolved_at = ?, resolved_by = ? WHERE id = ?', [now(), mb_substr(current_user()['name'], 0, 60), $n['id']]);
            audit('resolve', 'notification', $n['id'], $n['title']);
            flash('success', 'Marked as resolved.');
        }
        if (post('action') === 'check') { $c = run_checks(); flash('success', "Checked everything: $c open issue(s)."); }
        redirect('alerts', ['show' => get('show')]);
    }
    $show = get('show') === 'resolved' ? 'resolved' : 'open';
    $list = $show === 'open' ? visible_notifications(true) : array_values(array_filter(visible_notifications(false, 300), fn($n) => $n['resolved_at']));
    $h = page_head('Alerts', count(visible_notifications()) . ' open', form_open('check', 'class="inline"') . '<button class="btn ghost">Check now</button></form>');
    $h .= '<div class="chips"><a class="chip' . ($show === 'open' ? ' on' : '') . '" href="' . e(url('alerts')) . '">Open</a><a class="chip' . ($show === 'resolved' ? ' on' : '') . '" href="' . e(url('alerts', ['show' => 'resolved'])) . '">Resolved</a></div>';
    if (!$list) $h .= '<div class="card empty"><p class="muted">' . ($show === 'open' ? 'Nothing needs attention right now.' : 'No resolved alerts yet.') . '</p></div>';
    else {
        $h .= '<div class="card flush"><ul class="alerts big">';
        foreach ($list as $n) $h .= '<li class="sev-' . e($n['severity']) . '"><a href="' . e($n['link'] ?: '#') . '"><b>' . e($n['title']) . '</b><small>' . e($n['message']) . ' · ' . e(fmt_dt($n['created_at'])) . ($n['resolved_at'] ? ' · resolved ' . e(fmt_dt($n['resolved_at'])) . ' by ' . e($n['resolved_by'] === 'auto' ? 'the system (fixed)' : $n['resolved_by']) : '') . '</small></a>'
            . (!$n['resolved_at'] ? form_open('resolve', 'class="inline"') . '<input type="hidden" name="id" value="' . $n['id'] . '"><button class="btn ghost small">Resolve</button></form>' : '') . '</li>';
        $h .= '</ul></div>';
    }
    $h .= '<p class="muted small">Alerts clear themselves when the problem is fixed (for example, when a payment is received or a document is renewed). Each problem alerts only once. Email alerts can be switched on in Settings.</p>';
    render_page('Alerts', $h, 'alerts');
}
