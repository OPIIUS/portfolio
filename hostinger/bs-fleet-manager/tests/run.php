<?php
/* Automated checks of the business rules. Run:  php tests/run.php            (SQLite, temporary database)
   or against an empty MySQL database:          FLEET_TEST_MYSQL="host;dbname;user;pass" php tests/run.php
   Never point this at the live database: it creates and deletes its own tables. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('APP', true);
$tmp = sys_get_temp_dir() . '/fleet-test-' . getmypid();
@mkdir($tmp);
if ($m = getenv('FLEET_TEST_MYSQL')) { [$h, $n, $u, $p] = explode(';', $m); $db = ['driver' => 'mysql', 'host' => $h, 'name' => $n, 'user' => $u, 'pass' => $p]; }
else $db = ['driver' => 'sqlite', 'path' => "$tmp/test.sqlite"];
file_put_contents("$tmp/config.php", '<?php return ' . var_export(['db' => $db], true) . ';');
putenv("FLEET_CONFIG=$tmp/config.php");
require __DIR__ . '/../lib/core.php';
require __DIR__ . '/../lib/schema.php';
require __DIR__ . '/../lib/domain.php';
require __DIR__ . '/../lib/view.php';
if ($db['driver'] === 'mysql') foreach (array_keys(schema_tables()) as $t) db()->exec("DROP TABLE IF EXISTS $t");

$pass = 0; $fail = 0; $section = '';
function ok($cond, $what) { global $pass, $fail, $section; if ($cond) { $pass++; echo "  ✓ $what\n"; } else { $fail++; echo "  ✗ FAILED: $what\n"; } }
function throws(callable $fn, $needle, $what) { try { $fn(); ok(false, "$what (no error raised)"); } catch (UserError $e) { ok(stripos($e->getMessage(), $needle) !== false, "$what → \"" . $e->getMessage() . '"'); } }
function section($s) { global $section; $section = $s; echo "\n$s\n"; }
function at($dt) { $GLOBALS['FLEET_TEST_NOW'] = $dt; }
function open_alerts($type) { return rows("SELECT * FROM notifications WHERE type = ? AND resolved_at IS NULL", [$type]); }
function rs($rupees) { return (int)round($rupees * 100); }

at('2026-11-01 10:00:00');
$_SESSION = [];
schema_install();
$owner = insert('users', ['name' => 'Owner', 'email' => 'o@x.in', 'password_hash' => password_hash('Owner123', PASSWORD_DEFAULT), 'role' => 'owner', 'perms' => '[]', 'active' => 1, 'session_version' => 1, 'created_at' => now()]);
$staff = insert('users', ['name' => 'Staff', 'email' => 's@x.in', 'password_hash' => password_hash('Staff123', PASSWORD_DEFAULT), 'role' => 'staff', 'perms' => json_encode(STAFF_DEFAULT), 'active' => 1, 'session_version' => 1, 'created_at' => now()]);
function login_as($id) { $_SESSION['uid'] = $id; $_SESSION['sv'] = 1; $_SESSION['_reload'] = microtime(true); }
login_as($owner);
echo "Database: {$db['driver']}\n";

section('1. Vehicles and status');
$v1 = insert('vehicles', ['reg_no' => 'AS01AB1234', 'name' => 'Hyundai Creta', 'category' => 'SUV', 'odometer' => 20000, 'daily_rate' => rs(3000), 'monthly_rate' => rs(60000), 'km_limit_per_day' => 250, 'last_service_km' => 15000, 'last_service_date' => '2026-08-01', 'created_at' => now()]);
$v2 = insert('vehicles', ['reg_no' => 'AS01CD5678', 'name' => 'Maruti Swift', 'category' => 'Hatchback', 'odometer' => 50000, 'daily_rate' => rs(1800), 'created_at' => now()]);
$c1 = insert('customers', ['name' => 'Rahul Das', 'phone' => '9876543210', 'created_at' => now()]);
$c2 = insert('customers', ['name' => 'Priya Sharma', 'phone' => '9123456780', 'created_at' => now()]);
ok(fleet_status_map()[$v1]['status'] === 'available', 'new vehicle is Available');
update('vehicles', $v2, ['status_override' => 'maintenance']);
ok(fleet_status_map()[$v2]['status'] === 'maintenance', 'vehicle marked Under maintenance');
update('vehicles', $v2, ['status_override' => null]);

section('2. Booking, rent suggestion, double booking');
ok(suggested_amount(row('SELECT * FROM vehicles WHERE id = ?', [$v1]), '2026-11-02 10:00:00', '2026-11-05 10:00:00') === rs(9000), '3 days × ₹3,000 = ₹9,000');
ok(suggested_amount(row('SELECT * FROM vehicles WHERE id = ?', [$v1]), '2026-11-02 10:00:00', '2026-11-05 11:00:00') === rs(12000), '3 days + 1 hour counts as 4 days');
ok(suggested_amount(row('SELECT * FROM vehicles WHERE id = ?', [$v1]), '2026-11-01 10:00:00', '2026-12-01 10:00:00', 'monthly') === rs(60000), 'monthly rate for 30 days');
$mk = function ($c, $v, $s, $e, $amt, $status = 'confirmed', $extra = []) { return insert('bookings', $extra + ['code' => next_code('bookings', 'code', 'BS'), 'customer_id' => $c, 'vehicle_id' => $v, 'status' => $status, 'start_at' => $s, 'end_at' => $e, 'rate_type' => 'daily', 'agreed_amount' => $amt, 'discount' => 0, 'deposit_amount' => rs(5000), 'due_date' => substr($e, 0, 10), 'created_at' => now()]); };
$b1 = $mk($c1, $v1, '2026-11-02 10:00:00', '2026-11-05 10:00:00', rs(9000));
ok(booking_get($b1)['code'] === 'BS26-0001', 'booking numbered BS26-0001');
ok(count(booking_conflicts($v1, '2026-11-04 10:00:00', '2026-11-06 10:00:00')) === 1, 'overlapping booking on same vehicle is detected');
ok(count(booking_conflicts($v1, '2026-11-05 10:00:00', '2026-11-07 10:00:00')) === 0, 'back-to-back booking (starts when the other ends) is allowed');
ok(count(booking_conflicts($v2, '2026-11-04 10:00:00', '2026-11-06 10:00:00')) === 0, 'other vehicle is free');
$inq = $mk($c2, $v1, '2026-11-03 10:00:00', '2026-11-04 10:00:00', rs(3000), 'inquiry');
ok(count(booking_conflicts($v1, '2026-11-03 10:00:00', '2026-11-04 10:00:00', $inq)) === 1, 'an inquiry cannot be confirmed onto a booked vehicle');
ok(fleet_status_map()[$v1]['status'] === 'booked', 'vehicle shows Booked within 24h of pickup');

section('3. Payments: partial, overpay blocked, history never lost');
$b = booking_get($b1);
record_payment($b, 'deposit', rs(5000), 'Cash', '', now(), '');
record_payment(booking_get($b1), 'rental', rs(3000), 'UPI', 'UPI123', now(), 'advance');
$b = booking_get($b1);
ok($b['paid'] === rs(3000) && $b['balance'] === rs(6000), 'advance ₹3,000 → balance ₹6,000');
ok($b['pay_status'] === 'partial', 'status Partially paid');
ok($b['deposit_held'] === rs(5000), 'deposit ₹5,000 held separately');
throws(fn() => record_payment(booking_get($b1), 'rental', rs(7000), 'UPI', '', now(), ''), 'more than the balance', 'paying more than the balance is blocked');
throws(fn() => record_payment(booking_get($b1), 'rental', 0, 'UPI', '', now(), ''), 'greater than zero', 'zero payment is blocked');
$p2 = record_payment(booking_get($b1), 'rental', rs(2000), 'Cash', '', now(), '');
update('payments', $p2, ['voided' => 1, 'void_reason' => 'typo', 'voided_by' => $owner, 'voided_at' => now()]);
ok(booking_get($b1)['paid'] === rs(3000), 'voided payment no longer counts');
ok((int)val('SELECT COUNT(*) FROM payments WHERE booking_id = ?', [$b1]) === 3, 'voided payment is still stored (3 rows)');
$rc = array_column(rows('SELECT receipt_no FROM payments ORDER BY id'), 'receipt_no');
ok(count($rc) === count(array_unique($rc)), 'every payment has a unique receipt number');

section('4. Deposits are never revenue');
$rep = (function () { require_once __DIR__ . '/../pages/reports.php'; return report_data('2026-11-01', '2026-11-30'); })();
ok($rep['cash'] === rs(3000), 'rent collected = ₹3,000 (deposit excluded)');
ok($rep['dep_in'] === rs(5000), 'deposit ₹5,000 reported separately');
ok($rep['deposits_held'] === rs(5000), 'deposits held today = ₹5,000');

section('5. Handover, overdue return, extension');
at('2026-11-02 10:30:00');
update('bookings', $b1, ['status' => 'active', 'actual_start' => now()]);
ok(fleet_status_map()[$v1]['status'] === 'rented', 'vehicle shows Rented after handover');
at('2026-11-05 09:00:00'); run_checks();
ok(count(open_alerts('return_soon')) === 1, 'return-soon alert 1 hour before');
at('2026-11-05 14:00:00'); run_checks(); run_checks();
ok(count(open_alerts('return_overdue')) === 1, 'overdue-return alert raised once (no duplicates after two checks)');
ok(fleet_status_map()[$v1]['status'] === 'overdue', 'vehicle shows Overdue');
ok(booking_get($b1)['view_status'] === 'overdue', 'booking shows Return overdue');
ok(count(open_alerts('return_soon')) === 0, 'return-soon alert closed automatically');
// overdue rental blocks the next booking that starts now
$b2 = $mk($c2, $v1, '2026-11-05 18:00:00', '2026-11-06 18:00:00', rs(3000));
ok(count(booking_conflicts($v1, '2026-11-05 18:00:00', '2026-11-06 18:00:00', $b2)) === 0, 'next booking (after original return time) does not clash on paper…');
at('2026-11-05 19:00:00');
ok(count(booking_conflicts($v1, '2026-11-05 18:00:00', '2026-11-06 18:00:00', $b2)) === 1, '…but clashes once the first car is late past its start');
run_checks();
ok(count(open_alerts('booking_risk')) === 1, 'booking-at-risk alert for the next customer');
update('bookings', $b2, ['status' => 'cancelled', 'cancel_reason' => 'test']);
// extension: owner adds an agreed charge, nothing automatic
$before = booking_get($b1)['total'];
insert('booking_charges', ['booking_id' => $b1, 'kind' => 'extension', 'label' => 'Extension', 'amount' => rs(3000), 'created_at' => now()]);
update('bookings', $b1, ['end_at' => '2026-11-06 10:00:00', 'due_date' => '2026-11-06']);
ok(booking_get($b1)['total'] === $before + rs(3000), 'extension adds exactly the charge the owner approved');
run_checks();
ok(count(open_alerts('return_overdue')) === 0, 'overdue alert clears after extending');
ok(booking_get($b1)['view_status'] === 'active', 'booking is Active again');
ok((int)val("SELECT COUNT(*) FROM booking_charges WHERE booking_id = ? AND kind IN ('late','extra_km')", [$b1]) === 0, 'no late fee was added automatically');

section('6. Return, balance, payment overdue');
at('2026-11-06 09:00:00');
update('bookings', $b1, ['status' => 'completed', 'actual_end' => now()]);
$b = booking_get($b1);
ok($b['balance'] === rs(9000), 'after return: total ₹12,000 − paid ₹3,000 = ₹9,000 owed');
ok(fleet_status_map()[$v1]['status'] === 'available', 'vehicle Available again');
at('2026-11-09 10:00:00'); run_checks();
$b = booking_get($b1);
ok($b['pay_status'] === 'overdue' && $b['overdue_days'] === 3, 'payment overdue by 3 days');
ok(count(open_alerts('pay_overdue')) === 1, 'payment-overdue alert raised');
record_payment($b, 'rental', rs(4000), 'Deposit adjustment', '', now(), '');
$b = booking_get($b1);
ok($b['paid'] === rs(7000) && $b['deposit_held'] === rs(1000), 'deposit adjustment: ₹4,000 moved from deposit to rent');
record_payment($b, 'rental', rs(5000), 'UPI', '', now(), '');
record_payment(booking_get($b1), 'deposit_out', rs(1000), 'Cash', '', now(), '');
$b = booking_get($b1); run_checks();
ok($b['balance'] === 0 && $b['pay_status'] === 'paid' && $b['deposit_held'] === 0, 'fully paid, deposit returned');
ok(count(open_alerts('pay_overdue')) === 0, 'payment alert resolved automatically when paid');
throws(fn() => record_payment(booking_get($b1), 'deposit_out', rs(1), 'Cash', '', now(), ''), 'deposit is held', 'cannot return more deposit than held');

section('7. Cancellation and refunds');
$b3 = $mk($c2, $v2, '2026-11-20 10:00:00', '2026-11-21 10:00:00', rs(1800));
record_payment(booking_get($b3), 'rental', rs(1800), 'UPI', '', now(), '');
update('bookings', $b3, ['status' => 'cancelled', 'cancel_reason' => 'plans changed']);
$b = booking_get($b3);
ok($b['total'] === 0 && $b['balance'] === -rs(1800) && $b['pay_status'] === 'refund', 'cancelled booking shows ₹1,800 refund due');
insert('booking_charges', ['booking_id' => $b3, 'kind' => 'other', 'label' => 'Cancellation fee', 'amount' => rs(500), 'created_at' => now()]);
record_payment(booking_get($b3), 'refund', rs(1300), 'UPI', '', now(), '');
ok(booking_get($b3)['balance'] === 0, 'fee ₹500 kept, ₹1,300 refunded → settled');

section('8. Documents and reminders (30/15/7/1/0)');
$types = array_column(doc_types(), 'id', 'name');
$addDoc = fn($v, $t, $exp) => insert('vehicle_documents', ['vehicle_id' => $v, 'doc_type_id' => $types[$t], 'expiry_date' => $exp, 'created_at' => now()]);
at('2026-11-01 08:00:00');
$ins = $addDoc($v1, 'Insurance', '2026-12-01'); $addDoc($v1, 'PUC certificate', '2027-05-01'); $addDoc($v1, 'Registration certificate (RC)', '2040-01-01');
$comp = vehicle_compliance(row('SELECT * FROM vehicles WHERE id = ?', [$v1]));
ok($comp['overall'] === 'warning', 'insurance 30 days away → "Renewal due soon"');
ok(vehicle_compliance(row('SELECT * FROM vehicles WHERE id = ?', [$v2]))['overall'] === 'blocked', 'vehicle with no papers → "Not road-legal"');
ok(count(array_filter(vehicle_compliance(row('SELECT * FROM vehicles WHERE id = ?', [$v2]))['items'], fn($i) => $i['type']['name'] === 'Permit')) === 0, 'permit not required unless the owner enables it');
q("UPDATE doc_types SET required_for = 'Hatchback' WHERE name = 'Permit'");
ok(count(array_filter(vehicle_compliance(row('SELECT * FROM vehicles WHERE id = ?', [$v2]))['items'], fn($i) => $i['type']['name'] === 'Permit' && $i['required'])) === 1, 'after owner enables permit for Hatchback, it is required for the Swift only');
ok(count(array_filter(vehicle_compliance(row('SELECT * FROM vehicles WHERE id = ?', [$v1]))['items'], fn($i) => $i['type']['name'] === 'Permit')) === 0, '…and not for the SUV');
$seen = [];
foreach (['2026-10-31' => 31, '2026-11-01' => 30, '2026-11-10' => 21, '2026-11-16' => 15, '2026-11-24' => 7, '2026-11-30' => 1, '2026-12-01' => 0] as $day => $left) {
    at("$day 09:00:00"); run_checks(); run_checks();
    $a = rows("SELECT dedupe_key FROM notifications WHERE type = 'doc_expiring' AND dedupe_key LIKE ?", ["doc_expiring:$ins:%"]);
    $seen[$day] = count($a);
}
ok($seen['2026-10-31'] === 0, '31 days before: no reminder yet');
ok($seen['2026-11-01'] === 1 && $seen['2026-11-10'] === 1, '30 days before: first reminder; nothing new at 21 days');
ok($seen['2026-11-16'] === 2 && $seen['2026-11-24'] === 3 && $seen['2026-11-30'] === 4 && $seen['2026-12-01'] === 5, 'reminders at 15, 7, 1 and 0 days (5 in total, each once)');
ok(count(rows("SELECT * FROM notifications WHERE type = 'doc_expiring' AND dedupe_key LIKE ? AND resolved_at IS NULL", ["doc_expiring:$ins:%"])) === 1, 'only the latest reminder stays open');
at('2026-12-02 09:00:00'); run_checks();
ok(count(open_alerts('doc_expired')) === 1, 'day after expiry: "expired" alert');
ok(vehicle_compliance(row('SELECT * FROM vehicles WHERE id = ?', [$v1]))['overall'] === 'blocked', 'expired insurance → vehicle Not road-legal (handover blocked)');
update('vehicle_documents', $ins, ['replaced' => 1]); $addDoc($v1, 'Insurance', '2027-12-01'); run_checks();
ok(count(open_alerts('doc_expired')) === 0, 'renewing clears the alert');
ok((int)val('SELECT COUNT(*) FROM vehicle_documents WHERE vehicle_id = ? AND doc_type_id = ?', [$v1, $types['Insurance']]) === 2, 'old insurance kept in history');
setting_save('reminder_days', '45,10'); 
ok(reminder_days() === [45, 10], 'reminder days are configurable');
setting_save('reminder_days', '30,15,7,1,0');

section('9. Servicing (km and time)');
at('2026-12-02 09:00:00');
$v = row('SELECT * FROM vehicles WHERE id = ?', [$v1]);
update('vehicles', $v1, ['odometer' => 24600]); $s = service_info(row('SELECT * FROM vehicles WHERE id = ?', [$v1]));
ok($s['nextKm'] === 25000 && $s['state'] === 'due', 'service every 10,000 km: due at 25,000, warned at 24,600');
update('vehicles', $v1, ['odometer' => 25100]); run_checks();
ok(service_info(row('SELECT * FROM vehicles WHERE id = ?', [$v1]))['state'] === 'overdue' && count(open_alerts('service_overdue')) === 1, 'past 25,000 km → service overdue alert');
update('vehicles', $v1, ['odometer' => 18000, 'last_service_date' => '2026-05-01']);
ok(service_info(row('SELECT * FROM vehicles WHERE id = ?', [$v1]))['state'] === 'overdue', 'time-based: 180 days passed → overdue even with low km');
update('vehicles', $v1, ['odometer' => 25100, 'last_service_km' => 25100, 'last_service_date' => today()]); run_checks();
$s = service_info(row('SELECT * FROM vehicles WHERE id = ?', [$v1]));
ok($s['nextKm'] === 35100 && $s['nextDate'] === '2027-05-31' && $s['state'] === 'ok', 'after service: next at 35,100 km or 31 May 2027');
ok(count(open_alerts('service_overdue')) === 0, 'service alert cleared');

section('10. Expenses and profit');
insert('expenses', ['expense_date' => '2026-11-10', 'vehicle_id' => $v1, 'category' => 'servicing', 'amount' => rs(4500), 'description' => 'Service', 'source' => 'maintenance', 'created_at' => now()]);
insert('expenses', ['expense_date' => '2026-11-12', 'vehicle_id' => null, 'category' => 'parking', 'amount' => rs(500), 'description' => 'Office parking', 'source' => 'manual', 'created_at' => now()]);
$vx = insert('expenses', ['expense_date' => '2026-11-12', 'vehicle_id' => $v2, 'category' => 'fuel', 'amount' => rs(999), 'description' => 'wrong', 'source' => 'manual', 'voided' => 1, 'created_at' => now()]);
$rep = report_data('2026-11-01', '2026-11-30');
ok($rep['expenses'] === rs(5000), 'expenses ₹5,000 (voided expense excluded)');
ok($rep['cash'] === rs(3000 + 4000 + 5000 + 1800 - 1300), 'rent collected in November = ₹12,500 (₹12,000 rental + ₹500 kept from the cancelled booking)');
ok($rep['profit'] === $rep['cash'] - $rep['expenses'], 'profit = collected − expenses');
ok($rep['billed'] === rs(12000), 'rent billed = ₹12,000 for the completed rental');
$vr = vehicle_report('2026-11-01', '2026-11-30');
ok($vr[$v1]['maint'] === rs(4500) && $vr[$v1]['rentals'] === 1, 'vehicle report: Creta maintenance ₹4,500, 1 rental');
ok(abs($vr[$v1]['secs'] - 340200) < 2, 'vehicle report: Creta out 3 days 22.5 hours (2 Nov 10:30 → 6 Nov 09:00)');

section('11. Permissions');
login_as($staff);
ok(!can('payments') && !can('reports') && !can('expenses') && !can('void') && !can('settings'), 'staff cannot see money, reports, expenses, void or settings by default');
ok(can('bookings') && can('fleet') && can('documents'), 'staff can do bookings, fleet and documents');
update('users', $staff, ['perms' => json_encode(['payments'])]); $_SESSION['_reload'] = microtime(true);
ok(can('payments') && !can('void'), 'owner can grant payments, but voiding stays owner-only');
login_as($owner);
ok(can('void') && can('settings'), 'owner can do everything');
update('users', $staff, ['session_version' => 2]); login_as($staff);
ok(current_user() === null, 'bumping session version signs a user out everywhere');
login_as($owner);

section('12. Security basics');
$hash = val('SELECT password_hash FROM users WHERE id = ?', [$owner]);
ok(str_starts_with($hash, '$2y$') || str_starts_with($hash, '$argon'), 'passwords stored as bcrypt/argon hashes, never plain text');
ok(validate_password('short') !== null && validate_password('abcdefgh') !== null && validate_password('abcdefg1') === null, 'password rules: 8+ chars, letter and number');
for ($i = 0; $i < 8; $i++) record_login_attempt('attacker@x.in', false);
ok(login_attempt_blocked('attacker@x.in'), 'login blocked after 8 wrong attempts in 15 minutes');
at('2026-12-02 09:20:00');
at('2026-12-02 09:40:00');
ok(!login_attempt_blocked('attacker@x.in'), 'lockout lifts after 15 minutes');
ok(e('<script>') === '&lt;script&gt;', 'output is HTML-escaped');
ok(parse_money('1,500.50') === 150050 && parse_money('abc') === false && parse_money('-5') === false, 'money input validated (no negatives or text)');
ok(money(12345678) === '₹1,23,456.78', 'Indian number format ₹1,23,456.78');
require_once __DIR__ . '/../pages/reports.php';
ok(csv_safe('=HYPERLINK("x")') === "'=HYPERLINK(\"x\")", 'spreadsheet formula injection neutralised in exports');

section('13. Audit log, backup and restore');
audit('test', 'system', null, 'hello');
ok((int)val("SELECT COUNT(*) FROM audit_log WHERE action = 'test'") === 1, 'actions are written to the audit log');
$before = ['bookings' => (int)val('SELECT COUNT(*) FROM bookings'), 'payments' => (int)val('SELECT COUNT(*) FROM payments'), 'sum' => (int)val('SELECT SUM(amount) FROM payments')];
$json = json_encode(backup_data());
q('DELETE FROM payments'); ok((int)val('SELECT COUNT(*) FROM payments') === 0, '(simulated disaster: payments wiped)');
backup_restore($json);
ok((int)val('SELECT COUNT(*) FROM payments') === $before['payments'] && (int)val('SELECT SUM(amount) FROM payments') === $before['sum'] && (int)val('SELECT COUNT(*) FROM bookings') === $before['bookings'], 'restore brings back every booking and payment exactly');
ok(setting('business_name') === 'BS Car Rentals', 'settings readable after restore');
throws(fn() => backup_restore('{"hello":1}'), 'not a fleet manager backup', 'restoring a wrong file is refused');
$f = backup_write(); ok(is_file($f) && filesize($f) > 100, 'compressed backup file written: ' . basename($f)); @unlink($f);

section('14. Dashboard numbers come only from data');
$GLOBALS['__fleet_settings'] = null;
ok(array_sum(array_map(fn($b) => max(0, $b['balance']), bookings_where("b.status <> 'inquiry'"))) === 0, 'outstanding = ₹0 when everything is paid');

echo "\n" . ($fail ? "FAILED: $fail" : 'ALL PASSED') . " · $pass passed, $fail failed\n";
if ($db['driver'] === 'mysql') foreach (array_keys(schema_tables()) as $t) db()->exec("DROP TABLE IF EXISTS $t");
@unlink("$tmp/test.sqlite"); @unlink("$tmp/test.sqlite-wal"); @unlink("$tmp/test.sqlite-shm"); @unlink("$tmp/config.php"); @rmdir($tmp);
exit($fail ? 1 : 0);
