<?php
defined('APP') or exit;

/* Net rent collected from a list of payments: rent in minus rent refunded. Deposits are never income. */
function rent_net(array $pays) {
    $n = 0;
    foreach ($pays as $p) if (!$p['voided']) $n += $p['kind'] === 'rental' ? (int)$p['amount'] : ($p['kind'] === 'refund' ? -(int)$p['amount'] : 0);
    return $n;
}

function page_payments() {
    require_perm('payments');
    $dr = date_range('month');
    $kind = get('kind'); $method = get('method'); $period = in_array(get('period'), ['day', 'week', 'month'], true) ? get('period') : 'day';
    $where = 'p.paid_at BETWEEN ? AND ?'; $par = [$dr['from'] . ' 00:00:00', $dr['to'] . ' 23:59:59'];
    if (isset(PAY_KIND_LABEL[$kind])) { $where .= ' AND p.kind = ?'; $par[] = $kind; }
    if (in_array($method, PAY_METHODS, true)) { $where .= ' AND p.method = ?'; $par[] = $method; }
    if ($c = (int)get('customer_id')) { $where .= ' AND p.customer_id = ?'; $par[] = $c; }
    $list = rows("SELECT p.*, b.code, c.name AS customer_name, v.reg_no, u.name AS by_name FROM payments p LEFT JOIN bookings b ON b.id = p.booking_id LEFT JOIN customers c ON c.id = p.customer_id
        LEFT JOIN vehicles v ON v.id = b.vehicle_id LEFT JOIN users u ON u.id = p.created_by WHERE $where ORDER BY p.paid_at DESC, p.id DESC", $par);
    $live = array_values(array_filter($list, fn($p) => !$p['voided']));
    $sum = fn($k) => array_sum(array_map(fn($p) => $p['kind'] === $k ? (int)$p['amount'] : 0, $live));

    if (get('export')) {
        require_once __DIR__ . '/reports.php';
        export_table('payments-' . $dr['from'] . '-to-' . $dr['to'], ['Date', 'Receipt', 'Type', 'Rental', 'Customer', 'Vehicle', 'Method', 'Reference', 'Amount (₹)', 'Voided', 'Recorded by'],
            array_map(fn($p) => [$p['paid_at'], $p['receipt_no'], PAY_KIND_LABEL[$p['kind']], $p['code'], $p['customer_name'], $p['reg_no'], $p['method'], $p['reference'], money_plain($p['amount']), $p['voided'] ? 'Yes: ' . $p['void_reason'] : '', $p['by_name']], $list), get('export'));
    }

    $heldNow = (int)val("SELECT COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount ELSE -amount END),0) FROM payments WHERE kind IN ('deposit','deposit_out') AND voided = 0");
    $h = page_head('Payments', e($dr['label']), btn('Money Due', url('money_due')));
    $extra = sel('kind', ['' => 'All types'] + PAY_KIND_LABEL, $kind) . sel('method', ['' => 'All methods'] + array_combine(PAY_METHODS, PAY_METHODS), $method) . sel('period', ['day' => 'Daily', 'week' => 'Weekly', 'month' => 'Monthly'], $period);
    $h .= range_filter('payments', $dr, $extra);
    $h .= '<div class="stats">' . tile('Rent collected', money(rent_net($live)), null, 'good', 'rent received minus refunds') . tile('Deposits received', money($sum('deposit')), null, '', 'refundable, not income')
        . tile('Deposits returned', money($sum('deposit_out'))) . tile('Deposits held now', money($heldNow), null, '', 'all rentals, today') . '</div>';

    $rentRows = array_map(fn($p) => ['d' => $p['paid_at'], 'a' => $p['kind'] === 'refund' ? -$p['amount'] : $p['amount']], array_filter($live, fn($p) => in_array($p['kind'], ['rental', 'refund'], true)));
    $per = group_by_period($rentRows, 'd', 'a', $period);
    $byMethod = []; foreach ($live as $p) if ($p['kind'] === 'rental') $byMethod[$p['method']] = ($byMethod[$p['method']] ?? 0) + (int)$p['amount'];
    arsort($byMethod);
    $h .= '<div class="grid2"><div class="card"><h3>' . ['day' => 'Daily', 'week' => 'Weekly', 'month' => 'Monthly'][$period] . ' rent collection</h3>' . ($per ? '<dl class="kv">' . implode('', array_map(fn($k, $v) => '<dt>' . e(period_label($k, $period)) . '</dt><dd>' . money($v) . '</dd>', array_keys($per), $per)) . '</dl>' : '<p class="muted">No rent collected in this period.</p>') . '</div>'
        . '<div class="card"><h3>Rent by payment method</h3>' . ($byMethod ? '<dl class="kv">' . implode('', array_map(fn($k, $v) => '<dt>' . e($k) . '</dt><dd>' . money($v) . '</dd>', array_keys($byMethod), $byMethod)) . '</dl>' : '<p class="muted">—</p>') . '</div></div>';

    $trs = [];
    foreach (array_slice($list, 0, 500) as $p) $trs[] = tr([e(fmt_dt($p['paid_at'])), '<a href="' . e(url('receipt', ['id' => $p['id']])) . '" target="_blank">' . e($p['receipt_no']) . '</a>', badge(PAY_KIND_LABEL[$p['kind']], in_array($p['kind'], ['deposit', 'deposit_out'], true) ? 'grey' : ($p['kind'] === 'refund' ? 'amber' : 'green')),
        e($p['customer_name']) . '<small>' . e($p['code']) . ($p['reg_no'] ? ' · ' . e($p['reg_no']) : '') . '</small>', ($p['voided'] ? '<s>' . money($p['amount']) . '</s> ' . badge('Voided', 'grey') : (in_array($p['kind'], ['deposit_out', 'refund'], true) ? '−' : '') . money($p['amount'])), e($p['method']) . ($p['reference'] ? '<small>' . e($p['reference']) . '</small>' : ''), e($p['by_name'])], url('booking', ['id' => $p['booking_id']]));
    $q = array_diff_key($_GET, ['p' => 1]);
    $h .= '<div class="row between"><h2>Transactions</h2><div class="row">' . btn('Excel', url('payments', $q + ['export' => 'xls']), 'ghost small') . btn('CSV', url('payments', $q + ['export' => 'csv']), 'ghost small') . btn('Print / PDF', url('payments', $q + ['export' => 'print']), 'ghost small') . '</div></div>';
    $h .= '<div class="card flush">' . table(['Date', 'Receipt', 'Type', 'Customer', 'Amount', 'Method', 'By'], $trs, 'No payments in this period.') . '</div>';
    $h .= '<p class="muted small">Payments are never deleted. A mistake is voided by the owner and stays visible, crossed out, with the reason.</p>';
    render_page('Payments', $h, 'reports');
}

function page_money_due() {
    require_perm('payments');
    $all = bookings_where("b.status <> 'inquiry'", [], 'b.due_date ASC');
    $owing = array_values(array_filter($all, fn($b) => $b['balance'] > 0));
    usort($owing, fn($a, $b) => [$b['overdue_days'], $b['balance']] <=> [$a['overdue_days'], $a['balance']]);
    $refunds = array_values(array_filter($all, fn($b) => $b['balance'] < 0));
    $deposits = array_values(array_filter($all, fn($b) => $b['deposit_held'] > 0 && in_array($b['status'], ['completed', 'cancelled'], true)));
    $paidFull = array_values(array_filter($all, fn($b) => $b['status'] === 'completed' && $b['balance'] === 0));
    $total = array_sum(array_column($owing, 'balance'));
    $overdue = array_sum(array_map(fn($b) => $b['overdue_days'] > 0 ? $b['balance'] : 0, $owing));
    $custs = count(array_unique(array_column($owing, 'customer_id')));
    $show = get('show') === 'paid' ? 'paid' : 'owing';
    if (get('export')) {
        require_once __DIR__ . '/reports.php';
        export_table('money-due-' . today(), ['Customer', 'Phone', 'Car', 'Rental', 'Total rental amount', 'Amount paid', 'Amount remaining', 'Due date', 'Overdue days'],
            array_map(fn($b) => [$b['customer_name'], $b['customer_phone'], $b['reg_no'], $b['code'], money_plain($b['total']), money_plain($b['paid']), money_plain($b['balance']), $b['due_date'], $b['overdue_days']], $owing), get('export'));
    }
    $h = page_head('Money Due', 'Who owes you money, as of ' . e(fmt_d(today())), btn('Excel', url('money_due', ['export' => 'xls']), 'ghost small') . btn('CSV', url('money_due', ['export' => 'csv']), 'ghost small'));
    $h .= '<div class="stats">' . tile('Total money due', money($total), null, $total ? 'warn' : 'good', count($owing) . ' rental(s)') . tile('Overdue', money($overdue), null, $overdue ? 'bad' : '', 'past the due date')
        . tile('Customers owing', $custs) . tile('Rentals paid in full', count($paidFull), url('money_due', ['show' => 'paid']), 'good') . '</div>';
    $h .= '<div class="chips"><a class="chip' . ($show === 'owing' ? ' on' : '') . '" href="' . e(url('money_due')) . '">Owing <b>' . count($owing) . '</b></a><a class="chip' . ($show === 'paid' ? ' on' : '') . '" href="' . e(url('money_due', ['show' => 'paid'])) . '">Paid in full <b>' . count($paidFull) . '</b></a></div>';
    if ($show === 'paid') {
        $trs = array_map(fn($b) => tr(['<b>' . e($b['customer_name']) . '</b><small>' . e($b['customer_phone']) . '</small>', e($b['reg_no']) . '<small>' . e($b['code']) . '</small>', money($b['total']), e(fmt_d($b['actual_end'])), badge('Paid', 'green')], url('booking', ['id' => $b['id']])), array_reverse($paidFull));
        $h .= '<div class="card flush">' . table(['Customer', 'Car', 'Total paid', 'Returned', ''], $trs, 'No completed rentals yet.') . '</div>';
        render_page('Money Due', $h, 'money_due'); return;
    }
    $trs = [];
    foreach ($owing as $b) {
        $msg = "Hello {$b['customer_name']}, a reminder from " . setting('business_name') . ' that ' . money($b['balance']) . " is pending for rental {$b['code']} ({$b['reg_no']}). Thank you.";
        $trs[] = tr(['<b>' . e($b['customer_name']) . '</b>', '<a href="tel:' . e($b['customer_phone']) . '">' . e($b['customer_phone']) . '</a>', e($b['reg_no']) . '<small>' . e($b['code']) . ' · ' . e(BOOKING_STATUS_LABEL[$b['view_status']]) . '</small>',
            money($b['total']), money($b['paid']), '<b class="red">' . money($b['balance']) . '</b>', e(fmt_d($b['due_date'])), $b['overdue_days'] ? badge($b['overdue_days'] . ' day' . ($b['overdue_days'] === 1 ? '' : 's'), 'red') : '<span class="muted">Not yet due</span>',
            '<a class="btn ghost small" target="_blank" rel="noopener" href="' . e(wa_link($b['customer_phone'], $msg)) . '">WhatsApp</a>'], url('booking', ['id' => $b['id']]));
    }
    $h .= '<div class="card flush">' . table(['Customer', 'Phone', 'Car', 'Total rental amount', 'Paid', 'Remaining', 'Due date', 'Overdue', ''], $trs, 'Nobody owes you money right now.') . '</div>';
    if ($refunds) {
        $trs = array_map(fn($b) => tr([e($b['customer_name']), e($b['code']), money(-$b['balance']), e(BOOKING_STATUS_LABEL[$b['view_status']])], url('booking', ['id' => $b['id']])), $refunds);
        $h .= '<h2>Refunds you owe customers</h2><div class="card flush">' . table(['Customer', 'Rental', 'Refund due', 'Status'], $trs) . '</div>';
    }
    if ($deposits) {
        $trs = array_map(fn($b) => tr([e($b['customer_name']), e($b['code']), money($b['deposit_held']), e(fmt_dt($b['actual_end'] ?: $b['end_at']))], url('booking', ['id' => $b['id']])), $deposits);
        $h .= '<h2>Security deposits still held after the trip ended</h2><div class="card flush">' . table(['Customer', 'Rental', 'Deposit held', 'Ended'], $trs) . '</div>';
    }
    render_page('Money Due', $h, 'money_due');
}

function page_receipt() {
    require_perm('payments');
    $p = row('SELECT p.*, u.name AS by_name FROM payments p LEFT JOIN users u ON u.id = p.created_by WHERE p.id = ?', [(int)get('id')]);
    if (!$p) throw new UserError('Receipt not found.');
    $b = booking_get($p['booking_id']);
    $c = row('SELECT * FROM customers WHERE id = ?', [$p['customer_id']]);
    $title = ['rental' => 'Payment receipt', 'deposit' => 'Security deposit receipt', 'deposit_out' => 'Deposit refund voucher', 'refund' => 'Refund voucher'][$p['kind']];
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . e($p['receipt_no']) . '</title><link rel="stylesheet" href="assets/app.css?v=' . APP_VERSION . '"></head><body class="receipt-page">';
    echo '<div class="receipt">' . ($p['voided'] ? '<div class="void-stamp">VOID</div>' : '') . '<div class="row between"><div><h1>' . e(setting('business_name')) . '</h1><p class="muted">' . nl2br(e(setting('business_address'))) . '<br>' . e(setting('business_phone')) . (setting('business_gstin') ? '<br>GSTIN ' . e(setting('business_gstin')) : '') . '</p></div>'
        . '<div class="right"><h2>' . e($title) . '</h2><p><b>' . e($p['receipt_no']) . '</b><br>' . e(fmt_dt($p['paid_at'])) . '</p></div></div><hr>';
    echo '<dl class="kv"><dt>Received ' . (in_array($p['kind'], ['deposit_out', 'refund'], true) ? 'by' : 'from') . '</dt><dd>' . e($c['name'] ?? '') . ' · ' . e($c['phone'] ?? '') . '</dd><dt>Rental</dt><dd>' . e($b['code']) . ($b['reg_no'] ? ' · ' . e($b['reg_no'] . ' ' . $b['vehicle_name']) : '') . '</dd>'
        . '<dt>Rental period</dt><dd>' . e(fmt_dt($b['start_at'])) . ' to ' . e(fmt_dt($b['end_at'])) . '</dd><dt>Payment method</dt><dd>' . e($p['method']) . ($p['reference'] ? ' · ' . e($p['reference']) : '') . '</dd>' . ($p['note'] ? '<dt>Note</dt><dd>' . e($p['note']) . '</dd>' : '') . '</dl>';
    echo '<div class="amount-box"><span>' . e(PAY_KIND_LABEL[$p['kind']]) . '</span><b>' . money($p['amount']) . '</b></div>';
    if ($p['kind'] === 'rental' || $p['kind'] === 'refund') echo '<dl class="kv"><dt>Rental total</dt><dd>' . money($b['total']) . '</dd><dt>Total rent paid so far</dt><dd>' . money($b['paid']) . '</dd><dt>Balance</dt><dd><b>' . money(max(0, $b['balance'])) . '</b></dd></dl>';
    if ($p['kind'] === 'deposit') echo '<p class="small">This is a refundable security deposit. It will be returned after the car is returned, less any agreed deductions.</p>';
    if ($p['voided']) echo '<p class="red">This receipt was cancelled on ' . e(fmt_dt($p['voided_at'])) . ': ' . e($p['void_reason']) . '</p>';
    echo '<div class="row between sign"><span class="muted small">Recorded by ' . e($p['by_name']) . '</span><span>Authorised signature</span></div><p class="muted small center">Computer-generated receipt.</p>';
    echo '<p class="no-print center"><button class="btn primary" data-print>Print or save as PDF</button></p></div><script src="assets/app.js?v=' . APP_VERSION . '"></script></body></html>';
}
