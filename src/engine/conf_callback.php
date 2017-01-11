<?php

require_once 'config.php';

$action = $_REQUEST['ConferenceAction'];
$room   = $_REQUEST['ConferenceName'];
$user   = $_REQUEST['CallUUID'];

$call = r\db( DB_NAME )
	->table( 'calls' )
	->get( $room )
	->run( $connection );

event( [
	'type'      => 'call_action',
	'room'      => $room,
	'caller_id' => $user,
	'action'    => $action
] );

switch ( $action ) {
	case 'enter':
		r\db( DB_NAME )
			->table( 'calls' )
			->get( $room )
			->update( [
				$user . '_enter' => r\now()
			] )
			->run( $connection );
		break;
	case 'exit':
		$call = r\db( DB_NAME )
			->table( 'calls' )
			->get( $room )
			->update( [
				$user . '_exit' => r\now(),
				'callers'       => r\row( 'callers' )->sub( 1 )
			], [ 'return_changes' => true ] )
			->run( $connection );
		$call = $call['changes'][0]['new_val'];

		// finish the contest
		if ( $call['callers'] <= 0 ) {

			if ( $call['callers'] < 0 ) {
				event( [
					'type' => 'triangle'
				] );
			}

			$me    = $call['left_id'] == $user ? $call['left'] : $call['right']; //todo: handle cases where more than two are in the room
			$other = $call['right'] == $me ? $call['left'] : $call['right'];
			if ( $other == $me ) {
				// if we aren't actually on either side, bail
				// we should do something here...
			}
			// update the call as complete
			event( [
				'type'    => 'winner',
				'room_id' => $room,
				'vs'      => [ $me, $other ],
				'winner'  => $me
			] );
			r\db( DB_NAME )
				->table( 'calls' )
				->get( $room )
				->update( [
					'status' => 'complete',
					'winner' => $me
				] )->run( $connection );

			$points   = 0;
			$myPoints = 0;
			if ( ! empty( $other ) ) {
				// calculate points
				$points = r\db( DB_NAME )
					->table( 'calls' )
					->getAll( $room )
					->map( function ( $item ) use ( $call ) {
						return [
							'id'     => $item( 'id' ),
							'points' => r\expr( [
								$item( $call['left_id'] . '_exit' ),
								$item( $call['right_id'] . '_exit' )
							] )
								->min()
								->sub( r\expr( [
									$item( $call['left_id'] . '_enter' ),
									$item( $call['right_id'] . '_enter' )
								] )
									->max() )
								->div( 120 )
								->floor()
								->mul( 200 )
						];
					} )->run( $connection )->toArray();
				$points = $points[0]['points'];

				$myPoints = $points + 1000;
			}

			event( [
				'type'   => 'increase_score',
				'player' => $me,
				'amount' => $myPoints
			] );

			event( [
				'type'   => 'mark_player',
				'player' => $me,
				'status' => 'not_playing'
			] );

			if (!empty($other)) {
				event( [
					'type'   => 'increase_score',
					'player' => $other,
					'amount' => $points
				] );

				event( [
					'type'   => 'mark_player',
					'player' => $other,
					'status' => 'not_playing'
				] );

				event( [
					'type'   => 'kill_player',
					'player' => $other
				] );
			}

			// give points to winner
			user( $me )->update( [
				'score'  => r\row( 'score' )->add( $myPoints ),
				'status' => 'not_playing'
			] )->run( $connection );

			// deduct a life from the loser
			user( $other )->update( [
				'score'  => r\row( 'score' )->add( $points ),
				'lives'  => r\row( 'lives' )->sub( 1 ),
				'status' => 'not_playing'
			] )->run( $connection );

			// update the leaderboard
			/*r\db(DB_NAME)->table('leaderboard')->replace([
				'id' => $me,
				'score' =>
			]);*/
		}
		break;
}
