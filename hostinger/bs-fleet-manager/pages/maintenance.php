<?php
defined('APP') or exit;

/* Save a service or repair job. It creates the matching expense, and a scheduled service resets the next-service countdown. */
function maint_save(array $v) {
    require_perm('maintenance');
    $kind = post('kind');
    if (!isset(MAINT_KINDS[$kind])) throw new UserError('Choose the type of work.');
    $date = parse_date(post('service_date'));
    if (!$date) throw new UserError('Enter the date of the work.');
    if ($date > today()) throw new UserError('The date cannot be in the future.');
    $odo = post('odometer') === '' ? null : (ctype_digit(post('odometer')) ? (int)post('odometer') : false);
    if ($odo === false) throw new UserError('Check the odometer reading.');
    $cost = parse_money(post('cost'));
    if ($cost === false) throw new UserError('Check the cost.');
    $resets = post('resets_schedule') === '1' ? 1 : 0;
    if ($resets && $odo === null) throw new UserError('Enter the odometer reading so the next service can be worked out.');
    $desc = mb_substr(post('description'), 0, 2000);
    $me = current_user()['id'];
    $id = tx(function () use ($v, $kind, $date, $odo, $cost, $resets, $desc, $me) {
        $eid = null;
        if ($cost > 0) $eid = insert('expenses', ['expense_date' => $date, 'vehicle_id' => $v['id'], 'category' => MAINT_KINDS[$kind][1], 'amount' => $cost,
            'description' => MAINT_KINDS[$kind][0] . ($desc ? ': ' . mb_substr($desc, 0, 200) : '') . (post('provider') ? ' · ' . mb_substr(post('provider'), 0, 100) : ''),
            'method' => in_array(post('method'), PAY_METHODS, true) ? post('method') : 'Cash', 'source' => 'maintenance', 'created_by' => $me, 'created_at' => now()]);
        $id = insert('maintenance', ['vehicle_id' => $v['id'], 'kind' => $kind, 'service_date' => $date, 'odometer' => $odo, 'cost' => $cost, 'provider' => mb_substr(post('provider'), 0, 150),
            'description' => $desc, 'resets_schedule' => $resets, 'expense_id' => $eid, 'created_by' => $me, 'created_at' => now()]);
        if ($fid = handle_upload('file', 'maintenance', $id)) update('maintenance', $id, ['file_id' => $fid]);
        if ($eid && !empty($fid)) update('expenses', $eid, ['file_id' => $fid]);
        $vu = ['updated_at' => now()];
        if ($resets && (!$v['last_service_date'] || $date >= $v['last_service_date'])) { $vu['last_service_date'] = $date; $vu['last_service_km'] = $odo; }
        if ($odo !== null && $odo > (int)$v['odometer']) $vu['odometer'] = $odo;
        update('vehicles', $v['id'], $vu);
        if (in_array($kind, ['breakdown', 'accident', 'repair'], true) && $cost > 0)
            notify("maint_unexpected:$id", 'unexpected_expense', $kind === 'accident' ? 'high' : 'medium', MAINT_KINDS[$kind][0] . " on {$v['reg_no']}: " . money($cost), $desc ?: 'Recorded by ' . current_user()['name'] . '.', url('vehicle', ['id' => $v['id'], 'tab' => 'service']), 'expenses');
        audit('create', 'maintenance', $id, ['vehicle' => $v['reg_no'], 'kind' => $kind, 'cost' => $cost, 'odometer' => $odo, 'resets' => $resets]);
        return $id;
    });
    $s = service_info(row('SELECT * FROM vehicles WHERE id = ?', [$v['id']]));
    flash('success', MAINT_KINDS[$kind][0] . ' saved.' . ($resets ? ' Next service: ' . ($s['nextKm'] ? number_format($s['nextKm']) . ' km' : '') . ($s['nextKm'] && $s['nextDate'] ? ' or ' : '') . ($s['nextDate'] ? fmt_d($s['nextDate']) : '') . ', whichever comes first.' : '') . ($cost > 0 ? ' Cost added to expenses.' : ''));
    return $id;
}

function maint_void($vehicleId = null) {
    require_perm('void');
    $m = row('SELECT * FROM maintenance WHERE id = ? AND voided = 0', [(int)post('maint_id')]);
    if (!$m || ($vehicleId && (int)$m['vehicle_id'] !== (int)$vehicleId)) throw new UserError('Record not found.');
    if (post('reason') === '') throw new UserError('Write the reason.');
    tx(function () use ($m) {
        update('maintenance', $m['id'], ['voided' => 1, 'void_reason' => mb_substr(post('reason'), 0, 500)]);
        if ($m['expense_id']) update('expenses', $m['expense_id'], ['voided' => 1, 'void_reason' => 'Service record voided: ' . mb_substr(post('reason'), 0, 400), 'voided_by' => current_user()['id'], 'voided_at' => now()]);
        // If this record set the schedule, fall back to the latest remaining service.
        $v = row('SELECT * FROM vehicles WHERE id = ?', [$m['vehicle_id']]);
        if ($m['resets_schedule'] && $v['last_service_date'] === $m['service_date']) {
            $prev = row('SELECT * FROM maintenance WHERE vehicle_id = ? AND resets_schedule = 1 AND voided = 0 ORDER BY service_date DESC, id DESC LIMIT 1', [$m['vehicle_id']]);
            update('vehicles', $m['vehicle_id'], ['last_service_date' => $prev['service_date'] ?? null, 'last_service_km' => $prev['odometer'] ?? null]);
        }
        audit('void', 'maintenance', $m['id'], ['reason' => post('reason'), 'cost' => $m['cost']]);
    });
    flash('success', 'Service record voided. It stays in the history, crossed out.');
}

function vehicle_service_post(array $v) {
    if (post('action') === 'maint_add') maint_save($v);
    if (post('action') === 'maint_void') maint_void($v['id']);
    redirect('vehicle', ['id' => $v['id'], 'tab' => 'service']);
}

function maint_form($vehicleSelect = '') {
    $kinds = array_map(fn($k) => $k[0], MAINT_KINDS);
    return form_open('maint_add', 'class="card stack" id="add-job"', true) . '<h3>Record service or repair</h3><div class="grid3">' . $vehicleSelect
        . field('Type of work *', sel('kind', $kinds, old('kind', 'general_service'), 'required')) . field('Date *', inp('service_date', old('service_date', today()), 'date', 'required max="' . today() . '"'))
        . field('Odometer (km)', inp('odometer', old('odometer'), 'number', 'min="0"')) . field('Cost', money_in('cost', old('cost', ''))) . field('Paid by', sel('method', PAY_METHODS, old('method', 'Cash')))
        . field('Garage / provider', inp('provider', old('provider'))) . field('Bill (optional)', '<input type="file" name="file" accept="image/*,application/pdf">') . '</div>'
        . field('What was done', txt('description', old('description'), 'placeholder="e.g. Oil and filter change, front brake pads"'))
        . '<label class="check"><input type="checkbox" name="resets_schedule" value="1"' . (old('resets_schedule', '1') ? ' checked' : '') . '> This was the regular scheduled service (restart the next-service countdown)</label>'
        . '<p class="muted small">The cost is added to expenses automatically. Breakdowns, repairs and accidents also raise an alert for the owner.</p><button class="btn primary">Save</button></form>';
}

function maint_table(array $list, $showVehicle) {
    $trs = [];
    foreach ($list as $m) {
        $void = is_owner() && !$m['voided'] ? form_open('maint_void', 'class="inline" data-prompt="Why void this record?"') . '<input type="hidden" name="maint_id" value="' . $m['id'] . '"><input type="hidden" name="reason"><button class="link">void</button></form>' : '';
        $cells = [e(fmt_d($m['service_date'])), e(MAINT_KINDS[$m['kind']][0] ?? $m['kind']) . ($m['resets_schedule'] ? '<small>scheduled service</small>' : ''), $m['odometer'] !== null ? number_format($m['odometer']) . ' km' : '—',
            ($m['voided'] ? '<s>' . money($m['cost']) . '</s> ' . badge('Voided', 'grey') : money($m['cost'])), e($m['provider'] ?: '—'), nl2br(e($m['description'] ?: '')) . ($m['file_id'] ? ' <a href="' . e(url('file', ['id' => $m['file_id']])) . '" target="_blank">bill</a>' : '') . ' ' . $void];
        if ($showVehicle) array_unshift($cells, '<a href="' . e(url('vehicle', ['id' => $m['vehicle_id'], 'tab' => 'service'])) . '"><b>' . e($m['reg_no']) . '</b></a>');
        $trs[] = tr($cells);
    }
    return table(array_merge($showVehicle ? ['Vehicle'] : [], ['Date', 'Work', 'Odometer', 'Cost', 'Provider', 'Details']), $trs, 'No service or repair records yet.');
}

function vehicle_service_panel(array $v, array $s) {
    $h = '<div class="stats">' . tile('Service status', badge(SERVICE_STATE_LABEL[$s['state']], tone_for($s['state'])))
        . tile('Next service by km', $s['nextKm'] ? number_format($s['nextKm']) . ' km' : '—', null, '', $s['kmLeft'] !== null ? ($s['kmLeft'] < 0 ? number_format(-$s['kmLeft']) . ' km overdue' : number_format($s['kmLeft']) . ' km left') : 'every ' . number_format($s['km']) . ' km')
        . tile('Next service by date', $s['nextDate'] ? fmt_d($s['nextDate']) : '—', null, '', $s['daysLeft'] !== null ? ($s['daysLeft'] < 0 ? (-$s['daysLeft']) . ' days overdue' : $s['daysLeft'] . ' days left') : 'every ' . $s['days'] . ' days')
        . tile('Odometer now', number_format($v['odometer']) . ' km') . '</div>';
    if ($s['state'] === 'unknown') $h .= '<div class="flash info">No service on record. Record the last service below (or set it in Edit vehicle) so reminders can work.</div>';
    if (can('maintenance')) $h .= maint_form();
    $list = rows('SELECT * FROM maintenance WHERE vehicle_id = ? ORDER BY service_date DESC, id DESC', [$v['id']]);
    $total = array_sum(array_map(fn($m) => $m['voided'] ? 0 : (int)$m['cost'], $list));
    $h .= '<h2>History <span class="muted small">· total ' . money($total) . '</span></h2><div class="card flush">' . maint_table($list, false) . '</div>';
    return $h;
}

function page_maintenance() {
    require_perm('maintenance');
    if (is_post()) {
        if (post('action') === 'maint_add') {
            $v = row('SELECT * FROM vehicles WHERE id = ? AND archived = 0', [(int)post('vehicle_id')]);
            if (!$v) throw new UserError('Choose the vehicle.');
            maint_save($v);
        }
        if (post('action') === 'maint_void') maint_void();
        redirect('maintenance');
    }
    $vs = rows('SELECT * FROM vehicles WHERE archived = 0 ORDER BY reg_no');
    $info = []; foreach ($vs as $v) $info[$v['id']] = service_info($v);
    $order = ['overdue' => 0, 'due' => 1, 'unknown' => 2, 'ok' => 3];
    usort($vs, fn($a, $b) => [$order[$info[$a['id']]['state']], $info[$a['id']]['kmLeft'] ?? 0] <=> [$order[$info[$b['id']]['state']], $info[$b['id']]['kmLeft'] ?? 0]);
    $cnt = array_count_values(array_map(fn($i) => $i['state'], $info));
    $h = page_head('Maintenance', 'Service schedules, repairs and their cost');
    $month = substr(today(), 0, 7);
    $spend = (int)val("SELECT COALESCE(SUM(cost),0) FROM maintenance WHERE voided = 0 AND service_date >= ?", [$month . '-01']);
    $h .= '<div class="stats">' . tile('Service overdue', $cnt['overdue'] ?? 0, null, ($cnt['overdue'] ?? 0) ? 'bad' : '') . tile('Service soon', $cnt['due'] ?? 0, null, ($cnt['due'] ?? 0) ? 'warn' : '') . tile('No record yet', $cnt['unknown'] ?? 0)
        . (can('expenses') || can('reports') ? tile('Spent this month', money($spend)) : '') . '</div>';
    $trs = [];
    foreach ($vs as $v) {
        $s = $info[$v['id']];
        $trs[] = tr(['<b>' . e($v['reg_no']) . '</b><small>' . e($v['name']) . '</small>', badge(SERVICE_STATE_LABEL[$s['state']], tone_for($s['state'])), number_format($v['odometer']) . ' km',
            $s['nextKm'] ? number_format($s['nextKm']) . ' km<small>' . ($s['kmLeft'] < 0 ? number_format(-$s['kmLeft']) . ' km over' : number_format($s['kmLeft']) . ' km left') . '</small>' : '—',
            $s['nextDate'] ? e(fmt_d($s['nextDate'])) . '<small>' . ($s['daysLeft'] < 0 ? (-$s['daysLeft']) . ' days over' : $s['daysLeft'] . ' days left') . '</small>' : '—', e(fmt_d($s['lastDate']))], url('vehicle', ['id' => $v['id'], 'tab' => 'service']));
    }
    $h .= '<div class="card flush">' . table(['Vehicle', 'Status', 'Odometer', 'Next by km', 'Next by date', 'Last service'], $trs, 'Add vehicles first.') . '</div>';
    if (can('maintenance') && $vs) $h .= maint_form(field('Vehicle *', sel('vehicle_id', vehicle_options(), old('vehicle_id'), 'required', 'Choose…')));
    $h .= '<h2>Recent work</h2><div class="card flush">' . maint_table(rows('SELECT m.*, v.reg_no FROM maintenance m JOIN vehicles v ON v.id = m.vehicle_id ORDER BY m.service_date DESC, m.id DESC LIMIT 100'), true) . '</div>';
    render_page('Maintenance', $h, 'maintenance');
}
