<?php
defined('APP') or exit;

function page_expenses() {
    require_perm('reports');
    if (is_post()) {
        $a = post('action');
        if ($a === 'add') {
            $date = parse_date(post('expense_date'));
            if (!$date) throw new UserError('Enter the date.');
            if ($date > today()) throw new UserError('The date cannot be in the future.');
            if (!isset(EXPENSE_CATEGORIES[post('category')])) throw new UserError('Choose a category.');
            $amt = parse_money(post('amount'), false);
            if ($amt === false) throw new UserError('Enter the amount.');
            $vid = post('vehicle_id') === '' ? null : (int)post('vehicle_id');
            if ($vid && !row('SELECT id FROM vehicles WHERE id = ?', [$vid])) throw new UserError('Choose a valid car.');
            if (post('description') === '') throw new UserError('Write what the expense was for.');
            $id = tx(function () use ($date, $amt, $vid) {
                $id = insert('expenses', ['expense_date' => $date, 'vehicle_id' => $vid, 'category' => post('category'), 'amount' => $amt, 'description' => mb_substr(post('description'), 0, 1000),
                    'method' => in_array(post('method'), PAY_METHODS, true) ? post('method') : 'Cash', 'source' => 'manual', 'created_by' => current_user()['id'], 'created_at' => now()]);
                if ($fid = handle_upload('file', 'expense', $id)) update('expenses', $id, ['file_id' => $fid]);
                audit('create', 'expense', $id, ['amount' => $amt, 'category' => post('category'), 'vehicle' => $vid]);
                return $id;
            });
            flash('success', 'Expense of ' . money($amt) . ' saved.');
        }
        if ($a === 'void') {
            require_perm('void');
            $x = row('SELECT * FROM expenses WHERE id = ? AND voided = 0', [(int)post('expense_id')]);
            if (!$x) throw new UserError('Expense not found.');
            if (post('reason') === '') throw new UserError('Write the reason.');
            tx(function () use ($x) {
                update('expenses', $x['id'], ['voided' => 1, 'void_reason' => mb_substr(post('reason'), 0, 500), 'voided_by' => current_user()['id'], 'voided_at' => now()]);
                if ($x['source'] === 'maintenance') q('UPDATE maintenance SET voided = 1, void_reason = ? WHERE expense_id = ?', ['Expense voided: ' . mb_substr(post('reason'), 0, 400), $x['id']]);
                audit('void', 'expense', $x['id'], ['amount' => $x['amount'], 'reason' => post('reason')]);
            });
            flash('success', 'Expense voided. It stays in the records, crossed out.');
        }
        redirect('expenses', array_diff_key($_GET, ['p' => 1]));
    }

    $dr = date_range('month');
    $vid = get('vehicle_id'); $cat = get('category'); $period = in_array(get('period'), ['day', 'week', 'month'], true) ? get('period') : 'day';
    $where = 'x.expense_date BETWEEN ? AND ?'; $p = [$dr['from'], $dr['to']];
    if ($vid === 'none') $where .= ' AND x.vehicle_id IS NULL';
    elseif ($vid !== '') { $where .= ' AND x.vehicle_id = ?'; $p[] = (int)$vid; }
    if ($cat !== '' && isset(EXPENSE_CATEGORIES[$cat])) { $where .= ' AND x.category = ?'; $p[] = $cat; }
    $list = rows("SELECT x.*, v.reg_no, u.name AS by_name FROM expenses x LEFT JOIN vehicles v ON v.id = x.vehicle_id LEFT JOIN users u ON u.id = x.created_by WHERE $where ORDER BY x.expense_date DESC, x.id DESC", $p);
    $live = array_values(array_filter($list, fn($x) => !$x['voided']));
    $total = array_sum(array_column($live, 'amount'));

    if (get('export')) {
        require_once __DIR__ . '/reports.php';
        export_table('expenses-' . $dr['from'] . '-to-' . $dr['to'], ['Date', 'Category', 'Vehicle', 'Description', 'Method', 'Amount (₹)', 'Voided', 'Recorded by'],
            array_map(fn($x) => [$x['expense_date'], EXPENSE_CATEGORIES[$x['category']] ?? $x['category'], $x['reg_no'] ?: 'General', $x['description'], $x['method'], money_plain($x['amount']), $x['voided'] ? 'Yes: ' . $x['void_reason'] : '', $x['by_name']], $list), get('export'));
    }

    $h = page_head('Expenses', e($dr['label']) . ' · ' . count($live) . ' expense(s) · ' . money($total));
    $extra = sel('vehicle_id', ['' => 'All vehicles', 'none' => 'General (no car)'] + vehicle_options(true), $vid) . sel('category', ['' => 'All categories'] + EXPENSE_CATEGORIES, $cat) . sel('period', ['day' => 'By day', 'week' => 'By week', 'month' => 'By month'], $period);
    $h .= range_filter('expenses', $dr, $extra);

    $byCat = []; foreach ($live as $x) $byCat[$x['category']] = ($byCat[$x['category']] ?? 0) + (int)$x['amount'];
    arsort($byCat);
    $byVeh = []; foreach ($live as $x) { $k = $x['reg_no'] ?: 'General'; $byVeh[$k] = ($byVeh[$k] ?? 0) + (int)$x['amount']; }
    arsort($byVeh);
    $bars = function ($data, $labels = null) use ($total) {
        if (!$data) return '<p class="muted">No expenses in this period.</p>';
        $h = '<div class="bars">';
        foreach ($data as $k => $amt) $h .= '<div class="bar"><span>' . e($labels[$k] ?? $k) . '</span><i style="--w:' . ($total ? round($amt / $total * 100, 1) : 0) . '%"></i><b>' . money($amt) . '</b></div>';
        return $h . '</div>';
    };
    $per = group_by_period($live, 'expense_date', 'amount', $period);
    $h .= '<div class="grid3"><div class="card"><h3>By category</h3>' . $bars($byCat, EXPENSE_CATEGORIES) . '</div><div class="card"><h3>By car</h3>' . $bars(array_slice($byVeh, 0, 12, true)) . '</div>'
        . '<div class="card"><h3>' . ['day' => 'Daily', 'week' => 'Weekly', 'month' => 'Monthly'][$period] . ' totals</h3>' . ($per ? '<dl class="kv">' . implode('', array_map(fn($k, $v) => '<dt>' . e(period_label($k, $period)) . '</dt><dd>' . money($v) . '</dd>', array_keys($per), $per)) . '</dl>' : '<p class="muted">Nothing yet.</p>') . '</div></div>';

    $h .= form_open('add', 'class="card stack" id="add"', true) . '<h3>Add expense</h3><div class="grid3">' . field('Date *', inp('expense_date', old('expense_date', today()), 'date', 'required max="' . today() . '"'))
        . field('Category *', sel('category', EXPENSE_CATEGORIES, old('category', 'fuel'), 'required')) . field('Amount *', money_in('amount', old('amount', ''), 'required'))
        . field('Vehicle', sel('vehicle_id', vehicle_options(), old('vehicle_id', $vid !== 'none' ? $vid : ''), '', 'General / office expense')) . field('Paid by', sel('method', PAY_METHODS, old('method', 'Cash'))) . field('Bill (optional)', '<input type="file" name="file" accept="image/*,application/pdf">') . '</div>'
        . field('Description *', inp('description', old('description'), 'text', 'required placeholder="e.g. Diesel for delivery to airport"')) . '<p class="muted small">Servicing and repairs are best recorded under Maintenance, so the service schedule updates too.</p><button class="btn primary">Save expense</button></form>';

    $trs = [];
    foreach (array_slice($list, 0, 500) as $x) {
        $void = is_owner() && !$x['voided'] ? form_open('void', 'class="inline" data-prompt="Why void this expense?"') . '<input type="hidden" name="expense_id" value="' . $x['id'] . '"><input type="hidden" name="reason"><button class="link">void</button></form>' : '';
        $trs[] = tr([e(fmt_d($x['expense_date'])), e(EXPENSE_CATEGORIES[$x['category']] ?? $x['category']), e($x['reg_no'] ?: 'General'), e($x['description']) . ($x['source'] !== 'manual' ? ' ' . badge('from ' . $x['source'], 'grey') : '') . ($x['voided'] ? '<small>Voided: ' . e($x['void_reason']) . '</small>' : ''),
            $x['voided'] ? '<s>' . money($x['amount']) . '</s>' : money($x['amount']), e($x['method']), ($x['file_id'] ? '<a href="' . e(url('file', ['id' => $x['file_id']])) . '" target="_blank">bill</a> ' : '') . $void]);
    }
    $q = array_diff_key($_GET, ['p' => 1]);
    $h .= '<div class="row between"><h2>All expenses</h2><div class="row">' . btn('Excel', url('expenses', $q + ['export' => 'xls']), 'ghost small') . btn('CSV', url('expenses', $q + ['export' => 'csv']), 'ghost small') . btn('Print / PDF', url('expenses', $q + ['export' => 'print']), 'ghost small') . '</div></div>';
    $h .= '<div class="card flush">' . table(['Date', 'Category', 'Vehicle', 'Description', 'Amount', 'Method', ''], $trs, 'No expenses in this period.') . '</div>';
    render_page('Expenses', $h, 'expenses');
}
