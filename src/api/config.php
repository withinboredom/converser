<?php

/* --- Application options ----------------------------------------------------------------------- */

define( 'DB_NAME', getenv( 'DB_NAME' ) ?: 'converser' );
define( 'DB_HOST', getenv( 'DB_HOST' ) ?: 'localhost' );
define( 'SMS', getenv( 'SMS' ) ?: '18037143889' );
define( 'CALL', getenv( 'CALL' ) ?: '18882660156' );
define( 'HOST', getenv( 'CALL_HOST' ) ?: 'http://dev.converser.space:2200/' );

define( 'STRIPE_KEY', getenv( 'STRIPE_KEY' ) ?: 'sk_test_osM11tRI7n2u8cChs2J3R4kx' );

define( 'METRICS_DB', DB_NAME . '_metrics' );

$auth_id    = getenv( 'PLIVO_ID' ) ?: "SANTC0YTLLZTFMMZA3MM";
$auth_token = getenv( 'PLIVO_TOKEN' ) ?: "MzA2M2UyMWViNTI5NjFmZjNjMmJiYmZlNmM5YmZh";

global $conn, $plivo, $container;

/* Connect to rethinkdb */
$conn = r\connect( DB_HOST );

$plivo = new \Plivo\RestAPI( $auth_id, $auth_token );
unset( $auth_id );
unset( $auth_token );

Stripe\Stripe::setApiKey( STRIPE_KEY );

$container            = new \Model\Container();
$container->snapshots = r\db( 'records' )->table( 'snapshots' );
$container->records   = r\db( 'records' )->table( 'events' );
$container->conn      = $conn;
$container->plivo     = $plivo;
$container->uuid      = r\uuid();
$container->R         = r\db( DB_NAME );
$container->charge    = 'Stripe\Charge';
$container->storage   = new \Model\RqlStorage( $container );

/* --- Global server options -------------------------------------------------------------------- */

const AERYS_OPTIONS = [
	"keepAliveTimeout"   => 60,
	"user"               => "nobody",
	"defaultContentType" => "application/json",
	//"deflateMinimumLength" => 0,
];

