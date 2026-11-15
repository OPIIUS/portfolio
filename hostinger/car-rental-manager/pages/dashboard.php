<?php
defined('APP') or exit;

function page_dashboard() {
    $u = current_user();
    $vcount = (int)val('SELECT COUNT(*) FROM vehicles WHERE archived = 0');
    $h = page_head(setting('business_name'), e(date('l, d F Y', strtotime(now()))), (can('bookings') && $vcount ? btn('New rental', url('booking_new'), 'primary') : ''));
    if (!$vcount) {
        $target = (int)setting('vehicle_count', 0);
        $h .= '<div class="card hero-empty"><h2>Welcome, ' . e(explode(' ', $u['name'])[0]) . '. Three steps to start:</h2><ol class="steps">'
            . '<li>' . (can('fleet_edit') ? '<a href="' . e(url('vehicle_new')) . '">Add your cars</a>' : 'Cars are added by the owner') . ($target ? " (you said you have $target)" : '') . '</li>'
            . '<li>' . (can('customers') ? '<a href="' . e(url('customer_new')) . '">Add a customer</a>' : 'Add customers') . '</li><li>Create a rental when a customer takes a car</li></ol>'
            . '<p class="muted small">Everything on this screen is calculated from what you enter. Nothing is made up.</p></div>';
        render_page('Dashboard', $h, 'dashboard'); return;
    }
    $map = fleet_status_map();
    $live = array_intersect_key($map, array_column(rows('SELECT id FROM vehicles WHERE archived = 0'), 'id', 'id'));
    $cnt = array_count_values(array_map(fn($m) => $m['status'], $live));
    $late = count(array_filter($live, fn($m) => $m['late']));
    if (can('fleet_edit') && ($need = cars_needing_details())) $h .= '<div class="flash info">' . count($need) . ' car' . (count($need) === 1 ? '' : 's') . ' still need the real registration number or kilometre reading. <a href="' . e(url('fleet')) . '">Fill them in</a></div>';
    $h .= '<h2 class="first">Cars</h2><div class="stats">' . tile('Total cars', $vcount, url('fleet')) . tile('Available', $cnt['available'] ?? 0, url('fleet', ['status' => 'available']), 'good')
        . tile('Currently rented', $cnt['rented'] ?? 0, url('rentals'), '', $late ? '<span class="red">' . $late . ' overdue</span>' : '') . tile('Reserved', $cnt['booked'] ?? 0, url('fleet', ['status' => 'booked']), '', 'pickup within 24 hours')
        . tile('Under maintenance', ($cnt['maintenance'] ?? 0), url('fleet', ['status' => 'maintenance']), ($cnt['maintenance'] ?? 0) ? 'warn' : '', ($cnt['unavailable'] ?? 0) ? ($cnt['unavailable'] . ' unavailable') : '') . '</div>';

    if (can('payments')) {
        $open = bookings_where("b.status <> 'inquiry'");
        $owed = array_sum(array_map(fn($b) => max(0, $b['balance']), $open));
        $unpaid = count(array_filter($open, fn($b) => $b['balance'] > 0 && (int)$b['paid'] === 0));
        $partial = count(array_filter($open, fn($b) => $b['balance'] > 0 && (int)$b['paid'] > 0));
        $month = (int)val("SELECT COALESCE(SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END),0) FROM payments WHERE voided = 0 AND kind IN ('rental','refund') AND paid_at >= ?", [substr(today(), 0, 7) . '-01 00:00:00']);
        $h .= '<h2>Money</h2><div class="stats">' . tile('Collected this month', money($month), url('reports', ['range' => 'month']), 'good', 'rent only, deposits excluded') . tile('Money still due', money($owed), url('money_due'), $owed ? 'warn' : '')
            . tile('Unpaid rentals', $unpaid, url('money_due'), $unpaid ? 'bad' : '') . tile('Partially paid', $partial, url('money_due')) . '</div>';
    }

    $h .= '<div class="grid2">';
    if (can('bookings')) {
        $active = bookings_where("b.status = 'active'", [], 'b.end_at ASC');
        $li = '';
        foreach ($active as $b) $li .= '<li><a href="' . e(url('booking', ['id' => $b['id']])) . '"><span><b>' . e($b['reg_no']) . '</b> · ' . e($b['customer_name']) . '</span><small class="' . ($b['view_status'] === 'overdue' ? 'red' : '') . '">' . ($b['view_status'] === 'overdue' ? 'Overdue ' . e(human_duration(ts(now()) - ts($b['end_at']))) : 'Returns ' . e(fmt_dt($b['end_at']))) . (can('payments') && $b['balance'] > 0 ? ' · owes ' . money($b['balance']) : '') . '</small></a></li>';
        $h .= '<div class="card"><div class="row between"><h3>With customers now</h3><a href="' . e(url('rentals')) . '">All rentals</a></div>' . ($li ? '<ul class="list">' . $li . '</ul>' : '<p class="muted">No cars are out right now.</p>') . '</div>';
    }
    $h .= '<div class="card"><h3>Needs attention</h3>' . dashboard_alerts() . '</div></div>';
    render_page('Dashboard', $h, 'dashboard');
}

/* Today's important items, worked out live from the data. */
function dashboard_alerts() {
    $items = [];
    if (can('bookings')) {
        foreach (bookings_where("b.status = 'active'", [], 'b.end_at ASC') as $b) {
            if ($b['view_status'] === 'overdue') $items[] = ['high', 'Overdue: ' . $b['reg_no'] . ' with ' . $b['customer_name'], 'Was due ' . fmt_dt($b['end_at']) . ' · call ' . $b['customer_phone'], url('booking', ['id' => $b['id']])];
            elseif (substr($b['end_at'], 0, 10) === today()) $items[] = ['low', 'Returns today: ' . $b['reg_no'], $b['customer_name'] . ' at ' . date('g:i A', strtotime($b['end_at'])), url('booking', ['id' => $b['id']])];
        }
        foreach (bookings_where("b.status = 'confirmed' AND b.start_at <= ?", [today() . ' 23:59:59'], 'b.start_at ASC') as $b)
            $items[] = ['low', 'Pickup today: ' . $b['reg_no'], $b['customer_name'] . ' at ' . date('g:i A', strtotime($b['start_at'])), url('booking', ['id' => $b['id']])];
    }
    if (can('payments')) {
        foreach (bookings_where("b.status <> 'inquiry'", [], 'b.due_date ASC') as $b) {
            if ($b['balance'] <= 0 || !$b['due_date']) continue;
            if ($b['overdue_days']) $items[] = ['high', 'Payment overdue: ' . money($b['balance']), $b['customer_name'] . ' · ' . $b['overdue_days'] . ' day(s) late', url('booking', ['id' => $b['id']])];
            elseif ($b['due_date'] <= date('Y-m-d', strtotime(today() . ' +' . (int)setting('payment_alert_days', 1) . ' days'))) $items[] = ['medium', 'Payment due ' . ($b['due_date'] === today() ? 'today' : fmt_d($b['due_date'])) . ': ' . money($b['balance']), $b['customer_name'], url('booking', ['id' => $b['id']])];
        }
    }
    if (can('maintenance')) {
        require_once __DIR__ . '/maintenance.php';
        $rem = upkeep_reminders();
        $missing = array_unique(array_map(fn($r) => $r['v']['reg_no'], array_filter($rem, fn($r) => $r['state'] === 'missing')));
        if ($missing) $items[] = ['medium', 'Document dates not entered: ' . count($missing) . ' car' . (count($missing) === 1 ? '' : 's'), implode(', ', array_slice($missing, 0, 6)) . (count($missing) > 6 ? '…' : ''), url('upkeep')];
        foreach (array_filter($rem, fn($r) => $r['state'] !== 'missing') as $r) $items[] =[in_array($r['state'], ['overdue', 'expired'], true) ? 'high' : 'medium', ($r['kind'] === 'service' ? SERVICE_STATE_LABEL[$r['state']] : $r['what'] . ' ' . strtolower(DOC_STATE_LABEL[$r['state']])) . ': ' . $r['v']['reg_no'], strip_tags(str_replace(['<small>', '<br>'], [' · ', ' / '], $r['when'])), url('upkeep')];
    }
    if (can('void')) foreach (rows("SELECT d.*, v.reg_no FROM damages d JOIN vehicles v ON v.id = d.vehicle_id WHERE d.status = 'review'") as $d)
        $items[] = ['medium', 'Damage to review: ' . $d['reg_no'], mb_strimwidth($d['description'], 0, 80, '…'), $d['booking_id'] ? url('booking', ['id' => $d['booking_id']]) . '#damage' : url('vehicle', ['id' => $d['vehicle_id'], 'tab' => 'damage'])];
    if (!$items) return '<p class="muted">All clear. Nothing needs attention today.</p>';
    usort($items, fn($a, $b) => array_search($a[0], ['high', 'medium', 'low']) <=> array_search($b[0], ['high', 'medium', 'low']));
    $h = '<ul class="alerts">';
    foreach (array_slice($items, 0, 12) as [$sev, $t, $m, $link]) $h .= '<li class="sev-' . $sev . '"><a href="' . e($link) . '"><b>' . e($t) . '</b><small>' . e($m) . '</small></a></li>';
    return $h . '</ul>' . (count($items) > 12 ? '<p class="small muted">+' . (count($items) - 12) . ' more</p>' : '');
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
            flash('success', 'Marked as done.');
        }
        redirect('alerts');
    }
    $list = visible_notifications(true);
    $h = page_head('Alerts', count($list) . ' open');
    if (!$list) $h .= '<div class="card empty"><p class="muted">Nothing needs attention right now.</p></div>';
    else {
        $h .= '<div class="card flush"><ul class="alerts big">';
        foreach ($list as $n) $h .= '<li class="sev-' . e($n['severity']) . '"><a href="' . e($n['link'] ?: '#') . '"><b>' . e($n['title']) . '</b><small>' . e($n['message']) . ' · ' . e(fmt_dt($n['created_at'])) . '</small></a>'
            . form_open('resolve', 'class="inline"') . '<input type="hidden" name="id" value="' . $n['id'] . '"><button class="btn ghost small">Done</button></form></li>';
        $h .= '</ul></div>';
    }
    $h .= '<p class="muted small">Alerts close by themselves when the problem is fixed (payment received, car returned, document date updated).</p>';
    render_page('Alerts', $h, 'alerts');
}
