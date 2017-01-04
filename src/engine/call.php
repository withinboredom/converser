<?php

require_once 'config.php';

use Plivo\Response;

$from   = $_REQUEST['From'];
$callId = r\uuid()->run( $connection );

event( [
	'type' => 'call_received',
	'from' => $from
] );

//todo: determine if player exists and has credits
$user = user( $from )->run( $connection )->toArray();

// if the user doesn't exist, just hangup
if ( count( $user ) === 0 ) {
	$r = new Response();

	$r->addHangup( [
		'reason' => 'rejected'
	] );

	echo $r->toXML();

	event( [
		'type'   => 'call_force_hangup',
		'from'   => $from,
		'reason' => 'user does not exist'
	] );

	exit();
}

$user = $user[0];

// if the user is dead, tell them to go get more credits
if ( $user['lives'] <= 0 ) {
	$r = new Response();
	$r->addSpeak( 'You are out of lives. Please insert coin via the converser app' );
	echo $r->toXML();

	event( [
		'type'   => 'call_force_hangup',
		'from'   => $from,
		'reason' => 'user dead'
	] );

	exit();
}

// if the user is playing somewhere else, tell them to

//todo: set player status as playing
user( $from )
	->update( [
		'status' => 'playing'
	] )->run( $connection );

event( [
	'type'   => 'mark_player',
	'player' => $from,
	'status' => 'playing'
] );

//todo: find competitor, and connect

$competitor = r\db( DB_NAME )
	->table( 'calls' )
	->filter( [
		'status' => 'active_waiting'
	] )
	->sample( 1 )
	->update( function ( $call ) use ( $from ) {
		return r\branch(
			$call( 'callers' )->lt( 2 ),
			[
				'callers'  => 2,
				'right'    => $from,
				'right_id' => $_REQUEST['CallUUID'],
				'status'   => 'competing'
			], null
		);
	}, [ 'return_changes' => true ] )
	->run( $connection );

if ( ! $competitor['unchanged'] ) {
	if ( count( $competitor['changes'] ) > 0 ) {
		$changed = $competitor['changes'][0]['new_val'];
		$room    = $changed['id'];
		event( [
			'type'    => 'competition_join',
			'call_id' => $room,
			'vs'      => [ $changed['left'], $changed['right'] ]
		] );

		$params = [
			'record'                 => 'false',
			'method'                 => 'GET',
			'callbackUrl'            => HOST . 'conf_callback.php',
			'callbackMethod'         => 'GET',
			'startConferenceOnEnter' => 'true',
			'endConferenceOnExit'    => 'true'
		];

		$r = new Response();
		$r->addConference( $room, $params );
		echo $r->toXML();

		exit();
	}
}

// no competitor found, creating a competition room

$room = r\uuid()->run( $connection );

event( [
	'type'    => 'competition_create',
	'call_id' => $room,
	'vs'      => [ $from ]
] );

r\db( DB_NAME )->table( 'calls' )->insert( [
	'id'       => $room,
	'status'   => 'active_waiting',
	'callers'  => 1,
	'left'     => $from,
	'left_id'  => $_REQUEST['CallUUID'],
	'right'    => null,
	'right_id' => null
] )->run( $connection );

$r = new Response();

$message = "Please wait for Player Two. This may take a few minutes.";

$r->addSpeak( $message );

$params = [
	'record'                 => 'false',
	'method'                 => 'GET',
	'callbackUrl'            => HOST . 'conf_callback.php',
	'callbackMethod'         => 'GET',
	'startConferenceOnEnter' => 'true',
	'endConferenceOnExit'    => 'true',
	'maxMembers'             => 2,
	'digitsMatch'            => '1',
	'relayDTMF'              => false
];

$r->addConference( $room, $params );
echo $r->toXML();
