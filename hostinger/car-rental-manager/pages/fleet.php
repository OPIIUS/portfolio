<?php
defined('APP') or exit;

function vehicle_from_post($existing = null) {
    $d = [];
    $d['reg_no'] = strtoupper(preg_replace('/\s+/', ' ', post('reg_no')));
    if (!preg_match('/^[A-Z0-9 -]{4,20}$/', $d['reg_no'])) throw new UserError('Enter the registration number, e.g. AS01 AB 1234.');
    $dup = val('SELECT id FROM vehicles WHERE REPLACE(reg_no, \' \', \'\') = ? AND id <> ?', [str_replace(' ', '', $d['reg_no']), $existing['id'] ?? 0]);
    if ($dup) throw new UserError('Another car already has registration ' . $d['reg_no'] . '.');
    foreach (['name', 'make', 'colour', 'condition_note', 'notes'] as $k) $d[$k] = mb_substr(post($k), 0, in_array($k, ['notes', 'condition_note'], true) ? 2000 : 120);
    if ($d['name'] === '') throw new UserError('Enter the car name and model, e.g. Hyundai Creta SX.');
    $d['category'] = post('category'); if (!in_array($d['category'], categories(), true)) throw new UserError('Choose a category.');
    $d['fuel'] = in_array(post('fuel'), FUELS, true) ? post('fuel') : null;
    $d['transmission'] = in_array(post('transmission'), TRANSMISSIONS, true) ? post('transmission') : null;
    foreach (['odometer' => [0, 9999999], 'km_limit_per_day' => [0, 5000], 'last_service_km' => [0, 9999999], 'next_service_km' => [0, 9999999]] as $k => [$min, $max]) {
        $v = post($k);
        if ($v === '') { $d[$k] = null; continue; }
        if (!ctype_digit($v) || (int)$v < $min || (int)$v > $max) throw new UserError('Check the number for ' . str_replace('_', ' ', $k) . ' (whole kilometres, no letters).');
        $d[$k] = (int)$v;
    }
    if ($d['odometer'] === null) throw new UserError('Enter the current kilometre reading.');
    foreach (['last_service_date', 'next_service_date'] as $k) { $v = parse_date(post($k)); if ($v === false) throw new UserError('Check the date for ' . str_replace('_', ' ', $k) . '.'); $d[$k] = $v; }
    foreach (['daily_rate', 'monthly_rate'] as $k) { $v = parse_money(post($k)); if ($v === false) throw new UserError('Check the ' . ($k === 'daily_rate' ? 'daily' : 'monthly') . ' price (numbers only).'); $d[$k] = $v; }
    if ($existing && $d['odometer'] < (int)$existing['odometer'] && post('confirm_odo') !== '1')
        throw new UserError('The kilometre reading is lower than before (' . number_format($existing['odometer']) . ' km). Tick "the reading was corrected" if this is intended.');
    return $d;
}

function page_fleet() {
    require_perm('fleet');
    $map = fleet_status_map();
    $comp = fleet_compliance();
    $dmg = open_damage_by_vehicle();
    $qs = get('q'); $st = get('status'); $cat = get('category');
    $archived = get('archived') && is_owner();
    $all = rows('SELECT * FROM vehicles WHERE archived = ' . ($archived ? 1 : 0) . ' ORDER BY reg_no');
    $counts = []; foreach ($all as $v) $counts[$map[$v['id']]['status']] = ($counts[$map[$v['id']]['status']] ?? 0) + 1;
    $list = array_filter($all, function ($v) use ($qs, $st, $cat, $map, $dmg) {
        if ($qs !== '' && stripos($v['reg_no'] . ' ' . str_replace(' ', '', $v['reg_no']) . ' ' . $v['name'] . ' ' . $v['make'] . ' ' . $v['colour'], $qs) === false) return false;
        if ($st === 'damaged') return isset($dmg[$v['id']]);
        if ($st !== '' && $map[$v['id']]['status'] !== $st) return false;
        if ($cat !== '' && $v['category'] !== $cat) return false;
        return true;
    });
    $h = page_head($archived ? 'Removed cars' : 'Cars', count($all) . ' car' . (count($all) === 1 ? '' : 's'), can('fleet_edit') && !$archived ? btn('Add car', url('vehicle_new'), 'primary') : '');
    if (!$archived && ($need = cars_needing_details())) $h .= '<div class="flash info"><b>' . count($need) . ' car' . (count($need) === 1 ? '' : 's') . ' still need the real registration number or kilometre reading.</b> Open each one → Edit. ' . implode(', ', array_map(fn($c) => '<a href="' . e(url('vehicle', ['id' => $c['id'], 'tab' => 'edit'])) . '">' . e($c['reg_no']) . ' ' . e($c['name']) . '</a>', array_slice($need, 0, 8))) . (count($need) > 8 ? '…' : '') . '</div>';
    $h .= '<div class="chips">';
    foreach (['' => 'All'] + VEHICLE_STATUS_LABEL as $k => $l) $h .= '<a class="chip' . ($st === $k ? ' on' : '') . '" href="' . e(url('fleet', ['status' => $k] + ($archived ? ['archived' => 1] : []))) . '">' . e($l) . ' <b>' . ($k ? ($counts[$k] ?? 0) : count($all)) . '</b></a>';
    $h .= '<a class="chip' . ($st === 'damaged' ? ' on' : '') . '" href="' . e(url('fleet', ['status' => 'damaged'])) . '">Has damage <b>' . count(array_intersect_key($dmg, array_column($all, 'id', 'id'))) . '</b></a></div>';
    $h .= '<form class="filters" method="get"><input type="hidden" name="p" value="fleet"><input type="hidden" name="status" value="' . e($st) . '">' . ($archived ? '<input type="hidden" name="archived" value="1">' : '')
        . '<input type="search" name="q" value="' . e($qs) . '" placeholder="Search registration or name">' . sel('category', categories(), $cat, '', 'All categories') . '<button class="btn">Search</button></form>';
    $trs = [];
    foreach ($list as $v) {
        $m = $map[$v['id']]; $c = $comp[$v['id']]['overall'] ?? 'ok'; $s = service_info($v);
        $who = $m['active'] ? e($m['active']['customer_name']) . '<small>returns ' . e(fmt_dt($m['active']['end_at'])) . '</small>' : ($m['next'] ? '<small>Next: ' . e($m['next']['customer_name']) . ', ' . e(fmt_dt($m['next']['start_at'])) . '</small>' : '<small class="muted">—</small>');
        $trs[] = tr(['<b>' . e($v['reg_no']) . '</b><small>' . e($v['name']) . '</small>', badge(VEHICLE_STATUS_LABEL[$m['status']], tone_for($m['status'])) . ($m['late'] ? ' ' . badge('Overdue', 'red') : ''), $who,
            isset($dmg[$v['id']]) ? badge($dmg[$v['id']] . ' open', 'red') : '<span class="muted">None</span>', badge(SERVICE_STATE_LABEL[$s['state']], tone_for($s['state'])), badge(COMPLIANCE_LABEL[$c], tone_for($c)),
            number_format($v['odometer']) . ' km', can('payments') ? money($v['daily_rate']) . '<small>per day</small>' : ''], url('vehicle', ['id' => $v['id']]));
    }
    $h .= '<div class="card flush">' . table(['Car', 'Status', 'With customer', 'Damage', 'Service', 'Documents', 'Km', can('payments') ? 'Price' : ''], $trs, $all ? 'No cars match.' : 'No cars yet. Add your first car to get started.') . '</div>';
    if (is_owner()) $h .= '<p class="small"><a href="' . e(url('fleet', $archived ? [] : ['archived' => 1])) . '">' . ($archived ? '← Back to cars' : 'Show removed cars') . '</a></p>';
    render_page('Cars', $h, 'fleet');
}

function vehicle_form($v, $action) {
    $v = $v ?: []; $new = empty($v['id']);
    $g = fn($k, $def = '') => old($k, $v[$k] ?? $def);
    $h = form_open($action, 'class="card stack"', $new);
    $h .= '<div class="grid3">' . field('Registration number *', inp('reg_no', $g('reg_no'), 'text', 'required placeholder="AS01 AB 1234" autocapitalize="characters"'))
        . field('Car name and model *', inp('name', $g('name'), 'text', 'required placeholder="Hyundai Creta SX"')) . field('Manufacturer', inp('make', $g('make'), 'text', 'placeholder="Hyundai"'))
        . field('Category *', sel('category', categories(), $g('category'), 'required', 'Choose…')) . field('Fuel', sel('fuel', FUELS, $g('fuel'), '', '—'))
        . field('Transmission', sel('transmission', TRANSMISSIONS, $g('transmission'), '', '—')) . field('Colour', inp('colour', $g('colour')))
        . field('Current kilometre reading *', inp('odometer', $g('odometer'), 'number', 'min="0" required inputmode="numeric"'))
        . field('Current condition', inp('condition_note', $g('condition_note'), 'text', 'placeholder="Good. Small scratch on rear bumper"')) . '</div>';
    if (!$new) $h .= '<label class="check"><input type="checkbox" name="confirm_odo" value="1"> The reading was corrected (allow a lower number)</label>';
    $h .= '<h3>Price</h3><div class="grid3">' . field('Daily rental price', money_in('daily_rate', $g('daily_rate'))) . field('Monthly rental price', money_in('monthly_rate', $g('monthly_rate')))
        . field('Free km per day (optional)', inp('km_limit_per_day', $g('km_limit_per_day'), 'number', 'min="0" placeholder="e.g. 300"'), 'Used to suggest an extra-km charge at return.') . '</div>';
    $h .= '<h3>Service</h3><div class="grid3">' . field('Last service date', inp('last_service_date', $g('last_service_date'), 'date')) . field('Km at last service', inp('last_service_km', $g('last_service_km'), 'number', 'min="0"'))
        . field('Next service at (km)', inp('next_service_km', $g('next_service_km'), 'number', 'min="0"'), 'Empty = last service + ' . number_format((int)setting('default_service_km')) . ' km.')
        . field('Next service date', inp('next_service_date', $g('next_service_date'), 'date'), 'Optional.') . '</div>';
    if ($new) $h .= field('Photos (optional)', '<input type="file" name="photos[]" accept="image/jpeg,image/png,image/webp" multiple>', 'Photos of all sides help compare condition later.');
    $h .= field('Notes', txt('notes', $g('notes'))) . '<div class="row"><button class="btn primary">Save car</button><a class="btn ghost" href="' . e($new ? url('fleet') : url('vehicle', ['id' => $v['id']])) . '">Cancel</a></div></form>';
    return $h;
}

function save_vehicle_photos($id) {
    $n = 0;
    foreach (array_keys($_FILES['photos']['name'] ?? []) as $i) {
        if (($_FILES['photos']['error'][$i] ?? 4) === UPLOAD_ERR_NO_FILE) continue;
        $_FILES['one'] = array_map(fn($x) => $x[$i], $_FILES['photos']);
        if (handle_upload('one', 'vehicle_photo', $id, true)) $n++;
    }
    return $n;
}

function page_vehicle_new() {
    require_perm('fleet_edit');
    if (is_post()) {
        $d = vehicle_from_post();
        $id = tx(function () use ($d) {
            $id = insert('vehicles', $d + ['created_by' => current_user()['id'], 'created_at' => now(), 'updated_at' => now()]);
            save_vehicle_photos($id);
            audit('create', 'vehicle', $id, ['reg_no' => $d['reg_no']]);
            return $id;
        });
        flash('success', 'Car added. Add its insurance and PUC expiry dates below so you get reminders.');
        redirect('vehicle', ['id' => $id, 'tab' => 'upkeep']);
    }
    $count = (int)val('SELECT COUNT(*) FROM vehicles WHERE archived = 0'); $target = (int)setting('vehicle_count', 0);
    render_page('Add car', page_head('Add car', $target ? "$count of $target cars added" : '') . vehicle_form(null, 'create'), 'fleet');
}

function page_vehicle() {
    require_perm('fleet');
    $id = (int)get('id');
    $v = row('SELECT * FROM vehicles WHERE id = ?', [$id]);
    if (!$v) throw new UserError('Car not found.');
    $tab = get('tab', 'overview');

    if (is_post()) {
        $a = post('action');
        if ($a === 'update') {
            require_perm('fleet_edit');
            $d = vehicle_from_post($v);
            update('vehicles', $id, $d + ['updated_at' => now()]);
            $diff = []; foreach ($d as $k => $val) if ((string)$val !== (string)$v[$k]) $diff[$k] = [$v[$k], $val];
            audit('update', 'vehicle', $id, $diff);
            flash('success', 'Car saved.');
            redirect('vehicle', ['id' => $id]);
        }
        if ($a === 'status') {
            require_perm('fleet_edit');
            $s = post('status_override');
            if (!in_array($s, ['', 'maintenance', 'unavailable'], true)) throw new UserError('Unknown status.');
            update('vehicles', $id, ['status_override' => $s ?: null, 'status_note' => mb_substr(post('status_note'), 0, 500), 'updated_at' => now()]);
            audit('status', 'vehicle', $id, ['to' => $s ?: 'available', 'note' => post('status_note')]);
            $clash = $s ? bookings_where("b.vehicle_id = ? AND b.status = 'confirmed' AND b.end_at >= ?", [$id, now()]) : [];
            $out = fleet_status_map()[$id]['active'];
            flash($clash ? 'error' : 'success', ($out && !$s ? 'Saved. The car is still with ' . $out['customer_name'] . ', so it stays "Currently rented" until the return is recorded.' : 'Status updated.') . ($clash ? ' Note: this car has ' . count($clash) . ' upcoming rental(s). Move them to another car if it will not be ready.' : ''));
            redirect('vehicle', ['id' => $id]);
        }
        if ($a === 'photo') { require_perm('fleet_edit'); $n = save_vehicle_photos($id); flash($n ? 'success' : 'error', $n ? "$n photo(s) added." : 'Choose at least one photo.'); redirect('vehicle', ['id' => $id, 'tab' => 'photos']); }
        if ($a === 'photo_delete') {
            require_perm('fleet_edit');
            q("UPDATE files SET deleted = 1 WHERE id = ? AND entity = 'vehicle_photo' AND entity_id = ?", [(int)post('file_id'), $id]);
            audit('delete', 'file', (int)post('file_id'));
            redirect('vehicle', ['id' => $id, 'tab' => 'photos']);
        }
        if ($a === 'archive') {
            require_perm('void');
            if (!$v['archived'] && bookings_where("b.vehicle_id = ? AND b.status IN ('confirmed', 'active')", [$id])) throw new UserError('This car has an active or upcoming rental. Finish or move it first.');
            update('vehicles', $id, ['archived' => $v['archived'] ? 0 : 1, 'updated_at' => now()]);
            audit($v['archived'] ? 'restore' : 'remove', 'vehicle', $id);
            flash('success', $v['archived'] ? 'Car restored.' : 'Car removed from your list. Its rentals, payments and history are kept, and you can restore it from Cars → Show removed cars.');
            redirect($v['archived'] ? 'vehicle' : 'fleet', $v['archived'] ? ['id' => $id] : []);
        }
        if (str_starts_with($a, 'damage_')) { require_once __DIR__ . '/damage.php'; damage_post($id); redirect('vehicle', ['id' => $id, 'tab' => 'damage']); }
        if (str_starts_with($a, 'doc_') || str_starts_with($a, 'maint_')) { require_once __DIR__ . '/maintenance.php'; vehicle_upkeep_post($v); }
        redirect('vehicle', ['id' => $id]);
    }

    if ($tab === 'edit') { require_perm('fleet_edit'); render_page('Edit ' . $v['reg_no'], page_head('Edit ' . $v['reg_no']) . vehicle_form($v, 'update'), 'fleet'); return; }

    $m = fleet_status_map()[$id];
    $openDmg = open_damage_by_vehicle()[$id] ?? 0;
    $acts = (can('bookings') && !$v['archived'] ? btn('Rent this car', url('booking_new', ['vehicle_id' => $id]), 'primary') : '') . (can('fleet_edit') ? btn('Edit', url('vehicle', ['id' => $id, 'tab' => 'edit'])) : '');
    $h = page_head($v['reg_no'], e($v['name']) . ' · ' . badge(VEHICLE_STATUS_LABEL[$m['status']], tone_for($m['status'])) . ($m['late'] ? ' ' . badge('Overdue', 'red') : '') . ($v['archived'] ? ' ' . badge('Removed', 'grey') : '') . ($openDmg ? ' ' . badge($openDmg . ' damage not repaired', 'red') : ''), $acts);
    $h .= tabs('vehicle', ['id' => $id], $tab, ['overview' => 'Overview', 'history' => 'Rental history', 'damage' => 'Damage', 'upkeep' => 'Service & documents', 'photos' => 'Photos']);

    if ($tab === 'overview') {
        $bk = bookings_where("b.vehicle_id = ? AND b.status IN ('active', 'completed')", [$id]);
        $h .= '<div class="stats">' . tile('Trips', count($bk)) . (can('payments') ? tile('Money collected', money((int)val("SELECT COALESCE(SUM(CASE WHEN p.kind = 'refund' THEN -p.amount ELSE p.amount END),0) FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.vehicle_id = ? AND p.kind IN ('rental','refund') AND p.voided = 0", [$id]))) : '')
            . tile('Kilometres', number_format($v['odometer'])) . tile('Open damage', $openDmg, url('vehicle', ['id' => $id, 'tab' => 'damage']), $openDmg ? 'bad' : '') . '</div>';
        $h .= '<div class="grid2"><div class="card"><h3>Where is it now?</h3>';
        if ($m['active']) {
            $a = $m['active'];
            $h .= '<p><b>' . e($a['customer_name']) . '</b> · <a href="tel:' . e($a['customer_phone']) . '">' . e($a['customer_phone']) . '</a></p><dl class="kv"><dt>Taken</dt><dd>' . e(fmt_dt($a['actual_start'] ?: $a['start_at'])) . '</dd><dt>Returns</dt><dd>' . e(fmt_dt($a['end_at'])) . ($m['late'] ? ' ' . badge('Overdue ' . human_duration(ts(now()) - ts($a['end_at'])), 'red') : '') . '</dd></dl>' . btn('Open rental ' . $a['code'], url('booking', ['id' => $a['id']]));
        } else $h .= '<p class="muted">Not with a customer.</p>' . ($m['next'] ? '<p>Next rental: <a href="' . e(url('booking', ['id' => $m['next']['id']])) . '">' . e($m['next']['customer_name']) . ', ' . e(fmt_dt($m['next']['start_at'])) . '</a></p>' : '');
        $h .= '</div><div class="card"><h3>Status</h3>';
        if (can('fleet_edit') && !$v['archived']) $h .= form_open('status', 'class="stack"') . field('Set status', sel('status_override', ['' => 'Available (normal)', 'maintenance' => 'Under maintenance', 'unavailable' => 'Unavailable'], $v['status_override'] ?? ''), '"Currently rented" and "Reserved" are set automatically by rentals.')
            . field('Reason', inp('status_note', $v['status_note'] ?? '', 'text', 'placeholder="e.g. at garage for clutch"')) . '<button class="btn">Update status</button></form>';
        else $h .= '<p>' . e($v['status_note'] ?: '—') . '</p>';
        $h .= '</div></div><div class="card"><h3>Details</h3><dl class="kv cols">';
        foreach (['Manufacturer' => $v['make'], 'Category' => $v['category'], 'Fuel' => $v['fuel'], 'Transmission' => $v['transmission'], 'Colour' => $v['colour'], 'Condition' => $v['condition_note'], 'Free km/day' => $v['km_limit_per_day']] as $k => $val)
            $h .= '<dt>' . e($k) . '</dt><dd>' . e($val ?: '—') . '</dd>';
        if (can('payments')) $h .= '<dt>Daily price</dt><dd>' . money($v['daily_rate']) . '</dd><dt>Monthly price</dt><dd>' . money($v['monthly_rate']) . '</dd>';
        $h .= '</dl>' . ($v['notes'] ? '<p class="note">' . nl2br(e($v['notes'])) . '</p>' : '') . '</div>';
        if (is_owner()) $h .= '<div class="card danger">' . form_open('archive', 'data-confirm="' . ($v['archived'] ? 'Restore this car?' : 'Remove this car from your list? Its history is kept and it can be restored.') . '"') . '<p class="muted small">' . ($v['archived'] ? 'This car was removed. Its history is kept.' : 'Sold or no longer used? Remove it from your list. Rentals, payments and damage history are kept, and you can restore it later.') . '</p><button class="btn ghost">' . ($v['archived'] ? 'Restore car' : 'Remove car') . '</button></form></div>';
    }
    if ($tab === 'history') {
        $trs = [];
        foreach (bookings_where('b.vehicle_id = ?', [$id]) as $b) {
            $km = row("SELECT MIN(CASE WHEN stage = 'handover' THEN odometer END) AS s, MAX(CASE WHEN stage = 'return' THEN odometer END) AS e FROM checklists WHERE booking_id = ?", [$b['id']]);
            $trs[] = tr(['<b>' . e($b['code']) . '</b>', e($b['customer_name']) . '<small>' . e($b['customer_phone']) . '</small>', e(fmt_dt($b['actual_start'] ?: $b['start_at'])) . '<small>to ' . e(fmt_dt($b['actual_end'] ?: $b['end_at'])) . '</small>',
                $km && $km['s'] !== null && $km['e'] !== null ? number_format($km['e'] - $km['s']) . ' km' : '—', badge(BOOKING_STATUS_LABEL[$b['view_status']], tone_for($b['view_status'])),
                can('payments') ? money($b['total']) . '<small>' . ($b['balance'] > 0 ? 'due ' . money($b['balance']) : PAY_STATUS_LABEL[$b['pay_status']]) . '</small>' : ''], url('booking', ['id' => $b['id']]));
        }
        $h .= '<div class="card flush">' . table(['Rental', 'Customer', 'Dates', 'Distance', 'Status', can('payments') ? 'Amount' : ''], $trs, 'No rentals yet.') . '</div>';
    }
    if ($tab === 'damage') {
        require_once __DIR__ . '/damage.php';
        $h .= '<div class="card">' . damage_list(damage_rows('d.vehicle_id = ?', [$id]), 'vehicle') . '</div>';
        if (can('bookings')) $h .= damage_form('Record damage found outside a rental');
    }
    if ($tab === 'upkeep') { require_once __DIR__ . '/maintenance.php'; $h .= vehicle_upkeep_panel($v); }
    if ($tab === 'photos') {
        $ph = rows("SELECT * FROM files WHERE entity = 'vehicle_photo' AND entity_id = ? AND deleted = 0 ORDER BY id DESC", [$id]);
        $h .= '<div class="card">' . (can('fleet_edit') ? form_open('photo', '', true) . '<div class="row"><input type="file" name="photos[]" accept="image/jpeg,image/png,image/webp" multiple required><button class="btn">Upload photos</button></div></form>' : '');
        $h .= '<div class="photos">';
        foreach ($ph as $p) $h .= '<figure><a href="' . e(url('file', ['id' => $p['id']])) . '" target="_blank"><img loading="lazy" src="' . e(url('file', ['id' => $p['id']])) . '" alt=""></a>' . (can('fleet_edit') ? form_open('photo_delete', 'data-confirm="Remove this photo?"') . '<input type="hidden" name="file_id" value="' . $p['id'] . '"><button class="link">Remove</button></form>' : '') . '</figure>';
        $h .= '</div>' . ($ph ? '' : '<p class="muted">No photos yet.</p>') . '</div>';
    }
    render_page($v['reg_no'], $h, 'fleet');
}
