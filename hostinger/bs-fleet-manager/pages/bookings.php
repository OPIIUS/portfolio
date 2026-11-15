<?php
defined('APP') or exit;

function customer_options() {
    $o = [];
    foreach (rows('SELECT id, name, phone FROM customers WHERE archived = 0 ORDER BY name') as $c) $o[$c['id']] = $c['name'] . ' · ' . $c['phone'];
    return $o;
}
function money_post($k, $label, $allowZero = true) { $v = parse_money(post($k), $allowZero); if ($v === false) throw new UserError("Check the amount for $label."); return $v; }

/* Validate dates, vehicle and conflicts for a new or edited booking. */
function booking_from_post($existing = null) {
    $d = [];
    $d['customer_id'] = (int)post('customer_id');
    if (!row('SELECT id FROM customers WHERE id = ?', [$d['customer_id']])) throw new UserError('Choose the customer (or add a new one first).');
    $d['vehicle_id'] = post('vehicle_id') !== '' ? (int)post('vehicle_id') : null;
    $v = $d['vehicle_id'] ? row('SELECT * FROM vehicles WHERE id = ? AND archived = 0', [$d['vehicle_id']]) : null;
    if ($d['vehicle_id'] && !$v) throw new UserError('Choose a valid vehicle.');
    $d['start_at'] = parse_dt(post('start_at')); $d['end_at'] = parse_dt(post('end_at'));
    if (!$d['start_at'] || !$d['end_at']) throw new UserError('Enter the pickup and return date and time.');
    if (ts($d['end_at']) <= ts($d['start_at'])) throw new UserError('The return time must be after the pickup time.');
    $status = $existing ? $existing['status'] : (post('status') === 'inquiry' ? 'inquiry' : 'confirmed');
    if ($status === 'confirmed' && !$v) throw new UserError('Choose a vehicle to confirm the booking, or save it as an inquiry.');
    $d['rate_type'] = in_array(post('rate_type'), ['daily', 'monthly', 'fixed'], true) ? post('rate_type') : 'daily';
    $d['agreed_amount'] = money_post('agreed_amount', 'agreed rent');
    $d['discount'] = money_post('discount', 'discount');
    $d['deposit_amount'] = money_post('deposit_amount', 'security deposit');
    if ($d['discount'] > $d['agreed_amount']) throw new UserError('The discount cannot be more than the rent.');
    $due = parse_date(post('due_date')); if ($due === false) throw new UserError('Check the payment due date.');
    $d['due_date'] = $due ?: substr($d['end_at'], 0, 10);
    $d['km_limit'] = post('km_limit') === '' ? null : max(0, (int)post('km_limit'));
    $d['pickup_location'] = mb_substr(post('pickup_location'), 0, 200);
    $d['drop_location'] = mb_substr(post('drop_location'), 0, 200);
    $d['notes'] = mb_substr(post('notes'), 0, 2000);
    if ($v && in_array($status, ['confirmed', 'active'], true)) {
        $c = booking_conflicts($v['id'], $d['start_at'], $d['end_at'], $existing['id'] ?? 0);
        if ($c) throw new UserError("{$v['reg_no']} is already booked then: " . implode('; ', array_map(fn($x) => "{$x['code']} ({$x['customer_name']}, " . fmt_dt($x['start_at']) . ' to ' . fmt_dt(booking_effective_end($x)) . ')', $c)) . '. Choose another vehicle or other dates.');
    }
    return $d;
}

function booking_form($b, $action) {
    $b = $b ?: []; $g = fn($k, $def = '') => old($k, $b[$k] ?? $def);
    $vehicles = rows('SELECT id, reg_no, name, daily_rate, monthly_rate, km_limit_per_day, status_override FROM vehicles WHERE archived = 0 ORDER BY reg_no');
    $vopts = '<option value="">— Not decided yet —</option>';
    foreach ($vehicles as $v) $vopts .= '<option value="' . $v['id'] . '" data-daily="' . (int)$v['daily_rate'] . '" data-monthly="' . (int)$v['monthly_rate'] . '" data-km="' . (int)$v['km_limit_per_day'] . '"' . ((string)$g('vehicle_id', get('vehicle_id')) === (string)$v['id'] ? ' selected' : '') . '>' . e($v['reg_no'] . ' · ' . $v['name'] . (can('payments') ? ' · ' . money($v['daily_rate']) . '/day' : '') . ($v['status_override'] ? ' · ' . VEHICLE_STATUS_LABEL[$v['status_override']] : '')) . '</option>';
    $isNew = empty($b['id']);
    $start = $g('start_at') ? dt_input($g('start_at')) : date('Y-m-d\T10:00', strtotime(now() . ' +1 day'));
    $end = $g('end_at') ? dt_input($g('end_at')) : date('Y-m-d\T10:00', strtotime(now() . ' +2 days'));
    $h = form_open($action, 'class="card stack" data-booking-form');
    $h .= '<div class="grid2">' . field('Customer *', sel('customer_id', customer_options(), $g('customer_id', get('customer_id')), 'required', 'Choose customer…'), '<a href="' . e(url('customer_new', ['then' => 'booking', 'vehicle_id' => get('vehicle_id')])) . '">+ New customer</a>')
        . field('Vehicle', '<select name="vehicle_id" data-vehicle>' . $vopts . '</select>', 'Double bookings are blocked automatically.') . '</div>';
    $h .= '<div class="grid2">' . field('Pickup date and time *', inp('start_at', $start, 'datetime-local', 'required data-start')) . field('Return date and time *', inp('end_at', $end, 'datetime-local', 'required data-end'))
        . field('Pickup location', inp('pickup_location', $g('pickup_location'), 'text', 'placeholder="e.g. Office, Lokhra"')) . field('Drop-off location', inp('drop_location', $g('drop_location'))) . '</div>';
    if (can('payments')) {
        $h .= '<h3>Price</h3><div class="grid3">' . field('Price based on', sel('rate_type', ['daily' => 'Daily rate', 'monthly' => 'Monthly rate', 'fixed' => 'Fixed amount'], $g('rate_type', 'daily'), 'data-rate'))
            . field('Agreed rent *', money_in('agreed_amount', $g('agreed_amount', ''), 'required data-amount'), '<span data-suggest class="muted"></span>')
            . field('Discount', money_in('discount', $g('discount', 0))) . field('Security deposit (refundable)', money_in('deposit_amount', $g('deposit_amount', 0)), 'Not counted as income.')
            . field('Payment due date', inp('due_date', $g('due_date'), 'date'), 'Empty = the return date.') . field('Free km (per day)', inp('km_limit', $g('km_limit'), 'number', 'min="0" data-km'), 'For extra-km charges at return.') . '</div>';
        if ($isNew) $h .= '<h3>Money received now (optional)</h3><div class="grid3">' . field('Advance rent received', money_in('advance', old('advance', ''))) . field('Deposit received', money_in('deposit_now', old('deposit_now', '')))
            . field('Paid by', sel('method', PAY_METHODS, old('method', 'UPI'))) . field('Transaction reference', inp('reference', old('reference'), 'text', 'placeholder="UPI ref, cheque no."')) . '</div>';
    } else {
        $h .= '<input type="hidden" name="agreed_amount" value="' . e($g('agreed_amount') === '' ? '' : money_plain($g('agreed_amount'))) . '"><input type="hidden" name="discount" value="' . e(money_plain($g('discount', 0))) . '"><input type="hidden" name="deposit_amount" value="' . e(money_plain($g('deposit_amount', 0))) . '"><input type="hidden" name="rate_type" value="' . e($g('rate_type', 'daily')) . '">';
        if ($isNew) $h .= '<p class="muted small">The price will be calculated from the vehicle\'s daily rate. The owner can change it later.</p><input type="hidden" name="auto_price" value="1">';
    }
    $h .= field('Notes', txt('notes', $g('notes')));
    if ($isNew) $h .= '<div class="row"><label class="check"><input type="radio" name="status" value="confirmed" checked> Confirmed booking</label><label class="check"><input type="radio" name="status" value="inquiry"' . (old('status') === 'inquiry' ? ' checked' : '') . '> Just an inquiry (does not reserve the vehicle)</label></div>';
    $h .= '<div class="row"><button class="btn primary">' . ($isNew ? 'Save booking' : 'Save changes') . '</button><a class="btn ghost" href="' . e($isNew ? url('bookings') : url('booking', ['id' => $b['id']])) . '">Cancel</a></div></form>';
    return $h;
}

function page_bookings() {
    require_perm('bookings');
    $st = get('status'); $qs = get('q');
    $where = '1=1'; $p = [];
    if ($qs !== '') { $where .= ' AND (b.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR v.reg_no LIKE ?)'; $p = array_fill(0, 4, "%$qs%"); }
    if ($from = parse_date(get('from'))) { $where .= ' AND b.end_at >= ?'; $p[] = "$from 00:00:00"; }
    if ($to = parse_date(get('to'))) { $where .= ' AND b.start_at <= ?'; $p[] = "$to 23:59:59"; }
    $list = bookings_where($where, $p);
    $counts = array_count_values(array_column($list, 'view_status'));
    if ($st !== '') $list = array_values(array_filter($list, fn($b) => $b['view_status'] === $st));
    $h = page_head('Bookings', count($list) . ' shown', btn('New booking', url('booking_new'), 'primary'));
    $h .= '<div class="chips">';
    foreach (['' => 'All'] + BOOKING_STATUS_LABEL as $k => $l) $h .= '<a class="chip' . ($st === $k ? ' on' : '') . '" href="' . e(url('bookings', ['status' => $k, 'q' => $qs])) . '">' . e($l) . ($k ? ' <b>' . ($counts[$k] ?? 0) . '</b>' : '') . '</a>';
    $h .= '</div><form class="filters" method="get"><input type="hidden" name="p" value="bookings"><input type="hidden" name="status" value="' . e($st) . '"><input type="search" name="q" value="' . e($qs) . '" placeholder="Booking no., customer, phone, vehicle">'
        . '<input type="date" name="from" value="' . e(get('from')) . '" aria-label="From"><input type="date" name="to" value="' . e(get('to')) . '" aria-label="To"><button class="btn">Apply</button></form>';
    $trs = [];
    foreach (array_slice($list, 0, 500) as $b) $trs[] = tr(['<b>' . e($b['code']) . '</b>', e($b['customer_name']) . '<small>' . e($b['customer_phone']) . '</small>', e($b['reg_no'] ?: '—'), e(fmt_dt($b['start_at'])) . '<small>to ' . e(fmt_dt($b['end_at'])) . '</small>',
        badge(BOOKING_STATUS_LABEL[$b['view_status']], tone_for($b['view_status'])), can('payments') ? money($b['total']) . '<small>' . badge(PAY_STATUS_LABEL[$b['pay_status']], tone_for($b['pay_status'])) . '</small>' : '—'], url('booking', ['id' => $b['id']]));
    $h .= '<div class="card flush">' . table(['Booking', 'Customer', 'Vehicle', 'Dates', 'Status', 'Amount'], $trs, 'No bookings found.') . '</div>';
    render_page('Bookings', $h, 'bookings');
}

function page_booking_new() {
    require_perm('bookings');
    if (is_post()) {
        $d = booking_from_post();
        $status = post('status') === 'inquiry' ? 'inquiry' : 'confirmed';
        if (post('auto_price') === '1' || !can('payments')) {
            $v = $d['vehicle_id'] ? row('SELECT * FROM vehicles WHERE id = ?', [$d['vehicle_id']]) : null;
            $d['agreed_amount'] = $v ? suggested_amount($v, $d['start_at'], $d['end_at']) : 0;
            $d['km_limit'] = $v['km_limit_per_day'] ?? null;
        }
        if ($d['km_limit'] === null && $d['vehicle_id']) $d['km_limit'] = val('SELECT km_limit_per_day FROM vehicles WHERE id = ?', [$d['vehicle_id']]) ?: null;
        $advance = can('payments') ? money_post('advance', 'advance') : 0;
        $depNow = can('payments') ? money_post('deposit_now', 'deposit received') : 0;
        $id = tx(function () use ($d, $status, $advance, $depNow) {
            $id = insert('bookings', $d + ['code' => next_code('bookings', 'code', setting('booking_prefix', 'BS')), 'status' => $status, 'created_by' => current_user()['id'], 'created_at' => now(), 'updated_at' => now()]);
            audit('create', 'booking', $id, ['status' => $status, 'vehicle' => $d['vehicle_id'], 'amount' => $d['agreed_amount']]);
            $b = booking_get($id);
            if ($advance > 0) { record_payment($b, 'rental', $advance, post('method'), post('reference'), now(), 'Advance at booking'); $b = booking_get($id); }
            if ($depNow > 0) record_payment($b, 'deposit', $depNow, post('method'), post('reference'), now(), 'Deposit at booking');
            return $id;
        });
        flash('success', 'Booking saved.');
        redirect('booking', ['id' => $id]);
    }
    render_page('New booking', page_head('New booking') . booking_form(null, 'create'), 'bookings');
}

function checklist_form($b, $stage, $vehicle) {
    $isReturn = $stage === 'return';
    $hand = $isReturn ? row("SELECT * FROM checklists WHERE booking_id = ? AND stage = 'handover' ORDER BY id DESC LIMIT 1", [$b['id']]) : null;
    $h = form_open($stage, 'class="card stack" id="' . $stage . '"', true) . '<h3>' . ($isReturn ? 'Receive vehicle back' : 'Hand over vehicle') . '</h3><div class="grid3">'
        . field($isReturn ? 'Returned at' : 'Handed over at', inp('when', date('Y-m-d\TH:i', strtotime(now())), 'datetime-local', 'required'))
        . field('Odometer (km) *', inp('odometer', $vehicle['odometer'], 'number', 'required min="0"'), $hand ? 'At handover: ' . number_format($hand['odometer']) . ' km' : 'Last recorded: ' . number_format($vehicle['odometer']) . ' km')
        . field('Fuel level', sel('fuel_level', FUEL_LEVELS, $isReturn ? ($hand['fuel_level'] ?? 'Full') : 'Full'), $hand ? 'At handover: ' . e($hand['fuel_level']) : '') . '</div><div class="checks-grid">';
    foreach (CHECK_ITEMS as $i => $it) $h .= '<label class="check"><input type="checkbox" name="items[]" value="' . e($it) . '" checked> ' . e($it) . '</label>';
    $h .= '</div>' . field($isReturn ? 'New damage or problems' : 'Existing damage (scratches, dents)', txt('damage_notes', '', 'placeholder="e.g. Scratch on rear left door"')) . field('Condition notes', inp('condition_note', '', 'text'))
        . field('Photos (optional)', '<input type="file" name="photos[]" accept="image/*" multiple>');
    if (!$isReturn) {
        $comp = vehicle_compliance($vehicle);
        if ($comp['overall'] === 'blocked') {
            $bad = array_map(fn($i) => $i['type']['name'] . ' ' . strtolower(DOC_STATE_LABEL[$i['state']]), array_filter($comp['items'], fn($i) => $i['required'] && in_array($i['state'], ['expired', 'missing'], true)));
            $h .= '<div class="flash error">This vehicle is not road-legal: ' . e(implode(', ', $bad)) . '.' . (is_owner() ? ' To hand it over anyway, write the reason below.' : ' Only the owner can hand it over.') . '</div>' . (is_owner() ? field('Reason for handing over anyway', inp('override_reason')) : '');
        }
    } else {
        $late = max(0, (int)ceil((ts(now()) - ts($b['end_at'])) / 3600));
        $lateFee = $late * (int)setting('late_fee_per_hour', 0);
        $h .= '<h3>Charges at return (only added if you tick them)</h3>';
        $h .= '<div class="charge-row"><label class="check"><input type="checkbox" name="add_late" value="1"> Late return charge</label>' . money_in('late_amount', $lateFee) . '<small class="muted">' . ($late ? "$late hour(s) late at " . money(setting('late_fee_per_hour')) . '/hour' : 'Returned on time') . '. Change the amount if you agreed something else.</small></div>';
        $kmLimit = (int)$b['km_limit']; $days = rental_days($b['actual_start'] ?: $b['start_at'], now());
        $h .= '<div class="charge-row" data-extra-km data-start-odo="' . (int)($hand['odometer'] ?? $vehicle['odometer']) . '" data-free="' . ($kmLimit * $days) . '" data-rate="' . (int)setting('extra_km_rate', 0) . '"><label class="check"><input type="checkbox" name="add_km" value="1"> Extra km charge</label>' . money_in('km_amount', 0) . '<small class="muted">' . ($kmLimit ? "Free: $kmLimit km/day × $days day(s) = " . number_format($kmLimit * $days) . ' km at ' . money(setting('extra_km_rate')) . '/km. <span data-km-note></span>' : 'No free-km limit set on this booking.') . '</small></div>';
        $h .= '<div class="charge-row"><label class="check"><input type="checkbox" name="add_damage" value="1"> Damage / other charge</label>' . money_in('damage_amount', 0) . inp('damage_label', '', 'text', 'placeholder="What for?"') . '</div>';
        if ($b['deposit_held'] > 0) $h .= '<div class="charge-row"><label class="check"><input type="checkbox" name="refund_deposit" value="1"> Return the deposit now</label>' . money_in('refund_amount', $b['deposit_held']) . sel('refund_method', PAY_METHODS, 'Cash') . '<small class="muted">Held: ' . money($b['deposit_held']) . '. To pay dues from the deposit instead, use "Record payment" with method "Deposit adjustment".</small></div>';
    }
    return $h . '<button class="btn primary">' . ($isReturn ? 'Complete return' : 'Confirm handover') . '</button></form>';
}

function save_checklist_photos($bookingId) {
    foreach (array_keys($_FILES['photos']['name'] ?? []) as $i) {
        if (($_FILES['photos']['error'][$i] ?? 4) === UPLOAD_ERR_NO_FILE) continue;
        $_FILES['one'] = array_map(fn($x) => $x[$i], $_FILES['photos']);
        handle_upload('one', 'booking_photo', $bookingId, true);
    }
}

function page_booking() {
    require_perm('bookings');
    $id = (int)get('id');
    $b = booking_get($id);
    if (!$b) throw new UserError('Booking not found.');
    $v = $b['vehicle_id'] ? row('SELECT * FROM vehicles WHERE id = ?', [$b['vehicle_id']]) : null;
    $me = current_user()['id'];

    if (is_post()) {
        $a = post('action');
        $back = fn($msg = null, $type = 'success') => ($msg ? flash($type, $msg) : null) ?? redirect('booking', ['id' => $id]);
        switch ($a) {
            case 'update':
                if (in_array($b['status'], ['completed', 'cancelled'], true)) throw new UserError('This booking is closed.');
                $d = booking_from_post($b);
                if (!can('payments')) $d = array_diff_key($d, array_flip(['agreed_amount', 'discount', 'deposit_amount', 'rate_type', 'due_date']));
                if ($b['status'] === 'active') unset($d['start_at'], $d['vehicle_id']);
                update('bookings', $id, $d + ['updated_at' => now()]);
                $diff = []; foreach ($d as $k => $val) if ((string)$val !== (string)$b[$k]) $diff[$k] = [$b[$k], $val];
                audit('update', 'booking', $id, $diff);
                $back('Booking updated.');
            case 'confirm':
                if ($b['status'] !== 'inquiry') throw new UserError('Only inquiries can be confirmed.');
                if (!$v) throw new UserError('Assign a vehicle first (Edit booking).');
                if ($c = booking_conflicts($v['id'], $b['start_at'], $b['end_at'], $id)) throw new UserError("{$v['reg_no']} is already booked then (" . $c[0]['code'] . '). Change the vehicle or dates first.');
                update('bookings', $id, ['status' => 'confirmed', 'updated_at' => now()]);
                audit('confirm', 'booking', $id);
                $back('Booking confirmed and vehicle reserved.');
            case 'handover':
                if (!in_array($b['status'], ['confirmed'], true)) throw new UserError('Only confirmed bookings can be handed over.');
                if (!$v) throw new UserError('Assign a vehicle first.');
                if (in_array($v['status_override'], ['maintenance', 'unavailable'], true)) throw new UserError("{$v['reg_no']} is marked " . strtolower(VEHICLE_STATUS_LABEL[$v['status_override']]) . '. Change its status first.');
                $other = row("SELECT code FROM bookings WHERE vehicle_id = ? AND status = 'active' AND id <> ?", [$v['id'], $id]);
                if ($other) throw new UserError("{$v['reg_no']} is still out on booking {$other['code']}. Receive it back first.");
                $comp = vehicle_compliance($v); $override = null;
                if ($comp['overall'] === 'blocked') {
                    if (!is_owner()) throw new UserError('This vehicle has expired or missing documents. Only the owner can hand it over.');
                    $override = post('override_reason');
                    if ($override === '') throw new UserError('Documents are expired or missing. Write the reason for handing over anyway, or renew the documents first.');
                }
                $when = parse_dt(post('when')) ?: now(); $odo = (int)post('odometer');
                if (!ctype_digit(post('odometer'))) throw new UserError('Enter the odometer reading.');
                if ($odo < (int)$v['odometer']) throw new UserError('The odometer is lower than the last reading (' . number_format($v['odometer']) . ' km). Check it.');
                tx(function () use ($id, $v, $when, $odo, $override, $me) {
                    insert('checklists', ['booking_id' => $id, 'stage' => 'handover', 'odometer' => $odo, 'fuel_level' => post('fuel_level'), 'items' => json_encode(array_values((array)($_POST['items'] ?? []))),
                        'damage_notes' => mb_substr(post('damage_notes'), 0, 2000), 'condition_note' => mb_substr(post('condition_note'), 0, 500), 'override_reason' => $override, 'created_by' => $me, 'created_at' => now()]);
                    update('bookings', $id, ['status' => 'active', 'actual_start' => $when, 'updated_at' => now()]);
                    update('vehicles', $v['id'], ['odometer' => $odo, 'updated_at' => now()]);
                    save_checklist_photos($id);
                    audit('handover', 'booking', $id, ['odometer' => $odo, 'override' => $override]);
                });
                $back('Vehicle handed over. The rental is now active.');
            case 'return':
                if ($b['status'] !== 'active') throw new UserError('Only active rentals can be returned.');
                $when = parse_dt(post('when')) ?: now();
                if (!ctype_digit(post('odometer'))) throw new UserError('Enter the odometer reading.');
                $odo = (int)post('odometer');
                $hand = row("SELECT * FROM checklists WHERE booking_id = ? AND stage = 'handover' ORDER BY id DESC LIMIT 1", [$id]);
                if ($hand && $odo < (int)$hand['odometer']) throw new UserError('The return odometer is lower than at handover (' . number_format($hand['odometer']) . ' km).');
                $charges = [];
                if (post('add_late') === '1') $charges[] = ['late', 'Late return charge', money_post('late_amount', 'late charge', false)];
                if (post('add_km') === '1') $charges[] = ['extra_km', 'Extra km charge', money_post('km_amount', 'extra km charge (untick it if there is nothing to charge)', false)];
                if (post('add_damage') === '1') $charges[] = ['damage', post('damage_label') ?: 'Damage charge', money_post('damage_amount', 'damage charge', false)];
                if ($charges && !can('payments')) throw new UserError('Only someone with payment access can add charges.');
                $refund = post('refund_deposit') === '1' ? money_post('refund_amount', 'deposit refund', false) : 0;
                tx(function () use ($id, $b, $v, $when, $odo, $charges, $refund, $me) {
                    insert('checklists', ['booking_id' => $id, 'stage' => 'return', 'odometer' => $odo, 'fuel_level' => post('fuel_level'), 'items' => json_encode(array_values((array)($_POST['items'] ?? []))),
                        'damage_notes' => mb_substr(post('damage_notes'), 0, 2000), 'condition_note' => mb_substr(post('condition_note'), 0, 500), 'created_by' => $me, 'created_at' => now()]);
                    foreach ($charges as [$kind, $label, $amt]) insert('booking_charges', ['booking_id' => $id, 'kind' => $kind, 'label' => mb_substr($label, 0, 120), 'amount' => $amt, 'created_by' => $me, 'created_at' => now()]);
                    update('bookings', $id, ['status' => 'completed', 'actual_end' => $when, 'updated_at' => now()]);
                    if ($v && $odo > (int)$v['odometer']) update('vehicles', $v['id'], ['odometer' => $odo, 'updated_at' => now()]);
                    save_checklist_photos($id);
                    if ($refund > 0) record_payment(booking_get($id), 'deposit_out', $refund, post('refund_method'), '', now(), 'Deposit returned at vehicle return');
                    if (post('damage_notes') !== '' && $b['customer_id']) insert('customer_notes', ['customer_id' => $b['customer_id'], 'kind' => 'issue', 'body' => 'Damage at return of ' . ($v['reg_no'] ?? '') . ': ' . mb_substr(post('damage_notes'), 0, 1500), 'booking_id' => $id, 'created_by' => $me, 'created_at' => now()]);
                    audit('return', 'booking', $id, ['odometer' => $odo, 'charges' => $charges, 'deposit_refund' => $refund]);
                });
                $nb = booking_get($id);
                $back('Vehicle received back.' . ($nb['balance'] > 0 ? ' The customer still owes ' . money($nb['balance']) . ': it is listed under Outstanding.' : ''));
            case 'extend':
                if (!in_array($b['status'], ['confirmed', 'active'], true)) throw new UserError('Only confirmed or active bookings can be extended.');
                $new = parse_dt(post('new_end'));
                if (!$new || ts($new) <= ts($b['end_at'])) throw new UserError('The new return time must be later than ' . fmt_dt($b['end_at']) . '.');
                if ($v && ($c = booking_conflicts($v['id'], $b['start_at'], $new, $id))) throw new UserError("Can't extend: {$v['reg_no']} is booked by {$c[0]['customer_name']} from " . fmt_dt($c[0]['start_at']) . '.');
                $amt = can('payments') ? money_post('ext_amount', 'extension charge') : 0;
                tx(function () use ($id, $b, $new, $amt, $me) {
                    $cid = $amt > 0 ? insert('booking_charges', ['booking_id' => $id, 'kind' => 'extension', 'label' => 'Extension to ' . fmt_dt($new), 'amount' => $amt, 'created_by' => $me, 'created_at' => now()]) : null;
                    insert('booking_extensions', ['booking_id' => $id, 'old_end' => $b['end_at'], 'new_end' => $new, 'charge_id' => $cid, 'note' => mb_substr(post('ext_note'), 0, 500), 'created_by' => $me, 'created_at' => now()]);
                    $upd = ['end_at' => $new, 'updated_at' => now()];
                    if (post('move_due') === '1') $upd['due_date'] = substr($new, 0, 10);
                    update('bookings', $id, $upd);
                    audit('extend', 'booking', $id, ['from' => $b['end_at'], 'to' => $new, 'charge' => $amt]);
                });
                $back('Rental extended to ' . fmt_dt($new) . '.');
            case 'cancel':
                if (!in_array($b['status'], ['inquiry', 'confirmed'], true)) throw new UserError('Only bookings not yet handed over can be cancelled.');
                if (post('reason') === '') throw new UserError('Write the reason for cancelling.');
                update('bookings', $id, ['status' => 'cancelled', 'cancel_reason' => mb_substr(post('reason'), 0, 500), 'updated_at' => now()]);
                audit('cancel', 'booking', $id, post('reason'));
                $nb = booking_get($id);
                $back('Booking cancelled.' . ($nb['paid'] > 0 ? ' ' . money($nb['paid']) . ' rent was paid: record a refund or add a cancellation charge.' : '') . ($nb['deposit_held'] > 0 ? ' Return the deposit of ' . money($nb['deposit_held']) . '.' : ''));
            case 'payment':
                require_perm('payments');
                $amt = money_post('amount', 'payment', false);
                $when = parse_dt(post('paid_at')) ?: now();
                if (ts($when) > ts(now()) + 300) throw new UserError('The payment date cannot be in the future.');
                $pid = record_payment($b, post('kind'), $amt, post('method'), post('reference'), $when, mb_substr(post('note'), 0, 500));
                redirect('booking', ['id' => $id, 'receipt' => $pid]);
            case 'void_payment':
                require_perm('void');
                $p = row('SELECT * FROM payments WHERE id = ? AND booking_id = ?', [(int)post('payment_id'), $id]);
                if (!$p || $p['voided']) throw new UserError('Payment not found.');
                if (post('reason') === '') throw new UserError('Write why this payment is being voided.');
                if ($p['kind'] === 'deposit' && $b['deposit_held'] - $p['amount'] < 0) throw new UserError('Void the deposit return first.');
                update('payments', $p['id'], ['voided' => 1, 'void_reason' => mb_substr(post('reason'), 0, 500), 'voided_by' => $me, 'voided_at' => now()]);
                audit('void', 'payment', $p['id'], ['amount' => $p['amount'], 'reason' => post('reason')]);
                $back('Payment voided. It stays in the records, crossed out.');
            case 'charge':
                require_perm('payments');
                $amt = money_post('charge_amount', 'charge', false);
                if (post('charge_label') === '') throw new UserError('Write what the charge is for.');
                $cid = insert('booking_charges', ['booking_id' => $id, 'kind' => 'other', 'label' => mb_substr(post('charge_label'), 0, 120), 'amount' => $amt, 'created_by' => $me, 'created_at' => now()]);
                audit('charge', 'booking', $id, ['charge' => $cid, 'amount' => $amt, 'label' => post('charge_label')]);
                $back('Charge added.');
            case 'void_charge':
                require_perm('void');
                $c = row('SELECT * FROM booking_charges WHERE id = ? AND booking_id = ? AND voided = 0', [(int)post('charge_id'), $id]);
                if (!$c) throw new UserError('Charge not found.');
                if ($b['paid'] > $b['total'] - $c['amount']) throw new UserError('Payments already cover this charge. Refund first, then remove the charge.');
                update('booking_charges', $c['id'], ['voided' => 1, 'void_reason' => mb_substr(post('reason'), 0, 500)]);
                audit('void', 'charge', $c['id'], ['amount' => $c['amount']]);
                $back('Charge removed.');
            case 'note':
                q('UPDATE bookings SET notes = ?, updated_at = ? WHERE id = ?', [mb_substr(post('notes'), 0, 2000), now(), $id]);
                $back('Notes saved.');
        }
        redirect('booking', ['id' => $id]);
    }

    if (get('tab') === 'edit') {
        if (in_array($b['status'], ['completed', 'cancelled'], true)) throw new UserError('This booking is closed and cannot be edited.');
        render_page('Edit ' . $b['code'], page_head('Edit booking ' . $b['code']) . booking_form($b, 'update'), 'bookings'); return;
    }

    $c = row('SELECT * FROM customers WHERE id = ?', [$b['customer_id']]);
    $vs = $b['view_status'];
    $acts = '';
    if (in_array($b['status'], ['inquiry', 'confirmed', 'active'], true)) $acts .= btn('Edit', url('booking', ['id' => $id, 'tab' => 'edit']));
    if ($c) $acts .= '<a class="btn ghost" href="tel:' . e($c['phone']) . '">Call</a>';
    $h = page_head('Booking ' . $b['code'], badge(BOOKING_STATUS_LABEL[$vs], tone_for($vs)) . ' · created ' . e(fmt_d($b['created_at'])), $acts);
    if ($r = (int)get('receipt')) $h .= '<div class="flash success">Payment saved' . (($rn = val('SELECT receipt_no FROM payments WHERE id = ? AND booking_id = ?', [$r, $id])) ? ': receipt ' . e($rn) : '') . '. <a href="' . e(url('receipt', ['id' => $r])) . '" target="_blank">Print receipt</a></div>';
    if ($vs === 'overdue') $h .= '<div class="flash error">Return overdue by ' . e(human_duration(ts(now()) - ts($b['end_at']))) . '. Call the customer, then extend the rental or receive the vehicle.</div>';

    $h .= '<div class="grid2"><div class="card"><h3>Rental</h3><dl class="kv">'
        . '<dt>Customer</dt><dd>' . ($c ? '<a href="' . e(url('customer', ['id' => $c['id']])) . '">' . e($c['name']) . '</a> · <a href="tel:' . e($c['phone']) . '">' . e($c['phone']) . '</a>' . ($c['flagged'] ? ' ' . badge('Flagged', 'red') : '') . (!$c['id_verified'] ? ' ' . badge('ID not checked', 'amber') : '') : '—') . '</dd>'
        . '<dt>Vehicle</dt><dd>' . ($v ? '<a href="' . e(url('vehicle', ['id' => $v['id']])) . '">' . e($v['reg_no'] . ' · ' . $v['name']) . '</a>' : '<span class="muted">Not assigned</span>') . '</dd>'
        . '<dt>Pickup</dt><dd>' . e(fmt_dt($b['start_at'])) . ($b['pickup_location'] ? ' · ' . e($b['pickup_location']) : '') . '</dd>'
        . '<dt>Return due</dt><dd>' . e(fmt_dt($b['end_at'])) . ($b['drop_location'] ? ' · ' . e($b['drop_location']) : '') . '</dd>'
        . '<dt>Handed over</dt><dd>' . e(fmt_dt($b['actual_start'])) . '</dd><dt>Returned</dt><dd>' . e(fmt_dt($b['actual_end'])) . '</dd>'
        . ($b['km_limit'] ? '<dt>Free km</dt><dd>' . (int)$b['km_limit'] . ' km/day</dd>' : '') . ($b['cancel_reason'] ? '<dt>Cancelled</dt><dd>' . e($b['cancel_reason']) . '</dd>' : '') . '</dl>';
    $h .= form_open('note', 'class="stack"') . txt('notes', $b['notes'], 'placeholder="Notes about this booking"') . '<button class="btn ghost small">Save notes</button></form></div>';

    if (can('payments')) {
        $h .= '<div class="card money"><h3>Money</h3><dl class="kv"><dt>Agreed rent</dt><dd>' . money($b['status'] === 'cancelled' ? 0 : $b['agreed_amount']) . '</dd>';
        foreach (rows('SELECT * FROM booking_charges WHERE booking_id = ? ORDER BY id', [$id]) as $ch)
            $h .= '<dt>' . e($ch['label']) . '</dt><dd>' . ($ch['voided'] ? '<s>' . money($ch['amount']) . '</s>' : '+' . money($ch['amount'])) . (is_owner() && !$ch['voided'] ? form_open('void_charge', 'class="inline" data-confirm="Remove this charge?"') . '<input type="hidden" name="charge_id" value="' . $ch['id'] . '"><input type="hidden" name="reason" value="Removed by owner"><button class="link">remove</button></form>' : '') . '</dd>';
        if ($b['discount'] && $b['status'] !== 'cancelled') $h .= '<dt>Discount</dt><dd>−' . money($b['discount']) . '</dd>';
        $h .= '<dt class="tot">Total payable</dt><dd class="tot">' . money($b['total']) . '</dd><dt>Rent received</dt><dd>' . money($b['paid']) . '</dd>'
            . '<dt class="tot">' . ($b['balance'] < 0 ? 'Refund due' : 'Balance') . '</dt><dd class="tot ' . ($b['balance'] > 0 ? 'red' : 'green') . '">' . money(abs($b['balance'])) . '</dd>'
            . '<dt>Payment status</dt><dd>' . badge(PAY_STATUS_LABEL[$b['pay_status']], tone_for($b['pay_status'])) . ($b['overdue_days'] ? ' ' . $b['overdue_days'] . ' day(s) late' : '') . '</dd><dt>Due date</dt><dd>' . e(fmt_d($b['due_date'])) . '</dd>'
            . '<dt>Deposit agreed</dt><dd>' . money($b['deposit_amount']) . '</dd><dt>Deposit held</dt><dd>' . money($b['deposit_held']) . ' <small class="muted">(refundable, not income)</small></dd></dl>';
        if ($c && $b['balance'] > 0) $h .= '<a class="btn ghost small" target="_blank" rel="noopener" href="' . e(wa_link($c['phone'], "Hello {$c['name']}, this is a reminder from " . setting('business_name') . " that " . money($b['balance']) . " is pending for booking {$b['code']}" . ($v ? " ({$v['reg_no']})" : '') . '. Thank you.')) . '">Send WhatsApp reminder</a>';
        $h .= '</div>';
    }
    $h .= '</div>';

    // actions
    if ($b['status'] === 'inquiry') $h .= '<div class="card">' . form_open('confirm') . '<p>This is an inquiry: the vehicle is not reserved.</p><button class="btn primary">Confirm booking</button></form></div>';
    if ($b['status'] === 'confirmed' && $v) $h .= checklist_form($b, 'handover', $v);
    if ($b['status'] === 'active') $h .= checklist_form($b, 'return', $v);
    if (in_array($b['status'], ['confirmed', 'active'], true)) {
        $perDay = (int)round(((int)$b['agreed_amount'] - (int)$b['discount']) / max(1, rental_days($b['start_at'], $b['end_at'])));
        $h .= form_open('extend', 'class="card stack" id="extend"') . '<h3>Extend rental</h3><div class="grid3">' . field('New return date and time', inp('new_end', dt_input(date('Y-m-d H:i:s', strtotime($b['end_at'] . ' +1 day'))), 'datetime-local', 'required data-ext-end data-old-end="' . e(dt_input($b['end_at'])) . '" data-per-day="' . $perDay . '"'));
        if (can('payments')) $h .= field('Extra charge (you decide)', money_in('ext_amount', $perDay, 'data-ext-amount'), 'Suggested from the agreed rate: ' . money($perDay) . '/day. Nothing is charged unless you save.');
        $h .= field('Note', inp('ext_note', '', 'text', 'placeholder="e.g. customer called, approved"')) . '</div><label class="check"><input type="checkbox" name="move_due" value="1" checked> Move the payment due date to the new return date</label><button class="btn">Extend</button></form>';
    }

    if (can('payments') && $b['status'] !== 'inquiry') {
        $h .= '<h2>Payments</h2><div class="grid2"><div class="card flush">';
        $trs = [];
        foreach (rows('SELECT p.*, u.name AS by_name FROM payments p LEFT JOIN users u ON u.id = p.created_by WHERE booking_id = ? ORDER BY paid_at, id', [$id]) as $p) {
            $void = is_owner() && !$p['voided'] ? form_open('void_payment', 'class="inline" data-prompt="Why are you voiding this payment?"') . '<input type="hidden" name="payment_id" value="' . $p['id'] . '"><input type="hidden" name="reason"><button class="link">void</button></form>' : '';
            $trs[] = tr([e(fmt_dt($p['paid_at'])), e(PAY_KIND_LABEL[$p['kind']]), $p['voided'] ? '<s>' . money($p['amount']) . '</s> ' . badge('Voided', 'grey') . '<small>' . e($p['void_reason']) . '</small>' : money($p['amount']), e($p['method']) . ($p['reference'] ? '<small>' . e($p['reference']) . '</small>' : ''), e($p['by_name']), '<a href="' . e(url('receipt', ['id' => $p['id']])) . '" target="_blank">' . e($p['receipt_no']) . '</a> ' . $void]);
        }
        $h .= table(['Date', 'Type', 'Amount', 'Method', 'By', 'Receipt'], $trs, 'No payments yet.') . '</div>';
        $kinds = ['rental' => 'Rent received', 'deposit' => 'Deposit received', 'deposit_out' => 'Deposit returned', 'refund' => 'Rent refunded'];
        $h .= form_open('payment', 'class="card stack"') . '<h3>Record payment</h3><div class="grid2">' . field('Type', sel('kind', $kinds, 'rental')) . field('Amount', money_in('amount', $b['balance'] > 0 ? $b['balance'] : '', 'required'))
            . field('Method', sel('method', PAY_METHODS, 'UPI')) . field('Reference', inp('reference', '', 'text', 'placeholder="UPI ref / cheque no."')) . field('Date and time', inp('paid_at', date('Y-m-d\TH:i', strtotime(now())), 'datetime-local')) . field('Note', inp('note')) . '</div>'
            . '<p class="muted small">Every payment is kept. Mistakes are voided by the owner, never deleted. Part payments are fine.</p><button class="btn primary">Save payment</button></form>';
        $h .= form_open('charge', 'class="card stack"') . '<h3>Add charge</h3><div class="grid2">' . field('What for', inp('charge_label', '', 'text', 'placeholder="e.g. Fuel refill, challan, cleaning"')) . field('Amount', money_in('charge_amount', '')) . '</div><button class="btn">Add charge</button></form></div>';
    }

    $cl = rows('SELECT k.*, u.name AS by_name FROM checklists k LEFT JOIN users u ON u.id = k.created_by WHERE booking_id = ? ORDER BY k.id', [$id]);
    if ($cl) {
        $h .= '<h2>Handover and return records</h2><div class="grid2">';
        foreach ($cl as $k) $h .= '<div class="card"><h3>' . ($k['stage'] === 'handover' ? 'Handover' : 'Return') . '</h3><dl class="kv"><dt>When</dt><dd>' . e(fmt_dt($k['created_at'])) . ' · ' . e($k['by_name']) . '</dd><dt>Odometer</dt><dd>' . number_format($k['odometer']) . ' km</dd><dt>Fuel</dt><dd>' . e($k['fuel_level']) . '</dd>'
            . '<dt>Checked</dt><dd>' . e(implode(', ', json_decode($k['items'] ?: '[]', true) ?: []) ?: '—') . '</dd><dt>Damage</dt><dd>' . nl2br(e($k['damage_notes'] ?: 'None noted')) . '</dd>' . ($k['condition_note'] ? '<dt>Condition</dt><dd>' . e($k['condition_note']) . '</dd>' : '') . ($k['override_reason'] ? '<dt>Document override</dt><dd class="red">' . e($k['override_reason']) . '</dd>' : '') . '</dl></div>';
        if (count($cl) >= 2) { $km = (int)end($cl)['odometer'] - (int)$cl[0]['odometer']; $h .= '<div class="card"><h3>Trip</h3><p class="big">' . number_format($km) . ' km driven</p></div>'; }
        $h .= '</div>';
        $ph = rows("SELECT * FROM files WHERE entity = 'booking_photo' AND entity_id = ? AND deleted = 0", [$id]);
        if ($ph) { $h .= '<div class="card"><h3>Photos</h3><div class="photos">'; foreach ($ph as $p) $h .= '<figure><a href="' . e(url('file', ['id' => $p['id']])) . '" target="_blank"><img loading="lazy" src="' . e(url('file', ['id' => $p['id']])) . '" alt=""></a><figcaption>' . e(fmt_dt($p['created_at'])) . '</figcaption></figure>'; $h .= '</div></div>'; }
    }
    $ext = rows('SELECT * FROM booking_extensions WHERE booking_id = ? ORDER BY id', [$id]);
    if ($ext) { $h .= '<h2>Extensions</h2><div class="card"><ul class="timeline">'; foreach ($ext as $x) $h .= '<li>From ' . e(fmt_dt($x['old_end'])) . ' to <b>' . e(fmt_dt($x['new_end'])) . '</b>' . ($x['note'] ? ' · ' . e($x['note']) : '') . '<small>' . e(fmt_dt($x['created_at'])) . '</small></li>'; $h .= '</ul></div>'; }
    if (in_array($b['status'], ['inquiry', 'confirmed'], true)) $h .= form_open('cancel', 'class="card danger stack" data-confirm="Cancel this booking?"') . '<h3>Cancel booking</h3>' . inp('reason', '', 'text', 'placeholder="Reason" required') . '<button class="btn ghost">Cancel booking</button></form>';
    render_page('Booking ' . $b['code'], $h, 'bookings');
}

function page_rentals() {
    require_perm('bookings');
    $active = bookings_where("b.status = 'active'", [], 'b.end_at ASC');
    $soon = bookings_where("b.status = 'confirmed' AND b.start_at <= ?", [date('Y-m-d H:i:s', strtotime(now()) + 2 * 86400)], 'b.start_at ASC');
    $over = array_filter($active, fn($b) => $b['view_status'] === 'overdue');
    $h = page_head('Active rentals', count($active) . ' vehicle(s) out · ' . count($over) . ' overdue');
    $card = function ($b, $kind) {
        $late = ts(now()) - ts($b['end_at']);
        $time = $kind === 'out' ? ($late > 0 ? '<b class="red">Overdue ' . e(human_duration($late)) . '</b>' : 'Due back in ' . e(human_duration(-$late))) : 'Pickup ' . e(fmt_dt($b['start_at']));
        return '<a class="rental ' . ($kind === 'out' && $late > 0 ? 'late' : '') . '" href="' . e(url('booking', ['id' => $b['id']])) . '"><div><b>' . e($b['reg_no'] ?: 'No vehicle') . '</b> <span class="muted">' . e($b['vehicle_name']) . '</span></div>'
            . '<div>' . e($b['customer_name']) . ' · ' . e($b['customer_phone']) . '</div><div class="small">' . ($kind === 'out' ? 'Out since ' . e(fmt_dt($b['actual_start'])) . ' · due ' . e(fmt_dt($b['end_at'])) : 'Return ' . e(fmt_dt($b['end_at']))) . ($b['pickup_location'] ? ' · ' . e($b['pickup_location']) . ($b['drop_location'] ? ' → ' . e($b['drop_location']) : '') : '') . '</div>'
            . '<div class="row">' . $time . (can('payments') && $b['balance'] > 0 ? ' ' . badge('Owes ' . money($b['balance']), 'red') : '') . '</div></a>';
    };
    $h .= '<h2>Out with customers</h2><div class="rentals">' . ($active ? implode('', array_map(fn($b) => $card($b, 'out'), $active)) : '<p class="muted">No vehicles are out right now.</p>') . '</div>';
    $h .= '<h2>Pickups in the next 2 days</h2><div class="rentals">' . ($soon ? implode('', array_map(fn($b) => $card($b, 'next'), $soon)) : '<p class="muted">No pickups coming up.</p>') . '</div>';
    $h .= '<p class="muted small">Locations come from the booking (pickup and drop-off). Live GPS needs a GPS tracker fitted in the vehicle; if you add one, put its tracking link on the vehicle page.</p>';
    render_page('Active rentals', $h, 'rentals');
}
