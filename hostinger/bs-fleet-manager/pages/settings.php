<?php
defined('APP') or exit;

function page_settings() {
    require_perm('settings');
    $tab = get('tab', 'business');
    $me = current_user();
    if (is_post()) {
        $a = post('action');
        switch ($a) {
            case 'business':
                if (post('business_name') === '') throw new UserError('Enter the business name.');
                foreach (['business_name' => 100, 'business_phone' => 30, 'business_email' => 120, 'business_address' => 500, 'business_gstin' => 20] as $k => $len) setting_save($k, mb_substr(post($k), 0, $len));
                $prefix = strtoupper(preg_replace('/[^A-Za-z]/', '', post('booking_prefix')));
                setting_save('booking_prefix', substr($prefix ?: 'BS', 0, 5));
                audit('settings', 'business'); flash('success', 'Business details saved.'); break;
            case 'rules':
                $days = array_filter(array_map('trim', explode(',', post('reminder_days'))), fn($x) => $x !== '');
                foreach ($days as $d) if (!ctype_digit($d) || (int)$d > 365) throw new UserError('Reminder days must be whole numbers between 0 and 365, separated by commas.');
                if (!$days) throw new UserError('Enter at least one reminder day.');
                $nums = array_unique(array_map('intval', $days)); rsort($nums);
                setting_save('reminder_days', implode(',', $nums));
                foreach (['return_alert_hours' => [1, 168], 'payment_alert_days' => [0, 30], 'service_km_warning' => [0, 20000], 'service_days_warning' => [0, 180], 'default_service_km' => [500, 100000], 'default_service_days' => [15, 1000], 'session_minutes' => [10, 1440]] as $k => [$min, $max]) {
                    $v = post($k);
                    if (!ctype_digit($v) || (int)$v < $min || (int)$v > $max) throw new UserError('Check the value for "' . str_replace('_', ' ', $k) . "\" (between $min and $max).");
                    setting_save($k, (int)$v);
                }
                foreach (['late_fee_per_hour' => 'late fee', 'extra_km_rate' => 'extra km rate'] as $k => $l) { $m = parse_money(post($k)); if ($m === false) throw new UserError("Check the $l."); setting_save($k, $m); }
                audit('settings', 'rules', null, ['reminder_days' => implode(',', $nums)]); flash('success', 'Rules saved.'); break;
            case 'categories':
                $cats = array_values(array_unique(array_filter(array_map(fn($x) => mb_substr(trim($x), 0, 40), explode("\n", (string)post('categories'))))));
                if (!$cats) throw new UserError('Keep at least one category.');
                setting_save('categories', implode("\n", $cats));
                audit('settings', 'categories', null, $cats); flash('success', 'Categories saved.'); break;
            case 'doc_types':
                $cats = categories();
                tx(function () use ($cats) {
                    foreach (doc_types(false) as $t) {
                        $sel = (array)($_POST['req'][$t['id']] ?? []);
                        $req = in_array('__all', $sel, true) ? 'all' : implode('|', array_values(array_intersect($cats, $sel)));
                        update('doc_types', $t['id'], ['required_for' => $req, 'has_expiry' => isset($_POST['exp'][$t['id']]) ? 1 : 0, 'active' => isset($_POST['act'][$t['id']]) ? 1 : 0]);
                    }
                    if (($n = mb_substr(post('new_type'), 0, 80)) !== '') insert('doc_types', ['name' => $n, 'required_for' => '', 'has_expiry' => 1, 'active' => 1, 'sort' => 99]);
                });
                audit('settings', 'doc_types'); flash('success', 'Document rules saved. Vehicle compliance has been recalculated.'); run_checks(); break;
            case 'user_add':
                $email = strtolower(post('email'));
                if (post('name') === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) throw new UserError('Enter a name and a valid email.');
                if (val('SELECT id FROM users WHERE email = ?', [$email])) throw new UserError('Someone already uses this email.');
                $pw = (string)($_POST['password'] ?? '');
                if ($e = validate_password($pw)) throw new UserError($e);
                $role = post('role') === 'owner' ? 'owner' : 'staff';
                $perms = array_values(array_intersect(array_keys(PERMS), (array)($_POST['perms'] ?? [])));
                $uid = insert('users', ['name' => mb_substr(post('name'), 0, 100), 'email' => $email, 'password_hash' => password_hash($pw, PASSWORD_DEFAULT), 'role' => $role, 'perms' => json_encode($perms), 'active' => 1, 'session_version' => 1, 'created_at' => now(), 'updated_at' => now()]);
                audit('create', 'user', $uid, ['email' => $email, 'role' => $role, 'perms' => $perms]); flash('success', 'Account created. Give them the email and password; they can change the password after signing in.'); break;
            case 'user_update':
                $u = row('SELECT * FROM users WHERE id = ?', [(int)post('user_id')]);
                if (!$u) throw new UserError('User not found.');
                $role = post('role') === 'owner' ? 'owner' : 'staff';
                $active = post('active') === '1' ? 1 : 0;
                if ((int)$u['id'] === (int)$me['id'] && ($role !== 'owner' || !$active)) throw new UserError('You cannot remove your own owner access or switch off your own account.');
                if ($u['role'] === 'owner' && ($role !== 'owner' || !$active) && (int)val("SELECT COUNT(*) FROM users WHERE role = 'owner' AND active = 1") <= 1) throw new UserError('There must always be at least one active owner.');
                $perms = array_values(array_intersect(array_keys(PERMS), (array)($_POST['perms'] ?? [])));
                $upd = ['role' => $role, 'perms' => json_encode($perms), 'active' => $active, 'updated_at' => now()];
                if (!$active || $role !== $u['role']) $upd['session_version'] = (int)$u['session_version'] + 1;
                $pw = (string)($_POST['new_password'] ?? '');
                if ($pw !== '') { if ($e = validate_password($pw)) throw new UserError($e); $upd['password_hash'] = password_hash($pw, PASSWORD_DEFAULT); $upd['session_version'] = (int)$u['session_version'] + 1; }
                update('users', $u['id'], $upd);
                audit('update', 'user', $u['id'], ['role' => $role, 'perms' => $perms, 'active' => $active, 'password_reset' => $pw !== '']);
                flash('success', 'Account updated.' . ($pw !== '' ? ' Password reset; they have been signed out everywhere.' : '')); break;
            case 'email':
                $on = post('email_digest') === '1';
                if ($on && !filter_var(post('digest_email'), FILTER_VALIDATE_EMAIL)) throw new UserError('Enter a valid email address for alerts.');
                setting_save('email_digest', $on ? '1' : '0'); setting_save('digest_email', post('digest_email'));
                audit('settings', 'email', null, ['on' => $on]); flash('success', 'Email settings saved.'); break;
            case 'email_test':
                $ok = filter_var(setting('digest_email'), FILTER_VALIDATE_EMAIL) && @mail(setting('digest_email'), setting('business_name') . ': test email', 'This is a test from your fleet manager. Email alerts are working.', 'From: ' . (setting('business_email') ?: 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost')));
                flash($ok ? 'success' : 'error', $ok ? 'Test email handed to the server. Check the inbox (and spam folder) in a few minutes.' : 'The server could not send email. Check the address, or set up email in Hostinger first.'); break;
            case 'cron_token':
                setting_save('cron_token', bin2hex(random_bytes(16))); audit('settings', 'cron_token'); flash('success', 'New cron link created. Update it in Hostinger if you use the web cron.'); break;
            case 'backup_now':
                require_perm('backup'); $f = backup_write(); audit('backup', 'system', null, basename($f)); flash('success', 'Backup saved on the server: ' . basename($f)); break;
            case 'backup_download':
                require_perm('backup');
                $name = basename(post('file'));
                $path = STORAGE . '/backups/' . $name;
                if (!preg_match('/^backup-[\d-]+\.json\.gz$/', $name) || !is_file($path)) throw new UserError('Backup not found.');
                audit('download', 'backup', null, $name);
                header('Content-Type: application/gzip'); header('Content-Disposition: attachment; filename="' . $name . '"'); header('Content-Length: ' . filesize($path)); readfile($path); exit;
            case 'restore':
                require_perm('backup');
                if (post('confirm') !== 'RESTORE') throw new UserError('Type RESTORE in capitals to confirm.');
                if (empty($_FILES['backup']['tmp_name']) || !is_uploaded_file($_FILES['backup']['tmp_name']) && PHP_SAPI !== 'cli') throw new UserError('Choose a backup file.');
                $raw = file_get_contents($_FILES['backup']['tmp_name']);
                $json = str_starts_with($raw, "\x1f\x8b") ? gzdecode($raw) : $raw;
                $safety = backup_write();
                backup_restore($json);
                $_SESSION['_reload'] = time();
                audit('restore', 'backup', null, ['safety_copy' => basename($safety)]);
                flash('success', 'Backup restored. A copy of the data from just before the restore was saved as ' . basename($safety) . '.');
                if (!current_user()) redirect('login');
                break;
        }
        redirect('settings', ['tab' => $tab]);
    }

    $h = page_head('Settings', 'Only owners can see this page');
    $h .= tabs('settings', [], $tab, ['business' => 'Business', 'rules' => 'Reminders & rates', 'documents' => 'Documents', 'categories' => 'Categories', 'team' => 'Team', 'backup' => 'Backup', 'integrations' => 'Alerts & integrations', 'audit' => 'Activity log']);
    $s = fn($k) => setting($k, '');
    if ($tab === 'business') {
        $h .= form_open('business', 'class="card stack narrow"') . field('Business name *', inp('business_name', $s('business_name'), 'text', 'required')) . field('Phone', inp('business_phone', $s('business_phone'))) . field('Email', inp('business_email', $s('business_email'), 'email'))
            . field('Address (printed on receipts)', txt('business_address', $s('business_address'))) . field('GSTIN (optional)', inp('business_gstin', $s('business_gstin'))) . field('Booking number prefix', inp('booking_prefix', $s('booking_prefix'), 'text', 'maxlength="5"'), 'Bookings are numbered like ' . e($s('booking_prefix')) . date('y') . '-0001.')
            . '<button class="btn primary">Save</button></form>';
    }
    if ($tab === 'rules') {
        $h .= form_open('rules', 'class="card stack"') . '<h3>Reminders</h3><div class="grid3">' . field('Document reminders (days before expiry)', inp('reminder_days', $s('reminder_days')), 'Comma separated, e.g. 30,15,7,1,0')
            . field('Warn about returns (hours before)', inp('return_alert_hours', $s('return_alert_hours'), 'number')) . field('Warn about payments (days before due)', inp('payment_alert_days', $s('payment_alert_days'), 'number')) . '</div>'
            . '<h3>Servicing</h3><div class="grid3">' . field('Default service interval (km)', inp('default_service_km', $s('default_service_km'), 'number')) . field('Default service interval (days)', inp('default_service_days', $s('default_service_days'), 'number'))
            . field('Warn this many km before', inp('service_km_warning', $s('service_km_warning'), 'number')) . field('Warn this many days before', inp('service_days_warning', $s('service_days_warning'), 'number')) . '</div>'
            . '<h3>Suggested charges at return</h3><p class="muted small">These are only suggestions shown when a vehicle comes back. Nothing is charged unless you tick it.</p><div class="grid3">' . field('Late return, per hour', money_in('late_fee_per_hour', $s('late_fee_per_hour'))) . field('Extra km, per km', money_in('extra_km_rate', $s('extra_km_rate'))) . '</div>'
            . '<h3>Security</h3>' . field('Sign out after inactivity (minutes)', inp('session_minutes', $s('session_minutes'), 'number')) . '<button class="btn primary">Save</button></form>';
    }
    if ($tab === 'documents') {
        $cats = categories();
        $h .= form_open('doc_types', 'class="card stack"') . '<h3>Which documents does each vehicle category need?</h3><p class="muted small">You decide this. Insurance, PUC and RC start as required for all vehicles. Fitness, permit and road tax depend on how each vehicle is registered (for example yellow-plate taxi vs. self-drive), so tick them for the categories where they apply. Check with your RTO if unsure.</p><div class="tw"><table class="doc-matrix"><thead><tr><th>Document</th><th>All</th>';
        foreach ($cats as $c) $h .= '<th>' . e($c) . '</th>';
        $h .= '<th>Expires</th><th>In use</th></tr></thead><tbody>';
        foreach (doc_types(false) as $t) {
            $h .= '<tr><td>' . e($t['name']) . '</td><td><input type="checkbox" name="req[' . $t['id'] . '][]" value="__all"' . ($t['required_for'] === 'all' ? ' checked' : '') . ' aria-label="All"></td>';
            foreach ($cats as $c) $h .= '<td><input type="checkbox" name="req[' . $t['id'] . '][]" value="' . e($c) . '"' . (doc_required($t, $c) && $t['required_for'] !== 'all' ? ' checked' : '') . ' aria-label="' . e($c) . '"></td>';
            $h .= '<td><input type="checkbox" name="exp[' . $t['id'] . ']" value="1"' . ($t['has_expiry'] ? ' checked' : '') . '></td><td><input type="checkbox" name="act[' . $t['id'] . ']" value="1"' . ($t['active'] ? ' checked' : '') . '></td></tr>';
        }
        $h .= '</tbody></table></div>' . field('Add another document type', inp('new_type', '', 'text', 'placeholder="e.g. Pollution sticker, Fastag"')) . '<button class="btn primary">Save</button></form>';
    }
    if ($tab === 'categories') {
        $h .= form_open('categories', 'class="card stack narrow"') . field('Vehicle categories (one per line)', '<textarea name="categories" rows="8">' . e($s('categories')) . '</textarea>', 'Renaming a category does not change vehicles already saved; edit them too.') . '<button class="btn primary">Save</button></form>';
    }
    if ($tab === 'team') {
        $permBoxes = function ($have, $prefix = 'perms') { $h = '<div class="checks-grid">'; foreach (PERMS as $k => $l) $h .= '<label class="check"><input type="checkbox" name="' . $prefix . '[]" value="' . $k . '"' . (in_array($k, $have, true) ? ' checked' : '') . '> ' . e($l) . '</label>'; return $h . '</div>'; };
        foreach (rows('SELECT * FROM users ORDER BY role, name') as $u) {
            $h .= form_open('user_update', 'class="card stack"') . '<input type="hidden" name="user_id" value="' . $u['id'] . '"><div class="row between"><div><b>' . e($u['name']) . '</b> <span class="muted">' . e($u['email']) . '</span><br><small class="muted">Last sign-in: ' . e(fmt_dt($u['last_login'])) . '</small></div>' . badge($u['active'] ? ($u['role'] === 'owner' ? 'Owner' : 'Staff') : 'Switched off', $u['active'] ? 'green' : 'grey') . '</div>'
                . '<div class="grid3">' . field('Role', sel('role', ['staff' => 'Staff (only what is ticked)', 'owner' => 'Owner (everything)'], $u['role'])) . field('Account', sel('active', ['1' => 'Active', '0' => 'Switched off'], $u['active'])) . field('Reset password', inp('new_password', '', 'password', 'autocomplete="new-password" placeholder="Leave empty to keep"')) . '</div>'
                . ($u['role'] === 'staff' ? $permBoxes(json_decode($u['perms'] ?: '[]', true) ?: []) : '<p class="muted small">Owners can do everything, including voiding payments, settings and backups.</p>') . '<button class="btn">Save</button></form>';
        }
        $h .= form_open('user_add', 'class="card stack"') . '<h3>Add a team member</h3><div class="grid3">' . field('Name', inp('name', old('name'), 'text', 'required')) . field('Email (used to sign in)', inp('email', old('email'), 'email', 'required')) . field('Password', inp('password', '', 'password', 'required autocomplete="new-password"'), 'At least 8 characters with a letter and a number.')
            . field('Role', sel('role', ['staff' => 'Staff', 'owner' => 'Owner'], 'staff')) . '</div><p class="small">Staff can:</p>' . $permBoxes(STAFF_DEFAULT) . '<p class="muted small">Only owners can void payments, delete records, change settings, manage the team, and download backups.</p><button class="btn primary">Create account</button></form>';
    }
    if ($tab === 'backup') {
        $files = glob(STORAGE . '/backups/backup-*.json.gz') ?: []; rsort($files);
        $h .= '<div class="card stack"><h3>Backups</h3><p>A backup of all data is saved on the server every day (when the cron job is set up) and the last 30 are kept. Last backup: <b>' . e(fmt_dt($s('last_backup'))) . '</b>. Download one every week and keep it on your phone or Google Drive too.</p>'
            . form_open('backup_now') . '<button class="btn primary">Back up now</button></form>';
        if ($files) { $h .= '<div class="tw"><table><thead><tr><th>File</th><th>Size</th><th></th></tr></thead><tbody>'; foreach (array_slice($files, 0, 30) as $f) $h .= '<tr><td>' . e(basename($f)) . '</td><td>' . number_format(filesize($f) / 1024, 1) . ' KB</td><td>' . form_open('backup_download', 'class="inline"') . '<input type="hidden" name="file" value="' . e(basename($f)) . '"><button class="link">Download</button></form></td></tr>'; $h .= '</tbody></table></div>'; }
        $h .= '<p class="muted small">Uploaded photos and documents are in the storage/uploads folder. Hostinger\'s own daily/weekly backups include them.</p></div>';
        $h .= form_open('restore', 'class="card danger stack"', true) . '<h3>Restore from a backup</h3><p class="muted small">This replaces ALL current data with the backup. A safety copy of the current data is saved first.</p>' . field('Backup file (.json.gz)', '<input type="file" name="backup" accept=".gz,.json" required>') . field('Type RESTORE to confirm', inp('confirm', '', 'text', 'autocomplete="off"')) . '<button class="btn ghost">Restore</button></form>';
    }
    if ($tab === 'integrations') {
        $cronUrl = (isset($_SERVER['HTTP_HOST']) ? (($_SERVER['HTTPS'] ?? '') === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') : '') . '/cron.php?token=' . $s('cron_token');
        $h .= '<div class="card stack"><h3>Automatic checks (cron)</h3><p>Alerts are checked whenever someone uses the app (at most every 10 minutes). For alerts and backups to run even when nobody is signed in, add a cron job in Hostinger (Advanced → Cron Jobs), every hour:</p><pre>php ' . e(ROOT) . '/cron.php</pre><p class="small">Last cron run: <b>' . e(fmt_dt($s('last_cron'))) . '</b> · last check: <b>' . e(fmt_dt($s('last_check'))) . '</b></p>'
            . '<details><summary>Web cron link (if you use an outside cron service)</summary><pre>' . e($cronUrl) . '</pre>' . form_open('cron_token') . '<button class="btn ghost small">Make a new link</button></form></details></div>';
        $h .= form_open('email', 'class="card stack"') . '<h3>Email alerts (optional)</h3><p class="muted small">Sends new alerts to one email address when the cron job runs. Uses your Hostinger mail; it can land in spam until you mark it "not spam".</p>'
            . '<label class="check"><input type="checkbox" name="email_digest" value="1"' . ($s('email_digest') === '1' ? ' checked' : '') . '> Email me new alerts</label>' . field('Send to', inp('digest_email', $s('digest_email'), 'email')) . '<div class="row"><button class="btn primary">Save</button></div></form>'
            . form_open('email_test', 'class="card"') . '<button class="btn ghost small">Send a test email</button></form>';
        $h .= '<div class="card stack"><h3>WhatsApp</h3><p><b>Status: not connected.</b> The app gives you WhatsApp buttons (payment reminders) that open WhatsApp with the message ready; you press send yourself. Nothing is sent automatically.</p><p class="muted small">Automatic WhatsApp messages need a WhatsApp Business API account (Meta, or a provider such as Interakt, AiSensy or Gupshup), approved message templates, and a monthly fee. When you have one, your developer can connect it.</p></div>';
        $h .= '<div class="card stack"><h3>GPS tracking</h3><p><b>Status: not connected.</b> The app shows who has each vehicle and the pickup/drop-off locations from the booking. It does not show live location.</p><p class="muted small">For live location, fit GPS trackers in the vehicles (₹1,500–₹3,500 each plus a yearly SIM plan). Put the tracker\'s ID and its tracking link on each vehicle (Edit vehicle) and the vehicle page will show an "Open GPS tracker" button.</p></div>';
    }
    if ($tab === 'audit') {
        $ent = get('entity');
        $w = $ent !== '' ? 'WHERE a.entity = ?' : ''; $p = $ent !== '' ? [$ent] : [];
        $list = rows("SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id $w ORDER BY a.id DESC LIMIT 300", $p);
        $ents = array_column(rows('SELECT DISTINCT entity FROM audit_log ORDER BY entity'), 'entity');
        $h .= '<form class="filters" method="get"><input type="hidden" name="p" value="settings"><input type="hidden" name="tab" value="audit">' . sel('entity', ['' => 'Everything'] + array_combine($ents, $ents), $ent) . '<button class="btn">Filter</button></form>';
        $trs = array_map(fn($a) => tr([e(fmt_dt($a['created_at'])), e($a['user_name'] ?: 'System'), e($a['action']), e($a['entity']) . ($a['entity_id'] ? ' #' . (int)$a['entity_id'] : ''), '<code class="small">' . e(mb_strimwidth((string)$a['details'], 0, 180, '…')) . '</code>', e($a['ip'])]), $list);
        $h .= '<div class="card flush">' . table(['When', 'Who', 'Action', 'What', 'Details', 'IP'], $trs, 'No activity yet.') . '</div><p class="muted small">Every change, payment, void, sign-in and export is recorded here and cannot be edited from the app.</p>';
    }
    render_page('Settings', $h, 'settings');
}
