<?php
defined('APP') or exit;

/* Uploaded files are stored outside public reach and only served here, after a permission check. */
function page_file() {
    $f = row('SELECT * FROM files WHERE id = ? AND deleted = 0', [(int)get('id')]);
    if (!$f) { http_response_code(404); exit('Not found'); }
    require_perm(file_perm($f['entity']));
    $path = realpath(STORAGE . '/uploads/' . $f['stored_name']);
    $base = realpath(STORAGE . '/uploads');
    if (!$path || !$base || !str_starts_with($path, $base . DIRECTORY_SEPARATOR) || !is_file($path)) { http_response_code(404); exit('Not found'); }
    if ($f['entity'] === 'customer_id') audit('view', 'customer_file', $f['entity_id'], ['file' => $f['id']]);
    header('Content-Type: ' . $f['mime']);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', $f['orig_name']) . '"');
    header('Cache-Control: private, max-age=3600');
    header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    readfile($path);
    exit;
}
