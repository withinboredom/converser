<?php

require_once '../lib/user.php';

use Aerys\{
	Host, Request, Response, Router, Websocket, function root, function router, function websocket
};

define( 'DB_NAME', getenv( 'DB_NAME' ) ?: 'converser' );
define( 'DB_HOST', getenv( 'DB_HOST' ) ?: 'rethunk' );
define( 'SMS', getenv( 'SMS' ) ?: '18037143889' );
define( 'CALL', getenv( 'CALL' ) ?: '18882660156' );
define( 'HOST', getenv( 'CALL_HOST' ) ?: 'http://dev.converser.space:2200/' );

define( 'STRIPE_KEY', getenv( 'STRIPE_KEY' ) ?: 'sk_test_osM11tRI7n2u8cChs2J3R4kx' );

define( 'METRICS_DB', DB_NAME . '_metrics' );

$auth_id    = getenv( 'PLIVO_ID' ) ?: "SANTC0YTLLZTFMMZA3MM";
$auth_token = getenv( 'PLIVO_TOKEN' ) ?: "MzA2M2UyMWViNTI5NjFmZjNjMmJiYmZlNmM5YmZh";

function prep() {
	$conn     = r\connect( DB_HOST );
	$dbs      = r\dbList()->run( $conn );
	$filtered = array_filter( $dbs, function ( $db ) {
		return $db == DB_NAME;
	} );
	if ( count( $filtered ) == 0 ) {
		try {
			r\dbCreate( DB_NAME )->run( $conn );
			$db = r\db( DB_NAME );
			$db->tableCreate( 'users' )->run( $conn );
			$db->tableCreate( 'calls' )->run( $conn );
			$db->tableCreate( 'sessions' )->run( $conn );
			$db->tableCreate( 'events', [ 'durability' => 'soft' ] )->run( $conn );
			$db->tableCreate( 'sms', [ 'durability' => 'soft' ] )->run( $conn );
			$db->tableCreate( 'version' )->run( $conn );
			$db->table( 'users' )->wait()->run( $conn );
			$db->table( 'users' )->indexCreate( 'phone' )->run( $conn );
			$db->table( 'sessions' )->wait()->run( $conn );
			$db->table( 'sessions' )->indexCreate( 'phone' )->run( $conn );
			$db->table( 'sessions' )->indexCreate( 'token' )->run( $conn );
			$db->table( 'sessions' )->indexCreate( 'user_id' )->run( $conn );
			$db->table( 'users' )->insert( [
				'phone'   => '19102974810',
				'admin'   => true,
				'lives'   => 1000,
				'score'   => 0,
				'status'  => 'not-playing',
				'created' => r\now()
			] )->run( $conn );
			$db->table( 'version' )->wait()->run( $conn );
			$db->table( 'version' )->insert( [
				'id'    => 'db',
				'value' => 1
			] )->run( $conn );
		} catch ( Exception $exception ) {
			// nothing to do here
		}
	}

	$expectedVersion = 2;
	$currentVersion  = r\db( DB_NAME )->table( 'version' )->get( 'db' )->run( $conn )['value'];
	// put migrations here
	switch ( $currentVersion ) {
		case 1:
			r\db( DB_NAME )->tableCreate( 'leaderboard' )->run( $conn );
			r\db( DB_NAME )->table( 'leaderboard' )->wait()->run( $conn );
	}

	if ( $currentVersion != $expectedVersion ) {
		r\db( DB_NAME )->table( 'version' )->update( [
			'id'    => 'db',
			'value' => $expectedVersion
		] )->run( $conn );
	}

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
global $conn;

$conn = prep();

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

	/**
	 * Generates a one-time code for logging in
	 * @return string The code
	 */
	private function generateOneTimeCode(): string {
		$number = '' . random_int( 1, 9 );
		for ( $i = 0; $i < 4; $i ++ ) {
			$number .= random_int( 0, 9 );
		}

		return $number;
	}

	/**
	 * Gets or creates a user given a phone number
	 *
	 * @param $phone string The phone number
	 *
	 * @return array The user object (may or may not contain a user id
	 */
	private function getOrCreateUser( string $phone ) {
		global $conn;
		$phone = $this->cleanPhone( $phone );

		$user = r\db( DB_NAME )
			->table( 'users' )
			->filter( [ 'phone' => $phone ] )
			->limit( 1 )
			->run( $conn )->toArray();

		if ( count( $user ) == 1 ) {
			return $user[0];
		}

		$user = [
			'phone'    => $phone,
			'lives'    => 0,
			'status'   => 'not-playing',
			'opponent' => null,
			'score'    => 0,
			'created'  => r\now()
		];

		$data = r\db( DB_NAME )->table( 'users' )->insert( $user )->run( $conn );
		event( [
			'type'  => 'signup',
			'phone' => $phone,
			'data'  => $data
		] );

		return $user;
	}

	/**
	 * Creates a session for a user, which still requires verification
	 *
	 * @param $phone string The phone number to create the session for
	 * @param $client int The client id
	 * @param $password string The password to use to create the session
	 */
	private function createSession( string $phone, int $client, string $password ) {
		global $conn;
		$user = $this->getOrCreateUser( $phone );

		$session = [
			'user_id'  => $user['id'],
			'clientId' => $client,
			'password' => $password,
			'verified' => false,
			'valid'    => true
		];

		echo "Created new session for with password: $password\n";

		$data = r\db( DB_NAME )->table( 'sessions' )->insert( $session )->run( $conn );
		event( [
			'type'          => 'session-created',
			'user_id'       => $user['id'],
			'with_password' => $password,
			'data'          => $data
		] );
	}

	/**
	 * Verifies a session for use, completing the login process
	 *
	 * @param $client int The client id
	 * @param $password string The password
	 *
	 * @return bool|string false if verification wasn't successful, otherwise the auth token
	 */
	private function verifySession( int $client, string $phone, string $password ) {
		global $conn;
		$user = $this->getOrCreateUser( $phone );

		$sessions = r\db( DB_NAME )->table( 'sessions' )->filter( [
			'user_id'  => $user['id'],
			'password' => $password,
			'verified' => false
		] )->limit( 1 )->run( $conn );

		$sessions = $sessions->toArray();

		foreach ( $sessions as $session ) {
			$token = r\uuid( $client . $password )->run( $conn );
			r\db( DB_NAME )->table( 'sessions' )->filter( [
				'user_id'  => $user['id'],
				'password' => $password,
				'verified' => false
			] )->limit( 1 )->update( [ 'verified' => true, 'token' => $token ] )->run( $conn );

			event( [
				'type'    => 'session-verified',
				'user_id' => $user['id']
			] );

			activate( $user['id'], null ); //todo: collect campaign

			return $token;
		}

		event( [
			'type'    => 'session-invalid',
			'user_id' => $user['id']
		] );

		return false;
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
	 * Verifies a request's session
	 *
	 * @param string $userID The user id
	 * @param int $client The client id
	 * @param string $token The token from the request
	 *
	 * @return bool Whether the session is valid
	 */
	private function isVerified( $userID, $client, $token = false ): bool {
		global $conn;
		$check = [
			'user_id'  => $userID,
			'verified' => true,
			'valid'    => true,
			'token'    => $token['token']
		];

		$session = r\db( DB_NAME )->table( 'sessions' )->filter( $check )->limit( 1 )->run( $conn );

		foreach ( $session as $sess ) {
			return true;
		}

		return false;
	}

	/**
	 * Invalidates a token
	 *
	 * @param string $token The token to invalidate
	 */
	private function invalidate( $token ): void {
		global $conn;
		r\db( DB_NAME )->table( 'sessions' )->filter( [ 'token' => $token ] )->update( [
			'valid' => false
		] )->run( $conn );

		event( [
			'type'  => 'invalidated-token',
			'token' => $token
		] );
	}

	/**
	 * Get a player's information
	 *
	 * @param string $userId The user's id
	 *
	 * @return array The player information
	 */
	private function getPlayerInfo( $userId ) {
		global $conn;
		echo "Refreshing $userId\n";
		$user    = r\db( DB_NAME )->table( 'users' )->get( $userId )->run( $conn );
		$display = [
			'type'     => 'user',
			'lives'    => $user['lives'],
			'score'    => $user['score'],
			'status'   => $user['status'],
			'opponent' => $user['opponent']
		];

		return $display;
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

	public function autoRefresh( $clientId, $userId ) {
		global $conn;
		echo "Waiting for changes\n";
		$changes = r\db( DB_NAME )->table( 'users' )->get( $userId )->changes()->run( $conn );
		echo "Pusher installed\n";
		\Amp\repeat( function ( $watcherId ) use ( $clientId, $userId, $changes ) {
			$sent = false;

			echo "Looking for changes for $userId\n";

			$client = array_filter( $this->endpoint->getClients(), function ( $item ) use ( $clientId ) {
				return $clientId == $item;
			} );

			if ( count( $client ) == 0 ) {
				echo "No longer sending changes to $userId\n";
				Amp\cancel( $watcherId );

				return;
			}

			var_dump( $changes->toArray() );
			/*foreach($changes as $change) {
				print_r($change);
				break;
			}*/
		}, 1000 );
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
		if ( $request['token'] ) {
			if ( $this->isVerified( $request['token']['userId'], $clientId, $request['token'] ) ) {
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
			}
		} else {
			switch ( $request['command'] ) {
				case 'login':
					$phone = $this->cleanPhone( $request['phone'] );
					$user = new Model\User($phone, $conn);
					/*print "Logging $clientId in with $phone\n";
					$this->send( $clientId, json_encode( [
						'type'  => 'logging_in',
						'phone' => $phone
					] ) );
					$number = $this->generateOneTimeCode();
					$this->getOrCreateUser( $phone );
					$this->createSession( $phone, $clientId, $number );
					Amp\immediately( function () use ( $plivo, $phone, $number ) {
						$plivo->send_message( [
							'src'  => CALL,
							'dst'  => $phone,
							'text' => "${number} is your Converser login code."
						] );
						echo "Notified $phone of password\n";
					} );*/
					break;
				case 'verify':
					echo "Verifying session of $clientId with password ${request['password']}\n";
					$token = $this->verifySession( $clientId, $request['phone'], $request['password'] );
					if ( $token !== false ) {
						$user = $this->getOrCreateUser( $this->cleanPhone( $request['phone'] ) );
						echo "${user['id']} is logged in and verified\n";
						$this->send( $clientId, json_encode( [
							'type'   => 'token',
							'userId' => $user['id'],
							'token'  => $token
						] ) );
						$this->send( $clientId, json_encode( $this->getPlayerInfo( $user['id'] ) ) );
					}
					break;
				case 'connect':
					acquire( $request['campaign'] );
					break;
			}
		}
	}

	public function onClose( int $clientId, int $code, string $reason ) {

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
