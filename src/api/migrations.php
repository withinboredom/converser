<?php

function prep() {
	global $conn;
	$dbs      = yield r\dbList()->run( $conn );
	$filtered = array_filter( $dbs, function ( $db ) {
		return $db == DB_NAME;
	} );


	if ( count( $filtered ) == 0 ) {
		yield r\dbCreate( DB_NAME )->run( $conn );
		$db = r\db( DB_NAME );
		yield $db->tableCreate( 'version' )->run( $conn );
		yield $db->table( 'version' )->insert( [
			'id'    => 'db',
			'value' => 0
		] )->run( $conn );
	}

	$currentVersion = ( yield r\db( DB_NAME )->table( 'version' )->get( 'db' )->run( $conn ) )['value'];

	$db   = r\db( DB_NAME );
	$rnad = rand();
	yield $db->table( 'version' )->insert( [ 'id' => 'rlock', 'value' => $rnad ] )->run( $conn );
	$hasLock = ( yield $db->table( 'version' )->get( 'rlock' )->run( $conn ) )['value'] == $rnad;

	var_dump( $hasLock );

	if ( ! $hasLock ) {
		return $conn;
	}

	if ( $currentVersion == null ) {
		yield $db->table( 'version' )->insert( [
			'id'    => 'db',
			'value' => 0
		] )->run( $conn );
		$currentVersion = 0;
	}

	// todo: increment this if you add a migration
	$expectedVersion = 13;
	// put migrations here
	switch ( $currentVersion + 1 ) {
		case 1:
			yield $db->tableCreate( 'users' )->run( $conn );
		case 2:
			yield $db->table( 'users' )->indexCreate( 'phone' )->run( $conn );
		case 3:
			yield $db->table( 'users' )->insert( [
				'phone'   => '19102974810',
				'admin'   => true,
				'lives'   => 1000,
				'score'   => 0,
				'status'  => 'not-playing',
				'created' => r\now()
			] )->run( $conn );
		case 4:
			yield $db->tableCreate( 'calls' )->run( $conn );
		case 5:
			yield $db->tableCreate( 'sessions' )->run( $conn );
		case 6:
			yield $db->tableCreate( 'events', [ 'durability' => 'soft' ] )->run( $conn );
		case 7:
			yield $db->tableCreate( 'sms', [ 'durability' => 'soft' ] )->run( $conn );
		case 8:
			yield $db->table( 'sessions' )->indexCreate( 'phone' )->run( $conn );
			yield $db->table( 'sessions' )->indexCreate( 'token' )->run( $conn );
			yield $db->table( 'sessions' )->indexCreate( 'user_id' )->run( $conn );
		case 9:
			yield r\dbCreate( 'records' )->run( $conn );
		case 10:
			yield r\db( 'records' )->tableCreate( 'events', [
				'primaryKey' => [
					r\row( 'model_id' ),
					r\row( 'version' )
				]
			] )->run( $conn );
		case 11:
			yield r\db( 'records' )->table( 'events' )->indexCreate( 'model_id' )->run( $conn );
		case 12:
			yield r\db( 'records' )->tableCreate( 'snapshots' )->run( $conn );
		case 13:
			yield $db->tableCreate( 'payments' )->run( $conn );
	}

	if ( $currentVersion != $expectedVersion ) {
		yield r\db( DB_NAME )->table( 'version' )->update( [
			'id'    => 'db',
			'value' => $expectedVersion
		] )->run( $conn );
	}

	yield $db->table( 'version' )->get( 'rlock' )->delete()->run( $conn );

	return $conn;
}