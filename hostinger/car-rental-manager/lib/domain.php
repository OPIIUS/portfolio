<?php
/* Business rules for the rental business. Everything that decides a status, an amount or an alert lives here. */
defined('APP') or exit;

const FUELS = ['Petrol', 'Diesel', 'CNG', 'Petrol + CNG', 'Electric', 'Hybrid'];
const TRANSMISSIONS = ['Manual', 'Automatic'];
const PAY_METHODS = ['Cash', 'UPI', 'Bank transfer', 'Card', 'Cheque', 'Deposit adjustment', 'Other'];
const EXPENSE_CATEGORIES = [
    'servicing' => 'Vehicle servicing', 'fuel' => 'Fuel', 'insurance' => 'Insurance', 'puc' => 'PUC', 'repairs' => 'Repairs',
    'tyres' => 'Tyres', 'battery' => 'Battery', 'cleaning' => 'Cleaning', 'parking' => 'Parking', 'tolls' => 'Tolls',
    'fines' => 'Fines and challans', 'driver' => 'Driver payments', 'purchase' => 'Vehicle purchase', 'other' => 'Other',
];
const MAINT_KINDS = [
    'general_service' => ['General service', 'servicing'], 'oil_change' => ['Engine oil change', 'servicing'],
    'brakes' => ['Brake service', 'servicing'], 'tyres' => ['Tyre replacement', 'tyres'], 'battery' => ['Battery replacement', 'battery'],
    'repair' => ['Repair', 'repairs'], 'breakdown' => ['Breakdown', 'repairs'], 'accident' => ['Accident damage', 'repairs'],
    'other' => ['Other work', 'other'],
];
const FUEL_LEVELS = ['Empty', '1/4', '1/2', '3/4', 'Full'];
const CHECK_ITEMS = ['Exterior body', 'Windscreen and glass', 'Lights and indicators', 'Tyres and spare wheel', 'Interior and seats',
    'AC working', 'Music system', 'Jack and tools', 'RC, insurance and PUC copies in car', 'Keys and remote'];
const ID_TYPES = ['Aadhaar', 'Voter ID', 'Passport', 'PAN', 'Driving licence', 'Other'];

function categories() { return array_values(array_filter(array_map('trim', explode("\n", setting('categories', ''))))); }

/* ---------------- numbering ---------------- */
function next_code($table, $col, $prefix) {
    $year = date('y', strtotime(now()));
    $base = $prefix . $year . '-';
    $last = val("SELECT $col FROM $table WHERE $col LIKE ? ORDER BY id DESC LIMIT 1", [$base . '%']);
    $n = $last ? ((int)substr($last, strlen($base))) + 1 : 1;
    return $base . str_pad((string)$n, 4, '0', STR_PAD_LEFT);
}

/* ---------------- bookings and money ---------------- */
/* All bookings with their money worked out in SQL, so lists and reports agree. */
function booking_sql($where = '1=1') {
    return "SELECT b.*, c.name AS customer_name, c.phone AS customer_phone, v.reg_no, v.name AS vehicle_name,
        COALESCE((SELECT SUM(amount) FROM booking_charges WHERE booking_id = b.id AND voided = 0), 0) AS charges_total,
        COALESCE((SELECT SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) FROM payments WHERE booking_id = b.id AND kind IN ('rental', 'refund') AND voided = 0), 0) AS paid,
        COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = b.id AND kind = 'deposit' AND voided = 0), 0) AS deposit_in,
        COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = b.id AND kind = 'deposit_out' AND voided = 0), 0) AS deposit_out,
        COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = b.id AND kind = 'rental' AND is_advance = 1 AND voided = 0), 0) AS advance_paid,
        (SELECT COUNT(*) FROM booking_extensions WHERE booking_id = b.id) AS ext_count
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN vehicles v ON v.id = b.vehicle_id
        WHERE $where";
}
function booking_money(array $b) {
    // MySQL returns SUM() as text; make every amount a whole number of paise.
    foreach (['charges_total', 'paid', 'deposit_in', 'deposit_out', 'agreed_amount', 'discount', 'deposit_amount', 'advance_paid', 'ext_count'] as $k) $b[$k] = (int)($b[$k] ?? 0);
    // A cancelled booking only owes the charges added to it (for example a cancellation fee).
    $total = $b['status'] === 'cancelled' ? (int)$b['charges_total'] : (int)$b['agreed_amount'] + (int)$b['charges_total'] - (int)$b['discount'];
    $b['total'] = max(0, $total);
    $b['balance'] = $b['total'] - (int)$b['paid'];
    $b['deposit_held'] = (int)$b['deposit_in'] - (int)$b['deposit_out'];
    $b['pay_status'] = payment_status($b);
    $b['overdue_days'] = ($b['balance'] > 0 && $b['due_date'] && $b['due_date'] < today() && $b['status'] !== 'cancelled') ? days_between($b['due_date'], today()) : 0;
    $b['view_status'] = booking_view_status($b);
    return $b;
}
function bookings_where($where = '1=1', $params = [], $order = 'b.start_at DESC') {
    return array_map('booking_money', rows(booking_sql($where) . " ORDER BY $order", $params));
}
function booking_get($id) { $r = rows(booking_sql('b.id = ?'), [$id]); return $r ? booking_money($r[0]) : null; }

function payment_status(array $b) {
    if ($b['balance'] < 0) return 'refund';
    if ($b['status'] === 'cancelled' && (int)$b['paid'] === 0) return 'none';
    if ($b['total'] <= 0) return 'paid';
    if ($b['balance'] <= 0) return 'paid';
    if ($b['due_date'] && $b['due_date'] < today()) return 'overdue';
    return (int)$b['paid'] > 0 ? 'partial' : 'unpaid';
}
const PAY_STATUS_LABEL = ['refund' => 'Refund due', 'paid' => 'Paid', 'partial' => 'Partially paid', 'unpaid' => 'Unpaid', 'overdue' => 'Overdue', 'none' => '—'];

function booking_view_status(array $b) {
    switch ($b['status']) {
        case 'inquiry': case 'confirmed': return 'upcoming';
        case 'active':
            if (ts($b['end_at']) < ts(now())) return 'overdue';
            return (int)($b['ext_count'] ?? 0) > 0 ? 'extended' : 'active';
        default: return $b['status'];
    }
}
const BOOKING_STATUS_LABEL = [
    'upcoming' => 'Upcoming', 'active' => 'Active', 'extended' => 'Active · extended', 'overdue' => 'Overdue', 'completed' => 'Completed', 'cancelled' => 'Cancelled',
];

/* Rental days, counted in started 24-hour blocks. */
function rental_days($start, $end) {
    $h = (ts($end) - ts($start)) / 3600;
    return max(1, (int)ceil(round($h, 4) / 24));
}
function suggested_amount(array $vehicle, $start, $end, $rateType = 'daily') {
    if ($rateType === 'monthly' && (int)$vehicle['monthly_rate'] > 0) {
        $months = max(1, (int)ceil(rental_days($start, $end) / 30));
        return $months * (int)$vehicle['monthly_rate'];
    }
    return rental_days($start, $end) * (int)$vehicle['daily_rate'];
}

/* When does this booking really free the vehicle? An overdue rental keeps it until now. */
function booking_effective_end(array $b) {
    if ($b['actual_end']) return $b['actual_end'];
    if ($b['status'] === 'active' && ts($b['end_at']) < ts(now())) return now();
    return $b['end_at'];
}
/* Other confirmed/active bookings of the same vehicle that overlap [start, end). */
function booking_conflicts($vehicleId, $start, $end, $excludeId = 0) {
    if (!$vehicleId) return [];
    $c = rows("SELECT b.*, c.name AS customer_name FROM bookings b LEFT JOIN customers c ON c.id = b.customer_id
        WHERE b.vehicle_id = ? AND b.id <> ? AND b.status IN ('confirmed', 'active')", [$vehicleId, (int)$excludeId]);
    return array_values(array_filter($c, fn($b) => ts($b['start_at']) < ts($end) && ts(booking_effective_end($b)) > ts($start)));
}

/* ---------------- vehicles ---------------- */
const VEHICLE_STATUS_LABEL = [
    'available' => 'Available', 'rented' => 'Currently rented', 'booked' => 'Reserved', 'maintenance' => 'Under maintenance', 'unavailable' => 'Unavailable',
];
/* Status of every vehicle right now, plus the booking that causes it. */
function fleet_status_map() {
    $active = []; $next = [];
    foreach (bookings_where("b.status = 'active'") as $b) $active[$b['vehicle_id']] = $b;
    foreach (bookings_where("b.status = 'confirmed' AND b.vehicle_id IS NOT NULL AND b.end_at >= ?", [now()], 'b.start_at ASC') as $b)
        if (!isset($next[$b['vehicle_id']])) $next[$b['vehicle_id']] = $b;
    $map = [];
    foreach (rows('SELECT id, status_override FROM vehicles') as $v) {
        $id = $v['id']; $a = $active[$id] ?? null; $n = $next[$id] ?? null;
        // A car out with a customer is always "Currently rented", even if it is also marked for maintenance.
        if ($a) $s = 'rented';
        elseif ($v['status_override'] === 'maintenance') $s = 'maintenance';
        elseif ($v['status_override'] === 'unavailable') $s = 'unavailable';
        elseif ($n && ts($n['start_at']) <= ts(now()) + 86400) $s = 'booked';
        else $s = 'available';
        $map[$id] = ['status' => $s, 'active' => $a, 'next' => $n, 'late' => $a && $a['view_status'] === 'overdue'];
    }
    return $map;
}

/* ---------------- servicing ---------------- */
function service_info(array $v) {
    $km = (int)($v['service_interval_km'] ?: setting('default_service_km', 10000));
    $days = (int)($v['service_interval_days'] ?: setting('default_service_days', 180));
    $lastKm = $v['last_service_km'] !== null && $v['last_service_km'] !== '' ? (int)$v['last_service_km'] : null;
    $lastDate = $v['last_service_date'] ?: null;
    // The owner's own "next service" entry wins; otherwise last service + the usual interval.
    $nextKm = ($v['next_service_km'] ?? '') !== '' && $v['next_service_km'] !== null ? (int)$v['next_service_km'] : ($lastKm !== null && $km > 0 ? $lastKm + $km : null);
    $nextDate = !empty($v['next_service_date']) ? $v['next_service_date'] : ($lastDate && $days > 0 ? date('Y-m-d', strtotime($lastDate . " +$days days")) : null);
    $odo = (int)$v['odometer'];
    $kmLeft = $nextKm !== null ? $nextKm - $odo : null;
    $daysLeft = $nextDate ? days_between(today(), $nextDate) : null;
    $warnKm = (int)setting('service_km_warning', 500); $warnDays = (int)setting('service_days_warning', 15);
    if ($nextKm === null && !$nextDate) $state = 'unknown';
    elseif (($kmLeft !== null && $kmLeft <= 0) || ($daysLeft !== null && $daysLeft <= 0)) $state = 'overdue';
    elseif (($kmLeft !== null && $kmLeft <= $warnKm) || ($daysLeft !== null && $daysLeft <= $warnDays)) $state = 'due';
    else $state = 'ok';
    return compact('km', 'days', 'lastKm', 'lastDate', 'nextKm', 'nextDate', 'kmLeft', 'daysLeft', 'state');
}
const SERVICE_STATE_LABEL = ['ok' => 'Up to date', 'due' => 'Service soon', 'overdue' => 'Service overdue', 'unknown' => 'Not set'];

/* ---------------- documents ---------------- */
function doc_types($activeOnly = true) { return rows('SELECT * FROM doc_types' . ($activeOnly ? ' WHERE active = 1' : '') . ' ORDER BY sort, id'); }
function doc_required(array $type, $category) {
    $r = trim((string)$type['required_for']);
    if ($r === 'all') return true;
    if ($r === '') return false;
    return in_array(mb_strtolower(trim($category)), array_map(fn($x) => mb_strtolower(trim($x)), explode('|', $r)), true);
}
function doc_state($doc, $hasExpiry = true) {
    if (!$doc) return 'missing';
    if (!$hasExpiry || !$doc['expiry_date']) return 'valid';
    $left = days_between(today(), $doc['expiry_date']);
    if ($left < 0) return 'expired';
    if ($left <= max(reminder_days())) return 'expiring';
    return 'valid';
}
const DOC_STATE_LABEL = ['valid' => 'Valid', 'expiring' => 'Expiring soon', 'expired' => 'Expired', 'missing' => 'Missing'];

/* Current document of each type for a vehicle, and whether the vehicle is compliant. */
function vehicle_compliance(array $v, $types = null, $docs = null) {
    $types = $types ?? doc_types();
    if ($docs === null) $docs = rows('SELECT * FROM vehicle_documents WHERE vehicle_id = ? AND replaced = 0 ORDER BY expiry_date DESC, id DESC', [$v['id']]);
    $current = [];
    foreach ($docs as $d) if ((int)$d['vehicle_id'] === (int)$v['id'] && !isset($current[$d['doc_type_id']])) $current[$d['doc_type_id']] = $d;
    $items = []; $overall = 'ok';
    foreach ($types as $t) {
        $req = doc_required($t, $v['category']);
        $doc = $current[$t['id']] ?? null;
        if (!$req && !$doc) continue;
        $state = doc_state($doc, (bool)$t['has_expiry']);
        $items[] = ['type' => $t, 'doc' => $doc, 'required' => $req, 'state' => $state,
            'days_left' => $doc && $doc['expiry_date'] ? days_between(today(), $doc['expiry_date']) : null];
        if ($req && in_array($state, ['expired', 'missing'], true)) $overall = 'blocked';
        elseif ($overall === 'ok' && $state === 'expiring') $overall = 'warning';
        elseif ($overall === 'ok' && !$req && $state === 'expired') $overall = 'warning';
    }
    return ['items' => $items, 'overall' => $overall];
}
function fleet_compliance() {
    $types = doc_types();
    $docs = rows('SELECT * FROM vehicle_documents WHERE replaced = 0 ORDER BY expiry_date DESC, id DESC');
    $out = [];
    foreach (rows('SELECT * FROM vehicles WHERE archived = 0 ORDER BY reg_no') as $v) $out[$v['id']] = ['vehicle' => $v] + vehicle_compliance($v, $types, $docs);
    return $out;
}
const COMPLIANCE_LABEL = ['ok' => 'Up to date', 'warning' => 'Expiring soon', 'blocked' => 'Expired or missing'];

/* ---------------- file uploads ---------------- */
const UPLOAD_TYPES = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'pdf' => 'application/pdf'];
function handle_upload($field, $entity, $entityId, $imagesOnly = false) {
    if (empty($_FILES[$field]) || ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    $f = $_FILES[$field];
    if ($f['error'] !== UPLOAD_ERR_OK) throw new UserError('The file could not be uploaded (it may be too large; the limit is 8 MB).');
    if ($f['size'] > 8 * 1024 * 1024) throw new UserError('The file is larger than 8 MB.');
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    $allowed = $imagesOnly ? array_diff_key(UPLOAD_TYPES, ['pdf' => 1]) : UPLOAD_TYPES;
    if (!isset($allowed[$ext])) throw new UserError('Only ' . strtoupper(implode(', ', array_keys($allowed))) . ' files can be uploaded.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if ($mime !== $allowed[$ext]) throw new UserError('That file does not look like a real ' . strtoupper($ext) . ' file.');
    $dir = date('Y/m', strtotime(now()));
    if (!is_dir(STORAGE . "/uploads/$dir")) mkdir(STORAGE . "/uploads/$dir", 0750, true);
    $stored = $dir . '/' . bin2hex(random_bytes(16)) . '.' . $ext;
    $ok = is_uploaded_file($f['tmp_name']) ? move_uploaded_file($f['tmp_name'], STORAGE . "/uploads/$stored") : (PHP_SAPI === 'cli' && copy($f['tmp_name'], STORAGE . "/uploads/$stored"));
    if (!$ok) throw new UserError('The file could not be saved. Check that the storage folder is writable.');
    $id = insert('files', ['entity' => $entity, 'entity_id' => $entityId, 'orig_name' => mb_substr(basename($f['name']), 0, 200), 'stored_name' => $stored,
        'mime' => $mime, 'size' => (int)$f['size'], 'uploaded_by' => current_user()['id'] ?? null, 'created_at' => now()]);
    audit('upload', $entity, $entityId, ['file' => $id, 'name' => $f['name']]);
    return $id;
}
function file_perm($entity) {
    return match ($entity) {
        'customer_id' => 'customer_sensitive', 'vehicle_doc' => 'maintenance', 'expense' => 'reports', 'payment' => 'payments',
        'maintenance' => 'maintenance', default => 'fleet',
    };
}
class UserError extends RuntimeException {}

/* ---------------- payments ---------------- */
function record_payment(array $b, $kind, $amount, $method, $reference, $paidAt, $note, $isAdvance = false) {
    if (!in_array($kind, ['rental', 'deposit', 'deposit_out', 'refund'], true)) throw new UserError('Unknown payment type.');
    if ($amount <= 0) throw new UserError('Enter an amount greater than zero.');
    if (!in_array($method, PAY_METHODS, true)) throw new UserError('Choose how the money was paid.');
    if ($b['status'] === 'cancelled' && $kind === 'rental') throw new UserError('This rental is cancelled. Record a refund or a cancellation charge instead.');
    if ($kind === 'rental' && $amount > $b['balance']) throw new UserError('That is more than the balance of ' . money($b['balance']) . '. Add the extra charge first, or enter the correct amount.');
    if ($kind === 'refund' && $amount > (int)$b['paid']) throw new UserError('You can refund at most the rent received: ' . money($b['paid']) . '.');
    if ($kind === 'deposit_out' && $amount > $b['deposit_held']) throw new UserError('Only ' . money($b['deposit_held']) . ' of security deposit is held for this rental.');
    if ($method === 'Deposit adjustment' && $kind !== 'rental') throw new UserError('Deposit adjustment is only for paying rent from the deposit.');
    return tx(function () use ($b, $kind, $amount, $method, $reference, $paidAt, $note, $isAdvance) {
        $common = ['booking_id' => $b['id'], 'customer_id' => $b['customer_id'], 'method' => $method, 'reference' => mb_substr($reference, 0, 120),
            'paid_at' => $paidAt, 'note' => $note, 'created_by' => current_user()['id'] ?? null, 'created_at' => now()];
        if ($method === 'Deposit adjustment') {
            if ($amount > $b['deposit_held']) throw new UserError('Only ' . money($b['deposit_held']) . ' of security deposit is held for this rental.');
            // Moving deposit to rent: deposit goes out, rent comes in. Both stay on record.
            insert('payments', $common + ['receipt_no' => next_code('payments', 'receipt_no', 'RC'), 'kind' => 'deposit_out', 'amount' => $amount, 'note' => 'Deposit used to pay rent' . ($note ? ": $note" : '')]);
        }
        $id = insert('payments', $common + ['receipt_no' => next_code('payments', 'receipt_no', 'RC'), 'kind' => $kind, 'amount' => $amount, 'is_advance' => $isAdvance && $kind === 'rental' ? 1 : 0]);
        audit('payment', 'booking', $b['id'], ['payment' => $id, 'kind' => $kind, 'amount' => $amount, 'method' => $method]);
        return $id;
    });
}
const PAY_KIND_LABEL = ['rental' => 'Rent payment', 'deposit' => 'Security deposit received', 'deposit_out' => 'Security deposit returned', 'refund' => 'Rent refunded'];

/* ---------------- notifications ---------------- */
function notify($key, $type, $severity, $title, $message, $link, $perm = null) {
    if (val('SELECT id FROM notifications WHERE dedupe_key = ?', [$key])) return false;
    insert('notifications', ['dedupe_key' => mb_substr($key, 0, 150), 'type' => $type, 'severity' => $severity, 'title' => mb_substr($title, 0, 250),
        'message' => $message, 'link' => $link, 'perm' => $perm, 'created_at' => now()]);
    return true;
}
const CHECKED_TYPES = ['pay_due', 'pay_overdue', 'return_soon', 'return_overdue', 'doc_expiring', 'doc_expired', 'doc_missing', 'service_due', 'service_overdue', 'booking_risk', 'damage_review'];

/* Look at the whole business and raise alerts. Safe to run as often as you like: each event alerts once, and alerts clear themselves when fixed. */
function run_checks() {
    $live = [];
    $add = function ($key, ...$args) use (&$live) { $live[$key] = true; notify($key, ...$args); };
    $n = ts(now());

    foreach (bookings_where("b.status IN ('confirmed', 'active', 'completed')") as $b) {
        $who = $b['customer_name'] . ($b['reg_no'] ? ' · ' . $b['reg_no'] : '');
        $link = url('booking', ['id' => $b['id']]);
        if ($b['balance'] > 0 && $b['due_date']) {
            $left = days_between(today(), $b['due_date']);
            if ($left < 0) $add("pay_overdue:{$b['id']}:{$b['due_date']}", 'pay_overdue', 'high', 'Payment overdue: ' . money($b['balance']) . " from {$b['customer_name']}", "Rental {$b['code']} ($who). Was due " . fmt_d($b['due_date']) . '.', $link, 'payments');
            elseif ($left <= (int)setting('payment_alert_days', 1)) $add("pay_due:{$b['id']}:{$b['due_date']}", 'pay_due', 'medium', 'Payment due ' . ($left === 0 ? 'today' : 'on ' . fmt_d($b['due_date'])) . ': ' . money($b['balance']), "Rental {$b['code']} ($who).", $link, 'payments');
        }
        if ($b['status'] === 'active') {
            $end = ts($b['end_at']);
            if ($end < $n) $add("return_overdue:{$b['id']}:{$b['end_at']}", 'return_overdue', 'high', "Not returned: {$b['reg_no']} with {$b['customer_name']}", 'Was due back ' . fmt_dt($b['end_at']) . ". Call {$b['customer_phone']}.", $link, 'bookings');
            elseif ($end - $n <= (int)setting('return_alert_hours', 24) * 3600) $add("return_soon:{$b['id']}:{$b['end_at']}", 'return_soon', 'low', "Returning soon: {$b['reg_no']}", "{$b['customer_name']} is due back " . fmt_dt($b['end_at']) . '.', $link, 'bookings');
        }
        if ($b['status'] === 'confirmed' && $b['vehicle_id'] && ts($b['start_at']) - $n <= 86400 && ts($b['end_at']) > $n) {
            foreach (booking_conflicts($b['vehicle_id'], $b['start_at'], $b['end_at'], $b['id']) as $c)
                $add("booking_risk:{$b['id']}:{$c['id']}", 'booking_risk', 'high', "Rental at risk: {$b['reg_no']} is still out", "{$b['customer_name']} picks it up " . fmt_dt($b['start_at']) . ", but {$c['customer_name']} has not returned it yet.", $link, 'bookings');
        }
    }

    $days = reminder_days();
    foreach (fleet_compliance() as $vid => $fc) {
        $v = $fc['vehicle']; $link = url('vehicle', ['id' => $vid, 'tab' => 'upkeep']);
        foreach ($fc['items'] as $it) {
            $name = $it['type']['name'];
            // A date not entered yet is shown on Maintenance & Documents, not raised as an alert.
            if ($it['state'] === 'missing' || $it['days_left'] === null) continue;
            if ($it['days_left'] < 0) { $add("doc_expired:{$it['doc']['id']}", 'doc_expired', 'high', "$name expired: {$v['reg_no']}", 'Expired on ' . fmt_d($it['doc']['expiry_date']) . '. Update the date here once it is renewed.', $link, 'maintenance'); continue; }
            $hit = null;
            foreach ($days as $d) if ($it['days_left'] <= $d) $hit = $d;   // smallest reminder point reached
            if ($hit !== null) $add("doc_expiring:{$it['doc']['id']}:$hit", 'doc_expiring', $it['days_left'] <= 7 ? 'high' : 'medium',
                "$name " . ($it['days_left'] === 0 ? 'expires today' : "expires in {$it['days_left']} day" . ($it['days_left'] === 1 ? '' : 's')) . ": {$v['reg_no']}", 'Expiry date ' . fmt_d($it['doc']['expiry_date']) . '.', $link, 'maintenance');
        }
    }

    foreach (rows('SELECT * FROM vehicles WHERE archived = 0') as $v) {
        $s = service_info($v); $link = url('vehicle', ['id' => $v['id'], 'tab' => 'upkeep']);
        $tag = "{$v['id']}:" . ($s['lastKm'] ?? 'x') . ':' . ($s['lastDate'] ?? 'x');
        $why = [];
        if ($s['kmLeft'] !== null) $why[] = $s['kmLeft'] <= 0 ? number_format(-$s['kmLeft']) . ' km past the service limit' : number_format($s['kmLeft']) . ' km left';
        if ($s['daysLeft'] !== null) $why[] = $s['daysLeft'] <= 0 ? 'service date passed ' . fmt_d($s['nextDate']) : $s['daysLeft'] . ' days left';
        if ($s['state'] === 'overdue') $add("service_overdue:$tag", 'service_overdue', 'high', "Service overdue: {$v['reg_no']}", ucfirst(implode(', ', $why)) . '.', $link, 'maintenance');
        elseif ($s['state'] === 'due') $add("service_due:$tag", 'service_due', 'medium', "Service soon: {$v['reg_no']}", ucfirst(implode(', ', $why)) . '.', $link, 'maintenance');
    }

    foreach (rows("SELECT d.*, v.reg_no FROM damages d JOIN vehicles v ON v.id = d.vehicle_id WHERE d.status = 'review'") as $d)
        $add("damage_review:{$d['id']}", 'damage_review', 'medium', "Damage to review: {$d['reg_no']}", mb_strimwidth((string)$d['description'], 0, 140, '…') . ' Decide whether to charge the customer.', $d['booking_id'] ? url('booking', ['id' => $d['booking_id']]) . '#damage' : url('vehicle', ['id' => $d['vehicle_id'], 'tab' => 'damage']), 'void');

    // Alerts whose problem has gone away are closed automatically.
    $open = rows("SELECT id, dedupe_key FROM notifications WHERE resolved_at IS NULL AND type IN ('" . implode("','", CHECKED_TYPES) . "')");
    foreach ($open as $o) if (!isset($live[$o['dedupe_key']])) q("UPDATE notifications SET resolved_at = ?, resolved_by = 'auto' WHERE id = ?", [now(), $o['id']]);
    setting_save('last_check', now());
    return count($live);
}
function maybe_run_checks() {
    $last = setting('last_check');
    $due = !empty($_SESSION['checks_due']); unset($_SESSION['checks_due']);
    if ($due || !$last || ts(now()) - ts($last) > 600) { try { run_checks(); } catch (Throwable $e) { error_log('checks: ' . $e->getMessage()); } }
}
function visible_notifications($onlyOpen = true, $limit = 200) {
    $list = rows('SELECT * FROM notifications' . ($onlyOpen ? ' WHERE resolved_at IS NULL' : '') . ' ORDER BY ' . ($onlyOpen ? "CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, " : '') . 'created_at DESC LIMIT ' . (int)$limit);
    return array_values(array_filter($list, fn($n) => !$n['perm'] || can($n['perm'])));
}

/* ---------------- email digest (optional) ---------------- */
function send_digest() {
    if (setting('email_digest') !== '1' || !filter_var(setting('digest_email'), FILTER_VALIDATE_EMAIL)) return 'off';
    $new = rows('SELECT * FROM notifications WHERE resolved_at IS NULL AND emailed = 0 ORDER BY created_at');
    if (!$new) return 'nothing';
    $lines = array_map(fn($n) => '- ' . $n['title'] . "\n  " . $n['message'], $new);
    $ok = @mail(setting('digest_email'), setting('business_name') . ': ' . count($new) . ' new alert(s)', implode("\n\n", $lines) . "\n\nOpen the fleet manager to see and resolve them.",
        'From: ' . (setting('business_email') ?: 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost')) . "\r\nContent-Type: text/plain; charset=UTF-8");
    if ($ok) { foreach ($new as $n) q('UPDATE notifications SET emailed = 1 WHERE id = ?', [$n['id']]); setting_save('last_digest', now()); }
    return $ok ? 'sent' : 'failed';
}

/* ---------------- backups (JSON, works for MySQL and SQLite alike) ---------------- */
function backup_data() {
    $data = ['app' => 'car-rental-manager', 'version' => APP_VERSION, 'schema' => SCHEMA_VERSION, 'created_at' => now(), 'tables' => []];
    foreach (array_keys(schema_tables()) as $t) $data['tables'][$t] = rows("SELECT * FROM $t");
    return $data;
}
function backup_write() {
    $dir = STORAGE . '/backups';
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    $file = $dir . '/backup-' . date('Ymd-His', strtotime(now())) . '.json.gz';
    file_put_contents($file, gzencode(json_encode(backup_data(), JSON_UNESCAPED_UNICODE), 6));
    $all = glob($dir . '/backup-*.json.gz'); sort($all);
    foreach (array_slice($all, 0, max(0, count($all) - 30)) as $old) @unlink($old);
    setting_save('last_backup', now());
    return $file;
}
function backup_restore($json) {
    $data = json_decode($json, true);
    if (!is_array($data) || !in_array($data['app'] ?? '', ['car-rental-manager', 'bs-fleet-manager'], true) || empty($data['tables'])) throw new UserError('This is not a backup file from this app.');
    $tables = schema_tables();
    tx(function () use ($data, $tables) {
        foreach (array_keys($tables) as $t) q("DELETE FROM $t");
        foreach ($data['tables'] as $t => $list) {
            if (!isset($tables[$t])) continue;
            foreach ($list as $r) insert($t, array_intersect_key($r, $tables[$t]));
        }
    });
    $GLOBALS['__fleet_settings'] = null;
}

/* ---------------- damage records ---------------- */
const DAMAGE_STATUS_LABEL = ['review' => 'Waiting for owner decision', 'charged' => 'Charged to customer', 'not_charged' => 'Not charged', 'repaired' => 'Repaired'];
/* Record damage found on a car. It is never charged automatically: it waits for the owner's decision. */
function damage_add($vehicleId, $bookingId, $customerId, $description, $estimate) {
    $description = trim((string)$description);
    if ($description === '') throw new UserError('Describe the damage (what and where).');
    $id = insert('damages', ['vehicle_id' => $vehicleId, 'booking_id' => $bookingId, 'customer_id' => $customerId, 'description' => mb_substr($description, 0, 2000),
        'estimate_cost' => (int)$estimate, 'status' => 'review', 'created_by' => current_user()['id'] ?? null, 'created_at' => now()]);
    audit('create', 'damage', $id, ['vehicle' => $vehicleId, 'rental' => $bookingId, 'estimate' => $estimate]);
    return $id;
}
/* Owner decision: charge the customer an agreed amount (added to that rental as a charge), or don't charge. */
function damage_decide($damageId, $charge, $amount, $note) {
    if (!can('void')) throw new UserError('Only the owner can decide on damage charges.');
    $d = row('SELECT * FROM damages WHERE id = ?', [$damageId]);
    if (!$d) throw new UserError('Damage record not found.');
    if ($d['status'] !== 'review') throw new UserError('A decision was already made for this damage.');
    return tx(function () use ($d, $charge, $amount, $note) {
        $cid = null;
        if ($charge) {
            if ($amount <= 0) throw new UserError('Enter the amount agreed with the customer.');
            if (!$d['booking_id']) throw new UserError('This damage is not linked to a rental, so there is no customer to charge.');
            $cid = insert('booking_charges', ['booking_id' => $d['booking_id'], 'kind' => 'damage', 'label' => 'Damage: ' . mb_strimwidth($d['description'], 0, 80, '…'), 'amount' => $amount, 'created_by' => current_user()['id'], 'created_at' => now()]);
        }
        update('damages', $d['id'], ['status' => $charge ? 'charged' : 'not_charged', 'charge_id' => $cid, 'charge_amount' => $charge ? $amount : 0, 'decision_note' => mb_substr((string)$note, 0, 500), 'decided_by' => current_user()['id'], 'decided_at' => now()]);
        audit('decide', 'damage', $d['id'], ['charge' => $charge, 'amount' => $amount, 'note' => $note]);
    });
}
/* Mark damage repaired; the repair cost is saved as a repair expense for that car. */
function damage_repaired($damageId, $date, $cost) {
    $d = row('SELECT * FROM damages WHERE id = ?', [$damageId]);
    if (!$d) throw new UserError('Damage record not found.');
    if ($d['repaired_at']) throw new UserError('Already marked as repaired.');
    if (!$date || $date > today()) throw new UserError('Enter the repair date (not in the future).');
    return tx(function () use ($d, $date, $cost) {
        $eid = $cost > 0 ? insert('expenses', ['expense_date' => $date, 'vehicle_id' => $d['vehicle_id'], 'category' => 'repairs', 'amount' => $cost, 'description' => 'Damage repair: ' . mb_strimwidth($d['description'], 0, 150, '…'), 'method' => 'Cash', 'source' => 'damage', 'created_by' => current_user()['id'], 'created_at' => now()]) : null;
        update('damages', $d['id'], ['repaired_at' => $date, 'repair_cost' => $cost, 'expense_id' => $eid, 'status' => $d['status'] === 'review' ? 'review' : $d['status']]);
        audit('repaired', 'damage', $d['id'], ['cost' => $cost]);
    });
}
/* Cars with damage not yet repaired. */
function open_damage_by_vehicle() {
    $out = [];
    foreach (rows('SELECT vehicle_id, COUNT(*) AS n FROM damages WHERE repaired_at IS NULL GROUP BY vehicle_id') as $r) $out[$r['vehicle_id']] = (int)$r['n'];
    return $out;
}
