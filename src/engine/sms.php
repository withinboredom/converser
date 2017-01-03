<?php

require_once 'config.php';

// Sender's phone numer
$from_number = $_REQUEST["From"];
// Receiver's phone number - Plivo number
$to_number = $_REQUEST["To"];
// The SMS text message which was received
$text = $_REQUEST["Text"];
// Output the text which was received, you could
// also store the text in a database.
r\db( DB_NAME )->table( 'sms' )->insert( [
	'from' => $from_number,
	'to' => $to_number,
	'text' => $text
] )->run( $connection );

$plivo->send_message( [
	'src' => SMS,
	'dst' => $from_number,
	'text' => 'Thank you for your message, it has been stored. We will review it and get back to you as soon as possible.',
	'received' => r\now()
] );
