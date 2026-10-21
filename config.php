<?php
// ============================================================
// 3AmigosBiscuits settings - EDIT THESE TWO LINES
// ============================================================

// Where orders and contact messages are sent.
define('OWNER_EMAIL', 'hello@3amigosbiscuits.com');

// The address emails come FROM. On Hostinger this must be a real mailbox on
// your own domain (create it under hPanel -> Emails), or emails may go to spam
// or not send at all.
define('FROM_EMAIL', 'hello@3amigosbiscuits.com');

define('SITE_NAME', '3AmigosBiscuits');
define('SHIPPING_FLAT', 5.00);

// Product catalog - prices are checked here so nobody can change them in the browser.
// Keep these in sync with the prices shown on the website.
$PRODUCTS = [
    '1' => ['name' => 'Foxy B 10 oz',            'price' => 9.99,  'ships' => true],
    '2' => ['name' => 'Foxy B 16 oz',            'price' => 14.99, 'ships' => true],
    '3' => ['name' => 'Foxy B 32 oz',            'price' => 24.99, 'ships' => true],
    '4' => ['name' => 'Foxy B 3-Pack Bundle',    'price' => 25.00, 'ships' => true],
    '5' => ['name' => "Mom's Secret Recipe PDF", 'price' => 199.99, 'ships' => false],
];

// ============================================================
// Helpers (no need to edit below)
// ============================================================
define('DATA_DIR', __DIR__ . '/data');

function respond($ok, $payload = [], $code = 200) {
    $wantsJson = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;
    if (!$wantsJson) {
        // Plain form post (JavaScript off): show a simple page
        http_response_code($code);
        $msg = $ok ? 'Thank you! We received your submission.' : htmlspecialchars($payload['error'] ?? 'Something went wrong.');
        echo "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>" . SITE_NAME . "</title></head>"
           . "<body style='font-family:sans-serif;text-align:center;padding:3rem 1rem'><h2>$msg</h2><p><a href='index.html'>Back to the site</a></p></body></html>";
        exit;
    }
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(array_merge(['ok' => $ok], $payload));
    exit;
}

function clean($key, $max = 500) {
    $v = isset($_POST[$key]) ? trim((string)$_POST[$key]) : '';
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    return mb_substr($v, 0, $max);
}

function one_line($s) {
    // Prevents email header injection
    return trim(preg_replace('/[\r\n]+/', ' ', $s));
}

function send_mail($to, $subject, $body, $replyTo = '') {
    $headers  = 'From: ' . SITE_NAME . ' <' . FROM_EMAIL . ">\r\n";
    if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers .= 'Reply-To: ' . one_line($replyTo) . "\r\n";
    }
    $headers .= "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    return @mail($to, '=?UTF-8?B?' . base64_encode(one_line($subject)) . '?=', $body, $headers, '-f' . FROM_EMAIL);
}

function save_record($file, $line) {
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0755, true);
    @file_put_contents(DATA_DIR . '/' . $file, $line . "\n", FILE_APPEND | LOCK_EX);
}

function too_many_requests($bucket, $limit = 8, $window = 600) {
    // Simple per-IP limit to slow down spam bots
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $f = sys_get_temp_dir() . '/3ab_' . $bucket . '_' . md5($ip);
    $hits = array_filter(explode(',', (string)@file_get_contents($f)), function ($t) use ($window) {
        return $t !== '' && (time() - (int)$t) < $window;
    });
    if (count($hits) >= $limit) return true;
    $hits[] = time();
    @file_put_contents($f, implode(',', $hits));
    return false;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, ['error' => 'Method not allowed'], 405);
}
// Honeypot: bots fill the hidden "website" field
if (clean('website') !== '') {
    respond(true, ['orderId' => '0', 'total' => 0]);
}
