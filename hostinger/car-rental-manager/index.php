<?php
/* Car Rental Manager. Every page goes through here. */
define('APP', true);
require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/schema.php';
require __DIR__ . '/lib/domain.php';
require __DIR__ . '/lib/view.php';

if (!installed()) { header('Location: install.php'); exit; }

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; form-action 'self'");
header('Cache-Control: no-store');

const ROUTES = [
    'login' => 'auth', 'logout' => 'auth', 'account' => 'auth',
    'dashboard' => 'dashboard', 'alerts' => 'dashboard',
    'fleet' => 'fleet', 'vehicle' => 'fleet', 'vehicle_new' => 'fleet',
    'customers' => 'customers', 'customer' => 'customers', 'customer_new' => 'customers',
    'rentals' => 'bookings', 'booking' => 'bookings', 'booking_new' => 'bookings',
    'money_due' => 'payments', 'payments' => 'payments', 'receipt' => 'payments',
    'upkeep' => 'maintenance', 'expenses' => 'expenses',
    'reports' => 'reports', 'export' => 'reports',
    'settings' => 'settings', 'file' => 'file',
];
/* Old addresses still work. */
const ROUTE_ALIASES = ['bookings' => 'rentals', 'outstanding' => 'money_due', 'documents' => 'upkeep', 'maintenance' => 'upkeep'];

start_session();
$page = get('p', 'dashboard');
if (isset(ROUTE_ALIASES[$page])) redirect(ROUTE_ALIASES[$page], array_diff_key($_GET, ['p' => 1]));
if (!isset(ROUTES[$page])) $page = 'dashboard';
if ((int)setting('schema_version', 1) < SCHEMA_VERSION) schema_upgrade();

if (current_user()) {
    $limit = max(10, (int)setting('session_minutes', 120)) * 60;
    if (!empty($_SESSION['seen']) && time() - $_SESSION['seen'] > $limit) {
        session_unset(); session_regenerate_id(true);
        flash('info', 'You were signed out after a period of inactivity.');
        redirect('login');
    }
    $_SESSION['seen'] = time();
} elseif ($page !== 'login') {
    redirect('login');
}

function old($k, $default = '') { return $_SESSION['old'][$k] ?? $default; }

try {
    if (is_post()) { csrf_check(); $_SESSION['checks_due'] = 1; }
    if (current_user()) maybe_run_checks();
    require __DIR__ . '/pages/' . ROUTES[$page] . '.php';
    $fn = 'page_' . $page;
    $fn();
    unset($_SESSION['old']);
} catch (UserError $e) {
    flash('error', $e->getMessage());
    if (is_post()) { $_SESSION['old'] = $_POST; header('Location: ' . ($_SERVER['REQUEST_URI'] ?? url($page))); exit; }
    render_page('Problem', '');
} catch (Throwable $e) {
    error_log('[fleet] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    render_page('Something went wrong', '<div class="card empty"><h2>Something went wrong</h2><p class="muted">Nothing was saved from this action. Please try again. If it keeps happening, tell your website developer and mention the time: ' . e(now()) . '.</p><p><a class="btn" href="' . url('dashboard') . '">Back to dashboard</a></p></div>');
}
