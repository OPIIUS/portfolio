<?php
defined('APP') or exit;

function vehicle_fields() { return ['reg_no', 'name', 'make', 'model', 'category', 'year', 'fuel', 'transmission', 'colour', 'seats', 'odometer', 'purchase_date', 'purchase_price',
    'condition_note', 'daily_rate', 'monthly_rate', 'km_limit_per_day', 'service_interval_km', 'service_interval_days', 'last_service_date', 'last_service_km', 'gps_device_id', 'gps_tracking_url', 'notes']; }

function vehicle_from_post($existing = null) {
    $d = [];
    $d['reg_no'] = strtoupper(preg_replace('/\s+/', ' ', post('reg_no')));
    if (!preg_match('/^[A-Z0-9 -]{4,20}$/', $d['reg_no'])) throw new UserError('Enter the registration number, e.g. AS01 AB 1234.');
    $dup = val('SELECT id FROM vehicles WHERE REPLACE(reg_no, \' \', \'\') = ? AND id <> ?', [str_replace(' ', '', $d['reg_no']), $existing['id'] ?? 0]);
    if ($dup) throw new UserError('Another vehicle already has registration ' . $d['reg_no'] . '.');
    foreach (['name', 'make', 'model', 'colour', 'condition_note', 'gps_device_id', 'notes'] as $k) $d[$k] = mb_substr(post($k), 0, $k === 'notes' || $k === 'condition_note' ? 2000 : 120);
    if ($d['name'] === '') $d['name'] = trim($d['make'] . ' ' . $d['model']);
    if ($d['name'] === '') throw new UserError('Enter the vehicle name, e.g. Hyundai Creta.');
    $d['category'] = post('category'); if (!in_array($d['category'], categories(), true)) throw new UserError('Choose a category.');
    $d['fuel'] = in_array(post('fuel'), FUELS, true) ? post('fuel') : null;
    $d['transmission'] = in_array(post('transmission'), TRANSMISSIONS, true) ? post('transmission') : null;
    foreach (['year' => [1980, 2100], 'seats' => [1, 60], 'odometer' => [0, 9999999], 'km_limit_per_day' => [0, 5000], 'service_interval_km' => [0, 200000], 'service_interval_days' => [0, 3650], 'last_service_km' => [0, 9999999]] as $k => [$min, $max]) {
        $v = post($k);
        if ($v === '') { $d[$k] = $k === 'odometer' ? 0 : null; continue; }
        if (!ctype_digit($v) || (int)$v < $min || (int)$v > $max) throw new UserError('Check the value for ' . str_replace('_', ' ', $k) . '.');
        $d[$k] = (int)$v;
    }
    foreach (['purchase_date', 'last_service_date'] as $k) { $v = parse_date(post($k)); if ($v === false) throw new UserError('Check the date for ' . str_replace('_', ' ', $k) . '.'); $d[$k] = $v; }
    foreach (['purchase_price', 'daily_rate', 'monthly_rate'] as $k) { $v = parse_money(post($k)); if ($v === false) throw new UserError('Check the amount for ' . str_replace('_', ' ', $k) . '.'); $d[$k] = $v; }
    $url = post('gps_tracking_url');
    $d['gps_tracking_url'] = ($url !== '' && filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#', $url)) ? $url : null;
    if ($existing && $d['odometer'] < (int)$existing['odometer'] && post('confirm_odo') !== '1')
        throw new UserError('The odometer is lower than before (' . number_format($existing['odometer']) . ' km). Tick "the odometer was corrected" if this is intended.');
    return $d;
}

function page_fleet() {
    require_perm('fleet');
    $map = fleet_status_map();
    $comp = fleet_compliance();
    $qs = get('q'); $st = get('status'); $cat = get('category'); $sort = get('sort', 'reg');
    $list = rows('SELECT * FROM vehicles WHERE archived = ' . (get('archived') ? 1 : 0));
    $list = array_filter($list, function ($v) use ($qs, $st, $cat, $map) {
        if ($qs !== '' && stripos($v['reg_no'] . ' ' . $v['name'] . ' ' . $v['make'] . ' ' . $v['model'] . ' ' . $v['colour'], $qs) === false) return false;
        if ($st !== '' && ($map[$v['id']]['status'] ?? '') !== $st) return false;
        if ($cat !== '' && $v['category'] !== $cat) return false;
        return true;
    });
    usort($list, fn($a, $b) => match ($sort) {
        'name' => strcasecmp($a['name'], $b['name']), 'rate' => $b['daily_rate'] <=> $a['daily_rate'], 'km' => $b['odometer'] <=> $a['odometer'],
        'status' => strcmp($map[$a['id']]['status'], $map[$b['id']]['status']), default => strcmp($a['reg_no'], $b['reg_no']),
    });
    $counts = array_count_values(array_column($map, 'status'));
    $h = page_head('Fleet', count($list) . ' vehicle' . (count($list) === 1 ? '' : 's') . ' shown', can('fleet_edit') ? btn('Add vehicle', url('vehicle_new'), 'primary') : '');
    $h .= '<div class="chips">';
    foreach (['' => 'All'] + VEHICLE_STATUS_LABEL as $k => $l) $h .= '<a class="chip' . ($st === $k ? ' on' : '') . '" href="' . e(url('fleet', ['status' => $k, 'q' => $qs, 'category' => $cat])) . '">' . e($l) . ($k ? ' <b>' . ($counts[$k] ?? 0) . '</b>' : '') . '</a>';
    $h .= '</div><form class="filters" method="get"><input type="hidden" name="p" value="fleet"><input type="hidden" name="status" value="' . e($st) . '">'
        . '<input type="search" name="q" value="' . e($qs) . '" placeholder="Search registration, name, colour">'
        . sel('category', categories(), $cat, '', 'All categories') . sel('sort', ['reg' => 'Sort: registration', 'name' => 'Sort: name', 'status' => 'Sort: status', 'rate' => 'Sort: daily rate', 'km' => 'Sort: odometer'], $sort)
        . '<button class="btn">Apply</button>' . (is_owner() ? '<a class="btn ghost" href="' . e(url('fleet', ['archived' => get('archived') ? '' : 1])) . '">' . (get('archived') ? 'Show active' : 'Show archived') . '</a>' : '') . '</form>';
    $trs = [];
    foreach ($list as $v) {
        $m = $map[$v['id']]; $c = $comp[$v['id']]['overall'] ?? 'ok'; $s = service_info($v);
        $who = $m['active'] ? e($m['active']['customer_name']) . '<small>back ' . e(fmt_dt($m['active']['end_at'])) . '</small>' : ($m['next'] ? '<small>Next: ' . e($m['next']['customer_name']) . ', ' . e(fmt_dt($m['next']['start_at'])) . '</small>' : '<small class="muted">—</small>');
        $trs[] = tr(['<b>' . e($v['reg_no']) . '</b><small>' . e($v['name']) . '</small>', e($v['category']), badge(VEHICLE_STATUS_LABEL[$m['status']], tone_for($m['status'])), $who,
            badge(COMPLIANCE_LABEL[$c], tone_for($c)), badge(SERVICE_STATE_LABEL[$s['state']], tone_for($s['state'])), number_format($v['odometer']) . ' km', can('payments') ? money($v['daily_rate']) . '<small>/day</small>' : '—'], url('vehicle', ['id' => $v['id']]));
    }
    $h .= '<div class="card flush">' . table(['Vehicle', 'Category', 'Status', 'With / next', 'Documents', 'Service', 'Odometer', 'Rate'], $trs, 'No vehicles match. Add your first vehicle to get started.') . '</div>';
    render_page('Fleet', $h, 'fleet');
}

function vehicle_form($v, $action) {
    $v = $v ?: [];
    $g = fn($k) => old($k, $v[$k] ?? '');
    $h = form_open($action, 'class="card stack"');
    $h .= '<h3>Vehicle</h3><div class="grid3">' . field('Registration number *', inp('reg_no', $g('reg_no'), 'text', 'required placeholder="AS01 AB 1234" autocapitalize="characters"'))
        . field('Name shown to staff *', inp('name', $g('name'), 'text', 'placeholder="Hyundai Creta"'))
        . field('Category *', sel('category', categories(), $g('category'), 'required', 'Choose…'))
        . field('Manufacturer', inp('make', $g('make'), 'text', 'placeholder="Hyundai"')) . field('Model / variant', inp('model', $g('model'), 'text', 'placeholder="Creta SX 1.5"'))
        . field('Year', inp('year', $g('year'), 'number', 'min="1980" max="2100"')) . field('Fuel', sel('fuel', FUELS, $g('fuel'), '', '—'))
        . field('Gearbox', sel('transmission', TRANSMISSIONS, $g('transmission'), '', '—')) . field('Colour', inp('colour', $g('colour')))
        . field('Seats', inp('seats', $g('seats'), 'number', 'min="1" max="60"')) . field('Odometer (km) *', inp('odometer', $g('odometer') === '' ? '' : $g('odometer'), 'number', 'min="0" required'))
        . field('Current condition', inp('condition_note', $g('condition_note'), 'text', 'placeholder="Good, small scratch on rear bumper"')) . '</div>';
    if (!empty($v['id'])) $h .= '<label class="check"><input type="checkbox" name="confirm_odo" value="1"> The odometer was corrected (allow a lower reading)</label>';
    $h .= '<h3>Rates</h3><div class="grid3">' . field('Daily rate', money_in('daily_rate', $g('daily_rate'))) . field('Monthly rate', money_in('monthly_rate', $g('monthly_rate')))
        . field('Free km per day', inp('km_limit_per_day', $g('km_limit_per_day'), 'number', 'min="0" placeholder="e.g. 300"'), 'Used to suggest extra-km charges at return.') . '</div>';
    $h .= '<h3>Purchase</h3><div class="grid3">' . field('Purchase date', inp('purchase_date', $g('purchase_date'), 'date')) . field('Purchase price', money_in('purchase_price', $g('purchase_price'))) . '</div>';
    $h .= '<h3>Service schedule</h3><div class="grid3">' . field('Service every (km)', inp('service_interval_km', $g('service_interval_km'), 'number', 'min="0" placeholder="' . e(setting('default_service_km')) . '"'), 'Leave empty to use the default (' . number_format((int)setting('default_service_km')) . ' km).')
        . field('…or every (days)', inp('service_interval_days', $g('service_interval_days'), 'number', 'min="0" placeholder="' . e(setting('default_service_days')) . '"'), 'Whichever comes first.')
        . field('Last service date', inp('last_service_date', $g('last_service_date'), 'date')) . field('Odometer at last service', inp('last_service_km', $g('last_service_km'), 'number', 'min="0"')) . '</div>';
    $h .= '<h3>GPS (optional)</h3><div class="grid3">' . field('GPS device ID', inp('gps_device_id', $g('gps_device_id'))) . field('Tracking link', inp('gps_tracking_url', $g('gps_tracking_url'), 'url', 'placeholder="https://…"'), 'Link from your GPS tracker app, if you have one.') . '</div>';
    $h .= field('Notes', txt('notes', $g('notes'))) . '<div class="row"><button class="btn primary">Save vehicle</button><a class="btn ghost" href="' . e(empty($v['id']) ? url('fleet') : url('vehicle', ['id' => $v['id']])) . '">Cancel</a></div></form>';
    return $h;
}

function page_vehicle_new() {
    require_perm('fleet_edit');
    if (is_post()) {
        $d = vehicle_from_post();
        $d += ['created_by' => current_user()['id'], 'created_at' => now(), 'updated_at' => now()];
        $id = insert('vehicles', $d);
        audit('create', 'vehicle', $id, ['reg_no' => $d['reg_no']]);
        flash('success', 'Vehicle added. Next, add its documents (insurance, PUC, RC).');
        redirect('vehicle', ['id' => $id, 'tab' => 'documents']);
    }
    render_page('Add vehicle', page_head('Add vehicle') . vehicle_form(null, 'create'), 'fleet');
}

function page_vehicle() {
    require_perm('fleet');
    $id = (int)get('id');
    $v = row('SELECT * FROM vehicles WHERE id = ?', [$id]);
    if (!$v) throw new UserError('Vehicle not found.');
    $tab = get('tab', 'overview');

    if (is_post()) {
        $a = post('action');
        if ($a === 'update') {
            require_perm('fleet_edit');
            $d = vehicle_from_post($v);
            $changed = array_filter($d, fn($val, $k) => (string)$val !== (string)$v[$k], ARRAY_FILTER_USE_BOTH);
            update('vehicles', $id, $d + ['updated_at' => now()]);
            $diff = []; foreach ($changed as $k => $val) $diff[$k] = [$v[$k], $val];
            audit('update', 'vehicle', $id, $diff);
            flash('success', 'Vehicle saved.');
            redirect('vehicle', ['id' => $id]);
        }
        if ($a === 'status') {
            require_perm('fleet_edit');
            $s = post('status_override');
            if (!in_array($s, ['', 'maintenance', 'unavailable'], true)) throw new UserError('Unknown status.');
            update('vehicles', $id, ['status_override' => $s ?: null, 'status_note' => mb_substr(post('status_note'), 0, 500), 'updated_at' => now()]);
            audit('status', 'vehicle', $id, ['to' => $s ?: 'available', 'note' => post('status_note')]);
            if ($s) notify("vehicle_$s:$id:" . now(), 'vehicle_unavailable', 'medium', "{$v['reg_no']} is " . VEHICLE_STATUS_LABEL[$s], post('status_note') ?: 'Marked by ' . current_user()['name'] . '.', url('vehicle', ['id' => $id]), 'fleet');
            $clash = $s ? bookings_where("b.vehicle_id = ? AND b.status = 'confirmed' AND b.end_at >= ?", [$id, now()]) : [];
            flash($clash ? 'error' : 'success', $clash ? 'Saved. Note: this vehicle has ' . count($clash) . ' upcoming booking(s). Move them to another vehicle if it will not be ready.' : 'Status updated.');
            redirect('vehicle', ['id' => $id]);
        }
        if ($a === 'photo') {
            require_perm('fleet_edit');
            $n = 0;
            foreach (array_keys($_FILES['photos']['name'] ?? []) as $i) {
                $_FILES['one'] = array_map(fn($x) => $x[$i], $_FILES['photos']);
                if (handle_upload('one', 'vehicle_photo', $id, true)) $n++;
            }
            flash($n ? 'success' : 'error', $n ? "$n photo(s) added." : 'Choose at least one photo.');
            redirect('vehicle', ['id' => $id, 'tab' => 'photos']);
        }
        if ($a === 'photo_delete') {
            require_perm('fleet_edit');
            q("UPDATE files SET deleted = 1 WHERE id = ? AND entity = 'vehicle_photo' AND entity_id = ?", [(int)post('file_id'), $id]);
            audit('delete', 'file', (int)post('file_id'));
            redirect('vehicle', ['id' => $id, 'tab' => 'photos']);
        }
        if ($a === 'archive') {
            require_perm('void');
            if (!$v['archived'] && bookings_where("b.vehicle_id = ? AND b.status IN ('confirmed', 'active')", [$id])) throw new UserError('This vehicle has an active or upcoming booking. Finish or move it first.');
            update('vehicles', $id, ['archived' => $v['archived'] ? 0 : 1, 'updated_at' => now()]);
            audit($v['archived'] ? 'restore' : 'archive', 'vehicle', $id);
            flash('success', $v['archived'] ? 'Vehicle restored.' : 'Vehicle archived. Its history is kept.');
            redirect('vehicle', ['id' => $id]);
        }
        if (str_starts_with($a, 'doc_')) { require_once __DIR__ . '/documents.php'; vehicle_documents_post($v); }
        if (str_starts_with($a, 'maint_')) { require_once __DIR__ . '/maintenance.php'; vehicle_service_post($v); }
        redirect('vehicle', ['id' => $id]);
    }

    if ($tab === 'edit') { require_perm('fleet_edit'); render_page('Edit ' . $v['reg_no'], page_head('Edit ' . $v['reg_no']) . vehicle_form($v, 'update'), 'fleet'); return; }

    $m = fleet_status_map()[$id];
    $comp = vehicle_compliance($v);
    $s = service_info($v);
    $acts = (can('bookings') && !$v['archived'] ? btn('New booking', url('booking_new', ['vehicle_id' => $id]), 'primary') : '') . (can('fleet_edit') ? btn('Edit', url('vehicle', ['id' => $id, 'tab' => 'edit'])) : '');
    $h = page_head($v['reg_no'] . ' · ' . $v['name'], e($v['category']) . ($v['archived'] ? ' · archived' : '') . ' · ' . badge(VEHICLE_STATUS_LABEL[$m['status']], tone_for($m['status'])), $acts);
    $h .= tabs('vehicle', ['id' => $id], $tab, ['overview' => 'Overview', 'documents' => 'Documents', 'service' => 'Service & repairs', 'bookings' => 'Rentals', 'photos' => 'Photos']);

    if ($tab === 'overview') {
        $income = (int)val("SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE b.vehicle_id = ? AND p.kind = 'rental' AND p.voided = 0", [$id]);
        $spend = (int)val('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE vehicle_id = ? AND voided = 0', [$id]);
        $maintSpend = (int)val("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE vehicle_id = ? AND voided = 0 AND category IN ('servicing','repairs','tyres','battery')", [$id]);
        $h .= '<div class="stats">' . (can('payments') ? tile('Rent collected (all time)', money($income)) . tile('Maintenance spend', money($maintSpend)) . tile('All expenses', money($spend)) . tile('Collected minus expenses', money($income - $spend), null, $income - $spend < 0 ? 'bad' : '') : '')
            . tile('Odometer', number_format($v['odometer']) . ' km') . '</div>';
        $h .= '<div class="grid2"><div class="card"><h3>Where is it now?</h3>';
        if ($m['active']) {
            $a = $m['active'];
            $h .= '<p><b>' . e($a['customer_name']) . '</b> · <a href="tel:' . e($a['customer_phone']) . '">' . e($a['customer_phone']) . '</a></p><dl class="kv"><dt>Handed over</dt><dd>' . e(fmt_dt($a['actual_start'] ?: $a['start_at'])) . '</dd><dt>Due back</dt><dd>' . e(fmt_dt($a['end_at'])) . ($a['view_status'] === 'overdue' ? ' ' . badge('Overdue ' . human_duration(ts(now()) - ts($a['end_at'])), 'red') : '') . '</dd><dt>Pickup</dt><dd>' . e($a['pickup_location'] ?: '—') . '</dd><dt>Drop-off</dt><dd>' . e($a['drop_location'] ?: '—') . '</dd></dl>' . btn('Open booking ' . $a['code'], url('booking', ['id' => $a['id']]));
        } else $h .= '<p class="muted">Not rented out right now.</p>' . ($m['next'] ? '<p>Next booking: <a href="' . e(url('booking', ['id' => $m['next']['id']])) . '">' . e($m['next']['customer_name']) . ', ' . e(fmt_dt($m['next']['start_at'])) . '</a></p>' : '');
        if ($v['gps_tracking_url']) $h .= '<p><a class="btn ghost" target="_blank" rel="noopener" href="' . e($v['gps_tracking_url']) . '">Open GPS tracker</a></p>';
        elseif (!$v['gps_device_id']) $h .= '<p class="muted small">No GPS tracker linked. Location shown here is from bookings (who has the car), not live GPS.</p>';
        $h .= '</div><div class="card"><h3>Status</h3>';
        if (can('fleet_edit')) $h .= form_open('status', 'class="stack"') . field('Set status', sel('status_override', ['' => 'Available (normal)', 'maintenance' => 'Under maintenance', 'unavailable' => 'Temporarily unavailable'], $v['status_override'] ?? ''))
            . field('Reason', inp('status_note', $v['status_note'] ?? '', 'text', 'placeholder="e.g. at garage for clutch"')) . '<button class="btn">Update status</button></form>';
        $h .= '<dl class="kv"><dt>Documents</dt><dd>' . badge(COMPLIANCE_LABEL[$comp['overall']], tone_for($comp['overall'])) . '</dd><dt>Service</dt><dd>' . badge(SERVICE_STATE_LABEL[$s['state']], tone_for($s['state'])) . '</dd></dl></div></div>';
        $h .= '<div class="card"><h3>Details</h3><dl class="kv cols">';
        foreach (['Manufacturer' => $v['make'], 'Model' => $v['model'], 'Year' => $v['year'], 'Fuel' => $v['fuel'], 'Gearbox' => $v['transmission'], 'Colour' => $v['colour'], 'Seats' => $v['seats'],
            'Condition' => $v['condition_note'], 'Free km/day' => $v['km_limit_per_day'], 'Purchase date' => $v['purchase_date'] ? fmt_d($v['purchase_date']) : '', 'GPS device' => $v['gps_device_id']] as $k => $val)
            $h .= '<dt>' . e($k) . '</dt><dd>' . e($val ?: '—') . '</dd>';
        if (can('payments')) $h .= '<dt>Daily rate</dt><dd>' . money($v['daily_rate']) . '</dd><dt>Monthly rate</dt><dd>' . money($v['monthly_rate']) . '</dd><dt>Purchase price</dt><dd>' . money($v['purchase_price']) . '</dd>';
        $h .= '</dl>' . ($v['notes'] ? '<p class="note">' . nl2br(e($v['notes'])) . '</p>' : '') . '</div>';
        if (is_owner()) $h .= '<div class="card danger">' . form_open('archive', 'data-confirm="Are you sure?"') . '<p class="muted small">' . ($v['archived'] ? 'This vehicle is archived.' : 'Sold or scrapped? Archive it. Its bookings, payments and history stay in the records.') . '</p><button class="btn ghost">' . ($v['archived'] ? 'Restore vehicle' : 'Archive vehicle') . '</button></form></div>';
    }
    if ($tab === 'documents') { require_once __DIR__ . '/documents.php'; $h .= vehicle_documents_panel($v, $comp); }
    if ($tab === 'service') { require_once __DIR__ . '/maintenance.php'; $h .= vehicle_service_panel($v, $s); }
    if ($tab === 'bookings') {
        $trs = [];
        foreach (bookings_where('b.vehicle_id = ?', [$id]) as $b)
            $trs[] = tr(['<b>' . e($b['code']) . '</b>', e($b['customer_name']), e(fmt_dt($b['start_at'])) . '<small>to ' . e(fmt_dt($b['end_at'])) . '</small>', badge(BOOKING_STATUS_LABEL[$b['view_status']], tone_for($b['view_status'])),
                can('payments') ? money($b['total']) . '<small>' . ($b['balance'] > 0 ? 'due ' . money($b['balance']) : 'paid') . '</small>' : '—'], url('booking', ['id' => $b['id']]));
        $h .= '<div class="card flush">' . table(['Booking', 'Customer', 'Dates', 'Status', 'Amount'], $trs, 'No rentals yet.') . '</div>';
    }
    if ($tab === 'photos') {
        $ph = rows("SELECT * FROM files WHERE entity = 'vehicle_photo' AND entity_id = ? AND deleted = 0 ORDER BY id DESC", [$id]);
        $h .= '<div class="card">' . (can('fleet_edit') ? form_open('photo', '', true) . '<div class="row"><input type="file" name="photos[]" accept="image/jpeg,image/png,image/webp" multiple required><button class="btn">Upload photos</button></div></form>' : '');
        $h .= '<div class="photos">';
        foreach ($ph as $p) $h .= '<figure><a href="' . e(url('file', ['id' => $p['id']])) . '" target="_blank"><img loading="lazy" src="' . e(url('file', ['id' => $p['id']])) . '" alt=""></a>' . (can('fleet_edit') ? form_open('photo_delete', 'data-confirm="Remove this photo?"') . '<input type="hidden" name="file_id" value="' . $p['id'] . '"><button class="link">Remove</button></form>' : '') . '</figure>';
        $h .= $ph ? '</div>' : '</div><p class="muted">No photos yet. Add photos of all sides so damage can be compared at return.</p>';
        $h .= '</div>';
    }
    render_page($v['reg_no'], $h, 'fleet');
}
