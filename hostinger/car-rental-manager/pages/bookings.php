<?php
defined('APP') or exit;

const CONDITIONS = ['Good', 'Fair', 'Needs cleaning', 'Damaged'];
const RATE_TYPES = ['daily' => 'Per day', 'monthly' => 'Per month', 'fixed' => 'Fixed amount'];

function customer_options() {
    $o = [];
    foreach (rows('SELECT id, name, phone FROM customers WHERE archived = 0 ORDER BY name') as $c) $o[$c['id']] = $c['name'] . ' · ' . $c['phone'];
    return $o;
}
function money_post($k, $label, $allowZero = true) { $v = parse_money(post($k), $allowZero); if ($v === false) throw new UserError("Check the amount for $label (numbers only)."); return $v; }
function km_post($k, $label) { $v = post($k); if (!ctype_digit($v)) throw new UserError("Enter the $label in whole kilometres."); return (int)$v; }
function time_left($b) {
    $d = ts($b['end_at']) - ts(now());
    return $d >= 0 ? human_duration($d) . ' left' : '<b class="red">' . e(human_duration(-$d)) . ' late</b>';
}

/* Validate a new or edited rental. Overlapping rentals of the same car are refused. */
function booking_from_post($existing = null) {
    $d = [];
    $d['customer_id'] = (int)post('customer_id');
    if (!row('SELECT id FROM customers WHERE id = ?', [$d['customer_id']])) throw new UserError('Choose the customer (or add a new one first).');
    $d['vehicle_id'] = (int)post('vehicle_id');
    $v = row('SELECT * FROM vehicles WHERE id = ? AND archived = 0', [$d['vehicle_id']]);
    if (!$v) throw new UserError('Choose the car.');
    $d['start_at'] = parse_dt(post('start_at')); $d['end_at'] = parse_dt(post('end_at'));
    if (!$d['start_at'] || !$d['end_at']) throw new UserError('Enter the start and expected return date and time.');
    if (ts($d['end_at']) <= ts($d['start_at'])) throw new UserError('The expected return must be after the start.');
    $d['rate_type'] = isset(RATE_TYPES[post('rate_type')]) ? post('rate_type') : 'daily';
    if (can('payments') || !$existing) {
        $d['agreed_amount'] = money_post('agreed_amount', 'agreed rental price');
        $d['deposit_amount'] = money_post('deposit_amount', 'security deposit');
        $due = parse_date(post('due_date')); if ($due === false) throw new UserError('Check the payment due date.');
        $d['due_date'] = $due ?: substr($d['end_at'], 0, 10);
    }
    $d['km_limit'] = post('km_limit') === '' ? null : km_post('km_limit', 'free km per day');
    $d['pickup_location'] = mb_substr(post('pickup_location'), 0, 200);
    $d['notes'] = mb_substr(post('notes'), 0, 2000);
    if (in_array($v['status_override'], ['maintenance', 'unavailable'], true) && ts($d['start_at']) <= ts(now()) + 86400 && !$existing)
        throw new UserError("{$v['reg_no']} is marked " . strtolower(VEHICLE_STATUS_LABEL[$v['status_override']]) . '. Change its status on the car page first, or choose another car.');
    $c = booking_conflicts($v['id'], $d['start_at'], $d['end_at'], $existing['id'] ?? 0);
    if ($c) throw new UserError("{$v['reg_no']} is already rented for that time: " . implode('; ', array_map(fn($x) => "{$x['code']} ({$x['customer_name']}, " . fmt_dt($x['start_at']) . ' to ' . fmt_dt(booking_effective_end($x)) . ')', $c)) . '. Choose another car or other dates.');
    return [$d, $v];
}

function booking_form($b = null) {
    $b = $b ?: []; $isNew = empty($b['id']); $g = fn($k, $def = '') => old($k, $b[$k] ?? $def);
    $vehicles = rows('SELECT id, reg_no, name, daily_rate, monthly_rate, km_limit_per_day, odometer, status_override FROM vehicles WHERE archived = 0 ORDER BY reg_no');
    $map = fleet_status_map();
    $vopts = '<option value="">Choose car…</option>';
    foreach ($vehicles as $v) {
        $st = $map[$v['id']]['status'];
        $vopts .= '<option value="' . $v['id'] . '" data-daily="' . (int)$v['daily_rate'] . '" data-monthly="' . (int)$v['monthly_rate'] . '" data-km="' . (int)$v['km_limit_per_day'] . '" data-odo="' . (int)$v['odometer'] . '"'
            . ((string)$g('vehicle_id', get('vehicle_id')) === (string)$v['id'] ? ' selected' : '') . '>' . e($v['reg_no'] . ' · ' . $v['name'] . ' · ' . VEHICLE_STATUS_LABEL[$st] . (can('payments') ? ' · ' . money($v['daily_rate']) . '/day' : '')) . '</option>';
    }
    $start = $g('start_at') ? dt_input($g('start_at')) : date('Y-m-d\TH:i', strtotime(now()));
    $end = $g('end_at') ? dt_input($g('end_at')) : date('Y-m-d\TH:i', strtotime(now() . ' +1 day'));
    $h = form_open($isNew ? 'create' : 'update', 'class="card stack" data-booking-form', $isNew);
    $h .= '<div class="grid2">' . field('Customer *', sel('customer_id', customer_options(), $g('customer_id', get('customer_id')), 'required', 'Choose customer…'), '<a href="' . e(url('customer_new', ['then' => 'booking', 'vehicle_id' => get('vehicle_id')])) . '">+ New customer</a>')
        . field('Car *', '<select name="vehicle_id" data-vehicle required>' . $vopts . '</select>', 'A car cannot be given to two customers at the same time.') . '</div>';
    $h .= '<div class="grid3">' . field('Start date and time *', inp('start_at', $start, 'datetime-local', 'required data-start')) . field('Expected return *', inp('end_at', $end, 'datetime-local', 'required data-end'))
        . field('Rental duration', '<output class="duration" data-duration>—</output>') . '</div>';
    if (can('payments')) {
        $h .= '<h3>Price</h3><div class="grid3">' . field('Charged', sel('rate_type', RATE_TYPES, $g('rate_type', setting('default_rate_type', 'daily')), 'data-rate'))
            . field('Agreed rental price *', money_in('agreed_amount', $g('agreed_amount', ''), 'required data-amount'), '<span data-suggest class="muted"></span>')
            . field('Security deposit', money_in('deposit_amount', $g('deposit_amount', 0)), 'Refundable. Kept separate from rent.')
            . field('Payment due date', inp('due_date', $g('due_date'), 'date'), 'Empty = the return date.') . field('Free km per day', inp('km_limit', $g('km_limit'), 'number', 'min="0" data-km'), 'Optional. For extra-km charges at return.') . '</div>';
        if ($isNew) $h .= '<div class="grid3">' . field('Additional charge (optional)', inp('extra_label', old('extra_label'), 'text', 'placeholder="e.g. Driver, delivery, child seat"')) . field('Additional charge amount', money_in('extra_amount', old('extra_amount', ''))) . '</div>'
            . '<h3>Money received now</h3><div class="grid3">' . field('Advance payment', money_in('advance', old('advance', ''))) . field('Security deposit received', money_in('deposit_now', old('deposit_now', '')))
            . field('Paid by', sel('method', PAY_METHODS, old('method', default_pay_method()))) . field('Transaction reference', inp('reference', old('reference'), 'text', 'placeholder="Optional"')) . '</div>';
    } else if ($isNew) $h .= '<p class="muted small">The price is calculated from the car\'s daily price. The owner can change it.</p><input type="hidden" name="auto_price" value="1">';
    $h .= field('Special conditions or notes', txt('notes', $g('notes', $isNew ? (string)setting('default_rental_terms', '') : ''), 'rows="4" placeholder="e.g. ' . (in_india() ? 'Only within Assam. No smoking.' : 'Island use only. No smoking. No pets.') . '"'), $isNew && setting('default_rental_terms') ? 'Your usual rental rules are filled in. Change them for this rental if needed.' : '') . field('Pickup place (optional)', inp('pickup_location', $g('pickup_location')));
    if ($isNew) {
        $now = old('mode', 'now');
        $h .= '<h3>Is the customer taking the car now?</h3><div class="row"><label class="check"><input type="radio" name="mode" value="now" data-mode' . ($now === 'now' ? ' checked' : '') . '> Yes, hand over the car now</label><label class="check"><input type="radio" name="mode" value="later" data-mode' . ($now === 'later' ? ' checked' : '') . '> No, reserve it for later</label></div>';
        $h .= '<div class="stack" data-now><h3>Condition before rental</h3>' . checklist_fields('handover', null) . '<label class="check"><input type="checkbox" name="ack_docs" value="1"> I have checked this car\'s papers <span class="muted small">(only asked if a document date you entered has passed)</span></label></div>';
    }
    $h .= '<div class="row"><button class="btn primary">' . ($isNew ? 'Save rental' : 'Save changes') . '</button><a class="btn ghost" href="' . e($isNew ? url('rentals') : url('booking', ['id' => $b['id']])) . '">Cancel</a></div></form>';
    return $h;
}

/* Condition check fields, used before the rental (handover) and at return. */
function checklist_fields($stage, $vehicle, $prev = null) {
    $ret = $stage === 'return';
    $h = '<div class="grid3">' . field($ret ? 'Final kilometre reading *' : 'Starting kilometre reading *', inp('odometer', $ret ? '' : ($vehicle['odometer'] ?? ''), 'number', 'min="0" inputmode="numeric" data-odo-input' . ($ret ? ' required' : '')), $prev ? 'At start: ' . number_format($prev['odometer']) . ' km' : ($vehicle ? 'Car\'s last reading: ' . number_format($vehicle['odometer']) . ' km' : '<span data-odo-hint></span>'))
        . field('Fuel level (optional)', sel('fuel_level', FUEL_LEVELS, $prev['fuel_level'] ?? 'Full', '', '—'), $prev ? 'At start: ' . e($prev['fuel_level'] ?: '—') : '')
        . field('Car condition', sel('condition', CONDITIONS, 'Good')) . '</div><div class="checks-grid">';
    foreach (check_items() as $it) $h .= '<label class="check"><input type="checkbox" name="items[]" value="' . e($it) . '" checked> ' . e($it) . '</label>';
    return $h . '</div>' . field($ret ? 'Condition notes' : 'Existing scratches or dents (before rental)', txt('damage_notes', '', 'placeholder="' . ($ret ? 'e.g. Interior dirty' : 'e.g. Scratch on rear bumper') . '"'))
        . field('Photos (optional)', '<input type="file" name="photos[]" accept="image/*" multiple>');
}

function save_checklist($bookingId, $stage, $odo) {
    insert('checklists', ['booking_id' => $bookingId, 'stage' => $stage, 'odometer' => $odo, 'fuel_level' => in_array(post('fuel_level'), FUEL_LEVELS, true) ? post('fuel_level') : null,
        'items' => json_encode(array_values(array_intersect(check_items(), (array)($_POST['items'] ?? [])))), 'damage_notes' => mb_substr(post('damage_notes'), 0, 2000),
        'condition_note' => in_array(post('condition'), CONDITIONS, true) ? post('condition') : null, 'override_reason' => post('ack_docs') === '1' ? 'Documents warning acknowledged' : null,
        'created_by' => current_user()['id'], 'created_at' => now()]);
    foreach (array_keys($_FILES['photos']['name'] ?? []) as $i) {
        if (($_FILES['photos']['error'][$i] ?? 4) === UPLOAD_ERR_NO_FILE) continue;
        $_FILES['one'] = array_map(fn($x) => $x[$i], $_FILES['photos']);
        handle_upload('one', $stage === 'return' ? 'return_photo' : 'handover_photo', $bookingId, true);
    }
}

/* Hand the car to the customer: records the before-rental condition and makes the rental active. */
function do_handover(array $b, array $v, $when) {
    if (!ctype_digit(post('odometer'))) throw new UserError('Enter the starting kilometre reading.');
    $odo = (int)post('odometer');
    if ($odo < (int)$v['odometer']) throw new UserError('The starting reading is lower than the car\'s last reading (' . number_format($v['odometer']) . ' km). Check it.');
    if ($other = row("SELECT code FROM bookings WHERE vehicle_id = ? AND status = 'active' AND id <> ?", [$v['id'], $b['id']])) throw new UserError("{$v['reg_no']} is still out on rental {$other['code']}. Record that return first.");
    if (in_array($v['status_override'], ['maintenance', 'unavailable'], true)) throw new UserError("{$v['reg_no']} is marked " . strtolower(VEHICLE_STATUS_LABEL[$v['status_override']]) . '. Change its status on the car page first.');
    $expired = expired_docs($v);
    if ($expired && post('ack_docs') !== '1')
        throw new UserError('Reminder: ' . implode(', ', $expired) . " for {$v['reg_no']} (by the date you entered). Tick \"I have checked this car's papers\" to continue.");
    save_checklist($b['id'], 'handover', $odo);
    update('bookings', $b['id'], ['status' => 'active', 'actual_start' => $when, 'updated_at' => now()]);
    update('vehicles', $v['id'], ['odometer' => $odo, 'updated_at' => now()]);
    audit('handover', 'booking', $b['id'], ['odometer' => $odo]);
}

/* Documents whose entered expiry date has passed. Missing dates only show as reminders and never stop a rental. */
function expired_docs($v) {
    return array_values(array_map(fn($i) => $i['type']['name'] . ' expired on ' . fmt_d($i['doc']['expiry_date']), array_filter(vehicle_compliance($v)['items'], fn($i) => $i['state'] === 'expired')));
}
function docs_ack($v) {
    $bad = expired_docs($v);
    if (!$bad) return '';
    return '<div class="flash error">Reminder for ' . e($v['reg_no']) . ': ' . e(implode(', ', $bad)) . '.</div><label class="check"><input type="checkbox" name="ack_docs" value="1"> I have checked this car\'s papers</label>';
}

function page_rentals() {
    require_perm('bookings');
    $tab = get('show', 'active'); $qs = get('q');
    $where = '1=1'; $p = [];
    if ($qs !== '') { $where = '(b.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR v.reg_no LIKE ?)'; $p = array_fill(0, 4, "%$qs%"); }
    $all = bookings_where($where, $p, 'b.start_at DESC');
    $groups = ['active' => fn($b) => in_array($b['view_status'], ['active', 'extended', 'overdue'], true), 'upcoming' => fn($b) => $b['view_status'] === 'upcoming', 'overdue' => fn($b) => $b['view_status'] === 'overdue',
        'extended' => fn($b) => $b['ext_count'] > 0 && $b['status'] !== 'cancelled', 'completed' => fn($b) => $b['status'] === 'completed', 'cancelled' => fn($b) => $b['status'] === 'cancelled', 'all' => fn($b) => true];
    $labels = ['active' => 'Active trips', 'upcoming' => 'Upcoming', 'overdue' => 'Overdue', 'extended' => 'Extended', 'completed' => 'Completed', 'cancelled' => 'Cancelled', 'all' => 'All'];
    if (!isset($groups[$tab])) $tab = 'active';
    $list = array_values(array_filter($all, $groups[$tab]));
    if ($tab === 'active') usort($list, fn($a, $b) => ts($a['end_at']) <=> ts($b['end_at']));
    if ($tab === 'upcoming') usort($list, fn($a, $b) => ts($a['start_at']) <=> ts($b['start_at']));
    $h = page_head('Rentals', '', btn('New rental', url('booking_new'), 'primary'));
    $h .= '<div class="chips">';
    foreach ($labels as $k => $l) $h .= '<a class="chip' . ($tab === $k ? ' on' : '') . '" href="' . e(url('rentals', ['show' => $k, 'q' => $qs])) . '">' . e($l) . ' <b>' . count(array_filter($all, $groups[$k])) . '</b></a>';
    $h .= '</div><form class="filters" method="get"><input type="hidden" name="p" value="rentals"><input type="hidden" name="show" value="' . e($tab) . '"><input type="search" name="q" value="' . e($qs) . '" placeholder="Search customer, phone, car or rental number"><button class="btn">Search</button></form>';
    $money = can('payments'); $trs = [];
    foreach (array_slice($list, 0, 500) as $b) {
        $cells = ['<b>' . e($b['customer_name']) . '</b><small><a href="tel:' . e($b['customer_phone']) . '">' . e($b['customer_phone']) . '</a></small>', '<b>' . e($b['reg_no']) . '</b><small>' . e($b['code']) . '</small>',
            e(fmt_dt($b['actual_start'] ?: $b['start_at'])), e(fmt_dt($b['end_at'])) . ($b['status'] === 'active' ? '<small>' . time_left($b) . '</small>' : ($b['actual_end'] ? '<small>returned ' . e(fmt_dt($b['actual_end'])) . '</small>' : ''))];
        if ($money) array_push($cells, money($b['total']), money($b['paid']), $b['balance'] > 0 ? '<b class="red">' . money($b['balance']) . '</b>' : badge(PAY_STATUS_LABEL[$b['pay_status']], tone_for($b['pay_status'])));
        $cells[] = badge(BOOKING_STATUS_LABEL[$b['view_status']], tone_for($b['view_status']));
        $trs[] = tr($cells, url('booking', ['id' => $b['id']]));
    }
    $head = array_merge(['Customer', 'Car', 'Start', 'Expected return'], $money ? ['Rental amount', 'Received', 'Remaining'] : [], ['Status']);
    $h .= '<div class="card flush">' . table($head, $trs, ['active' => 'No cars are out with customers right now.', 'upcoming' => 'No upcoming rentals.'][$tab] ?? 'Nothing here.') . '</div>';
    render_page('Rentals', $h, 'rentals');
}

function page_booking_new() {
    require_perm('bookings');
    if (is_post()) {
        [$d, $v] = booking_from_post();
        $now = post('mode') !== 'later';
        if (post('auto_price') === '1' || !can('payments')) {
            $d['agreed_amount'] = suggested_amount($v, $d['start_at'], $d['end_at'], $d['rate_type']);
            $d['deposit_amount'] = 0; $d['due_date'] = substr($d['end_at'], 0, 10);
        }
        if ($d['km_limit'] === null) $d['km_limit'] = $v['km_limit_per_day'] ?: null;
        $advance = can('payments') ? money_post('advance', 'advance payment') : 0;
        $depNow = can('payments') ? money_post('deposit_now', 'deposit received') : 0;
        $extra = can('payments') ? money_post('extra_amount', 'additional charge') : 0;
        if ($extra > 0 && post('extra_label') === '') throw new UserError('Write what the additional charge is for.');
        if ($now && ts($d['start_at']) > ts(now()) + 6 * 3600) throw new UserError('The start time is in the future. Choose "reserve it for later", or set the start to now.');
        if ($advance > $d['agreed_amount'] + $extra) throw new UserError('The advance is more than the total rental amount.');
        $id = tx(function () use ($d, $v, $now, $advance, $depNow, $extra) {
            $id = insert('bookings', $d + ['code' => next_code('bookings', 'code', setting('booking_prefix', 'R')), 'status' => 'confirmed', 'discount' => 0, 'created_by' => current_user()['id'], 'created_at' => now(), 'updated_at' => now()]);
            audit('create', 'booking', $id, ['vehicle' => $d['vehicle_id'], 'amount' => $d['agreed_amount'], 'start_now' => $now]);
            if ($extra > 0) insert('booking_charges', ['booking_id' => $id, 'kind' => 'other', 'label' => mb_substr(post('extra_label'), 0, 120), 'amount' => $extra, 'created_by' => current_user()['id'], 'created_at' => now()]);
            if ($now) do_handover(booking_get($id), $v, $d['start_at']);
            if ($advance > 0) record_payment(booking_get($id), 'rental', $advance, post('method'), post('reference'), now(), 'Advance payment', true);
            if ($depNow > 0) record_payment(booking_get($id), 'deposit', $depNow, post('method'), post('reference'), now(), 'Security deposit');
            return $id;
        });
        flash('success', $now ? "Rental saved. {$v['reg_no']} is now Currently rented." : "Reservation saved. {$v['reg_no']} is reserved for this customer.");
        redirect('booking', ['id' => $id]);
    }
    render_page('New rental', page_head('New rental') . booking_form(), 'rentals');
}

function page_booking() {
    require_perm('bookings');
    $id = (int)get('id');
    $b = booking_get($id);
    if (!$b) throw new UserError('Rental not found.');
    $v = row('SELECT * FROM vehicles WHERE id = ?', [$b['vehicle_id']]);
    $me = current_user()['id'];

    if (is_post()) {
        $a = post('action');
        $back = function ($msg) use ($id) { flash('success', $msg); redirect('booking', ['id' => $id]); };
        if (str_starts_with($a, 'damage_')) { require_once __DIR__ . '/damage.php'; damage_post($b['vehicle_id'], $id, $b['customer_id']); redirect('booking', ['id' => $id]); }
        switch ($a) {
            case 'update':
                if (!in_array($b['status'], ['confirmed', 'active'], true)) throw new UserError('This rental is closed and cannot be edited.');
                [$d] = booking_from_post($b);
                if ($b['status'] === 'active') { unset($d['start_at'], $d['vehicle_id']); if (isset($d['end_at']) && $d['end_at'] !== $b['end_at']) throw new UserError('To change the return date of an active trip, use "Extend trip" so the change is recorded.'); }
                update('bookings', $id, $d + ['updated_at' => now()]);
                $diff = []; foreach ($d as $k => $val) if ((string)$val !== (string)$b[$k]) $diff[$k] = [$b[$k], $val];
                audit('update', 'booking', $id, $diff);
                $back('Rental updated.');
            case 'handover':
                if ($b['status'] !== 'confirmed') throw new UserError('This rental has already started or is closed.');
                tx(fn() => do_handover($b, $v, parse_dt(post('when')) ?: now()));
                $back("Car handed over. {$v['reg_no']} is now Currently rented.");
            case 'return':
                if ($b['status'] !== 'active') throw new UserError('Only active trips can be returned.');
                $when = parse_dt(post('when')) ?: now();
                if (ts($when) > ts(now()) + 600) throw new UserError('The return time cannot be in the future.');
                if (ts($when) < ts($b['actual_start'] ?: $b['start_at'])) throw new UserError('The return time is before the trip started.');
                $odo = km_post('odometer', 'final kilometre reading');
                $hand = row("SELECT * FROM checklists WHERE booking_id = ? AND stage = 'handover' ORDER BY id DESC LIMIT 1", [$id]);
                if ($hand && $odo < (int)$hand['odometer']) throw new UserError('The final reading is lower than the starting reading (' . number_format($hand['odometer']) . ' km).');
                $charges = [];
                if (post('add_late') === '1') $charges[] = ['late', 'Late return charge', money_post('late_amount', 'late return charge', false)];
                if (post('add_km') === '1') $charges[] = ['extra_km', 'Extra km charge', money_post('km_amount', 'extra km charge', false)];
                if (post('add_other') === '1') { if (post('other_label') === '') throw new UserError('Write what the other charge is for.'); $charges[] = ['other', post('other_label'), money_post('other_amount', 'other charge', false)]; }
                if ($charges && !can('payments')) throw new UserError('Only someone with access to money can add charges.');
                $newDamage = post('new_damage') === '1';
                $dmgEst = $newDamage ? money_post('damage_estimate', 'repair estimate') : 0;
                if ($newDamage && post('damage_description') === '') throw new UserError('Describe the new damage.');
                $chargeDamage = $newDamage && post('charge_damage') === '1';
                if ($chargeDamage && !can('void')) throw new UserError('Only the owner can approve a damage charge.');
                $dmgCharge = $chargeDamage ? money_post('damage_charge', 'damage charge', false) : 0;
                $payNow = can('payments') ? money_post('pay_now', 'payment received now') : 0;
                $refund = can('payments') && post('refund_deposit') === '1' ? money_post('refund_amount', 'deposit returned', false) : 0;
                tx(function () use ($id, $b, $v, $when, $odo, $charges, $newDamage, $dmgEst, $chargeDamage, $dmgCharge, $payNow, $refund, $me) {
                    save_checklist($id, 'return', $odo);
                    foreach ($charges as [$kind, $label, $amt]) insert('booking_charges', ['booking_id' => $id, 'kind' => $kind, 'label' => mb_substr($label, 0, 120), 'amount' => $amt, 'created_by' => $me, 'created_at' => now()]);
                    if ($newDamage) {
                        require_once __DIR__ . '/damage.php';
                        $did = damage_add($v['id'], $id, $b['customer_id'], post('damage_description'), $dmgEst);
                        damage_photos($did);
                        if ($chargeDamage) damage_decide($did, true, $dmgCharge, 'Approved at return');
                    }
                    update('bookings', $id, ['status' => 'completed', 'actual_end' => $when, 'updated_at' => now()]);
                    if ($odo > (int)$v['odometer']) update('vehicles', $v['id'], ['odometer' => $odo, 'updated_at' => now()]);
                    if (post('condition') && in_array(post('condition'), CONDITIONS, true)) update('vehicles', $v['id'], ['condition_note' => post('condition') . (post('damage_notes') ? ': ' . mb_substr(post('damage_notes'), 0, 200) : '')]);
                    $nb = booking_get($id);
                    if ($payNow > 0) { if ($payNow > $nb['balance']) throw new UserError('The payment received is more than the remaining ' . money(max(0, $nb['balance'])) . '.'); record_payment($nb, 'rental', $payNow, post('pay_method'), post('pay_reference'), now(), 'Paid at return'); }
                    if ($refund > 0) record_payment(booking_get($id), 'deposit_out', $refund, post('pay_method'), '', now(), 'Deposit returned at vehicle return');
                    audit('return', 'booking', $id, ['odometer' => $odo, 'charges' => $charges, 'damage' => $newDamage, 'paid_now' => $payNow, 'deposit_refund' => $refund]);
                });
                $nb = booking_get($id);
                $back("Return completed. {$v['reg_no']} is available again." . ($nb['balance'] > 0 ? ' The customer still owes ' . money($nb['balance']) . ' (shown in Money Due).' : ' Fully paid.') . ($newDamage && !$chargeDamage ? ' The damage is waiting for the owner\'s decision.' : ''));
            case 'extend':
                if (!in_array($b['status'], ['confirmed', 'active'], true)) throw new UserError('Only upcoming or active trips can be extended.');
                $new = parse_dt(post('new_end'));
                if (!$new || ts($new) <= ts($b['end_at'])) throw new UserError('The new return time must be later than ' . fmt_dt($b['end_at']) . '.');
                if ($c = booking_conflicts($v['id'], $b['start_at'], $new, $id)) throw new UserError("Can't extend: {$v['reg_no']} is reserved for {$c[0]['customer_name']} from " . fmt_dt($c[0]['start_at']) . '.');
                $amt = can('payments') ? money_post('ext_amount', 'extra charge') : 0;
                if (post('ext_terms') === '' && $amt > 0) throw new UserError('Write the agreed terms for the extra charge (e.g. "2 more days at ' . trim(currency_symbol()) . '3,000/day, agreed on phone").');
                tx(function () use ($id, $b, $new, $amt, $me) {
                    $cid = $amt > 0 ? insert('booking_charges', ['booking_id' => $id, 'kind' => 'extension', 'label' => 'Extension to ' . fmt_dt($new), 'amount' => $amt, 'created_by' => $me, 'created_at' => now()]) : null;
                    insert('booking_extensions', ['booking_id' => $id, 'old_end' => $b['end_at'], 'new_end' => $new, 'charge_id' => $cid, 'note' => mb_substr(post('ext_terms'), 0, 500), 'created_by' => $me, 'created_at' => now()]);
                    update('bookings', $id, ['end_at' => $new, 'due_date' => post('move_due') === '1' ? substr($new, 0, 10) : $b['due_date'], 'updated_at' => now()]);
                    audit('extend', 'booking', $id, ['from' => $b['end_at'], 'to' => $new, 'charge' => $amt, 'terms' => post('ext_terms')]);
                });
                $back('Trip extended to ' . fmt_dt($new) . ($amt > 0 ? ' with an extra ' . money($amt) . '.' : '. No extra charge was added.'));
            case 'cancel':
                if ($b['status'] !== 'confirmed') throw new UserError('Only upcoming rentals can be cancelled. For an active trip, record the return.');
                if (post('reason') === '') throw new UserError('Write the reason for cancelling.');
                update('bookings', $id, ['status' => 'cancelled', 'cancel_reason' => mb_substr(post('reason'), 0, 500), 'updated_at' => now()]);
                audit('cancel', 'booking', $id, post('reason'));
                $nb = booking_get($id);
                $back('Rental cancelled. The car is free for those dates.' . ($nb['paid'] > 0 ? ' ' . money($nb['paid']) . ' rent was paid: record a refund, or add a cancellation charge.' : '') . ($nb['deposit_held'] > 0 ? ' Return the deposit of ' . money($nb['deposit_held']) . '.' : ''));
            case 'payment':
                require_perm('payments');
                $amt = money_post('amount', 'payment', false);
                $when = parse_dt(post('paid_at')) ?: now();
                if (substr($when, 0, 16) === substr(now(), 0, 16)) $when = now(); // "now" keeps its seconds so the history stays in order
                if (ts($when) > ts(now()) + 300) throw new UserError('The payment date cannot be in the future.');
                $pid = record_payment($b, post('kind'), $amt, post('method'), post('reference'), $when, mb_substr(post('note'), 0, 500));
                redirect('booking', ['id' => $id, 'receipt' => $pid]);
            case 'void_payment':
                require_perm('void');
                $p = row('SELECT * FROM payments WHERE id = ? AND booking_id = ?', [(int)post('payment_id'), $id]);
                if (!$p || $p['voided']) throw new UserError('Payment not found.');
                if (post('reason') === '') throw new UserError('Write why this payment is being cancelled.');
                if ($p['kind'] === 'deposit' && $b['deposit_held'] - $p['amount'] < 0) throw new UserError('Cancel the deposit return first.');
                update('payments', $p['id'], ['voided' => 1, 'void_reason' => mb_substr(post('reason'), 0, 500), 'voided_by' => $me, 'voided_at' => now()]);
                audit('void', 'payment', $p['id'], ['amount' => $p['amount'], 'reason' => post('reason')]);
                $back('Payment cancelled. It stays in the history, crossed out, with the reason.');
            case 'charge':
                require_perm('payments');
                $amt = money_post('charge_amount', 'charge', false);
                if (post('charge_label') === '') throw new UserError('Write what the charge is for and what was agreed.');
                $cid = insert('booking_charges', ['booking_id' => $id, 'kind' => 'other', 'label' => mb_substr(post('charge_label'), 0, 120), 'amount' => $amt, 'created_by' => $me, 'created_at' => now()]);
                audit('charge', 'booking', $id, ['charge' => $cid, 'amount' => $amt, 'label' => post('charge_label')]);
                $back('Charge added.');
            case 'void_charge':
                require_perm('void');
                $c = row('SELECT * FROM booking_charges WHERE id = ? AND booking_id = ? AND voided = 0', [(int)post('charge_id'), $id]);
                if (!$c) throw new UserError('Charge not found.');
                if ($b['paid'] > $b['total'] - $c['amount']) throw new UserError('Payments already cover this charge. Refund first, then remove the charge.');
                update('booking_charges', $c['id'], ['voided' => 1, 'void_reason' => 'Removed by owner']);
                if ($c['kind'] === 'damage') q("UPDATE damages SET status = 'review', charge_id = NULL, charge_amount = 0 WHERE charge_id = ?", [$c['id']]);
                audit('void', 'charge', $c['id'], ['amount' => $c['amount']]);
                $back('Charge removed.');
        }
        redirect('booking', ['id' => $id]);
    }

    if (get('tab') === 'edit') {
        if (!in_array($b['status'], ['confirmed', 'active'], true)) throw new UserError('This rental is closed and cannot be edited.');
        render_page('Edit ' . $b['code'], page_head('Edit rental ' . $b['code']) . booking_form($b), 'rentals'); return;
    }

    $c = row('SELECT * FROM customers WHERE id = ?', [$b['customer_id']]);
    $vs = $b['view_status'];
    $hand = row("SELECT k.*, u.name AS by_name FROM checklists k LEFT JOIN users u ON u.id = k.created_by WHERE booking_id = ? AND stage = 'handover' ORDER BY k.id DESC LIMIT 1", [$id]);
    $ret = row("SELECT k.*, u.name AS by_name FROM checklists k LEFT JOIN users u ON u.id = k.created_by WHERE booking_id = ? AND stage = 'return' ORDER BY k.id DESC LIMIT 1", [$id]);
    $acts = (in_array($b['status'], ['confirmed', 'active'], true) ? btn('Edit', url('booking', ['id' => $id, 'tab' => 'edit'])) : '') . ($c ? '<a class="btn ghost" href="tel:' . e($c['phone']) . '">Call customer</a>' : '');
    $h = page_head('Rental ' . $b['code'], badge(BOOKING_STATUS_LABEL[$vs], tone_for($vs)) . ' · ' . e($b['customer_name']) . ' · ' . e($b['reg_no']), $acts);
    if ($r = (int)get('receipt')) $h .= '<div class="flash success">Payment saved' . (($rn = val('SELECT receipt_no FROM payments WHERE id = ? AND booking_id = ?', [$r, $id])) ? ' (receipt ' . e($rn) . ')' : '') . '. <a href="' . e(url('receipt', ['id' => $r])) . '" target="_blank">Print receipt</a></div>';
    if ($vs === 'overdue') $h .= '<div class="flash error">Return overdue by ' . e(human_duration(ts(now()) - ts($b['end_at']))) . '. Call the customer, then extend the trip or record the return.</div>';

    $days = rental_days($b['actual_start'] ?: $b['start_at'], $b['actual_end'] ?: $b['end_at']);
    $h .= '<div class="grid2"><div class="card"><h3>Trip</h3><dl class="kv">'
        . '<dt>Customer</dt><dd>' . ($c ? '<a href="' . e(url('customer', ['id' => $c['id']])) . '">' . e($c['name']) . '</a> · <a href="tel:' . e($c['phone']) . '">' . e($c['phone']) . '</a>' : '—') . '</dd>'
        . '<dt>Car</dt><dd><a href="' . e(url('vehicle', ['id' => $v['id']])) . '">' . e($v['reg_no'] . ' · ' . $v['name']) . '</a></dd>'
        . '<dt>Start</dt><dd>' . e(fmt_dt($b['actual_start'] ?: $b['start_at'])) . ($b['status'] === 'confirmed' ? ' <span class="muted">(planned)</span>' : '') . '</dd>'
        . '<dt>Expected return</dt><dd>' . e(fmt_dt($b['end_at'])) . ($b['status'] === 'active' ? '<br><small>' . time_left($b) . '</small>' : '') . '</dd>'
        . ($b['actual_end'] ? '<dt>Returned</dt><dd>' . e(fmt_dt($b['actual_end'])) . '</dd>' : '')
        . '<dt>Duration</dt><dd>' . $days . ' day' . ($days === 1 ? '' : 's') . '</dd>'
        . ($hand ? '<dt>Starting km</dt><dd>' . number_format($hand['odometer']) . '</dd>' : '') . ($ret ? '<dt>Final km</dt><dd>' . number_format($ret['odometer']) . ' <span class="muted">(' . number_format($ret['odometer'] - ($hand['odometer'] ?? $ret['odometer'])) . ' km driven)</span></dd>' : '')
        . ($b['km_limit'] ? '<dt>Free km</dt><dd>' . (int)$b['km_limit'] . ' per day</dd>' : '') . ($b['pickup_location'] ? '<dt>Pickup</dt><dd>' . e($b['pickup_location']) . '</dd>' : '')
        . ($b['notes'] ? '<dt>Conditions</dt><dd>' . nl2br(e($b['notes'])) . '</dd>' : '') . ($b['cancel_reason'] ? '<dt>Cancelled</dt><dd>' . e($b['cancel_reason']) . '</dd>' : '') . '</dl></div>';

    if (can('payments')) {
        $charges = rows('SELECT * FROM booking_charges WHERE booking_id = ? ORDER BY id', [$id]);
        $h .= '<div class="card money"><h3>Money</h3><dl class="kv"><dt>Rental amount</dt><dd>' . money($b['status'] === 'cancelled' ? 0 : $b['agreed_amount']) . ' <small class="muted">' . e(RATE_TYPES[$b['rate_type']] ?? '') . '</small></dd>';
        foreach ($charges as $ch) $h .= '<dt>' . e($ch['label']) . '</dt><dd>' . ($ch['voided'] ? '<s>' . money($ch['amount']) . '</s> <small>removed</small>' : '+' . money($ch['amount'])) . (is_owner() && !$ch['voided'] ? form_open('void_charge', 'class="inline" data-confirm="Remove this charge?"') . '<input type="hidden" name="charge_id" value="' . $ch['id'] . '"> <button class="link">remove</button></form>' : '') . '</dd>';
        if ($b['discount'] && $b['status'] !== 'cancelled') $h .= '<dt>Discount</dt><dd>−' . money($b['discount']) . '</dd>';
        $h .= '<dt class="tot">Total payable</dt><dd class="tot">' . money($b['total']) . '</dd>'
            . '<dt>Advance payment</dt><dd>' . money($b['advance_paid']) . '</dd><dt>Additional payments</dt><dd>' . money($b['paid'] - $b['advance_paid']) . '</dd>'
            . '<dt>Total received</dt><dd>' . money($b['paid']) . '</dd>'
            . '<dt class="tot">' . ($b['balance'] < 0 ? 'Refund due to customer' : 'Remaining') . '</dt><dd class="tot ' . ($b['balance'] > 0 ? 'red' : 'green') . '">' . money(abs($b['balance'])) . '</dd>'
            . '<dt>Payment status</dt><dd>' . badge(PAY_STATUS_LABEL[$b['pay_status']], tone_for($b['pay_status'])) . ($b['overdue_days'] ? ' ' . $b['overdue_days'] . ' day(s) overdue' : '') . '</dd><dt>Payment due</dt><dd>' . e(fmt_d($b['due_date'])) . '</dd>'
            . '<dt>Security deposit</dt><dd>' . money($b['deposit_in']) . ' received' . ($b['deposit_out'] ? ' · ' . money($b['deposit_out']) . ' returned' : '') . '<br><small class="muted">Held now: ' . money($b['deposit_held']) . '. Not counted as rent.</small></dd></dl>';
        if ($c && $b['balance'] > 0) $h .= '<a class="btn ghost small" target="_blank" rel="noopener" href="' . e(wa_link($c['phone'], "Hello {$c['name']}, a reminder from " . setting('business_name') . ' that ' . money($b['balance']) . " is pending for rental {$b['code']} ({$v['reg_no']}). Thank you.")) . '">WhatsApp reminder</a>';
        $h .= '</div>';
    }
    $h .= '</div>';

    // next step
    if ($b['status'] === 'confirmed') {
        $h .= form_open('handover', 'class="card stack" id="handover"', true) . '<h3>Customer takes the car</h3><div class="grid3">' . field('Handed over at', inp('when', date('Y-m-d\TH:i', strtotime(now())), 'datetime-local', 'required')) . '</div>'
            . checklist_fields('handover', $v) . docs_ack($v) . '<button class="btn primary">Hand over car</button></form>';
    }
    if ($b['status'] === 'active') $h .= return_form($b, $v, $hand);
    if (in_array($b['status'], ['confirmed', 'active'], true)) {
        $perDay = (int)round(((int)$b['agreed_amount'] - (int)$b['discount']) / max(1, rental_days($b['start_at'], $b['end_at'])));
        $h .= form_open('extend', 'class="card stack" id="extend"') . '<h3>Extend trip</h3><div class="grid3">' . field('New expected return', inp('new_end', dt_input(date('Y-m-d H:i:s', strtotime($b['end_at'] . ' +1 day'))), 'datetime-local', 'required data-ext-end data-old-end="' . e(dt_input($b['end_at'])) . '" data-per-day="' . $perDay . '"'));
        if (can('payments')) $h .= field('Extra charge agreed', money_in('ext_amount', $perDay, 'data-ext-amount'), 'Suggested: ' . money($perDay) . ' per extra day. Change it to what you agreed.');
        $h .= field('Agreed terms', inp('ext_terms', '', 'text', 'placeholder="e.g. 1 more day at the same rate, agreed on phone"')) . '</div><label class="check"><input type="checkbox" name="move_due" value="1" checked> Move the payment due date to the new return date</label><button class="btn">Extend trip</button></form>';
    }

    if (can('payments')) {
        $h .= '<h2>Payments</h2><div class="grid2"><div class="card flush">';
        $trs = [];
        foreach (rows('SELECT p.*, u.name AS by_name FROM payments p LEFT JOIN users u ON u.id = p.created_by WHERE booking_id = ? ORDER BY paid_at, id', [$id]) as $p) {
            $void = is_owner() && !$p['voided'] ? form_open('void_payment', 'class="inline" data-prompt="Why are you cancelling this payment?"') . '<input type="hidden" name="payment_id" value="' . $p['id'] . '"><input type="hidden" name="reason"><button class="link">cancel</button></form>' : '';
            $trs[] = tr([e(fmt_dt($p['paid_at'])), e(PAY_KIND_LABEL[$p['kind']]) . ($p['is_advance'] ? '<small>advance</small>' : ''), $p['voided'] ? '<s>' . money($p['amount']) . '</s> ' . badge('Cancelled', 'grey') . '<small>' . e($p['void_reason']) . '</small>' : money($p['amount']),
                e($p['method']) . ($p['reference'] ? '<small>' . e($p['reference']) . '</small>' : '') . ($p['note'] ? '<small>' . e($p['note']) . '</small>' : ''), '<a href="' . e(url('receipt', ['id' => $p['id']])) . '" target="_blank">' . e($p['receipt_no']) . '</a> ' . $void]);
        }
        $h .= table(['Date', 'Type', 'Amount', 'Method', 'Receipt'], $trs, 'No payments yet.') . '</div>';
        $kinds = ['rental' => 'Rent payment', 'deposit' => 'Security deposit received', 'deposit_out' => 'Security deposit returned', 'refund' => 'Rent refunded'];
        $h .= '<div>' . form_open('payment', 'class="card stack"') . '<h3>Record payment</h3><div class="grid2">' . field('Type', sel('kind', $kinds, 'rental')) . field('Amount', money_in('amount', $b['balance'] > 0 ? $b['balance'] : '', 'required'))
            . field('Method', sel('method', PAY_METHODS, default_pay_method())) . field('Transaction reference', inp('reference', '', 'text', 'placeholder="Optional"')) . field('Date and time', inp('paid_at', date('Y-m-d\TH:i', strtotime(now())), 'datetime-local')) . field('Note', inp('note', '', 'text', 'placeholder="Optional"')) . '</div>'
            . '<p class="muted small">Part payments are fine. Every payment is kept; a mistake is cancelled by the owner, never deleted.</p><button class="btn primary">Save payment</button></form>';
        if ($b['status'] !== 'cancelled') $h .= form_open('charge', 'class="card stack"') . '<h3>Add an agreed charge</h3><div class="grid2">' . field('What was agreed', inp('charge_label', '', 'text', 'placeholder="e.g. Fuel refill agreed with customer"')) . field('Amount', money_in('charge_amount', '')) . '</div><button class="btn">Add charge</button></form>';
        $h .= '</div></div>';
    }

    if ($hand || $ret) $h .= compare_card($id, $hand, $ret);
    require_once __DIR__ . '/damage.php';
    $dm = damage_rows('d.booking_id = ?', [$id]);
    if ($dm || $b['status'] === 'completed') $h .= '<h2 id="damage">Damage</h2><div class="card">' . damage_list($dm, 'rental') . '</div>' . ($b['status'] === 'completed' && can('bookings') ? '<details class="card"><summary>Record damage found later for this rental</summary>' . damage_form('Record damage') . '</details>' : '');
    $ext = rows('SELECT * FROM booking_extensions WHERE booking_id = ? ORDER BY id', [$id]);
    if ($ext) { $h .= '<h2>Extensions</h2><div class="card"><ul class="timeline">'; foreach ($ext as $x) $h .= '<li>' . e(fmt_dt($x['old_end'])) . ' → <b>' . e(fmt_dt($x['new_end'])) . '</b>' . ($x['note'] ? ' · ' . e($x['note']) : '') . '<small>recorded ' . e(fmt_dt($x['created_at'])) . '</small></li>'; $h .= '</ul></div>'; }
    if ($b['status'] === 'confirmed') $h .= form_open('cancel', 'class="card danger stack" data-confirm="Cancel this rental?"') . '<h3>Cancel rental</h3>' . inp('reason', '', 'text', 'placeholder="Reason" required') . '<button class="btn ghost">Cancel rental</button></form>';
    render_page('Rental ' . $b['code'], $h, 'rentals');
}

function return_form(array $b, array $v, $hand) {
    $h = form_open('return', 'class="card stack" id="return"', true) . '<h3>Return the car</h3><div class="grid3">' . field('Actual return date and time *', inp('when', date('Y-m-d\TH:i', strtotime(now())), 'datetime-local', 'required')) . '</div>'
        . checklist_fields('return', $v, $hand);
    $h .= '<h3>New damage</h3><label class="check"><input type="checkbox" name="new_damage" value="1" data-toggle="#dmg"> The car has new damage</label><div id="dmg" class="stack" hidden>'
        . field('Damage description *', txt('damage_description', '', 'placeholder="What and where, e.g. dent on front right door"')) . '<div class="grid2">' . field('Repair estimate or actual cost', money_in('damage_estimate', '')) . field('Damage photos', '<input type="file" name="damage_photos[]" accept="image/*" multiple>') . '</div>';
    if (is_owner()) $h .= '<label class="check"><input type="checkbox" name="charge_damage" value="1"> I agree with the customer to charge for this damage</label>' . field('Damage charge', money_in('damage_charge', ''));
    $h .= '<p class="muted small">' . (is_owner() ? 'Leave the box unticked to decide later.' : 'The owner will decide whether to charge the customer.') . ' Nothing is charged automatically.</p></div>';
    if (can('payments')) {
        $late = max(0, (int)ceil((ts(now()) - ts($b['end_at'])) / 3600));
        $kmLimit = (int)$b['km_limit']; $days = rental_days($b['actual_start'] ?: $b['start_at'], now());
        $h .= '<h3>Additional charges (only if you tick them)</h3>'
            . '<div class="charge-row"><label class="check"><input type="checkbox" name="add_late" value="1"> Late return</label>' . money_in('late_amount', $late * (int)setting('late_fee_per_hour', 0)) . '<small class="muted">' . ($late ? "$late hour(s) late. Suggested at " . money(setting('late_fee_per_hour')) . '/hour.' : 'On time.') . '</small></div>'
            . '<div class="charge-row" data-extra-km data-start-odo="' . (int)($hand['odometer'] ?? $v['odometer']) . '" data-free="' . ($kmLimit * $days) . '" data-rate="' . (int)setting('extra_km_rate', 0) . '"><label class="check"><input type="checkbox" name="add_km" value="1"> Extra km</label>' . money_in('km_amount', 0) . '<small class="muted">' . ($kmLimit ? "Free: $kmLimit km/day × $days day(s). <span data-km-note></span>" : 'No free-km limit on this rental.') . '</small></div>'
            . '<div class="charge-row"><label class="check"><input type="checkbox" name="add_other" value="1"> Other</label>' . money_in('other_amount', 0) . inp('other_label', '', 'text', 'placeholder="What for?"') . '</div>';
        $h .= '<h3>Final payment</h3><div class="grid3">' . field('Payment received now', money_in('pay_now', ''), 'Remaining before charges: ' . money(max(0, $b['balance']))) . field('Paid by', sel('pay_method', array_values(array_diff(PAY_METHODS, ['Deposit adjustment'])), 'Cash')) . field('Reference', inp('pay_reference', '', 'text', 'placeholder="Optional"')) . '</div>';
        if ($b['deposit_held'] > 0) $h .= '<label class="check"><input type="checkbox" name="refund_deposit" value="1"> Return the security deposit now</label>' . field('Deposit returned', money_in('refund_amount', $b['deposit_held']), 'Held: ' . money($b['deposit_held']) . '. To use the deposit for dues, record a payment with method "Deposit adjustment" instead.');
    }
    return $h . '<button class="btn primary">Complete return</button></form>';
}

/* Before rental vs after return, side by side. */
function compare_card($id, $hand, $ret) {
    $row = function ($label, $a, $b) { $diff = $a !== null && $b !== null && (string)$a !== (string)$b; return '<tr><th>' . e($label) . '</th><td>' . ($a === null ? '—' : $a) . '</td><td' . ($diff ? ' class="changed"' : '') . '>' . ($b === null ? '—' : $b) . '</td></tr>'; };
    $items = fn($k) => $k ? e(implode(', ', json_decode($k['items'] ?: '[]', true) ?: []) ?: 'None ticked') : null;
    $missing = $hand && $ret ? array_diff(json_decode($hand['items'] ?: '[]', true) ?: [], json_decode($ret['items'] ?: '[]', true) ?: []) : [];
    $h = '<h2>Condition: before vs after</h2><div class="card flush"><div class="tw"><table class="compare"><thead><tr><th></th><th>Before rental</th><th>After return</th></tr></thead><tbody>'
        . $row('When', $hand ? e(fmt_dt($hand['created_at'])) . '<small>' . e($hand['by_name']) . '</small>' : null, $ret ? e(fmt_dt($ret['created_at'])) . '<small>' . e($ret['by_name']) . '</small>' : null)
        . $row('Kilometres', $hand ? number_format($hand['odometer']) : null, $ret ? number_format($ret['odometer']) : null)
        . $row('Fuel', $hand ? e($hand['fuel_level'] ?: '—') : null, $ret ? e($ret['fuel_level'] ?: '—') : null)
        . $row('Condition', $hand ? e($hand['condition_note'] ?: '—') : null, $ret ? e($ret['condition_note'] ?: '—') : null)
        . $row('Notes / marks', $hand ? nl2br(e($hand['damage_notes'] ?: 'None')) : null, $ret ? nl2br(e($ret['damage_notes'] ?: 'None')) : null)
        . $row('Checked OK', $items($hand), $items($ret))
        . ($missing ? '<tr><th>Not OK at return</th><td></td><td class="changed">' . e(implode(', ', $missing)) . '</td></tr>' : '') . '</tbody></table></div>';
    $ph = fn($e) => rows("SELECT * FROM files WHERE entity = ? AND entity_id = ? AND deleted = 0", [$e, $id]);
    $hp = $ph('handover_photo'); $rp = $ph('return_photo');
    if ($hp || $rp) {
        $h .= '<div class="grid2 pad">';
        foreach (['Before' => $hp, 'After' => $rp] as $lbl => $list) { $h .= '<div><h4>' . $lbl . '</h4><div class="photos">'; foreach ($list as $p) $h .= '<figure><a href="' . e(url('file', ['id' => $p['id']])) . '" target="_blank"><img loading="lazy" src="' . e(url('file', ['id' => $p['id']])) . '" alt="' . $lbl . ' photo"></a></figure>'; $h .= ($list ? '' : '<p class="muted small">No photos.</p>') . '</div></div>'; }
        $h .= '</div>';
    }
    return $h . '</div>';
}
