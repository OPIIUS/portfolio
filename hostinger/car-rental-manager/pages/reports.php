<?php
defined('APP') or exit;

/* ---------- exports: Excel (.xlsx), CSV, and a print view for PDF ---------- */
function export_table($name, array $headers, array $data, $format) {
    $headers = str_replace('(₹)', '(' . setting('currency', 'INR') . ')', $headers);
    $name = preg_replace('/[^A-Za-z0-9_-]+/', '-', $name);
    audit('export', 'report', null, ['name' => $name, 'format' => $format, 'rows' => count($data)]);
    if ($format === 'csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"$name.csv\"");
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, $headers, ',', '"', '\\');
        foreach ($data as $r) fputcsv($out, array_map('csv_safe', $r), ',', '"', '\\');
        exit;
    }
    if ($format === 'xls') {
        if (class_exists('ZipArchive')) { $file = xlsx_build($headers, $data); header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); header("Content-Disposition: attachment; filename=\"$name.xlsx\""); header('Content-Length: ' . filesize($file)); readfile($file); @unlink($file); exit; }
        header('Content-Type: application/vnd.ms-excel; charset=utf-8'); header("Content-Disposition: attachment; filename=\"$name.xls\"");
        echo '<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>';
        foreach (array_merge([$headers], $data) as $r) { echo '<Row>'; foreach ($r as $c) echo '<Cell><Data ss:Type="' . (is_numeric($c) && !preg_match('/^0\d/', (string)$c) ? 'Number' : 'String') . '">' . htmlspecialchars((string)$c, ENT_XML1) . '</Data></Cell>'; echo '</Row>'; }
        echo '</Table></Worksheet></Workbook>'; exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' . e($name) . '</title><link rel="stylesheet" href="assets/app.css?v=' . APP_VERSION . '"></head><body class="print-page">';
    echo '<div class="row between"><div><h1>' . e(setting('business_name')) . '</h1><p class="muted">' . e(str_replace('-', ' ', $name)) . ' · printed ' . e(fmt_dt(now())) . '</p></div><button class="btn primary no-print" data-print>Print or save as PDF</button></div>';
    echo '<table class="print"><thead><tr>'; foreach ($headers as $hd) echo '<th>' . e($hd) . '</th>'; echo '</tr></thead><tbody>';
    foreach ($data as $r) { echo '<tr>'; foreach ($r as $c) echo '<td>' . e($c) . '</td>'; echo '</tr>'; }
    echo '</tbody></table>' . (!$data ? '<p class="muted">No rows.</p>' : '') . '<script src="assets/app.js?v=' . APP_VERSION . '"></script></body></html>';
    exit;
}
/* Stop spreadsheet formula injection from values typed by users. */
function csv_safe($v) { $v = (string)$v; return preg_match('/^[=+\-@\t\r]/', $v) && !is_numeric($v) ? "'" . $v : $v; }

function xlsx_build(array $headers, array $data) {
    $col = function ($i) { $s = ''; for ($i++; $i > 0; $i = intdiv($i - 1, 26)) $s = chr(65 + ($i - 1) % 26) . $s; return $s; };
    $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    foreach (array_merge([$headers], $data) as $ri => $r) {
        $xml .= '<row r="' . ($ri + 1) . '">';
        foreach (array_values($r) as $ci => $c) {
            $ref = $col($ci) . ($ri + 1); $c = (string)$c;
            if ($ri > 0 && $c !== '' && preg_match('/^-?(0|[1-9]\d{0,14})(\.\d+)?$/', $c)) $xml .= '<c r="' . $ref . '"><v>' . $c . '</v></c>';
            else $xml .= '<c r="' . $ref . '" t="inlineStr"' . ($ri === 0 ? ' s="1"' : '') . '><is><t xml:space="preserve">' . htmlspecialchars(csv_safe($c), ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</t></is></c>';
        }
        $xml .= '</row>';
    }
    $xml .= '</sheetData></worksheet>';
    $file = tempnam(sys_get_temp_dir(), 'xl');
    $z = new ZipArchive(); $z->open($file, ZipArchive::OVERWRITE);
    $z->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
    $z->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    $z->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>');
    $z->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    $z->addFromString('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>');
    $z->addFromString('xl/worksheets/sheet1.xml', $xml);
    $z->close();
    return $file;
}

/* ---------- report numbers ---------- */
/* Seconds of overlap between two time ranges. */
function overlap($a1, $a2, $b1, $b2) { return max(0, min($a2, $b2) - max($a1, $b1)); }

function report_data($from, $to, $vehicleId = 0, $customerId = 0) {
    $f = $from . ' 00:00:00'; $t = $to . ' 23:59:59';
    $pw = 'p.voided = 0 AND p.paid_at BETWEEN ? AND ?'; $pp = [$f, $t];
    $ew = 'x.voided = 0 AND x.expense_date BETWEEN ? AND ?'; $ep = [$from, $to];
    if ($vehicleId) { $pw .= ' AND b.vehicle_id = ?'; $pp[] = $vehicleId; $ew .= ' AND x.vehicle_id = ?'; $ep[] = $vehicleId; }
    if ($customerId) { $pw .= ' AND p.customer_id = ?'; $pp[] = $customerId; }
    $pays = rows("SELECT p.*, b.vehicle_id FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE $pw", $pp);
    $exps = $customerId ? [] : rows("SELECT x.* FROM expenses x WHERE $ew", $ep);
    $bw = "b.status = 'completed' AND b.actual_end BETWEEN ? AND ?"; $bp = [$f, $t];
    if ($vehicleId) { $bw .= ' AND b.vehicle_id = ?'; $bp[] = $vehicleId; }
    if ($customerId) { $bw .= ' AND b.customer_id = ?'; $bp[] = $customerId; }
    $completed = bookings_where($bw, $bp);
    $cash = 0; $depIn = 0; $depOut = 0;
    foreach ($pays as $p) match ($p['kind']) { 'rental' => $cash += $p['amount'], 'refund' => $cash -= $p['amount'], 'deposit' => $depIn += $p['amount'], 'deposit_out' => $depOut += $p['amount'] };
    $expTotal = array_sum(array_column($exps, 'amount'));
    $ow = "b.status <> 'inquiry'"; $op = [];
    if ($vehicleId) { $ow .= ' AND b.vehicle_id = ?'; $op[] = $vehicleId; }
    if ($customerId) { $ow .= ' AND b.customer_id = ?'; $op[] = $customerId; }
    $open = bookings_where($ow, $op);
    return [
        'billed' => array_sum(array_column($completed, 'total')), 'completed' => count($completed), 'cash' => $cash, 'dep_in' => $depIn, 'dep_out' => $depOut,
        'expenses' => $expTotal, 'profit' => $cash - $expTotal,
        'receivable' => array_sum(array_map(fn($b) => max(0, $b['balance']), $open)), 'deposits_held' => array_sum(array_map(fn($b) => $b['deposit_held'], $open)),
        'pays' => $pays, 'exps' => $exps,
    ];
}

function vehicle_report($from, $to) {
    $f = ts($from . ' 00:00:00'); $t = min(ts($to . ' 23:59:59'), ts(now()));
    $span = max(1, $t - $f);
    $out = [];
    $vs = rows('SELECT * FROM vehicles ORDER BY reg_no');
    foreach ($vs as $v) $out[$v['id']] = ['v' => $v, 'rentals' => 0, 'secs' => 0, 'cash' => 0, 'maint' => 0, 'exp' => 0, 'billed' => 0];
    foreach (rows("SELECT * FROM bookings WHERE status IN ('active', 'completed') AND vehicle_id IS NOT NULL") as $b) {
        if (!isset($out[$b['vehicle_id']])) continue;
        $s = ts($b['actual_start'] ?: $b['start_at']); $e = $b['actual_end'] ? ts($b['actual_end']) : ($b['status'] === 'active' ? ts(now()) : ts($b['end_at']));
        $o = overlap($s, $e, $f, $t);
        if ($s <= $t && $e >= $f) { $out[$b['vehicle_id']]['secs'] += $o; $out[$b['vehicle_id']]['rentals']++; }
    }
    foreach (rows("SELECT b.vehicle_id, p.kind, SUM(p.amount) AS a FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.voided = 0 AND p.kind IN ('rental', 'refund') AND p.paid_at BETWEEN ? AND ? GROUP BY b.vehicle_id, p.kind", [$from . ' 00:00:00', $to . ' 23:59:59']) as $r)
        if (isset($out[$r['vehicle_id']])) $out[$r['vehicle_id']]['cash'] += $r['kind'] === 'refund' ? -$r['a'] : $r['a'];
    foreach (rows("SELECT vehicle_id, category, SUM(amount) AS a FROM expenses WHERE voided = 0 AND vehicle_id IS NOT NULL AND expense_date BETWEEN ? AND ? GROUP BY vehicle_id, category", [$from, $to]) as $r) {
        if (!isset($out[$r['vehicle_id']])) continue;
        $out[$r['vehicle_id']]['exp'] += $r['a'];
        if (in_array($r['category'], ['servicing', 'repairs', 'tyres', 'battery'], true)) $out[$r['vehicle_id']]['maint'] += $r['a'];
    }
    foreach ($out as &$o) { $o['util'] = round($o['secs'] / $span * 100, 1); $o['days'] = round($o['secs'] / 86400, 1); $o['net'] = $o['cash'] - $o['exp']; }
    unset($o);
    // Archived vehicles with no activity in the period are left out.
    return array_filter($out, fn($o) => !$o['v']['archived'] || $o['secs'] || $o['cash'] || $o['exp']);
}

function page_reports() {
    require_perm('reports');
    $dr = date_range('all');
    $f = $dr['from'] . ' 00:00:00'; $t = $dr['to'] . ' 23:59:59';
    $inRange = fn($b) => $b['status'] !== 'cancelled' && ts($b['actual_start'] ?: $b['start_at']) <= ts($t) && ts($b['actual_end'] ?: $b['end_at']) >= ts($f);
    $all = bookings_where('1=1');
    $bk = array_values(array_filter($all, $inRange));
    $money = can('payments');
    $d = report_data($dr['from'], $dr['to']);
    $outstanding = array_sum(array_map(fn($b) => max(0, $b['balance']), $all));
    $ex = get('export'); $what = get('what');

    // monthly money collected
    $monthly = [];
    foreach (rows("SELECT kind, amount, paid_at FROM payments WHERE voided = 0 AND paid_at BETWEEN ? AND ?", [$f, $t]) as $p) {
        $m = substr($p['paid_at'], 0, 7); $monthly[$m] ??= ['rent' => 0, 'dep_in' => 0, 'dep_out' => 0];
        match ($p['kind']) { 'rental' => $monthly[$m]['rent'] += $p['amount'], 'refund' => $monthly[$m]['rent'] -= $p['amount'], 'deposit' => $monthly[$m]['dep_in'] += $p['amount'], 'deposit_out' => $monthly[$m]['dep_out'] += $p['amount'] };
    }
    krsort($monthly);
    // vehicle-wise
    $vr = vehicle_report($dr['from'], $dr['to']);
    $dmgV = []; foreach (rows('SELECT vehicle_id, COUNT(*) AS n FROM damages WHERE created_at BETWEEN ? AND ? GROUP BY vehicle_id', [$f, $t]) as $r) $dmgV[$r['vehicle_id']] = (int)$r['n'];
    $kmV = []; foreach (rows("SELECT b.vehicle_id, SUM(r.odometer - h.odometer) AS km FROM bookings b JOIN checklists h ON h.booking_id = b.id AND h.stage = 'handover' JOIN checklists r ON r.booking_id = b.id AND r.stage = 'return' WHERE b.actual_end BETWEEN ? AND ? GROUP BY b.vehicle_id", [$f, $t]) as $r) $kmV[$r['vehicle_id']] = (int)$r['km'];
    // customer-wise
    $cr = [];
    foreach ($bk as $b) {
        $c = $b['customer_id']; $cr[$c] ??= ['name' => $b['customer_name'], 'phone' => $b['customer_phone'], 'rentals' => 0, 'completed' => 0, 'paid' => 0, 'due' => 0];
        $cr[$c]['rentals']++; if ($b['status'] === 'completed') $cr[$c]['completed']++;
        $cr[$c]['paid'] += $b['paid']; $cr[$c]['due'] += max(0, $b['balance']);
    }
    uasort($cr, fn($a, $b) => $b['rentals'] <=> $a['rentals'] ?: $b['paid'] <=> $a['paid']);
    $dmgC = []; foreach (rows('SELECT customer_id, COUNT(*) AS n FROM damages WHERE customer_id IS NOT NULL GROUP BY customer_id') as $r) $dmgC[$r['customer_id']] = (int)$r['n'];
    // damage + maintenance
    require_once __DIR__ . '/damage.php';
    $damages = damage_rows('d.created_at BETWEEN ? AND ?', [$f, $t]);
    $maint = rows("SELECT m.*, v.reg_no, v.name AS vehicle_name FROM maintenance m JOIN vehicles v ON v.id = m.vehicle_id WHERE m.voided = 0 AND m.service_date BETWEEN ? AND ? ORDER BY m.service_date DESC", [$dr['from'], $dr['to']]);
    $repairs = rows("SELECT d.repaired_at AS service_date, d.repair_cost AS cost, d.description, v.reg_no FROM damages d JOIN vehicles v ON v.id = d.vehicle_id WHERE d.repaired_at BETWEEN ? AND ? AND d.repair_cost > 0", [$dr['from'], $dr['to']]);
    $maintTotal = array_sum(array_column($maint, 'cost')) + array_sum(array_column($repairs, 'cost'));
    $label = str_replace(' ', '-', strtolower($dr['label']));

    if ($ex && $what === 'rentals') export_table("rentals-$label", ['Rental', 'Status', 'Customer', 'Phone', 'Car', 'Start', 'Expected return', 'Returned', 'Total (' . setting('currency', 'INR') . ')', 'Paid', 'Remaining', 'Payment status'],
        array_map(fn($b) => [$b['code'], BOOKING_STATUS_LABEL[$b['view_status']], $b['customer_name'], $b['customer_phone'], $b['reg_no'], $b['actual_start'] ?: $b['start_at'], $b['end_at'], $b['actual_end'], $money ? money_plain($b['total']) : '', $money ? money_plain($b['paid']) : '', $money ? money_plain($b['balance']) : '', PAY_STATUS_LABEL[$b['pay_status']]], $bk), $ex);
    if ($ex && $what === 'monthly' && $money) export_table("money-collected-$label", ['Month', 'Rent collected', 'Security deposits received', 'Security deposits returned'], array_map(fn($m, $r) => [date('F Y', strtotime("$m-01")), money_plain($r['rent']), money_plain($r['dep_in']), money_plain($r['dep_out'])], array_keys($monthly), $monthly), $ex);
    if ($ex && $what === 'vehicles') export_table("car-wise-$label", ['Car', 'Name', 'Rentals', 'Km driven', 'Days rented', 'Money collected', 'Maintenance cost', 'Damage records'],
        array_map(fn($o) => [$o['v']['reg_no'], $o['v']['name'], $o['rentals'], $kmV[$o['v']['id']] ?? 0, $o['days'], $money ? money_plain($o['cash']) : '', money_plain($o['maint']), $dmgV[$o['v']['id']] ?? 0], array_values($vr)), $ex);
    if ($ex && $what === 'customers') export_table("customer-wise-$label", ['Customer', 'Phone', 'Rentals', 'Completed', 'Total paid', 'Remaining due', 'Damage records'],
        array_map(fn($id, $c) => [$c['name'], $c['phone'], $c['rentals'], $c['completed'], $money ? money_plain($c['paid']) : '', $money ? money_plain($c['due']) : '', $dmgC[$id] ?? 0], array_keys($cr), $cr), $ex);
    if ($ex && $what === 'damage') export_table("damage-history-$label", ['Date', 'Car', 'Customer', 'Rental', 'Description', 'Estimate', 'Decision', 'Charged', 'Repaired on', 'Repair cost'],
        array_map(fn($x) => [substr($x['created_at'], 0, 10), $x['reg_no'], $x['customer_name'], $x['code'], $x['description'], money_plain($x['estimate_cost']), DAMAGE_STATUS_LABEL[$x['status']] ?? $x['status'], money_plain($x['charge_amount']), $x['repaired_at'], money_plain($x['repair_cost'])], $damages), $ex);
    if ($ex && $what === 'maintenance') export_table("maintenance-expenses-$label", ['Date', 'Car', 'Work', 'Km', 'Cost', 'Description'],
        array_merge(array_map(fn($m) => [$m['service_date'], $m['reg_no'], MAINT_KINDS[$m['kind']][0] ?? $m['kind'], $m['odometer'], money_plain($m['cost']), $m['description']], $maint), array_map(fn($r) => [$r['service_date'], $r['reg_no'], 'Damage repair', '', money_plain($r['cost']), $r['description']], $repairs)), $ex);

    $q = array_diff_key($_GET, ['p' => 1, 'export' => 1, 'what' => 1]);
    $exp = fn($w) => '<div class="row">' . btn('Excel', url('reports', $q + ['export' => 'xls', 'what' => $w]), 'ghost small') . btn('CSV', url('reports', $q + ['export' => 'csv', 'what' => $w]), 'ghost small') . '</div>';
    $sec = fn($title, $w) => '<div class="row between"><h2>' . e($title) . '</h2>' . $exp($w) . '</div>';
    $h = page_head('Reports', e($dr['label'])) . range_filter('reports', $dr);
    $cnt = fn($fn) => count(array_filter($bk, $fn));
    $h .= '<div class="stats">' . tile('Total rentals', count($bk)) . tile('Active rentals', $cnt(fn($b) => $b['status'] === 'active'), url('rentals')) . tile('Completed rentals', $cnt(fn($b) => $b['status'] === 'completed'))
        . ($money ? tile('Money collected', money($d['cash']), null, 'good', 'rent, minus refunds') . tile('Outstanding today', money($outstanding), url('money_due'), $outstanding ? 'warn' : '') : '') . tile('Maintenance expenses', money($maintTotal)) . '</div>';
    if ($money) {
        $h .= $sec('Money collected by month', 'monthly') . '<div class="card flush">' . table(['Month', 'Rent collected', 'Security deposits received', 'Security deposits returned'],
            array_map(fn($m, $r) => tr([e(date('F Y', strtotime("$m-01"))), '<b>' . money($r['rent']) . '</b>', money($r['dep_in']), money($r['dep_out'])]), array_keys($monthly), $monthly), 'No payments in this period.') . '</div><p class="muted small">Security deposits are refundable and never counted as rent collected. <a href="' . e(url('payments', ['range' => $dr['range'], 'from' => $dr['from'], 'to' => $dr['to']])) . '">See every payment</a></p>';
    }
    $h .= $sec('Car-wise', 'vehicles') . '<div class="card flush">' . table(array_merge(['Car', 'Rentals', 'Km driven', 'Days rented'], $money ? ['Money collected'] : [], ['Maintenance', 'Damage']),
        array_map(fn($o) => tr(array_merge(['<b>' . e($o['v']['reg_no']) . '</b><small>' . e($o['v']['name']) . '</small>', $o['rentals'], number_format($kmV[$o['v']['id']] ?? 0), $o['days']], $money ? [money($o['cash'])] : [], [money($o['maint']), ($dmgV[$o['v']['id']] ?? 0) ? badge($dmgV[$o['v']['id']], 'red') : '0']), url('vehicle', ['id' => $o['v']['id'], 'tab' => 'history'])), array_values($vr)), 'No cars yet.') . '</div>';
    $h .= $sec('Customer-wise', 'customers') . '<div class="card flush">' . table(array_merge(['Customer', 'Rentals', 'Completed'], $money ? ['Total paid', 'Remaining due'] : [], ['Damage']),
        array_map(fn($id, $c) => tr(array_merge(['<b>' . e($c['name']) . '</b><small>' . e($c['phone']) . '</small>', $c['rentals'], $c['completed']], $money ? [money($c['paid']), $c['due'] ? '<b class="red">' . money($c['due']) . '</b>' : badge('Paid', 'green')] : [], [($dmgC[$id] ?? 0) ?: '0']), url('customer', ['id' => $id])), array_keys($cr), $cr), 'No rentals in this period.') . '</div>';
    $h .= $sec('Damage history', 'damage') . '<div class="card">' . damage_list(array_slice($damages, 0, 50), 'report') . '</div>';
    $h .= $sec('Maintenance expenses', 'maintenance') . '<div class="card flush">' . maint_report_table($maint, $repairs) . '</div>';
    $h .= $sec('All rentals', 'rentals') . '<p class="muted small">Download every rental in this period with its money details.</p>';
    $h .= '<p class="small"><a href="' . e(url('expenses')) . '">Other expenses (fuel, parking, etc.)</a></p>';
    render_page('Reports', $h, 'reports');
}
function maint_report_table($maint, $repairs) {
    $trs = array_map(fn($m) => tr([e(fmt_d($m['service_date'])), '<b>' . e($m['reg_no']) . '</b>', e(MAINT_KINDS[$m['kind']][0] ?? $m['kind']), money($m['cost']), e($m['description'] ?: '')]), $maint);
    foreach ($repairs as $r) $trs[] = tr([e(fmt_d($r['service_date'])), '<b>' . e($r['reg_no']) . '</b>', 'Damage repair', money($r['cost']), e($r['description'])]);
    return table(['Date', 'Car', 'Work', 'Cost', 'Description'], $trs, 'No maintenance expenses in this period.');
}

function page_export() {
    $what = get('what'); $fmt = in_array(get('format'), ['csv', 'xls', 'print'], true) ? get('format') : 'csv';
    if ($what === 'bookings') {
        require_perm('reports');
        $list = bookings_where('1=1', [], 'b.start_at DESC');
        export_table('all-bookings-' . today(), ['Booking', 'Status', 'Customer', 'Phone', 'Vehicle', 'Pickup', 'Return', 'Handed over', 'Returned', 'Agreed rent (₹)', 'Charges (₹)', 'Discount (₹)', 'Total (₹)', 'Rent paid (₹)', 'Balance (₹)', 'Deposit held (₹)', 'Due date', 'Payment status'],
            array_map(fn($b) => [$b['code'], BOOKING_STATUS_LABEL[$b['view_status']], $b['customer_name'], $b['customer_phone'], $b['reg_no'], $b['start_at'], $b['end_at'], $b['actual_start'], $b['actual_end'], money_plain($b['agreed_amount']), money_plain($b['charges_total']), money_plain($b['discount']), money_plain($b['total']), money_plain($b['paid']), money_plain($b['balance']), money_plain($b['deposit_held']), $b['due_date'], PAY_STATUS_LABEL[$b['pay_status']]], $list), $fmt);
    }
    if ($what === 'vehicles') {
        require_perm('fleet');
        $map = fleet_status_map(); $comp = fleet_compliance();
        export_table('vehicles-' . today(), ['Registration', 'Name', 'Category', 'Year', 'Fuel', 'Gearbox', 'Seats', 'Odometer', 'Status', 'Documents', 'Service', 'Daily rate (₹)', 'Archived'],
            array_map(fn($v) => [$v['reg_no'], $v['name'], $v['category'], $v['year'], $v['fuel'], $v['transmission'], $v['seats'], $v['odometer'], VEHICLE_STATUS_LABEL[$map[$v['id']]['status']], isset($comp[$v['id']]) ? COMPLIANCE_LABEL[$comp[$v['id']]['overall']] : '', SERVICE_STATE_LABEL[service_info($v)['state']], can('payments') ? money_plain($v['daily_rate']) : '', $v['archived'] ? 'Yes' : ''], rows('SELECT * FROM vehicles ORDER BY reg_no')), $fmt);
    }
    redirect('reports');
}
