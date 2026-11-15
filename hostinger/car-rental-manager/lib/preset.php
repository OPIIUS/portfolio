<?php
/* Business presets: ready-made details for a known business, loaded once by the installer. */
defined('APP') or exit;

const TEMP_REG_PREFIX = 'TEMP ';

function preset_list() {
    $out = [];
    foreach (glob(ROOT . '/presets/*.php') ?: [] as $f) if (basename($f) !== 'index.php') $out[basename($f, '.php')] = $f;
    return $out;
}
function preset_load($name) {
    $all = preset_list();
    if (!isset($all[$name])) return null;
    $p = require $all[$name];
    return is_array($p) ? $p + ['key' => $name] : null;
}

/* Save the preset's settings, and optionally its fleet. Cars get temporary registration numbers
   (TEMP 01, TEMP 02…) and 0 km until the owner enters the real ones; the app shows a reminder until then. */
function preset_apply(array $p, $withFleet) {
    foreach ($p['settings'] ?? [] as $k => $v) setting_save($k, $v);
    if (!$withFleet) return 0;
    $n = 0;
    foreach ($p['vehicles'] ?? [] as $i => $v) {
        $photo = $v['photo'] ?? null; unset($v['photo']);
        $id = insert('vehicles', $v + ['reg_no' => TEMP_REG_PREFIX . str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT), 'odometer' => 0, 'monthly_rate' => 0,
            'condition_note' => '', 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')]);
        if ($photo) preset_photo(ROOT . '/presets/' . $p['key'] . '/' . $photo, $id);
        $n++;
    }
    return $n;
}
function preset_photo($src, $vehicleId) {
    if (!is_file($src)) return;
    $dir = date('Y/m');
    if (!is_dir(STORAGE . "/uploads/$dir")) mkdir(STORAGE . "/uploads/$dir", 0750, true);
    $ext = strtolower(pathinfo($src, PATHINFO_EXTENSION));
    $stored = $dir . '/' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!copy($src, STORAGE . "/uploads/$stored")) return;
    insert('files', ['entity' => 'vehicle_photo', 'entity_id' => $vehicleId, 'orig_name' => basename($src), 'stored_name' => $stored,
        'mime' => $ext === 'png' ? 'image/png' : 'image/jpeg', 'size' => filesize($src), 'created_at' => date('Y-m-d H:i:s')]);
}
/* Cars still carrying a temporary registration number or no km reading. */
function cars_needing_details() {
    return rows("SELECT id, reg_no, name FROM vehicles WHERE archived = 0 AND (reg_no LIKE ? OR odometer = 0) ORDER BY reg_no", [TEMP_REG_PREFIX . '%']);
}
