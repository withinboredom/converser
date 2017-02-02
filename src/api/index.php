<?php

require_once 'lib/user.php';

use Aerys\{
	Host, Request, Response, Router, Websocket, function root, function router, function websocket
};

define( 'DB_NAME', getenv( 'DB_NAME' ) ?: 'converser' );
define( 'DB_HOST', getenv( 'DB_HOST' ) ?: 'localhost' );
define( 'SMS', getenv( 'SMS' ) ?: '18037143889' );
define( 'CALL', getenv( 'CALL' ) ?: '18882660156' );
define( 'HOST', getenv( 'CALL_HOST' ) ?: 'http://dev.converser.space:2200/' );

define( 'STRIPE_KEY', getenv( 'STRIPE_KEY' ) ?: 'sk_test_osM11tRI7n2u8cChs2J3R4kx' );

define( 'METRICS_DB', DB_NAME . '_metrics' );

$auth_id    = getenv( 'PLIVO_ID' ) ?: "SANTC0YTLLZTFMMZA3MM";
$auth_token = getenv( 'PLIVO_TOKEN' ) ?: "MzA2M2UyMWViNTI5NjFmZjNjMmJiYmZlNmM5YmZh";

global $conn;
$conn = r\connect( DB_HOST );

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
			yield r\db( 'records' )->tableCreate( 'events' )->run( $conn );
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

/**
 * Call when a user first connects to the api
 *
 * @param $campaign string The Campaign (utm_)
 */
function acquire( $campaign ) {
}

/**
 * Call when a user logins for the very first time
 *
 * @param $userid
 */
function activate( $userid, $campaign ) {
}

/**
 * Call whenever a user returns
 *
 * @param $userid
 */
function retented( $userid ) {
}

/**
 * Call whenever a user refers another user
 *
 * @param $from
 * @param $to
 */
function referral( $from, $to ) {
}

/**
 * Call whenever a user generates revenue
 *
 * @param $userid
 * @param $amount
 */
function revenue( $userid, $amount ) {
}

global $plivo;

function event( $event ) {
	$event['time'] = r\now();
	$conn          = r\connect( DB_HOST );
	r\db( DB_NAME )->table( 'events' )->insert( $event )->run( $conn );
}

/* --- Global server options -------------------------------------------------------------------- */

const AERYS_OPTIONS = [
	"keepAliveTimeout"   => 60,
	"user"               => "nobody",
	"defaultContentType" => "application/json",
	//"deflateMinimumLength" => 0,
];

$plivo = new \Plivo\RestAPI( $auth_id, $auth_token );
unset( $auth_id );
unset( $auth_token );
/* --- http://localhost:1337/ ------------------------------------------------------------------- */

function PlaceCall( $from, $left, $right ) {
	$params = [
		'to'         => "$left<$right",
		'from'       => $from,
		'answer_url' => 'somewhere.com/'
	];
}

$router = router()
	->get( "/", function ( Request $req, Response $res ) {
		$res->end( "<html><body><h1>Hello, world. yo...</h1></body></html>" );
	} );

$websocket = websocket( new class implements Aerys\Websocket {
	/**
	 * @var Websocket\Endpoint;
	 */
	private $endpoint;
	private $connection = [];
	private $watchers = [];

	public function __construct() {
		global $conn;
		$p = Amp\coroutine( 'prep' )();
	}

	/**
	 * Cleans a phone number
	 *
	 * @param $phone string The phone number to clean
	 *
	 * @return string The clean phone number
	 */
	private function cleanPhone( string $phone ): string {
		return preg_replace( '/\D+/', '', $phone );
	}

	/**
	 * Takes money from people
	 *
	 * @param string $userId The user's id
	 * @param string $payToken The payment token from the request
	 * @param int $packageId The package to purchase
	 *
	 * @return bool Whether or not the charge was successful
	 */
	private function pay( $userId, $payToken, $packageId, $clientId ) {
		global $conn;
		//todo: make these not hard coded
		$packages = [
			1 => [
				'cost'        => 100,
				'description' => '1 life',
				'lives'       => 1
			],
			2 => [
				'cost'        => 300,
				'description' => '3 lives',
				'lives'       => 3
			],
			3 => [
				'cost'        => 2000,
				'description' => '25 lives',
				'lives'       => 25
			]
		];

		$package = $packages[ $packageId ];

		$attempt = r\uuid()->run( $conn );

		$payment = [
			'amount'      => $package['cost'],
			'currency'    => 'usd',
			'source'      => $payToken['id'],
			'description' => $package['description'],
			'metadata'    => [
				'user_id'    => $userId,
				'attempt_id' => $attempt
			]
		];

		Stripe\Stripe::setApiKey( STRIPE_KEY );

		event( [
			'type'        => 'payment_attempt',
			'amount'      => $package['cost'],
			'currency'    => 'usd',
			'source'      => $payToken['id'],
			'description' => $package['description'],
			'user_id'     => $userId,
			'attempt_id'  => $attempt,
			'request'     => $this->connection[ $clientId ]
		] );

		try {
			$charge = Stripe\Charge::create( $payment );

			// breaks for good reasons
			if ( $charge->outcome->risk_level == 'elevated' ) {
				$this->notify( $clientId, 'Please try a different card', 'Payment Failed' );
				event( [
					'type'       => 'payment_fraud',
					'data'       => json_decode( json_encode( $charge ) ),
					'attempt_id' => $attempt,
					'user_id'    => $userId
				] );

				return false;
			}

			if ( $charge->amount === $payment['amount'] ) {
				echo "Increasing ${userId} lives by ${package['lives']}\n";
				// update the user object
				r\db( DB_NAME )->table( 'users' )->get( $userId )->update( [
					'lives' => r\row( 'lives' )->add( $package['lives'] )->rDefault( 0 )
				] )->run( $conn );

				event( [
					'type'       => 'payment_success',
					'data'       => json_decode( json_encode( $charge ) ),
					'attempt_id' => $attempt,
					'user_id'    => $userId
				] );

				return true;
			} else if ( $charge->captured ) {
				echo "$userId charge was partial, refunding\n";
				event( [
					'type'       => 'payment_partial',
					'data'       => json_decode( json_encode( $charge ) ),
					'attempt_id' => $attempt,
					'user_id'    => $userId
				] );
				//todo: refund & fail;
			} else {
				echo "$userId charge failed\n";
				event( [
					'type'       => 'payment_failure',
					'data'       => json_decode( json_encode( $charge ) ),
					'attempt_id' => $attempt,
					'user_id'    => $userId
				] );
				//todo: fail
			}
		} catch ( Exception $exception ) {
			//todo: fail
			echo "$userId Charge failed for reason: (${payToken})\n";
			echo $exception->getMessage() . "\n";
			event( [
				'type'       => 'payment_exception',
				'data'       => $exception->getMessage(),
				'attempt_id' => $attempt,
				'user_id'    => $userId
			] );
		}

		return false;
	}

	private function getRank( $phone ) {
		global $conn;
		$phone = $this->cleanPhone( $phone );
		$rank  = r\db( DB_NAME )
			->table( 'events' )
			->filter( [
				'type' => 'increase_score',
			] )
			->group( 'player' )
			->map( function ( $row ) {
				return $row( 'amount' );
			} )
			->ungroup()
			->map( function ( $res ) {
				return r\expr( [
					'player' => $res( 'group' ),
					'score'  => $res( 'reduction' )->sum()
				] );
			} )
			->orderBy( r\desc( 'score' ) )
			->offsetsOf( function ( $row ) use ( $phone ) {
				return $row( 'player' )->eq( $phone );
			} )->run( $conn )->toArray();

		if ( empty( $rank ) ) {
			return 'not ranked';
		}

		return $rank[0];
	}

	private function getLeaderboard() {
		global $conn;
		$lastDay = r\db( DB_NAME )
			->table( 'events' )
			->filter( [ 'type' => 'increase_score' ] )
			->group( 'player' )
			->map( function ( $row ) {
				return $row( 'amount' );
			} )
			->ungroup()
			->map( function ( $res ) {
				return r\expr( [
					'player_prefix' => $res( 'group' )->slice( 1, 4 ),
					'player_suffix' => $res( 'group' )->slice( - 4 ),
					'score'         => $res( 'reduction' )->sum()
				] );
			} )
			->orderBy( r\desc( 'score' ) )
			->limit( 10 )->run( $conn )->toArray();

		$allTime = r\db( DB_NAME )
			->table( 'events' )
			->filter( [ 'type' => 'increase_score' ] )
			->group( 'player' )
			->map( function ( $row ) {
				return $row( 'amount' );
			} )
			->ungroup()
			->map( function ( $res ) {
				return r\expr( [
					'player_prefix' => $res( 'group' )->slice( 1, 4 ),
					'player_suffix' => $res( 'group' )->slice( - 4 ),
					'score'         => $res( 'reduction' )->sum()
				] );
			} )
			->orderBy( r\desc( 'score' ) )
			->limit( 10 )->run( $conn )->toArray();

		return [
			'lastDay' => $lastDay,
			'allTime' => $allTime
		];
	}

	/**
	 * Notify the client of some event
	 *
	 * @param int $clientId The client id
	 * @param string $message The message to send
	 */
	private function notify( int $clientId, string $message, string $title = "", string $level = "info", string $position = "tc" ): void {
		$this->send( $clientId, json_encode( [
			'type'         => 'notification',
			'notification' => [
				'title'    => $title,
				'message'  => $message,
				'level'    => $level,
				'position' => $position
			]
		] ) );
	}

	/**
	 * Called when a websocket first connects
	 *
	 * @param Websocket\Endpoint $endpoint
	 */
	public function onStart( Websocket\Endpoint $endpoint ) {
		$this->endpoint = $endpoint;
	}

	public function onHandshake( Request $request, Response $response ) {
		/* check origin header here */

		return $request->getConnectionInfo();
	}

	public function onOpen( int $clientId, $handshakeData ) {
		$this->connection[ $clientId ] = $handshakeData;
	}

	private function send( $clientId, $data ) {
		$this->endpoint->send( $data, $clientId );
	}

	public function onData( int $clientId, Websocket\Message $msg ) {
		global $plivo, $conn;
		$request = json_decode( yield $msg, true );
		if ( isset( $request['token'] ) && isset( $request['userId'] ) ) {
			$user = new Model\User( $request['userId'], $conn, $plivo );
			yield from $user->Load();
			if ( $user->GetActiveToken() === $request['token'] ) {
				if ( ! isset($this->watchers[ $clientId ]) ) {
					$id                          = Amp\repeat( function ( $watcherId, $data ) {
						global $conn, $plivo;
						$user = new Model\User( $data['user'], $conn, $plivo );
						yield from $user->Load();
						$this->send( $data['clientId'], json_encode( $user->GetPlayerInfo() ) );
						unset ( $user );
					}, 5000, [ 'cb_data' => [ 'user' => $request['userId'], 'clientId' => $clientId ] ] );
					$this->watchers[ $clientId ] = $id;
				}

				switch ( $request['command'] ) {
					case 'refresh':
						$this->send( $clientId, json_encode( $user->GetPlayerInfo() ) );
						break;
					case 'pay':
						yield from $user->DoPurchase( $request['payToken'], $request['packageId'] );
						yield from $user->Store();
						$this->send( $clientId, json_encode( $user->GetPlayerInfo() ) );
						break;
				}
			} else {
				$this->send( $clientId, json_encode( [ 'type' => 'logout' ] ) );
			}

			unset( $user );
			/*if ( $this->isVerified( $request['token']['userId'], $clientId, $request['token'] ) ) {
				switch ( $request['command'] ) {
					case 'logout':
						$this->invalidate( $request['token'] );
						break;
					case 'refresh':
						$this->send( $clientId, json_encode( $this->getPlayerInfo( $request['token']['userId'] ) ) );
						break;
					case 'pay':
						$userId = $request['token']['userId'];
						echo "Preparing to accept payment from $userId for ${request['packageId']}\n";
						if ( $this->pay( $request['token']['userId'], $request['payToken'], $request['packageId'], $clientId ) ) {
							$this->send( $clientId, json_encode( $this->getPlayerInfo( $request['token']['userId'] ) ) );
						}
						break;
				}
			} else {
				echo "Not verified\n";
				$this->send( $clientId, json_encode( [ 'type' => 'logout' ] ) );
			}*/
		} else {
			switch ( $request['command'] ) {
				case 'login':
					$user = new Model\User( $request['phone'], $conn, $plivo );
					yield from $user->Load();
					yield from $user->DoLogin( $request['phone'], $this->connection[ $clientId ] );
					//yield from $user->Store();

					$this->send( $clientId, json_encode( [
						'type'  => 'logging_in',
						'phone' => $user->Id()
					] ) );

					unset( $user );
					break;
				case 'verify':
					$user = new Model\User( $request['phone'], $conn, $plivo );
					yield from $user->Load();
					yield from $user->DoVerify( $request['phone'], $request['password'] );
					yield from $user->Store();
					$token = $user->GetActiveToken( $request['password'] );
					if ( $token ) {
						$this->send( $clientId, json_encode( [
							'type'   => 'token',
							'userId' => $user->Id(),
							'token'  => $token
						] ) );
						$this->send( $clientId, json_encode( $user->GetPlayerInfo() ) );
					} else {
						$this->notify( $clientId, "Please check your sms messages", "Invalid password" );
					}
					unset( $user );
					break;
				case 'connect':
					acquire( $request['campaign'] );
					break;
			}
		}
	}

	public function onClose( int $clientId, int $code, string $reason ) {
		if ( $this->watchers[ $clientId ] ) {
			Amp\cancel( $this->watchers[ $clientId ] );
		}
	}

	public function onStop() {

	}
} );

$router->get( "/ws", $websocket );

// If none of our routes match try to serve a static file
//$root = root( $docrootPath = __DIR__ );

// If no static files match fallback to this
$fallback = function ( Request $req, Response $res ) {
	$res->end( "<html><body><h1>I don't know! \o/</h1></body></html>" );
};

( new Host )->expose( "*", 1337 )->use( $router )->use( $fallback );
