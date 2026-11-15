<?php
defined('APP') or exit;

/* ---------- saving ---------- */

/* Record a service or repair. Saves the cost as an expense and sets the next service. */
function maint_save(array $v) {
    require_perm('maintenance');
    $kind = post('kind', 'general_service');
    if (!isset(MAINT_KINDS[$kind])) throw new UserError('Choose the type of work.');
    $date = parse_date(post('service_date'));
    if (!$date) throw new UserError('Enter the date of the service.');
    if ($date > today()) throw new UserError('The service date cannot be in the future.');
    $odo = post('odometer') === '' ? null : (ctype_digit(post('odometer')) ? (int)post('odometer') : false);
    if ($odo === false) throw new UserError('Check the kilometre reading (whole numbers only).');
    $cost = parse_money(post('cost'));
    if ($cost === false) throw new UserError('Check the service cost (numbers only).');
    $resets = in_array($kind, ['general_service', 'oil_change'], true) || post('resets_schedule') === '1';
    $nextKm = post('next_km') === '' ? null : (ctype_digit(post('next_km')) ? (int)post('next_km') : false);
    if ($nextKm === false) throw new UserError('Check the next service kilometre reading.');
    if ($nextKm !== null && $odo !== null && $nextKm <= $odo) throw new UserError('The next service reading must be more than the current reading.');
    $nextDate = parse_date(post('next_date'));
    if ($nextDate === false) throw new UserError('Check the next service date.');
    if ($nextDate && $nextDate <= $date) throw new UserError('The next service date must be after the service date.');
    $desc = mb_substr(post('description'), 0, 2000);
    $me = current_user()['id'];
    $id = tx(function () use ($v, $kind, $date, $odo, $cost, $resets, $desc, $me, $nextKm, $nextDate) {
        $eid = $cost > 0 ? insert('expenses', ['expense_date' => $date, 'vehicle_id' => $v['id'], 'category' => MAINT_KINDS[$kind][1], 'amount' => $cost,
            'description' => MAINT_KINDS[$kind][0] . ($desc ? ': ' . mb_substr($desc, 0, 200) : ''), 'method' => 'Cash', 'source' => 'maintenance', 'created_by' => $me, 'created_at' => now()]) : null;
        $id = insert('maintenance', ['vehicle_id' => $v['id'], 'kind' => $kind, 'service_date' => $date, 'odometer' => $odo, 'cost' => $cost, 'provider' => mb_substr(post('provider'), 0, 150),
            'description' => $desc, 'resets_schedule' => $resets ? 1 : 0, 'expense_id' => $eid, 'created_by' => $me, 'created_at' => now()]);
        if ($fid = handle_upload('file', 'maintenance', $id)) { update('maintenance', $id, ['file_id' => $fid]); if ($eid) update('expenses', $eid, ['file_id' => $fid]); }
        $vu = ['updated_at' => now()];
        if ($resets && (!$v['last_service_date'] || $date >= $v['last_service_date'])) {
            $vu['last_service_date'] = $date; $vu['last_service_km'] = $odo;
            // The owner's next-service entry, or last service + the usual interval.
            $vu['next_service_km'] = $nextKm ?? ($odo !== null ? $odo + (int)setting('default_service_km', 10000) : null);
            $vu['next_service_date'] = $nextDate ?: date('Y-m-d', strtotime($date . ' +' . (int)setting('default_service_days', 180) . ' days'));
        }
        if ($odo !== null && $odo > (int)$v['odometer']) $vu['odometer'] = $odo;
        update('vehicles', $v['id'], $vu);
        if (in_array($kind, ['breakdown', 'accident', 'repair'], true) && $cost > 0)
            notify("maint_unexpected:$id", 'unexpected_expense', 'medium', MAINT_KINDS[$kind][0] . " on {$v['reg_no']}: " . money($cost), $desc ?: 'Recorded by ' . current_user()['name'] . '.', url('vehicle', ['id' => $v['id'], 'tab' => 'upkeep']), 'reports');
        audit('create', 'maintenance', $id, ['vehicle' => $v['reg_no'], 'kind' => $kind, 'cost' => $cost, 'odometer' => $odo, 'next_km' => $vu['next_service_km'] ?? null]);
        return $id;
    });
    $s = service_info(row('SELECT * FROM vehicles WHERE id = ?', [$v['id']]));
    flash('success', MAINT_KINDS[$kind][0] . ' saved for ' . $v['reg_no'] . '.' . ($resets ? ' Next service: ' . implode(' or ', array_filter([$s['nextKm'] ? number_format($s['nextKm']) . ' km' : '', $s['nextDate'] ? fmt_d($s['nextDate']) : ''])) . '.' : '') . ($cost > 0 ? ' Cost saved in maintenance expenses.' : ''));
    return $id;
}

/* Change the next-service reminder without recording a service. */
function maint_next(array $v) {
    require_perm('maintenance');
    $km = post('next_km') === '' ? null : (ctype_digit(post('next_km')) ? (int)post('next_km') : false);
    $date = parse_date(post('next_date'));
    if ($km === false || $date === false) throw new UserError('Check the next service reading and date.');
    if ($km === null && !$date) throw new UserError('Enter the next service kilometres or date.');
    update('vehicles', $v['id'], ['next_service_km' => $km, 'next_service_date' => $date, 'updated_at' => now()]);
    audit('next_service', 'vehicle', $v['id'], ['km' => $km, 'date' => $date]);
    flash('success', 'Next service reminder updated for ' . $v['reg_no'] . '.');
}

/* Add or renew a document. The older one stays in the history. */
function doc_save(array $v) {
    require_perm('maintenance');
    $type = row('SELECT * FROM doc_types WHERE id = ? AND active = 1', [(int)post('doc_type_id')]);
    if (!$type) throw new UserError('Choose the document.');
    $exp = parse_date(post('expiry_date'));
    if ($exp === false) throw new UserError('Check the expiry date.');
    if ($type['has_expiry'] && !$exp) throw new UserError("Enter the expiry date of the {$type['name']}.");
    $cost = parse_money(post('cost'));
    if ($cost === false) throw new UserError('Check the cost (numbers only).');
    tx(function () use ($v, $type, $exp, $cost) {
        $prev = rows('SELECT id FROM vehicle_documents WHERE vehicle_id = ? AND doc_type_id = ? AND replaced = 0', [$v['id'], $type['id']]);
        foreach ($prev as $p) update('vehicle_documents', $p['id'], ['replaced' => 1]);
        $did = insert('vehicle_documents', ['vehicle_id' => $v['id'], 'doc_type_id' => $type['id'], 'number' => mb_substr(post('number'), 0, 100), 'expiry_date' => $type['has_expiry'] ? $exp : null,
            'notes' => mb_substr(post('notes'), 0, 500), 'created_by' => current_user()['id'], 'created_at' => now()]);
        if ($fid = handle_upload('file', 'vehicle_doc', $did)) update('vehicle_documents', $did, ['file_id' => $fid]);
        if ($cost > 0) {
            $cat = match (mb_strtolower($type['name'])) { 'insurance' => 'insurance', 'puc certificate' => 'puc', default => 'other' };
            insert('expenses', ['expense_date' => today(), 'vehicle_id' => $v['id'], 'category' => $cat, 'amount' => $cost, 'description' => $type['name'] . ' renewal', 'method' => 'Cash', 'source' => 'document', 'created_by' => current_user()['id'], 'created_at' => now()]);
        }
        audit($prev ? 'renew' : 'create', 'vehicle_document', $did, ['vehicle' => $v['reg_no'], 'type' => $type['name'], 'expiry' => $exp]);
    });
    flash('success', "{$type['name']} for {$v['reg_no']} saved" . ($exp ? ': valid until ' . fmt_d($exp) : '') . '.');
}

function vehicle_upkeep_post(array $v) {
    $a = post('action');
    if ($a === 'maint_add') maint_save($v);
    if ($a === 'maint_next') maint_next($v);
    if ($a === 'doc_add') doc_save($v);
    redirect(post('back') === 'upkeep' ? 'upkeep' : 'vehicle', post('back') === 'upkeep' ? [] : ['id' => $v['id'], 'tab' => 'upkeep']);
}

/* ---------- forms ---------- */

function service_form(array $v, $back = '', $compact = false) {
    $s = service_info($v);
    $h = form_open('maint_add', 'class="stack' . ($compact ? '' : ' card') . '"', true) . ($back ? '<input type="hidden" name="back" value="' . e($back) . '"><input type="hidden" name="vid" value="' . $v['id'] . '">' : '')
        . ($compact ? '' : '<h3>Record service or repair</h3>') . '<div class="grid3">'
        . field('Work done', sel('kind', array_map(fn($k) => $k[0], MAINT_KINDS), 'general_service')) . field('Date *', inp('service_date', today(), 'date', 'required max="' . today() . '"'))
        . field('Kilometre reading', inp('odometer', $v['odometer'], 'number', 'min="0" data-svc-odo')) . field('Cost', money_in('cost', ''))
        . field('Next service at (km)', inp('next_km', (int)$v['odometer'] + (int)setting('default_service_km', 10000), 'number', 'min="0" data-svc-next'), 'For a regular service. Change it if your garage said otherwise.')
        . field('Next service date', inp('next_date', date('Y-m-d', strtotime(today() . ' +' . (int)setting('default_service_days', 180) . ' days')), 'date')) . '</div>'
        . field('Description', inp('description', '', 'text', 'placeholder="e.g. Oil and filter change, brake pads"')) . '<div class="grid2">' . field('Garage (optional)', inp('provider')) . field('Bill photo (optional)', '<input type="file" name="file" accept="image/*,application/pdf">') . '</div>'
        . '<p class="muted small">A general service or oil change sets the next service. Repairs only record the cost.</p><button class="btn primary">Save</button></form>';
    return $h;
}

function doc_form(array $v, $typeId = null, $back = '', $compact = false) {
    $types = []; foreach (doc_types() as $t) $types[$t['id']] = $t['name'];
    return form_open('doc_add', 'class="stack' . ($compact ? '' : ' card') . '"', true) . ($back ? '<input type="hidden" name="back" value="' . e($back) . '"><input type="hidden" name="vid" value="' . $v['id'] . '">' : '')
        . ($compact ? '' : '<h3>Add or update a document date</h3>') . '<div class="grid3">'
        . field('Document *', sel('doc_type_id', $types, $typeId ?? '', 'required', 'Choose…')) . field('New expiry date', inp('expiry_date', '', 'date')) . field('Number (optional)', inp('number'))
        . field('Cost paid (optional)', money_in('cost', '')) . field('Copy (optional)', '<input type="file" name="file" accept="image/*,application/pdf">') . '</div>'
        . '<p class="muted small">The app reminds you based on the date you enter. It does not check the document itself.</p><button class="btn primary">Save</button></form>';
}

/* ---------- views ---------- */

function doc_when($it) {
    if ($it['state'] === 'missing') return '<span class="muted">Date not entered</span>';
    if (!$it['doc']['expiry_date']) return 'No expiry';
    $d = $it['days_left'];
    return e(fmt_d($it['doc']['expiry_date'])) . ' <small>' . ($d < 0 ? 'expired ' . (-$d) . ' day(s) ago' : ($d === 0 ? 'expires today' : "in $d day(s)")) . '</small>';
}
function service_when($s) {
    $p = [];
    if ($s['nextKm'] !== null) $p[] = number_format($s['nextKm']) . ' km <small>' . ($s['kmLeft'] < 0 ? number_format(-$s['kmLeft']) . ' km overdue' : number_format($s['kmLeft']) . ' km left') . '</small>';
    if ($s['nextDate']) $p[] = e(fmt_d($s['nextDate'])) . ' <small>' . ($s['daysLeft'] < 0 ? (-$s['daysLeft']) . ' days overdue' : $s['daysLeft'] . ' days left') . '</small>';
    return $p ? implode('<br>', $p) : '<span class="muted">Not set</span>';
}

function vehicle_upkeep_panel(array $v) {
    $s = service_info($v); $comp = vehicle_compliance($v);
    $h = '<div class="grid2"><div class="card"><div class="row between"><h3>Service</h3>' . badge(SERVICE_STATE_LABEL[$s['state']], tone_for($s['state'])) . '</div><dl class="kv"><dt>Current km</dt><dd>' . number_format($v['odometer']) . '</dd>'
        . '<dt>Last service</dt><dd>' . e(fmt_d($s['lastDate'])) . ($s['lastKm'] !== null ? ' at ' . number_format($s['lastKm']) . ' km' : '') . '</dd><dt>Next service</dt><dd>' . service_when($s) . '</dd></dl>';
    if (can('maintenance')) $h .= '<details><summary>Change next service reminder</summary>' . form_open('maint_next', 'class="stack"') . '<div class="grid2">' . field('Next service at (km)', inp('next_km', $s['nextKm'] ?? '', 'number', 'min="0"')) . field('Next service date', inp('next_date', $s['nextDate'] ?? '', 'date')) . '</div><button class="btn small">Save</button></form></details>';
    $h .= '</div><div class="card"><div class="row between"><h3>Documents</h3>' . badge(COMPLIANCE_LABEL[$comp['overall']], tone_for($comp['overall'])) . '</div>';
    $trs = [];
    foreach ($comp['items'] as $it) $trs[] = tr(['<b>' . e($it['type']['name']) . '</b>', badge(DOC_STATE_LABEL[$it['state']], tone_for($it['state'])), doc_when($it), $it['doc'] && $it['doc']['file_id'] ? '<a href="' . e(url('file', ['id' => $it['doc']['file_id']])) . '" target="_blank">View</a>' : '']);
    $h .= table(['Document', 'State', 'Expiry', ''], $trs, 'No documents tracked for this category. Add one below.') . '</div></div>';
    if (can('maintenance')) $h .= '<div class="grid2">' . service_form($v) . doc_form($v) . '</div>';
    $list = rows('SELECT * FROM maintenance WHERE vehicle_id = ? AND voided = 0 ORDER BY service_date DESC, id DESC', [$v['id']]);
    $h .= '<h2>Service history' . (can('reports') || can('payments') ? ' <span class="muted small">· total ' . money(array_sum(array_column($list, 'cost'))) . '</span>' : '') . '</h2><div class="card flush">' . maint_table($list, false) . '</div>';
    $old = rows('SELECT d.*, t.name AS type_name FROM vehicle_documents d JOIN doc_types t ON t.id = d.doc_type_id WHERE d.vehicle_id = ? AND d.replaced = 1 ORDER BY d.id DESC', [$v['id']]);
    if ($old) $h .= '<h2>Older document dates</h2><div class="card flush">' . table(['Document', 'Number', 'Expired'], array_map(fn($d) => tr([e($d['type_name']), e($d['number'] ?: '—'), e(fmt_d($d['expiry_date']))]), $old)) . '</div>';
    return $h;
}

function maint_table(array $list, $showVehicle) {
    $trs = [];
    foreach ($list as $m) {
        $cells = [e(fmt_d($m['service_date'])), e(MAINT_KINDS[$m['kind']][0] ?? $m['kind']), $m['odometer'] !== null ? number_format($m['odometer']) . ' km' : '—', can('reports') || can('payments') ? money($m['cost']) : '', e($m['description'] ?: '') . ($m['provider'] ? '<small>' . e($m['provider']) . '</small>' : '') . ($m['file_id'] ? ' <a href="' . e(url('file', ['id' => $m['file_id']])) . '" target="_blank">bill</a>' : '')];
        if ($showVehicle) array_unshift($cells, '<a href="' . e(url('vehicle', ['id' => $m['vehicle_id'], 'tab' => 'upkeep'])) . '"><b>' . e($m['reg_no']) . '</b></a>');
        $trs[] = tr($cells);
    }
    return table(array_merge($showVehicle ? ['Car'] : [], ['Date', 'Work', 'Km', can('reports') || can('payments') ? 'Cost' : '', 'Description']), $trs, 'No service records yet.');
}

/* All reminders: service due/overdue and documents expiring/expired/missing. */
function upkeep_reminders() {
    $out = [];
    $fc = fleet_compliance();
    foreach (rows('SELECT * FROM vehicles WHERE archived = 0 ORDER BY reg_no') as $v) {
        $s = service_info($v);
        if (in_array($s['state'], ['due', 'overdue'], true)) $out[] = ['kind' => 'service', 'state' => $s['state'], 'v' => $v, 'what' => 'Service', 'when' => service_when($s), 'sort' => $s['state'] === 'overdue' ? 0 : 2];
        foreach ($fc[$v['id']]['items'] ?? [] as $it) {
            if ($it['state'] === 'valid' || (!$it['required'] && $it['state'] === 'missing')) continue;
            $out[] = ['kind' => 'doc', 'state' => $it['state'], 'v' => $v, 'what' => $it['type']['name'], 'type_id' => $it['type']['id'], 'when' => doc_when($it), 'sort' => ['expired' => 0, 'missing' => 1, 'expiring' => 2][$it['state']]];
        }
    }
    usort($out, fn($a, $b) => [$a['sort'], $a['v']['reg_no']] <=> [$b['sort'], $b['v']['reg_no']]);
    return $out;
}

function page_upkeep() {
    require_perm('maintenance');
    if (is_post()) {
        $v = row('SELECT * FROM vehicles WHERE id = ? AND archived = 0', [(int)post('vid')]);
        if (!$v) throw new UserError('Choose the car.');
        $_POST['back'] = 'upkeep';
        vehicle_upkeep_post($v);
    }
    $rem = upkeep_reminders();
    $cnt = fn($kind, $states) => count(array_filter($rem, fn($r) => $r['kind'] === $kind && in_array($r['state'], $states, true)));
    $h = page_head('Maintenance & Documents', 'Service and document reminders for every car');
    $h .= '<div class="stats">' . tile('Service overdue', $cnt('service', ['overdue']), null, $cnt('service', ['overdue']) ? 'bad' : '') . tile('Service soon', $cnt('service', ['due']), null, $cnt('service', ['due']) ? 'warn' : '')
        . tile('Documents expired', $cnt('doc', ['expired', 'missing']), null, $cnt('doc', ['expired', 'missing']) ? 'bad' : '', 'or date not entered') . tile('Expiring soon', $cnt('doc', ['expiring']), null, $cnt('doc', ['expiring']) ? 'warn' : '', 'within ' . max(reminder_days()) . ' days') . '</div>';
    $h .= '<h2>Reminders</h2>';
    if (!$rem) $h .= '<div class="card empty"><p class="muted">Nothing due. All services and document dates are fine.</p></div>';
    else {
        $h .= '<div class="card flush"><ul class="reminders">';
        foreach ($rem as $r) {
            $v = $r['v'];
            $label = $r['kind'] === 'service' ? SERVICE_STATE_LABEL[$r['state']] : DOC_STATE_LABEL[$r['state']];
            $h .= '<li><div class="rem-head"><div><a href="' . e(url('vehicle', ['id' => $v['id'], 'tab' => 'upkeep'])) . '"><b>' . e($v['reg_no']) . '</b></a> <span class="muted">' . e($v['name']) . '</span><br><b>' . e($r['what']) . '</b> · ' . $r['when'] . '</div>' . badge($label, tone_for($r['state'])) . '</div>';
            if (can('maintenance')) $h .= '<details><summary>' . ($r['kind'] === 'service' ? 'Mark service done' : ($r['state'] === 'missing' ? 'Enter the expiry date' : 'Update expiry date')) . '</summary>' . ($r['kind'] === 'service' ? service_form($v, 'upkeep', true) : doc_form($v, $r['type_id'], 'upkeep', true)) . '</details>';
            $h .= '</li>';
        }
        $h .= '</ul></div>';
    }
    $fc = fleet_compliance(); $types = doc_types();
    $show = array_values(array_filter($types, fn($t) => in_array(mb_strtolower($t['name']), ['insurance', 'puc certificate'], true)));
    $trs = [];
    foreach (rows('SELECT * FROM vehicles WHERE archived = 0 ORDER BY reg_no') as $v) {
        $s = service_info($v); $items = []; foreach ($fc[$v['id']]['items'] ?? [] as $it) $items[$it['type']['id']] = $it;
        $cells = ['<b>' . e($v['reg_no']) . '</b><small>' . e($v['name']) . '</small>', number_format($v['odometer']), e(fmt_d($s['lastDate'])), service_when($s)];
        foreach ($show as $t) $cells[] = isset($items[$t['id']]) ? badge(DOC_STATE_LABEL[$items[$t['id']]['state']], tone_for($items[$t['id']]['state'])) . '<small>' . ($items[$t['id']]['doc']['expiry_date'] ?? null ? e(fmt_d($items[$t['id']]['doc']['expiry_date'])) : '') . '</small>' : '<span class="muted">—</span>';
        $others = array_filter($items, fn($it) => !in_array($it['type']['id'], array_column($show, 'id')) && $it['state'] !== 'valid');
        $cells[] = $others ? implode(' ', array_map(fn($it) => badge($it['type']['name'] . ': ' . DOC_STATE_LABEL[$it['state']], tone_for($it['state'])), $others)) : '<span class="muted">OK</span>';
        $trs[] = tr($cells, url('vehicle', ['id' => $v['id'], 'tab' => 'upkeep']));
    }
    $h .= '<h2>All cars</h2><div class="card flush">' . table(array_merge(['Car', 'Km', 'Last service', 'Next service'], array_column($show, 'name'), ['Other documents']), $trs, 'Add cars first.') . '</div>';
    $h .= '<h2>Recent service work</h2><div class="card flush">' . maint_table(rows('SELECT m.*, v.reg_no FROM maintenance m JOIN vehicles v ON v.id = m.vehicle_id WHERE m.voided = 0 ORDER BY m.service_date DESC, m.id DESC LIMIT 50'), true) . '</div>';
    $h .= '<p class="muted small">Reminders come ' . e(implode(', ', reminder_days())) . ' days before a document expires (change this in Settings). The app only uses the dates you enter; it does not check documents or the law.</p>';
    render_page('Maintenance & Documents', $h, 'upkeep');
}
