<?php
defined('APP') or exit;

/* Save a new or renewed document for a vehicle. The previous document of the same type is kept, marked as replaced. */
function vehicle_documents_post(array $v) {
    require_perm('documents');
    $a = post('action'); $id = $v['id'];
    if ($a === 'doc_add') {
        $type = row('SELECT * FROM doc_types WHERE id = ? AND active = 1', [(int)post('doc_type_id')]);
        if (!$type) throw new UserError('Choose the document type.');
        $issue = parse_date(post('issue_date')); $exp = parse_date(post('expiry_date'));
        if ($issue === false || $exp === false) throw new UserError('Check the dates.');
        if ($type['has_expiry'] && !$exp) throw new UserError("Enter the expiry date of the {$type['name']}.");
        if ($issue && $exp && $exp < $issue) throw new UserError('The expiry date is before the issue date.');
        $cost = parse_money(post('cost'));
        if ($cost === false) throw new UserError('Check the cost.');
        if ($cost > 0 && !can('expenses')) throw new UserError('You do not have access to record expenses. Leave the cost empty.');
        $did = tx(function () use ($v, $type, $issue, $exp, $cost, $id) {
            $prev = rows('SELECT id FROM vehicle_documents WHERE vehicle_id = ? AND doc_type_id = ? AND replaced = 0', [$id, $type['id']]);
            foreach ($prev as $p) update('vehicle_documents', $p['id'], ['replaced' => 1]);
            $did = insert('vehicle_documents', ['vehicle_id' => $id, 'doc_type_id' => $type['id'], 'number' => mb_substr(post('number'), 0, 100), 'issue_date' => $issue,
                'expiry_date' => $type['has_expiry'] ? $exp : null, 'authority' => mb_substr(post('authority'), 0, 150), 'notes' => mb_substr(post('notes'), 0, 1000),
                'created_by' => current_user()['id'], 'created_at' => now()]);
            if ($fid = handle_upload('file', 'vehicle_doc', $did)) update('vehicle_documents', $did, ['file_id' => $fid]);
            if ($cost > 0) {
                $cat = match (mb_strtolower($type['name'])) { 'insurance' => 'insurance', 'puc certificate', 'puc' => 'puc', default => 'other' };
                insert('expenses', ['expense_date' => $issue ?: today(), 'vehicle_id' => $id, 'category' => $cat, 'amount' => $cost, 'description' => $type['name'] . ' renewal' . (post('number') ? ' (' . mb_substr(post('number'), 0, 60) . ')' : ''),
                    'method' => in_array(post('method'), PAY_METHODS, true) ? post('method') : 'Cash', 'source' => 'document', 'created_by' => current_user()['id'], 'created_at' => now()]);
            }
            audit($prev ? 'renew' : 'create', 'vehicle_document', $did, ['vehicle' => $v['reg_no'], 'type' => $type['name'], 'expiry' => $exp, 'replaced' => array_column($prev, 'id')]);
            return $did;
        });
        flash('success', "{$type['name']} saved for {$v['reg_no']}." . ($cost > 0 ? ' The cost was added to expenses.' : ''));
        redirect('vehicle', ['id' => $id, 'tab' => 'documents']);
    }
    redirect('vehicle', ['id' => $id, 'tab' => 'documents']);
}

function doc_when($it) {
    if ($it['state'] === 'missing') return '<span class="red">Not added</span>';
    if (!$it['doc']['expiry_date']) return 'No expiry';
    $d = $it['days_left'];
    return e(fmt_d($it['doc']['expiry_date'])) . '<small>' . ($d < 0 ? 'expired ' . (-$d) . ' day(s) ago' : ($d === 0 ? 'expires today' : "in $d day(s)")) . '</small>';
}

function vehicle_documents_panel(array $v, array $comp) {
    $h = '<div class="card"><div class="row between"><h3>Documents</h3>' . badge(COMPLIANCE_LABEL[$comp['overall']], tone_for($comp['overall'])) . '</div>';
    $trs = [];
    foreach ($comp['items'] as $it) {
        $d = $it['doc'];
        $trs[] = tr(['<b>' . e($it['type']['name']) . '</b>' . ($it['required'] ? '' : '<small>optional for ' . e($v['category'] ?: 'this type') . '</small>'), badge(DOC_STATE_LABEL[$it['state']], tone_for($it['state'])), doc_when($it),
            e($d['number'] ?? '—') . ($d && $d['authority'] ? '<small>' . e($d['authority']) . '</small>' : ''), $d && $d['file_id'] ? '<a href="' . e(url('file', ['id' => $d['file_id']])) . '" target="_blank">View file</a>' : '<span class="muted">—</span>']);
    }
    $h .= table(['Document', 'State', 'Expiry', 'Number', 'File'], $trs, 'No documents are required for this vehicle category. You can still add documents below.') . '</div>';
    if (can('documents')) {
        $types = []; foreach (doc_types() as $t) $types[$t['id']] = $t['name'];
        $h .= form_open('doc_add', 'class="card stack" id="add-doc"', true) . '<h3>Add or renew a document</h3><p class="muted small">Renewing keeps the old document in the history.</p><div class="grid3">'
            . field('Document *', sel('doc_type_id', $types, get('type'), 'required', 'Choose…')) . field('Number', inp('number', old('number'))) . field('Issued by', inp('authority', old('authority'), 'text', 'placeholder="e.g. insurer, RTO"'))
            . field('Issue date', inp('issue_date', old('issue_date'), 'date')) . field('Expiry date', inp('expiry_date', old('expiry_date'), 'date'), 'Required for documents that expire.') . field('Scan or photo', '<input type="file" name="file" accept="image/*,application/pdf">', 'PDF, JPG, PNG or WEBP, up to 8 MB.')
            . (can('expenses') ? field('Cost paid (optional)', money_in('cost', old('cost', ''))) . field('Paid by', sel('method', PAY_METHODS, old('method', 'UPI'))) : '') . field('Notes', inp('notes', old('notes'))) . '</div><button class="btn primary">Save document</button></form>';
    }
    $hist = rows('SELECT d.*, t.name AS type_name FROM vehicle_documents d JOIN doc_types t ON t.id = d.doc_type_id WHERE d.vehicle_id = ? AND d.replaced = 1 ORDER BY d.id DESC', [$v['id']]);
    if ($hist) {
        $trs = array_map(fn($d) => tr([e($d['type_name']), e($d['number'] ?: '—'), e(fmt_d($d['issue_date'])), e(fmt_d($d['expiry_date'])), $d['file_id'] ? '<a href="' . e(url('file', ['id' => $d['file_id']])) . '" target="_blank">View</a>' : '—']), $hist);
        $h .= '<h2>Older documents</h2><div class="card flush">' . table(['Document', 'Number', 'Issued', 'Expired', 'File'], $trs) . '</div>';
    }
    return $h;
}

function page_documents() {
    require_perm('documents');
    $fc = fleet_compliance();
    $f = get('f');
    $counts = ['blocked' => 0, 'warning' => 0, 'ok' => 0];
    $items = [];
    foreach ($fc as $vid => $c) {
        $counts[$c['overall']]++;
        foreach ($c['items'] as $it) $items[] = $it + ['vehicle' => $c['vehicle']];
    }
    $order = ['expired' => 0, 'missing' => 1, 'expiring' => 2, 'valid' => 3];
    usort($items, fn($a, $b) => [$order[$a['state']], $a['days_left'] ?? -9999] <=> [$order[$b['state']], $b['days_left'] ?? -9999]);
    if ($f !== '') $items = array_values(array_filter($items, fn($i) => $i['state'] === $f));
    $h = page_head('Documents', 'Insurance, PUC, RC and other papers for every vehicle', '');
    $h .= '<div class="stats">' . tile('Not road-legal', $counts['blocked'], url('documents', ['f' => 'expired']), $counts['blocked'] ? 'bad' : '', 'vehicles with expired or missing required papers')
        . tile('Renewal due soon', $counts['warning'], url('documents', ['f' => 'expiring']), $counts['warning'] ? 'warn' : '', 'within ' . max(reminder_days()) . ' days')
        . tile('Compliant', $counts['ok'], null, 'good', 'vehicles') . '</div>';
    $h .= '<div class="chips">';
    foreach (['' => 'All', 'expired' => 'Expired', 'missing' => 'Missing', 'expiring' => 'Expiring soon', 'valid' => 'Valid'] as $k => $l) $h .= '<a class="chip' . ($f === $k ? ' on' : '') . '" href="' . e(url('documents', ['f' => $k])) . '">' . $l . '</a>';
    $h .= '</div>';
    $trs = [];
    foreach ($items as $it) {
        $v = $it['vehicle'];
        $trs[] = tr(['<b>' . e($v['reg_no']) . '</b><small>' . e($v['name']) . '</small>', e($it['type']['name']) . ($it['required'] ? '' : '<small>optional</small>'), badge(DOC_STATE_LABEL[$it['state']], tone_for($it['state'])), doc_when($it), e($it['doc']['number'] ?? '—')],
            url('vehicle', ['id' => $v['id'], 'tab' => 'documents']) . ($it['state'] !== 'valid' ? '&type=' . $it['type']['id'] . '#add-doc' : ''));
    }
    $h .= '<div class="card flush">' . table(['Vehicle', 'Document', 'State', 'Expiry', 'Number'], $trs, 'No documents match.') . '</div>';
    $h .= '<p class="muted small">Which documents each vehicle category needs is set by the owner in Settings → Documents. Reminders are sent ' . e(implode(', ', reminder_days())) . ' days before expiry. This app does not decide what the law requires: check with your RTO or insurer.</p>';
    render_page('Documents', $h, 'documents');
}
