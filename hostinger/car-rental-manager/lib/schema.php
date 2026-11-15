<?php
/* Database schema. One definition, turned into MySQL or SQLite DDL.
   Money columns are integers in paise (₹1 = 100) so totals never suffer rounding errors. */
defined('APP') or exit;

const SCHEMA_VERSION = 2;

function schema_tables() {
    return [
        'settings' => ['k' => 'str:100 pk', 'v' => 'text'],
        'users' => [
            'id' => 'id', 'name' => 'str', 'email' => 'str unique', 'password_hash' => 'str',
            'role' => 'str:20', 'perms' => 'text', 'active' => 'int=1', 'session_version' => 'int=1',
            'last_login' => 'dt', 'created_at' => 'dt', 'updated_at' => 'dt',
        ],
        'login_attempts' => ['id' => 'id', 'email' => 'str', 'ip' => 'str:45', 'success' => 'int=0', 'created_at' => 'dt'],
        'vehicles' => [
            'id' => 'id', 'reg_no' => 'str:30 unique', 'name' => 'str', 'make' => 'str', 'model' => 'str',
            'category' => 'str:40', 'year' => 'int', 'fuel' => 'str:20', 'transmission' => 'str:20', 'colour' => 'str:40',
            'seats' => 'int', 'odometer' => 'int=0', 'purchase_date' => 'date', 'purchase_price' => 'money',
            'condition_note' => 'text', 'daily_rate' => 'money', 'monthly_rate' => 'money', 'km_limit_per_day' => 'int',
            'status_override' => 'str:20', 'status_note' => 'text',
            'service_interval_km' => 'int', 'service_interval_days' => 'int', 'last_service_date' => 'date', 'last_service_km' => 'int',
            'next_service_km' => 'int', 'next_service_date' => 'date', 'gps_device_id' => 'str', 'gps_tracking_url' => 'text', 'notes' => 'text', 'archived' => 'int=0',
            'created_by' => 'int', 'created_at' => 'dt', 'updated_at' => 'dt',
        ],
        'doc_types' => [
            'id' => 'id', 'name' => 'str', 'required_for' => 'text', 'has_expiry' => 'int=1', 'active' => 'int=1', 'sort' => 'int=0',
        ],
        'vehicle_documents' => [
            'id' => 'id', 'vehicle_id' => 'int idx', 'doc_type_id' => 'int idx', 'number' => 'str', 'issue_date' => 'date',
            'expiry_date' => 'date', 'authority' => 'str', 'notes' => 'text', 'file_id' => 'int', 'replaced' => 'int=0',
            'created_by' => 'int', 'created_at' => 'dt',
        ],
        'customers' => [
            'id' => 'id', 'name' => 'str', 'phone' => 'str:20 idx', 'alt_phone' => 'str:20', 'email' => 'str', 'address' => 'text',
            'dl_number' => 'str', 'dl_expiry' => 'date', 'id_type' => 'str:40', 'id_number' => 'str', 'id_verified' => 'int=0',
            'flagged' => 'int=0', 'notes' => 'text', 'archived' => 'int=0', 'created_by' => 'int', 'created_at' => 'dt', 'updated_at' => 'dt',
        ],
        'customer_notes' => [
            'id' => 'id', 'customer_id' => 'int idx', 'kind' => 'str:20', 'body' => 'text', 'booking_id' => 'int', 'created_by' => 'int', 'created_at' => 'dt',
        ],
        'bookings' => [
            'id' => 'id', 'code' => 'str:30 unique', 'customer_id' => 'int idx', 'vehicle_id' => 'int idx', 'status' => 'str:20 idx',
            'start_at' => 'dt', 'end_at' => 'dt', 'actual_start' => 'dt', 'actual_end' => 'dt',
            'pickup_location' => 'str', 'drop_location' => 'str', 'rate_type' => 'str:20', 'agreed_amount' => 'money',
            'discount' => 'money', 'deposit_amount' => 'money', 'due_date' => 'date', 'km_limit' => 'int',
            'notes' => 'text', 'cancel_reason' => 'text', 'created_by' => 'int', 'created_at' => 'dt', 'updated_at' => 'dt',
        ],
        'booking_charges' => [
            'id' => 'id', 'booking_id' => 'int idx', 'kind' => 'str:30', 'label' => 'str', 'amount' => 'money',
            'voided' => 'int=0', 'void_reason' => 'text', 'created_by' => 'int', 'created_at' => 'dt',
        ],
        'booking_extensions' => [
            'id' => 'id', 'booking_id' => 'int idx', 'old_end' => 'dt', 'new_end' => 'dt', 'charge_id' => 'int', 'note' => 'text',
            'created_by' => 'int', 'created_at' => 'dt',
        ],
        'checklists' => [
            'id' => 'id', 'booking_id' => 'int idx', 'stage' => 'str:20', 'odometer' => 'int', 'fuel_level' => 'str:20',
            'items' => 'text', 'damage_notes' => 'text', 'condition_note' => 'text', 'override_reason' => 'text',
            'created_by' => 'int', 'created_at' => 'dt',
        ],
        'payments' => [
            'id' => 'id', 'receipt_no' => 'str:30 unique', 'booking_id' => 'int idx', 'customer_id' => 'int idx', 'kind' => 'str:20',
            'amount' => 'money', 'is_advance' => 'int=0', 'method' => 'str:30', 'reference' => 'str', 'paid_at' => 'dt idx', 'note' => 'text',
            'voided' => 'int=0', 'void_reason' => 'text', 'voided_by' => 'int', 'voided_at' => 'dt',
            'created_by' => 'int', 'created_at' => 'dt',
        ],
        'maintenance' => [
            'id' => 'id', 'vehicle_id' => 'int idx', 'kind' => 'str:30', 'service_date' => 'date', 'odometer' => 'int', 'cost' => 'money',
            'provider' => 'str', 'description' => 'text', 'resets_schedule' => 'int=0', 'expense_id' => 'int', 'file_id' => 'int',
            'voided' => 'int=0', 'void_reason' => 'text', 'created_by' => 'int', 'created_at' => 'dt',
        ],
        'expenses' => [
            'id' => 'id', 'expense_date' => 'date idx', 'vehicle_id' => 'int idx', 'category' => 'str:30', 'amount' => 'money',
            'description' => 'text', 'method' => 'str:30', 'file_id' => 'int', 'source' => 'str:30',
            'voided' => 'int=0', 'void_reason' => 'text', 'voided_by' => 'int', 'voided_at' => 'dt',
            'created_by' => 'int', 'created_at' => 'dt',
        ],
        'damages' => [
            'id' => 'id', 'vehicle_id' => 'int idx', 'booking_id' => 'int idx', 'customer_id' => 'int idx', 'description' => 'text',
            'estimate_cost' => 'money', 'status' => 'str:20 idx', 'charge_id' => 'int', 'charge_amount' => 'money', 'decision_note' => 'text',
            'decided_by' => 'int', 'decided_at' => 'dt', 'repaired_at' => 'date', 'repair_cost' => 'money', 'expense_id' => 'int',
            'created_by' => 'int', 'created_at' => 'dt',
        ],
        'files' => [
            'id' => 'id', 'entity' => 'str:40', 'entity_id' => 'int', 'orig_name' => 'str', 'stored_name' => 'str', 'mime' => 'str:100',
            'size' => 'int', 'deleted' => 'int=0', 'uploaded_by' => 'int', 'created_at' => 'dt',
        ],
        'notifications' => [
            'id' => 'id', 'dedupe_key' => 'str:150 unique', 'type' => 'str:30 idx', 'severity' => 'str:10', 'title' => 'str',
            'message' => 'text', 'link' => 'str', 'perm' => 'str:30', 'created_at' => 'dt', 'resolved_at' => 'dt', 'resolved_by' => 'str:60',
            'emailed' => 'int=0',
        ],
        'audit_log' => [
            'id' => 'id', 'user_id' => 'int', 'action' => 'str:40', 'entity' => 'str:40', 'entity_id' => 'int', 'details' => 'text',
            'ip' => 'str:45', 'created_at' => 'dt idx',
        ],
    ];
}

/* SQL for one column. Unique/index requests are appended to $idx. */
function schema_col_def($table, $name, $spec, $driver, &$idx = []) {
    $parts = explode(' ', $spec);
    [$type, $arg] = array_pad(explode(':', $parts[0], 2), 2, null);
    $default = null;
    if (strpos($type, '=') !== false) [$type, $default] = explode('=', $type, 2);
    if ($type === 'id') return $driver === 'sqlite' ? "$name INTEGER PRIMARY KEY AUTOINCREMENT" : "$name INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY";
    $sqlType = match ($type) {
        'str' => 'VARCHAR(' . ($arg ?: 255) . ')',
        'text' => 'TEXT',
        'int' => $driver === 'sqlite' ? 'INTEGER' : 'INT',
        'money' => $driver === 'sqlite' ? 'INTEGER' : 'BIGINT',
        'dt' => $driver === 'sqlite' ? 'TEXT' : 'DATETIME',
        'date' => $driver === 'sqlite' ? 'TEXT' : 'DATE',
    };
    $d = "$name $sqlType";
    if (in_array('pk', $parts, true)) $d .= ' NOT NULL PRIMARY KEY';
    if ($default !== null) $d .= " NOT NULL DEFAULT $default";
    if (in_array('unique', $parts, true)) $idx[] = "CREATE UNIQUE INDEX ux_{$table}_{$name} ON $table ($name)";
    if (in_array('idx', $parts, true)) $idx[] = "CREATE INDEX ix_{$table}_{$name} ON $table ($name)";
    return $d;
}
function schema_sql($driver, $only = null) {
    $out = [];
    foreach (schema_tables() as $table => $cols) {
        if ($only && $table !== $only) continue;
        $defs = []; $idx = [];
        foreach ($cols as $name => $spec) $defs[] = schema_col_def($table, $name, $spec, $driver, $idx);
        $tail = $driver === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
        $out[] = "CREATE TABLE $table (\n  " . implode(",\n  ", $defs) . "\n)$tail";
        foreach ($idx as $i) $out[] = $i;
    }
    return $out;
}

function schema_install() {
    foreach (schema_sql(driver()) as $sql) db()->exec($sql);
    $defaults = [
        'schema_version' => SCHEMA_VERSION,
        'business_name' => 'My Car Rentals', 'owner_name' => '', 'business_phone' => '', 'business_address' => '', 'business_email' => '',
        'currency' => 'INR', 'opening_date' => '', 'vehicle_count' => '', 'default_rate_type' => 'daily',
        'booking_prefix' => 'R', 'reminder_days' => '30,15,7,1,0', 'return_alert_hours' => '24', 'payment_alert_days' => '1',
        'service_km_warning' => '500', 'service_days_warning' => '15', 'default_service_km' => '10000', 'default_service_days' => '180',
        'late_fee_per_hour' => '30000', 'extra_km_rate' => '1000', 'session_minutes' => '120',
        'email_digest' => '0', 'digest_email' => '', 'cron_token' => bin2hex(random_bytes(16)),
        'categories' => "Hatchback\nSedan\nCompact SUV\nSUV\n7-seater\nScooter\nBike",
        'last_check' => '', 'last_backup' => '', 'last_digest' => '',
    ];
    foreach ($defaults as $k => $v) insert('settings', ['k' => $k, 'v' => (string)$v]);
    // Insurance and PUC are tracked for every car by default. The owner can switch any other document on per category.
    // The app only reminds about dates the owner enters; it does not check documents or legal compliance.
    $types = [
        ['Insurance', 'all', 1], ['PUC certificate', 'all', 1], ['Registration certificate (RC)', '', 1],
        ['Fitness certificate', '', 1], ['Permit', '', 1], ['Road tax', '', 1],
    ];
    foreach ($types as $i => $t) insert('doc_types', ['name' => $t[0], 'required_for' => $t[1], 'has_expiry' => $t[2], 'active' => 1, 'sort' => $i]);
}

/* Bring an older database up to date: create missing tables and add missing columns. Never drops or changes existing data. */
function schema_upgrade() {
    $have = [];
    if (driver() === 'sqlite') { foreach (rows("SELECT name FROM sqlite_master WHERE type = 'table'") as $r) $have[$r['name']] = true; }
    else { foreach (rows('SHOW TABLES') as $r) $have[array_values($r)[0]] = true; }
    foreach (schema_tables() as $table => $cols) {
        if (!isset($have[$table])) {
            foreach (schema_sql(driver(), $table) as $sql) db()->exec($sql);
            continue;
        }
        $existing = driver() === 'sqlite' ? array_column(rows("PRAGMA table_info($table)"), 'name') : array_column(rows("SHOW COLUMNS FROM $table"), 'Field');
        foreach ($cols as $name => $spec) {
            if (in_array($name, $existing, true)) continue;
            $idx = [];
            db()->exec("ALTER TABLE $table ADD COLUMN " . schema_col_def($table, $name, $spec, driver(), $idx));
            foreach ($idx as $i) db()->exec($i);
        }
    }
    setting_save('schema_version', SCHEMA_VERSION);
}
