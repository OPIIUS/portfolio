<?php
defined('APP') or exit;

function page_login() {
    if (current_user()) redirect('dashboard');
    if (is_post()) {
        $email = strtolower(post('email')); $pw = (string)($_POST['password'] ?? '');
        if (login_attempt_blocked($email)) throw new UserError('Too many wrong attempts. Wait 15 minutes and try again.');
        $u = row('SELECT * FROM users WHERE email = ?', [$email]);
        if (!$u || !$u['active'] || !password_verify($pw, $u['password_hash'])) {
            record_login_attempt($email, false);
            usleep(300000);
            throw new UserError('That email and password don\'t match.');
        }
        record_login_attempt($email, true);
        session_regenerate_id(true);
        $_SESSION['uid'] = (int)$u['id']; $_SESSION['sv'] = (int)$u['session_version']; $_SESSION['seen'] = time();
        if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) update('users', $u['id'], ['password_hash' => password_hash($pw, PASSWORD_DEFAULT)]);
        update('users', $u['id'], ['last_login' => now()]);
        audit('login', 'user', $u['id']);
        redirect('dashboard');
    }
    $h = '<div class="auth"><div class="logo big">' . e(mb_substr(setting('business_name', 'BS'), 0, 2)) . '</div><h1>' . e(setting('business_name')) . '</h1><p class="muted">Fleet manager · sign in</p>';
    $h .= form_open('login', 'class="card stack"') . field('Email', inp('email', old('email'), 'email', 'autocomplete="username" required autofocus'))
        . field('Password', inp('password', '', 'password', 'autocomplete="current-password" required'))
        . '<button class="btn primary" type="submit">Sign in</button></form><p class="muted small">Forgot your password? The owner can reset it in Settings → Team. If the owner forgets, see the setup guide.</p></div>';
    render_page('Sign in', $h);
}

function page_logout() {
    if (current_user()) audit('logout', 'user', current_user()['id']);
    $_SESSION = [];
    session_regenerate_id(true);
    redirect('login');
}

function page_account() {
    $u = current_user();
    if (is_post()) {
        if (post('action') === 'password') {
            if (!password_verify((string)$_POST['current'], $u['password_hash'])) throw new UserError('Your current password is wrong.');
            $new = (string)$_POST['new'];
            if ($e = validate_password($new)) throw new UserError($e);
            if ($new !== (string)$_POST['new2']) throw new UserError('The two new passwords are different.');
            update('users', $u['id'], ['password_hash' => password_hash($new, PASSWORD_DEFAULT), 'session_version' => (int)$u['session_version'] + 1, 'updated_at' => now()]);
            $_SESSION['sv'] = (int)$u['session_version'] + 1;
            audit('password_change', 'user', $u['id']);
            flash('success', 'Password changed. Other devices have been signed out.');
        }
        redirect('account');
    }
    $h = page_head('My account', e($u['email']) . ' · ' . ($u['role'] === 'owner' ? 'Owner' : 'Staff'));
    $h .= '<div class="card narrow">' . form_open('password', 'class="stack"') . '<h3>Change password</h3>'
        . field('Current password', inp('current', '', 'password', 'required autocomplete="current-password"'))
        . field('New password', inp('new', '', 'password', 'required autocomplete="new-password"'), 'At least 8 characters, with a letter and a number.')
        . field('Repeat new password', inp('new2', '', 'password', 'required autocomplete="new-password"'))
        . '<button class="btn primary">Change password</button></form></div>';
    render_page('My account', $h, 'account');
}
