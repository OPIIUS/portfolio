<?php
/* Core: configuration, database, sessions, security helpers, formatting. */
defined('APP') or exit;

date_default_timezone_set('Asia/Kolkata');
mb_internal_encoding('UTF-8');

define('ROOT', dirname(__DIR__));
define('STORAGE', ROOT . '/storage');
define('APP_VERSION', '1.0.0');

/* ---------------- configuration ---------------- */
function config($key = null, $default = null) {
    static $cfg = null;
    if (!$cfg) {
        $file = getenv('FLEET_CONFIG') ?: ROOT . '/config.php';
        $cfg = is_file($file) ? (require $file) : [];
    }
    if ($key === null) return $cfg;
    return $cfg[$key] ?? $default;
}
function installed() { return (bool)config('db'); }

/* ---------------- database ---------------- */
function db() {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config('db');
    if (!$c) throw new RuntimeException('Not installed');
    if ($c['driver'] === 'sqlite') {
        $pdo = new PDO('sqlite:' . $c['path']);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 5000');
    } else {
        $dsn = "mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4";
        if (!empty($c['port'])) $dsn .= ";port={$c['port']}";
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+05:30', sql_mode = 'STRICT_ALL_TABLES'"]);
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    return $pdo;
}
function driver() { return config('db')['driver'] ?? 'sqlite'; }
function q($sql, $p = []) { $s = db()->prepare($sql); $s->execute(array_values($p)); return $s; }
function rows($sql, $p = []) { return q($sql, $p)->fetchAll(); }
function row($sql, $p = []) { $r = q($sql, $p)->fetch(); return $r ?: null; }
function val($sql, $p = []) { $v = q($sql, $p)->fetchColumn(); return $v === false ? null : $v; }
function insert($table, array $data) {
    $cols = array_keys($data);
    q("INSERT INTO $table (" . implode(',', $cols) . ") VALUES (" . implode(',', array_fill(0, count($cols), '?')) . ")", array_values($data));
    return (int)db()->lastInsertId();
}
function update($table, $id, array $data) {
    if (!$data) return;
    $set = implode(',', array_map(fn($c) => "$c = ?", array_keys($data)));
    q("UPDATE $table SET $set WHERE id = ?", array_merge(array_values($data), [$id]));
}
/* Run $fn in a transaction. Nested calls join the outer transaction. */
function tx(callable $fn) {
    $pdo = db();
    if ($pdo->inTransaction()) return $fn();
    $pdo->beginTransaction();
    try { $r = $fn(); $pdo->commit(); return $r; }
    catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}

/* ---------------- settings ---------------- */
function setting($key, $default = null) {
    $cache = &$GLOBALS['__fleet_settings'];
    if ($cache === null) { $cache = []; foreach (rows('SELECT k, v FROM settings') as $r) $cache[$r['k']] = $r['v']; }
    if (func_num_args() === 0) return $cache;
    return array_key_exists($key, $cache) ? $cache[$key] : $default;
}
function setting_save($key, $value) {
    if (val('SELECT COUNT(*) FROM settings WHERE k = ?', [$key])) q('UPDATE settings SET v = ? WHERE k = ?', [(string)$value, $key]);
    else insert('settings', ['k' => $key, 'v' => (string)$value]);
    if (isset($GLOBALS['__fleet_settings'])) $GLOBALS['__fleet_settings'][$key] = (string)$value;
}
function reminder_days() {
    $d = array_unique(array_filter(array_map('intval', explode(',', setting('reminder_days', '30,15,7,1,0'))), fn($x) => $x >= 0 && $x <= 365));
    rsort($d);
    return $d ?: [30, 15, 7, 1, 0];
}

/* ---------------- time ---------------- */
/* Tests can move the clock with $GLOBALS['FLEET_TEST_NOW']; web requests cannot set globals. */
function now() { return $GLOBALS['FLEET_TEST_NOW'] ?? (defined('FAKE_NOW') ? FAKE_NOW : date('Y-m-d H:i:s')); }
function today() { return substr(now(), 0, 10); }
function ts($dt) { return $dt ? strtotime($dt) : null; }
function days_between($a, $b) { return (int)round((strtotime(substr($b, 0, 10)) - strtotime(substr($a, 0, 10))) / 86400); }
function fmt_d($d) { return $d ? date('d M Y', strtotime($d)) : '—'; }
function fmt_dt($d) { return $d ? date('d M Y, g:i A', strtotime($d)) : '—'; }
function dt_input($d) { return $d ? date('Y-m-d\TH:i', strtotime($d)) : ''; }
function parse_dt($s) {
    $s = trim((string)$s);
    if ($s === '') return null;
    $t = strtotime(str_replace('T', ' ', $s));
    return $t ? date('Y-m-d H:i:s', $t) : false;
}
function parse_date($s) {
    $s = trim((string)$s);
    if ($s === '') return null;
    $d = DateTime::createFromFormat('Y-m-d', $s);
    return ($d && $d->format('Y-m-d') === $s) ? $s : false;
}
function human_duration($seconds) {
    $s = abs((int)$seconds);
    $d = intdiv($s, 86400); $h = intdiv($s % 86400, 3600); $m = intdiv($s % 3600, 60);
    if ($d) return $d . 'd ' . $h . 'h';
    if ($h) return $h . 'h ' . $m . 'm';
    return max(1, $m) . 'm';
}

/* ---------------- money (stored as integer paise) ---------------- */
function money($paise, $sign = false) {
    $paise = (int)$paise;
    $neg = $paise < 0; $p = abs($paise);
    $r = intdiv($p, 100); $f = $p % 100;
    $s = (string)$r;
    if (strlen($s) > 3) { $last = substr($s, -3); $rest = substr($s, 0, -3); $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest); $s = $rest . ',' . $last; }
    $out = '₹' . $s . ($f ? '.' . str_pad((string)$f, 2, '0', STR_PAD_LEFT) : '');
    return ($neg ? '−' : ($sign && $paise > 0 ? '+' : '')) . $out;
}
function money_plain($paise) { return number_format(((int)$paise) / 100, 2, '.', ''); }
/* "1,500.50" -> 150050. Returns false when invalid. */
function parse_money($s, $allowZero = true) {
    $s = trim(str_replace([',', '₹', ' '], '', (string)$s));
    if ($s === '') return $allowZero ? 0 : false;
    if (!preg_match('/^\d{1,9}(\.\d{1,2})?$/', $s)) return false;
    [$r, $f] = array_pad(explode('.', $s), 2, '0');
    $p = (int)$r * 100 + (int)str_pad(substr($f, 0, 2), 2, '0');
    if (!$allowZero && $p === 0) return false;
    return $p;
}

/* ---------------- output & requests ---------------- */
function e($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function post($k, $d = '') { return isset($_POST[$k]) ? (is_string($_POST[$k]) ? trim($_POST[$k]) : $_POST[$k]) : $d; }
function get($k, $d = '') { return isset($_GET[$k]) && is_string($_GET[$k]) ? trim($_GET[$k]) : $d; }
function url($page, $params = []) { return 'index.php?' . http_build_query(['p' => $page] + $params); }
function redirect($page, $params = []) { header('Location: ' . url($page, $params)); exit; }
function back_to($fallback) { redirect($fallback['p'], array_diff_key($fallback, ['p' => 1])); }
function flash($type, $msg) { $_SESSION['flash'][] = [$type, $msg]; }
function take_flashes() { $f = $_SESSION['flash'] ?? []; unset($_SESSION['flash']); return $f; }
function is_post() { return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST'; }

/* ---------------- sessions & CSRF ---------------- */
function start_session() {
    if (session_status() === PHP_SESSION_ACTIVE || PHP_SAPI === 'cli') return;
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('bsfleet');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
    ini_set('session.use_strict_mode', '1');
    $dir = STORAGE . '/sessions';
    if (is_dir($dir) && is_writable($dir)) session_save_path($dir);
    session_start();
}
function csrf_token() { if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32)); return $_SESSION['csrf']; }
function csrf_field() { return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">'; }
function csrf_check() {
    if (PHP_SAPI === 'cli') return;
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['_csrf'] ?? ''))) { http_response_code(400); exit('Your session expired. Go back, refresh the page and try again.'); }
}
function client_ip() { return substr($_SERVER['REMOTE_ADDR'] ?? 'cli', 0, 45); }

/* ---------------- audit log ---------------- */
function audit($action, $entity, $id = null, $details = null) {
    insert('audit_log', [
        'user_id' => current_user()['id'] ?? null,
        'action' => $action, 'entity' => $entity, 'entity_id' => $id,
        'details' => $details === null ? null : (is_string($details) ? $details : json_encode($details, JSON_UNESCAPED_UNICODE)),
        'ip' => client_ip(), 'created_at' => now(),
    ]);
}

/* ---------------- users, roles, permissions ---------------- */
const PERMS = [
    'fleet' => 'See vehicles',
    'fleet_edit' => 'Add and edit vehicles',
    'customers' => 'See and add customers',
    'customer_sensitive' => 'See licence and ID numbers, and ID documents',
    'bookings' => 'Create bookings, hand over and receive vehicles',
    'payments' => 'See amounts, record payments, see balances',
    'documents' => 'Manage vehicle documents',
    'maintenance' => 'Record servicing and repairs',
    'expenses' => 'Record and see expenses',
    'reports' => 'See revenue, profit and business reports',
];
const STAFF_DEFAULT = ['fleet', 'customers', 'bookings', 'documents', 'maintenance'];

function current_user() {
    static $cache = [];
    $uid = (int)($_SESSION['uid'] ?? 0);
    if (!$uid) return null;
    $key = $uid . ':' . ($_SESSION['sv'] ?? '') . ':' . ($_SESSION['_reload'] ?? 0);
    if (!array_key_exists($key, $cache)) {
        $u = row('SELECT * FROM users WHERE id = ? AND active = 1', [$uid]);
        if ($u && (int)$u['session_version'] !== (int)($_SESSION['sv'] ?? -1)) $u = null;
        $cache[$key] = $u;
    }
    return $cache[$key];
}
function is_owner() { $u = current_user(); return $u && $u['role'] === 'owner'; }
function can($perm) {
    $u = current_user();
    if (!$u) return false;
    if ($u['role'] === 'owner') return true;
    if (in_array($perm, ['settings', 'users', 'void', 'backup', 'audit'], true)) return false;
    $p = json_decode($u['perms'] ?: '[]', true) ?: [];
    return in_array($perm, $p, true);
}
function require_perm($perm) {
    if (!can($perm)) {
        http_response_code(403);
        render_page('No access', '<div class="card empty"><h2>You don\'t have access to this</h2><p class="muted">Ask the owner to give you access to this section.</p><p><a class="btn" href="' . url('dashboard') . '">Back to dashboard</a></p></div>');
        exit;
    }
}
function login_attempt_blocked($email) {
    $since = date('Y-m-d H:i:s', strtotime(now()) - 900);
    return (int)val('SELECT COUNT(*) FROM login_attempts WHERE (email = ? OR ip = ?) AND success = 0 AND created_at > ?', [strtolower($email), client_ip(), $since]) >= 8;
}
function record_login_attempt($email, $ok) {
    insert('login_attempts', ['email' => strtolower($email), 'ip' => client_ip(), 'success' => $ok ? 1 : 0, 'created_at' => now()]);
}
function validate_password($pw) {
    if (strlen($pw) < 8) return 'Password must be at least 8 characters.';
    if (!preg_match('/[A-Za-z]/', $pw) || !preg_match('/\d/', $pw)) return 'Use at least one letter and one number in the password.';
    return null;
}
