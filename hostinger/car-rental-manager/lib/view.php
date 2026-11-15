<?php
/* Page layout and small UI helpers. */
defined('APP') or exit;

const NAV = [
    ['dashboard', 'Dashboard', null, 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10'],
    ['fleet', 'Cars', 'fleet', 'M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 13l2-6h14l2 6v4H3z'],
    ['customers', 'Customers', 'customers', 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8'],
    ['rentals', 'Rentals', 'bookings', 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4'],
    ['money_due', 'Money Due', 'payments', 'M3 7h18v10H3zM3 11h18M7 15h3'],
    ['upkeep', 'Maintenance & Documents', 'maintenance', 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'],
    ['reports', 'Reports', 'reports', 'M4 20V10M10 20V4M16 20v-8M22 20H2'],
    ['settings', 'Settings', 'settings', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
];

function icon($d, $cls = 'ic') { return '<svg class="' . $cls . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' . $d . '"/></svg>'; }

function render_page($title, $content, $active = null) {
    $u = current_user();
    $flashes = take_flashes();
    $alerts = $u ? count(visible_notifications()) : 0;
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
    echo '<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#f5f5f7"><title>' . e($title) . ' · ' . e(setting('business_name', 'Fleet')) . '</title>';
    echo '<link rel="icon" href="assets/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/app.css?v=' . APP_VERSION . '"></head><body>';
    if ($u) {
        echo '<aside class="side" id="side"><div class="brand"><span class="logo">' . e(initials(setting('business_name', 'Car Rentals'))) . '</span><span>' . e(setting('business_name')) . '</span></div><nav>';
        foreach (NAV as [$p, $label, $perm, $d]) {
            if ($p === 'settings' ? !is_owner() : ($perm && !can($perm))) continue;
            echo '<a href="' . url($p) . '"' . ($active === $p ? ' class="on" aria-current="page"' : '') . '>' . icon($d) . '<span>' . e($label) . '</span></a>';
        }
        echo '</nav><div class="me"><a href="' . url('account') . '">' . e($u['name']) . '<small>' . ($u['role'] === 'owner' ? 'Owner' : 'Staff') . '</small></a><a class="out" href="' . url('logout') . '">Sign out</a></div></aside>';
        echo '<header class="top"><button class="menu" type="button" aria-label="Menu" data-nav-toggle><span></span></button><strong>' . e($title) . '</strong>';
        echo '<a class="bell' . ($alerts ? ' has' : '') . '" href="' . url('alerts') . '" aria-label="Alerts">' . icon('M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0') . ($alerts ? '<b>' . $alerts . '</b>' : '') . '</a></header>';
        echo '<div class="scrim" data-nav-close></div>';
    }
    echo '<main class="' . ($u ? 'main' : 'bare') . '">';
    foreach ($flashes as [$t, $m]) echo '<div class="flash ' . e($t) . '" role="' . ($t === 'error' ? 'alert' : 'status') . '">' . e($m) . '</div>';
    echo $content;
    echo '</main><script src="assets/app.js?v=' . APP_VERSION . '"></script></body></html>';
}

function page_head($title, $sub = '', $actions = '') {
    return '<div class="ph"><div><h1>' . e($title) . '</h1>' . ($sub ? '<p class="muted">' . $sub . '</p>' : '') . '</div>' . ($actions ? '<div class="acts">' . $actions . '</div>' : '') . '</div>';
}
function badge($text, $tone = 'grey') { return '<span class="badge ' . e($tone) . '">' . e($text) . '</span>'; }
function tone_for($state) {
    return match ($state) {
        'available', 'paid', 'valid', 'ok', 'completed', 'repaired' => 'green',
        'booked', 'assigned', 'confirmed', 'partial', 'due', 'expiring', 'warning', 'medium', 'inquiry', 'upcoming', 'review', 'maintenance' => 'amber',
        'rented', 'active', 'extended', 'low', 'charged' => 'blue',
        'overdue', 'expired', 'missing', 'blocked', 'unpaid', 'high' => 'red',
        default => 'grey',
    };
}
function btn($label, $href, $cls = '') { return '<a class="btn ' . $cls . '" href="' . e($href) . '">' . e($label) . '</a>'; }
function field($label, $input, $hint = '', $cls = '') {
    return '<label class="field ' . $cls . '"><span>' . e($label) . '</span>' . $input . ($hint ? '<small>' . $hint . '</small>' : '') . '</label>';
}
function inp($name, $value = '', $type = 'text', $extra = '') {
    return '<input type="' . e($type) . '" name="' . e($name) . '" value="' . e($value) . '" ' . $extra . '>';
}
function sel($name, array $options, $selected = '', $extra = '', $blank = null) {
    $h = '<select name="' . e($name) . '" ' . $extra . '>';
    if ($blank !== null) $h .= '<option value="">' . e($blank) . '</option>';
    foreach ($options as $k => $v) {
        $key = is_int($k) && array_is_list($options) ? $v : $k;
        $h .= '<option value="' . e($key) . '"' . ((string)$key === (string)$selected ? ' selected' : '') . '>' . e($v) . '</option>';
    }
    return $h . '</select>';
}
function txt($name, $value = '', $extra = '') { return '<textarea name="' . e($name) . '" rows="3" ' . $extra . '>' . e($value) . '</textarea>'; }
function money_in($name, $paise = null, $extra = '') {
    return '<div class="money-in"><i>₹</i><input type="text" inputmode="decimal" name="' . e($name) . '" value="' . e($paise === null || $paise === '' ? '' : rtrim(rtrim(money_plain($paise), '0'), '.')) . '" ' . $extra . '></div>';
}
function form_open($action, $extra = '', $multipart = false) {
    return '<form method="post" action="' . e(url(get('p', 'dashboard'), array_diff_key($_GET, ['p' => 1, 'receipt' => 1]))) . '"' . ($multipart ? ' enctype="multipart/form-data"' : '') . ' ' . $extra . '>' . csrf_field() . '<input type="hidden" name="action" value="' . e($action) . '">';
}
function tile($label, $value, $href = null, $tone = '', $sub = '') {
    $inner = '<span class="sl">' . e($label) . '</span><span class="sv">' . $value . '</span>' . ($sub ? '<span class="ss">' . $sub . '</span>' : '');
    return $href ? '<a class="stat ' . $tone . '" href="' . e($href) . '">' . $inner . '</a>' : '<div class="stat ' . $tone . '">' . $inner . '</div>';
}
function table($headers, $rowsHtml, $empty = 'Nothing here yet.') {
    if (!$rowsHtml) return '<div class="empty-row">' . e($empty) . '</div>';
    $h = '<div class="tw"><table><thead><tr>';
    foreach ($headers as $t) $h .= '<th>' . e($t) . '</th>';
    return $h . '</tr></thead><tbody>' . implode('', $rowsHtml) . '</tbody></table></div>';
}
function tr(array $cells, $href = null) {
    global $__headers;
    $h = '<tr' . ($href ? ' data-href="' . e($href) . '" tabindex="0"' : '') . '>';
    foreach ($cells as $c) $h .= '<td>' . $c . '</td>';
    return $h . '</tr>';
}
function wa_link($phone, $text) {
    $d = preg_replace('/\D/', '', (string)$phone);
    if (strlen($d) === 10) $d = '91' . $d;
    return 'https://wa.me/' . $d . '?text=' . rawurlencode($text);
}
function tabs($base, $params, $current, array $items) {
    $h = '<div class="tabs" role="tablist">';
    foreach ($items as $k => $label) $h .= '<a role="tab" href="' . e(url($base, $params + ['tab' => $k])) . '"' . ($current === $k ? ' class="on" aria-selected="true"' : '') . '>' . e($label) . '</a>';
    return $h . '</div>';
}
function vehicle_options($includeArchived = false) {
    $o = [];
    foreach (rows('SELECT id, reg_no, name FROM vehicles' . ($includeArchived ? '' : ' WHERE archived = 0') . ' ORDER BY reg_no') as $v) $o[$v['id']] = $v['reg_no'] . ' · ' . $v['name'];
    return $o;
}

/* Date range from the query string: presets (today, week, month, last_month, year, all) or custom from/to. */
function date_range($default = 'month') {
    $r = get('range', $default); $t = today();
    [$from, $to] = match ($r) {
        'today' => [$t, $t],
        'week' => [date('Y-m-d', strtotime($t . ' monday this week')), $t],
        'last_month' => [date('Y-m-01', strtotime(substr($t, 0, 7) . '-01 -1 month')), date('Y-m-t', strtotime(substr($t, 0, 7) . '-01 -1 month'))],
        'year' => [date('Y-04-01', strtotime($t)) <= $t ? date('Y-04-01', strtotime($t)) : (date('Y', strtotime($t)) - 1) . '-04-01', $t],
        'all' => ['2000-01-01', $t],
        'custom' => [parse_date(get('from')) ?: substr($t, 0, 7) . '-01', parse_date(get('to')) ?: $t],
        default => [substr($t, 0, 7) . '-01', $t],
    };
    if ($from > $to) [$from, $to] = [$to, $from];
    return ['range' => $r, 'from' => $from, 'to' => $to, 'label' => $r === 'all' ? 'All time' : fmt_d($from) . ($from !== $to ? ' – ' . fmt_d($to) : '')];
}
function range_filter($page, array $dr, $extraHtml = '', array $keep = []) {
    $h = '<form class="filters" method="get"><input type="hidden" name="p" value="' . e($page) . '">';
    foreach ($keep as $k => $v) $h .= '<input type="hidden" name="' . e($k) . '" value="' . e($v) . '">';
    $h .= sel('range', ['today' => 'Today', 'week' => 'This week', 'month' => 'This month', 'last_month' => 'Last month', 'year' => 'This financial year', 'all' => 'All time', 'custom' => 'Custom dates'], $dr['range'], 'data-range');
    $h .= '<input type="date" name="from" value="' . e($dr['from']) . '" aria-label="From" data-custom><input type="date" name="to" value="' . e($dr['to']) . '" aria-label="To" data-custom>';
    return $h . $extraHtml . '<button class="btn">Apply</button></form>';
}
/* Group dated amounts by day, ISO week or month. */
function group_by_period(array $rows, $dateKey, $amountKey, $period) {
    $out = [];
    foreach ($rows as $r) {
        $d = substr($r[$dateKey], 0, 10);
        $k = match ($period) { 'week' => date('o-\WW', strtotime($d)), 'month' => substr($d, 0, 7), default => $d };
        $out[$k] = ($out[$k] ?? 0) + (int)$r[$amountKey];
    }
    krsort($out);
    return $out;
}
function period_label($k, $period) {
    return match ($period) {
        'week' => 'Week of ' . fmt_d(date('Y-m-d', strtotime(str_replace('-W', 'W', $k)))),
        'month' => date('F Y', strtotime($k . '-01')),
        default => date('D, d M Y', strtotime($k)),
    };
}

function initials($name) {
    $w = preg_split('/\s+/', trim((string)$name)) ?: [];
    $i = mb_strtoupper(mb_substr($w[0] ?? 'C', 0, 1) . mb_substr($w[1] ?? '', 0, 1));
    return $i ?: 'CR';
}
