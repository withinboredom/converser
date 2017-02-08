<?php

require_once 'lib/user.php';
require_once 'lib/container.php';
require_once 'lib/rqlStorage.php';
require_once 'config.php';
require_once 'migrations.php';

use Aerys\{
	Host, Request, Response, Router, Websocket, function root, function router, function websocket
};

/* --- http://localhost:1337/ ------------------------------------------------------------------- */

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

	/**
	 * @var Model\Container
	 */
	private $container;

	public function __construct() {
		global $container;
		$p = Amp\coroutine( 'prep' )();
		$this->container = $container;
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
		$request = json_decode( yield $msg, true );
		if ( isset( $request['token'] ) && isset( $request['userId'] ) ) {
			$user = new Model\User( $request['userId'], $this->container );
			yield from $user->Load();
			if ( $user->GetActiveToken() === $request['token'] ) {
				if ( ! isset( $this->watchers[ $clientId ] ) ) {
					$id                          = Amp\repeat( function ( $watcherId, $data ) {
						$user = new Model\User( $data['user'], $this->container );
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
		} else {
			switch ( $request['command'] ) {
				case 'login':
					$user = new Model\User( $request['phone'], $this->container );
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
					$user = new Model\User( $request['phone'], $this->container );
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
					//acquire( $request['campaign'] );
					break;
			}
		}
	}

	public function onClose( int $clientId, int $code, string $reason ) {
		if ( isset($this->watchers[ $clientId ]) ) {
			Amp\cancel( $this->watchers[ $clientId ] );
		}
	}

	public function onStop() {

	}
} );

$router->get( "/ws", $websocket );

$router->get( "/sms", function ( Aerys\Request $request, Aerys\Response $response, $args ) {
	global $container;
	$from = $request->getParam( 'From' );
	$to   = $request->getParam( 'To' );
	$text = $request->getParam( 'Text' );

	$response->end( "" );

	$user = new \Model\User( $from, $container );
	yield from $user->Load();
	yield $user->DoRecordSms( $from, $to, $text );
} );

$router->get( "/call", function ( Aerys\Request $request, Aerys\Response $response, $args ) {

} );

$router->get( "/health", function ( Aerys\Request $request, Aerys\Response $response ) {
	global $conn;
	// determine the health of this node
	$code    = 200;
	$message = "I'm OK!";
	if ( ! $conn->isOpen() ) {
		$code    = 500;
		$message = "I can't see!";
	}
	$response->setStatus( $code );
	$response->end( $message );
} );

// If none of our routes match try to serve a static file
//$root = root( $docrootPath = __DIR__ );

// If no static files match fallback to this
$fallback = function ( Request $req, Response $res ) {
	$res->end( "{\"hello\": \"I don't know! \\o/\"}" );
};

( new Host )->expose( "*", 1337 )->use( $router )->use( $fallback );
