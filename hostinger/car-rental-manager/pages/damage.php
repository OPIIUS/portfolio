<?php
defined('APP') or exit;

/* Damage records: shared by the car page, the rental page and the customer page. */

function damage_post($vehicleId, $bookingId = null, $customerId = null) {
    $a = post('action');
    if ($a === 'damage_add') {
        require_perm('bookings');
        $est = parse_money(post('estimate'));
        if ($est === false) throw new UserError('Check the repair estimate.');
        tx(function () use ($vehicleId, $bookingId, $customerId, $est) {
            $id = damage_add($vehicleId, $bookingId, $customerId, post('description'), $est);
            damage_photos($id);
        });
        flash('success', 'Damage recorded. It is waiting for the owner to decide whether to charge anyone.');
    }
    if ($a === 'damage_decide') {
        $d = row('SELECT * FROM damages WHERE id = ?', [(int)post('damage_id')]);
        if (!$d || (int)$d['vehicle_id'] !== (int)$vehicleId) throw new UserError('Damage record not found.');
        $charge = post('decision') === 'charge';
        $amt = $charge ? parse_money(post('charge_amount'), false) : 0;
        if ($amt === false) throw new UserError('Enter the amount agreed with the customer.');
        damage_decide($d['id'], $charge, $amt, post('decision_note'));
        flash('success', $charge ? 'Charge of ' . money($amt) . ' added to the rental. It now shows in the customer\'s balance.' : 'Saved: no charge for this damage.');
    }
    if ($a === 'damage_repair') {
        require_perm('maintenance');
        $d = row('SELECT * FROM damages WHERE id = ?', [(int)post('damage_id')]);
        if (!$d || (int)$d['vehicle_id'] !== (int)$vehicleId) throw new UserError('Damage record not found.');
        $cost = parse_money(post('repair_cost'));
        if ($cost === false) throw new UserError('Check the repair cost.');
        damage_repaired($d['id'], parse_date(post('repaired_at')) ?: null, $cost);
        flash('success', 'Marked as repaired.' . ($cost > 0 ? ' The cost was added to this car\'s maintenance expenses.' : ''));
    }
}

function damage_photos($damageId) {
    foreach (array_keys($_FILES['damage_photos']['name'] ?? []) as $i) {
        if (($_FILES['damage_photos']['error'][$i] ?? 4) === UPLOAD_ERR_NO_FILE) continue;
        $_FILES['one'] = array_map(fn($x) => $x[$i], $_FILES['damage_photos']);
        handle_upload('one', 'damage_photo', $damageId, true);
    }
}

function damage_rows($where, $params) {
    return rows("SELECT d.*, v.reg_no, v.name AS vehicle_name, c.name AS customer_name, b.code, u.name AS by_name, ud.name AS decided_name
        FROM damages d JOIN vehicles v ON v.id = d.vehicle_id LEFT JOIN customers c ON c.id = d.customer_id LEFT JOIN bookings b ON b.id = d.booking_id
        LEFT JOIN users u ON u.id = d.created_by LEFT JOIN users ud ON ud.id = d.decided_by WHERE $where ORDER BY d.id DESC", $params);
}

/* List of damage records with the owner's decision and repair forms. */
function damage_list(array $list, $show = 'vehicle') {
    if (!$list) return '<p class="muted">No damage recorded.</p>';
    $h = '<div class="damage-list">';
    foreach ($list as $d) {
        $h .= '<div class="damage"><div class="row between"><div><b>' . e(fmt_d($d['created_at'])) . '</b>'
            . ($show !== 'vehicle' ? ' · <a href="' . e(url('vehicle', ['id' => $d['vehicle_id'], 'tab' => 'damage'])) . '">' . e($d['reg_no']) . '</a>' : '')
            . ($show !== 'customer' && $d['customer_name'] ? ' · ' . ($d['customer_id'] ? '<a href="' . e(url('customer', ['id' => $d['customer_id']])) . '">' . e($d['customer_name']) . '</a>' : e($d['customer_name'])) : '')
            . ($d['code'] && $show !== 'rental' ? ' · rental <a href="' . e(url('booking', ['id' => $d['booking_id']])) . '">' . e($d['code']) . '</a>' : '') . '</div><div>'
            . badge(DAMAGE_STATUS_LABEL[$d['status']] ?? $d['status'], tone_for($d['status'])) . ' ' . ($d['repaired_at'] ? badge('Repaired ' . fmt_d($d['repaired_at']), 'green') : badge('Not repaired yet', 'red')) . '</div></div>'
            . '<p>' . nl2br(e($d['description'])) . '</p><p class="small muted">Recorded by ' . e($d['by_name'] ?: '—') . (can('payments') && $d['estimate_cost'] ? ' · estimate ' . money($d['estimate_cost']) : '')
            . ($d['status'] === 'charged' && can('payments') ? ' · charged ' . money($d['charge_amount']) : '') . ($d['decided_name'] ? ' · decided by ' . e($d['decided_name']) : '') . ($d['decision_note'] ? ': ' . e($d['decision_note']) : '')
            . ($d['repaired_at'] && can('payments') && $d['repair_cost'] ? ' · repair cost ' . money($d['repair_cost']) : '') . '</p>';
        $ph = rows("SELECT id FROM files WHERE entity = 'damage_photo' AND entity_id = ? AND deleted = 0", [$d['id']]);
        if ($ph) { $h .= '<div class="photos">'; foreach ($ph as $p) $h .= '<figure><a href="' . e(url('file', ['id' => $p['id']])) . '" target="_blank"><img loading="lazy" src="' . e(url('file', ['id' => $p['id']])) . '" alt="Damage photo"></a></figure>'; $h .= '</div>'; }
        if ($d['status'] === 'review' && can('void')) {
            $h .= form_open('damage_decide', 'class="decide"') . '<input type="hidden" name="damage_id" value="' . $d['id'] . '"><p class="small"><b>Your decision</b>: nothing is charged until you choose.</p><div class="row">'
                . ($d['booking_id'] ? '<label class="check"><input type="radio" name="decision" value="charge" required> Charge the customer</label>' . money_in('charge_amount', $d['estimate_cost'] ?: '', 'aria-label="Amount to charge"') : '')
                . '<label class="check"><input type="radio" name="decision" value="none" required' . ($d['booking_id'] ? '' : ' checked') . '> No charge</label></div>'
                . inp('decision_note', '', 'text', 'placeholder="Note (optional), e.g. agreed with customer on phone"') . '<button class="btn small">Save decision</button></form>';
        } elseif ($d['status'] === 'review') $h .= '<p class="small amber">Waiting for the owner to decide about charges.</p>';
        if (!$d['repaired_at'] && can('maintenance'))
            $h .= '<details><summary>Mark as repaired</summary>' . form_open('damage_repair', 'class="row"') . '<input type="hidden" name="damage_id" value="' . $d['id'] . '">' . inp('repaired_at', today(), 'date', 'max="' . today() . '" aria-label="Repair date"') . money_in('repair_cost', '', 'placeholder="Repair cost" aria-label="Repair cost"') . '<button class="btn small">Save</button></form></details>';
        $h .= '</div>';
    }
    return $h . '</div>';
}

function damage_form($title = 'Record damage') {
    return form_open('damage_add', 'class="card stack" id="add-damage"', true) . '<h3>' . e($title) . '</h3>' . field('What is damaged and where? *', txt('description', '', 'required placeholder="e.g. Dent on rear left door, 10 cm"'))
        . '<div class="grid2">' . field('Repair estimate (optional)', money_in('estimate', '')) . field('Photos (optional)', '<input type="file" name="damage_photos[]" accept="image/*" multiple>') . '</div>'
        . '<p class="muted small">The customer is not charged automatically. The owner decides afterwards.</p><button class="btn">Save damage record</button></form>';
}
