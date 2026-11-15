<?php
/* One-time setup: connects the database, creates the tables and the owner account. Locks itself afterwards. */
define('APP', true);
require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/schema.php';

header('X-Frame-Options: DENY');
header('Cache-Control: no-store');
if (installed()) { http_response_code(403); exit('Already set up. To start again, delete config.php first.'); }

$errors = []; $done = false;
$f = fn($k, $d = '') => isset($_POST[$k]) ? trim((string)$_POST[$k]) : $d;

$checks = [
    'PHP 8.1 or newer' => version_compare(PHP_VERSION, '8.1', '>='),
    'PDO database support' => extension_loaded('pdo'),
    'MySQL driver' => extension_loaded('pdo_mysql'),
    'SQLite driver' => extension_loaded('pdo_sqlite'),
    'File type checking (fileinfo)' => extension_loaded('fileinfo'),
    'Folder can be written (for settings)' => is_writable(__DIR__),
    'Storage folder can be written' => is_dir(__DIR__ . '/storage') ? is_writable(__DIR__ . '/storage') : is_writable(__DIR__),
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $driver = $f('driver') === 'sqlite' ? 'sqlite' : 'mysql';
    $name = $f('owner_name'); $email = strtolower($f('owner_email')); $pw = (string)($_POST['owner_password'] ?? '');
    if ($name === '') $errors[] = 'Enter the owner\'s name.';
    if ($f('business_name') === '') $errors[] = 'Enter the business name.';
    if ($f('opening_date') !== '' && !DateTime::createFromFormat('Y-m-d', $f('opening_date'))) $errors[] = 'Check the opening date.';
    if ($f('vehicle_count') !== '' && (!ctype_digit($f('vehicle_count')) || (int)$f('vehicle_count') > 5000)) $errors[] = 'Number of vehicles must be a whole number.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Enter a valid email address for signing in.';
    if ($e = validate_password($pw)) $errors[] = $e;
    if ($pw !== (string)($_POST['owner_password2'] ?? '')) $errors[] = 'The two passwords are different.';
    if ($driver === 'mysql') {
        $db = ['driver' => 'mysql', 'host' => $f('db_host', 'localhost'), 'port' => $f('db_port'), 'name' => $f('db_name'), 'user' => $f('db_user'), 'pass' => (string)($_POST['db_pass'] ?? '')];
        if ($db['name'] === '' || $db['user'] === '') $errors[] = 'Enter the MySQL database name and username from Hostinger.';
    } else {
        foreach (['storage', 'storage/data'] as $d) if (!is_dir(__DIR__ . "/$d")) @mkdir(__DIR__ . "/$d", 0750, true);
        $db = ['driver' => 'sqlite', 'path' => __DIR__ . '/storage/data/fleet-' . bin2hex(random_bytes(6)) . '.sqlite'];
    }
    if (!$errors) {
        try {
            foreach (['storage', 'storage/uploads', 'storage/backups', 'storage/sessions'] as $d) if (!is_dir(__DIR__ . "/$d")) mkdir(__DIR__ . "/$d", 0750, true);
            if (!is_file(__DIR__ . '/storage/.htaccess')) file_put_contents(__DIR__ . '/storage/.htaccess', "Require all denied\n");
            $cfgText = "<?php\n// Created by the installer on " . date('Y-m-d H:i') . ". Keep this file private.\nreturn " . var_export(['db' => $db, 'key' => bin2hex(random_bytes(32))], true) . ";\n";
            $tmp = __DIR__ . '/config.php';
            if (file_put_contents($tmp, $cfgText) === false) throw new RuntimeException('Could not write config.php. Make the folder writable and try again.');
            putenv('FLEET_CONFIG=' . $tmp);
            try {
                db();
                if (val(driver() === 'sqlite' ? "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'" : "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"))
                    throw new RuntimeException('This database already has fleet manager tables. Use a new, empty database.');
                schema_install();
                if ($f('business_name') !== '') q('UPDATE settings SET v = ? WHERE k = ?', [$f('business_name'), 'business_name']);
                $set = ['business_phone' => mb_substr($f('business_phone'), 0, 30), 'business_address' => mb_substr($f('business_address'), 0, 500), 'owner_name' => mb_substr($name, 0, 100),
                    'currency' => isset(CURRENCIES[$f('currency')]) ? $f('currency') : 'INR', 'opening_date' => $f('opening_date'), 'vehicle_count' => $f('vehicle_count'),
                    'default_rate_type' => in_array($f('default_rate_type'), ['daily', 'monthly', 'fixed'], true) ? $f('default_rate_type') : 'daily'];
                foreach ($set as $k => $v) q('UPDATE settings SET v = ? WHERE k = ?', [(string)$v, $k]);
                insert('users', ['name' => $name, 'email' => $email, 'password_hash' => password_hash($pw, PASSWORD_DEFAULT), 'role' => 'owner', 'perms' => '[]',
                    'active' => 1, 'session_version' => 1, 'created_at' => date('Y-m-d H:i:s')]);
                insert('audit_log', ['user_id' => null, 'action' => 'install', 'entity' => 'system', 'details' => 'Fleet manager set up', 'ip' => client_ip(), 'created_at' => date('Y-m-d H:i:s')]);
                $done = true;
            } catch (Throwable $e) { @unlink($tmp); throw $e; }
        } catch (Throwable $e) {
            $msg = $e->getMessage();
            if ($e instanceof PDOException) $msg = 'Could not connect to the database. Check the database name, username and password in Hostinger → Databases. (' . $e->getMessage() . ')';
            $errors[] = $msg;
        }
    }
}
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Set up · Car Rental Manager</title><link rel="stylesheet" href="assets/app.css"></head><body><main class="bare"><div class="auth wide">
<h1>Welcome. Let's set up your business.</h1>
<?php if ($done): ?>
  <div class="flash success">Setup is complete. The owner account is ready.</div>
  <p>For safety, <b>delete install.php</b> from the server now (it no longer works, but there is no need to keep it).</p>
  <p><a class="btn primary" href="index.php">Sign in</a></p>
<?php else: ?>
  <p class="muted">This runs once. It connects the database and creates the owner account.</p>
  <div class="card"><h3>Server check</h3><ul class="checks">
  <?php foreach ($checks as $label => $ok): ?><li class="<?= $ok ? 'ok' : 'bad' ?>"><?= $ok ? '✓' : '✗' ?> <?= $h($label) ?></li><?php endforeach; ?>
  </ul></div>
  <?php foreach ($errors as $er): ?><div class="flash error"><?= $h($er) ?></div><?php endforeach; ?>
  <form method="post" class="card stack">
    <h3>Database</h3>
    <label class="field"><span>Database type</span><select name="driver" onchange="document.getElementById('my').hidden=this.value!=='mysql'">
      <option value="mysql" <?= $f('driver', 'mysql') === 'mysql' ? 'selected' : '' ?>>MySQL (recommended on Hostinger)</option>
      <option value="sqlite" <?= $f('driver') === 'sqlite' ? 'selected' : '' ?>>SQLite (single file, no setup)</option></select></label>
    <div id="my" <?= $f('driver') === 'sqlite' ? 'hidden' : '' ?>>
      <div class="grid2">
        <label class="field"><span>Database name</span><input name="db_name" value="<?= $h($f('db_name')) ?>" placeholder="u123456789_fleet"></label>
        <label class="field"><span>Database username</span><input name="db_user" value="<?= $h($f('db_user')) ?>" placeholder="u123456789_owner"></label>
        <label class="field"><span>Database password</span><input type="password" name="db_pass" autocomplete="new-password"></label>
        <label class="field"><span>Host</span><input name="db_host" value="<?= $h($f('db_host', 'localhost')) ?>"></label>
      </div>
    </div>
    <h3>Your business</h3>
    <p class="muted small">Only the business name is needed now. Everything can be changed later in Settings.</p>
    <div class="grid2">
      <label class="field"><span>Business name *</span><input name="business_name" value="<?= $h($f('business_name')) ?>" required></label>
      <label class="field"><span>Phone number</span><input name="business_phone" value="<?= $h($f('business_phone')) ?>"></label>
      <label class="field"><span>Currency</span><select name="currency"><?php foreach (CURRENCIES as $code => $sym): ?><option value="<?= $code ?>" <?= $f('currency', 'INR') === $code ? 'selected' : '' ?>><?= $code ?> (<?= $h(trim($sym)) ?>)</option><?php endforeach; ?></select></label>
      <label class="field"><span>Business opening date</span><input type="date" name="opening_date" value="<?= $h($f('opening_date')) ?>"></label>
      <label class="field"><span>Number of vehicles</span><input type="number" min="0" max="5000" name="vehicle_count" value="<?= $h($f('vehicle_count')) ?>"></label>
      <label class="field"><span>Usual way you charge rent</span><select name="default_rate_type"><?php foreach (['daily' => 'Per day', 'monthly' => 'Per month', 'fixed' => 'Fixed amount per trip'] as $k => $l): ?><option value="<?= $k ?>" <?= $f('default_rate_type', 'daily') === $k ? 'selected' : '' ?>><?= $l ?></option><?php endforeach; ?></select></label>
    </div>
    <label class="field"><span>Address</span><textarea name="business_address" rows="2"><?= $h($f('business_address')) ?></textarea></label>
    <h3>Owner account</h3>
    <div class="grid2">
      <label class="field"><span>Owner name</span><input name="owner_name" value="<?= $h($f('owner_name')) ?>" required></label>
      <label class="field"><span>Email (used to sign in)</span><input type="email" name="owner_email" value="<?= $h($f('owner_email')) ?>" required></label>
      <label class="field"><span>Password</span><input type="password" name="owner_password" autocomplete="new-password" required><small>At least 8 characters, with a letter and a number.</small></label>
      <label class="field"><span>Repeat password</span><input type="password" name="owner_password2" autocomplete="new-password" required></label>
    </div>
    <button class="btn primary" type="submit">Set up</button>
  </form>
<?php endif; ?>
</div></main></body></html>
