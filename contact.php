<?php
require __DIR__ . '/config.php';

if (too_many_requests('contact', 6)) respond(false, ['error' => 'Too many messages from this connection. Please wait a few minutes.'], 429);

$type  = clean('type', 20) === 'newsletter' ? 'newsletter' : 'contact';
$email = one_line(clean('email', 150));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(false, ['error' => 'Please enter a valid email address.'], 422);

if ($type === 'newsletter') {
    save_record('newsletter.csv', date('c') . ',' . str_replace(',', '', $email));
    send_mail(OWNER_EMAIL, 'New newsletter signup: ' . $email, "New newsletter subscriber:\n\n$email\n\nAll signups are saved in data/newsletter.csv on your hosting.");
    respond(true);
}

$name    = one_line(clean('name', 100));
$message = clean('message', 5000);
if ($name === '' || $message === '') respond(false, ['error' => 'Please fill in your name and message.'], 422);

save_record('messages.log', json_encode(['date' => date('c'), 'name' => $name, 'email' => $email, 'message' => $message]));
$ok = send_mail(OWNER_EMAIL, "Website message from $name", "Name: $name\nEmail: $email\n\n$message\n\n(Reply to this email to answer them.)", $email);
if (!$ok) error_log('3AmigosBiscuits: mail() failed for contact message');

respond(true);
