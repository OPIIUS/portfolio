<?php
defined('APP') or exit;

/* ---------- exports: Excel (.xlsx), CSV, and a print view for PDF ---------- */
function export_table($name, array $headers, array $data, $format) {
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
    $dr = date_range('month');
    $vid = (int)get('vehicle_id'); $cid = (int)get('customer_id');
    $d = report_data($dr['from'], $dr['to'], $vid, $cid);
    $vr = vehicle_report($dr['from'], $dr['to']);
    if ($vid) $vr = array_intersect_key($vr, [$vid => 1]);
    uasort($vr, fn($a, $b) => $b['net'] <=> $a['net']);
    $cr = rows("SELECT c.id, c.name, c.phone, COUNT(b.id) AS n FROM customers c JOIN bookings b ON b.customer_id = c.id AND b.status IN ('active', 'completed') AND COALESCE(b.actual_start, b.start_at) BETWEEN ? AND ? GROUP BY c.id, c.name, c.phone ORDER BY n DESC LIMIT 50", [$dr['from'] . ' 00:00:00', $dr['to'] . ' 23:59:59']);
    $paidBy = []; foreach (rows("SELECT customer_id, SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) AS a FROM payments WHERE voided = 0 AND kind IN ('rental', 'refund') AND paid_at BETWEEN ? AND ? GROUP BY customer_id", [$dr['from'] . ' 00:00:00', $dr['to'] . ' 23:59:59']) as $r) $paidBy[$r['customer_id']] = (int)$r['a'];

    $ex = get('export'); $what = get('what');
    if ($ex && $what === 'vehicles') export_table("vehicle-performance-{$dr['from']}-to-{$dr['to']}", ['Vehicle', 'Name', 'Rentals', 'Days rented', 'Utilisation %', 'Rent collected (₹)', 'Maintenance (₹)', 'All expenses (₹)', 'Net (₹)'],
        array_map(fn($o) => [$o['v']['reg_no'], $o['v']['name'], $o['rentals'], $o['days'], $o['util'], money_plain($o['cash']), money_plain($o['maint']), money_plain($o['exp']), money_plain($o['net'])], array_values($vr)), $ex);
    if ($ex && $what === 'summary') export_table("business-summary-{$dr['from']}-to-{$dr['to']}", ['Measure', 'Amount (₹)', 'Meaning'], [
        ['Rent billed', money_plain($d['billed']), "Total of {$d['completed']} rentals completed in the period"], ['Rent collected (cash)', money_plain($d['cash']), 'Rent received minus refunds, in the period'],
        ['Expenses', money_plain($d['expenses']), 'All recorded expenses in the period'], ['Profit (cash basis)', money_plain($d['profit']), 'Rent collected minus expenses'],
        ['Deposits received', money_plain($d['dep_in']), 'Refundable, not income'], ['Deposits returned', money_plain($d['dep_out']), ''],
        ['Receivables today', money_plain($d['receivable']), 'Money customers still owe'], ['Deposits held today', money_plain($d['deposits_held']), 'Refundable, not income']], $ex);
    if ($ex && $what === 'customers') export_table("customers-{$dr['from']}-to-{$dr['to']}", ['Customer', 'Phone', 'Rentals', 'Rent paid (₹)'], array_map(fn($c) => [$c['name'], $c['phone'], $c['n'], money_plain($paidBy[$c['id']] ?? 0)], $cr), $ex);

    $q = array_diff_key($_GET, ['p' => 1, 'export' => 1, 'what' => 1]);
    $exp = fn($what) => '<div class="row">' . btn('Excel', url('reports', $q + ['export' => 'xls', 'what' => $what]), 'ghost small') . btn('CSV', url('reports', $q + ['export' => 'csv', 'what' => $what]), 'ghost small') . btn('PDF', url('reports', $q + ['export' => 'print', 'what' => $what]), 'ghost small') . '</div>';
    $h = page_head('Reports', e($dr['label']));
    $h .= range_filter('reports', $dr, sel('vehicle_id', ['' => 'All vehicles'] + vehicle_options(true), $vid ?: '') . sel('customer_id', ['' => 'All customers'] + array_column(rows('SELECT id, name FROM customers ORDER BY name'), 'name', 'id'), $cid ?: ''));
    $h .= '<div class="row between"><h2>Money</h2>' . $exp('summary') . '</div><div class="stats">'
        . tile('Rent collected', money($d['cash']), null, 'good', 'cash in, minus refunds') . tile('Rent billed', money($d['billed']), null, '', $d['completed'] . ' rental(s) completed')
        . tile('Expenses', money($d['expenses']), null, '', $cid ? 'not shown per customer' : '') . tile('Profit (cash basis)', money($d['profit']), null, $d['profit'] < 0 ? 'bad' : 'good', 'collected minus expenses') . '</div>'
        . '<div class="stats">' . tile('Receivables today', money($d['receivable']), url('outstanding'), $d['receivable'] ? 'warn' : '', 'still owed by customers') . tile('Deposits held today', money($d['deposits_held']), null, '', 'refundable, not income')
        . tile('Deposits received', money($d['dep_in']), null, '', 'in this period') . tile('Deposits returned', money($d['dep_out']), null, '', 'in this period') . '</div>';
    $h .= '<p class="muted small">Rent billed counts rentals finished in the period. Rent collected counts money actually received in the period. Security deposits are never counted as income.</p>';

    // monthly trend
    $months = []; for ($i = 5; $i >= 0; $i--) $months[] = date('Y-m', strtotime(substr(today(), 0, 7) . "-01 -$i month"));
    $trend = [];
    foreach ($months as $m) { $md = report_data($m . '-01', date('Y-m-t', strtotime($m . '-01')), $vid, $cid); $trend[$m] = [$md['cash'], $md['expenses']]; }
    $max = max(1, ...array_values(array_map(fn($x) => max($x), $trend)));
    $h .= '<div class="card"><h3>Last 6 months: rent collected vs expenses</h3><div class="trend">';
    foreach ($trend as $m => [$in, $out]) $h .= '<div class="tcol"><div class="tbars"><i class="in" style="--h:' . round($in / $max * 100, 1) . '%" title="' . e(money($in)) . '"></i><i class="out" style="--h:' . round($out / $max * 100, 1) . '%" title="' . e(money($out)) . '"></i></div><span>' . date('M', strtotime($m . '-01')) . '</span><small>' . money($in - $out) . '</small></div>';
    $h .= '</div><p class="legend"><i class="in"></i> Rent collected <i class="out"></i> Expenses · the number under each month is the difference</p></div>';

    $trs = [];
    foreach ($vr as $o) $trs[] = tr(['<b>' . e($o['v']['reg_no']) . '</b><small>' . e($o['v']['name']) . '</small>', $o['rentals'], $o['days'], '<div class="util"><i style="--w:' . min(100, $o['util']) . '%"></i><span>' . $o['util'] . '%</span></div>', money($o['cash']), money($o['maint']), money($o['exp']), '<b class="' . ($o['net'] < 0 ? 'red' : '') . '">' . money($o['net']) . '</b>'], url('vehicle', ['id' => $o['v']['id']]));
    $h .= '<div class="row between"><h2>Vehicle performance</h2>' . $exp('vehicles') . '</div><div class="card flush">' . table(['Vehicle', 'Rentals', 'Days out', 'Utilisation', 'Rent collected', 'Maintenance', 'All expenses', 'Net'], $trs, 'No vehicles yet.') . '</div>';
    $h .= '<p class="muted small">Sorted best to worst by net (rent collected minus that vehicle\'s expenses). Utilisation = time rented ÷ time in the period.</p>';

    $trs = array_map(fn($c) => tr(['<b>' . e($c['name']) . '</b><small>' . e($c['phone']) . '</small>', $c['n'], money($paidBy[$c['id']] ?? 0)], url('customer', ['id' => $c['id']])), $cr);
    $h .= '<div class="row between"><h2>Customers in this period</h2>' . $exp('customers') . '</div><div class="card flush">' . table(['Customer', 'Rentals', 'Rent paid'], $trs, 'No rentals in this period.') . '</div>';

    $byCat = []; foreach ($d['exps'] as $x) $byCat[$x['category']] = ($byCat[$x['category']] ?? 0) + (int)$x['amount']; arsort($byCat);
    if ($byCat) { $h .= '<div class="card"><h3>Expenses by category</h3><div class="bars">'; foreach ($byCat as $k => $a) $h .= '<div class="bar"><span>' . e(EXPENSE_CATEGORIES[$k] ?? $k) . '</span><i style="--w:' . round($a / max(1, $d['expenses']) * 100, 1) . '%"></i><b>' . money($a) . '</b></div>'; $h .= '</div></div>'; }
    $h .= '<div class="card"><h3>Full data exports</h3><p class="muted small">Every booking, every payment, every expense: open in Excel.</p><div class="row">' . btn('All bookings (Excel)', url('export', ['what' => 'bookings', 'format' => 'xls'])) . btn('Payments (Excel)', url('payments', ['range' => 'all', 'export' => 'xls'])) . btn('Expenses (Excel)', url('expenses', ['range' => 'all', 'export' => 'xls'])) . btn('Vehicles (Excel)', url('export', ['what' => 'vehicles', 'format' => 'xls'])) . '</div></div>';
    render_page('Reports', $h, 'reports');
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
