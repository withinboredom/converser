<?php

require_once 'vendor/autoload.php';

Header( 'Content-type: text/xml' );

$auth_id    = getenv('PLIVO_ID') ?: "SANTC0YTLLZTFMMZA3MM";
$auth_token = getenv('PLIVO_TOKEN') ?: "MzA2M2UyMWViNTI5NjFmZjNjMmJiYmZlNmM5YmZh";
$plivo      = new \Plivo\RestAPI( $auth_id, $auth_token );
unset( $auth_id );
unset( $auth_token );

define( 'DB_NAME', getenv( 'DB_NAME' ) ?: 'converser' );
define( 'DB_HOST', getenv( 'DB_HOST' ) ?: 'rethunk' );
define( 'SMS', getenv( 'SMS' ) ?: '18037143889' );
define( 'CALL', getenv( 'CALL' ) ?: '18882660156' );
define( 'HOST', getenv( 'CALL_HOST' ) ?: 'http://dev.converser.space:2200/' );

$connection = r\connect( DB_HOST );

function cleanPhone( string $phone ): string {
	return preg_replace( '/\D+/', '', $phone );
}

function event( $event ) {
	$event['time'] = r\now();
	$conn          = r\connect( DB_HOST );
	r\db( DB_NAME )->table( 'events' )->insert( $event )->run( $conn );
}

function user( $from ) {
	return r\db( DB_NAME )->table( 'users' )->getAll( $from, [ 'index' => 'phone' ] )->limit( 1 );
}
