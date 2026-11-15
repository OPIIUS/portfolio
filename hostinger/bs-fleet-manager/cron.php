<?php
/* Scheduled jobs: alerts, daily backup, optional email digest.
   Hostinger → Advanced → Cron Jobs:   php /home/USER/domains/DOMAIN/public_html/manage/cron.php     (every hour)
   Or a web cron calling:              https://DOMAIN/manage/cron.php?token=YOUR_TOKEN   (token is in Settings → Reminders) */
define('APP', true);
require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/schema.php';
require __DIR__ . '/lib/domain.php';
require __DIR__ . '/lib/view.php';

if (!installed()) exit("Not set up\n");
if (PHP_SAPI !== 'cli' && !hash_equals((string)setting('cron_token'), (string)($_GET['token'] ?? ''))) { http_response_code(403); exit('Forbidden'); }
header('Content-Type: text/plain; charset=utf-8');

$out = [];
try { $out[] = 'alerts checked: ' . run_checks() . ' active'; } catch (Throwable $e) { $out[] = 'alerts failed: ' . $e->getMessage(); }
try {
    $last = setting('last_backup');
    if (!$last || substr($last, 0, 10) !== today()) $out[] = 'backup: ' . basename(backup_write());
    else $out[] = 'backup: already done today';
} catch (Throwable $e) { $out[] = 'backup failed: ' . $e->getMessage(); }
try { $out[] = 'email digest: ' . send_digest(); } catch (Throwable $e) { $out[] = 'digest failed: ' . $e->getMessage(); }
try { q('DELETE FROM login_attempts WHERE created_at < ?', [date('Y-m-d H:i:s', strtotime(now()) - 30 * 86400)]); } catch (Throwable $e) {}
setting_save('last_cron', now());
echo implode("\n", $out), "\n";
