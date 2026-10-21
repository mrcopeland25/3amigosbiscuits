<?php
require __DIR__ . '/config.php';

if (too_many_requests('order', 5)) respond(false, ['error' => 'Too many orders from this connection. Please wait a few minutes and try again.'], 429);

$name    = one_line(clean('name', 100));
$email   = one_line(clean('email', 150));
$phone   = one_line(clean('phone', 40));
$address = clean('address', 400);
$notes   = clean('notes', 1000);
$items   = json_decode($_POST['cart'] ?? '[]', true);

if ($name === '')                                 respond(false, ['error' => 'Please enter your name.'], 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL))   respond(false, ['error' => 'Please enter a valid email address.'], 422);
if (!is_array($items) || count($items) === 0)     respond(false, ['error' => 'Your cart is empty.'], 422);

// Rebuild the order from the server-side catalog
$lines = [];
$subtotal = 0;
$ships = false;
foreach ($items as $it) {
    $id  = isset($it['id']) ? (string)$it['id'] : '';
    $qty = isset($it['quantity']) ? (int)$it['quantity'] : 0;
    if (!isset($PRODUCTS[$id]) || $qty < 1 || $qty > 99) continue;
    $p = $PRODUCTS[$id];
    $lineTotal = $p['price'] * $qty;
    $subtotal += $lineTotal;
    if ($p['ships']) $ships = true;
    $lines[] = sprintf("%2d x %-26s $%7.2f", $qty, $p['name'], $lineTotal);
}
if (!$lines) respond(false, ['error' => 'Your cart has no valid items. Please re-add them from the Products page.'], 422);
if ($ships && trim($address) === '') respond(false, ['error' => 'Please enter your shipping address.'], 422);

$shipping = $ships ? SHIPPING_FLAT : 0;
$total    = round($subtotal + $shipping, 2);
$orderId  = date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));

$summary = implode("\n", $lines) . "\n"
         . str_repeat('-', 41) . "\n"
         . sprintf("%-31s $%7.2f\n", 'Subtotal', $subtotal)
         . sprintf("%-31s $%7.2f\n", 'Shipping', $shipping)
         . sprintf("%-31s $%7.2f\n", 'TOTAL', $total);

$ownerBody = "New order #$orderId\n\n"
           . "Customer: $name\nEmail: $email\nPhone: " . ($phone ?: '-') . "\n"
           . "Address:\n" . ($ships ? $address : '(digital only - no shipping)') . "\n\n"
           . "Notes: " . ($notes ?: '-') . "\n\n"
           . $summary
           . "\nReply to this email to contact the customer.\n";

$customerBody = "Hi $name,\n\nThanks for your order from " . SITE_NAME . "! Here's what we received:\n\n"
              . "Order #$orderId\n\n" . $summary
              . "\nWe'll email you shortly to confirm your order and send payment details.\n"
              . "Questions? Just reply to this email.\n\n- Regine & James, " . SITE_NAME . "\n";

// Always keep a copy on the server, even if email fails
save_record('orders.log', json_encode([
    'id' => $orderId, 'date' => date('c'), 'name' => $name, 'email' => $email, 'phone' => $phone,
    'address' => $address, 'notes' => $notes, 'items' => $lines, 'total' => $total
]));

$sent = send_mail(OWNER_EMAIL, "New order #$orderId - $name - $" . number_format($total, 2), $ownerBody, $email);
send_mail($email, "Your " . SITE_NAME . " order #$orderId", $customerBody, OWNER_EMAIL);

if (!$sent) {
    // Order is saved in data/orders.log; tell the customer it went through
    error_log("3AmigosBiscuits: mail() failed for order $orderId");
}

respond(true, ['orderId' => $orderId, 'total' => $total]);
