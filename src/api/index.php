<?php

use Aerys\{ Host, Request, Response, Router, Websocket, function root, function router, function websocket };

function prep() {
	$conn = r\connect('rethunk');
	$dbs = r\dbList()->run($conn);
	$filtered = array_filter($dbs, function($db) {
		return $db == 'converser';
	});
	if (count($filtered) == 0) {
		try {
			r\dbCreate( 'converser' )->run( $conn );
			$db = r\db( 'converser' );
			$db->tableCreate( 'users' )->run( $conn );
			$db->tableCreate( 'calls' )->run( $conn );
			$db->tableCreate( 'sessions' )->run( $conn );
			$db->table('users')->indexCreate('phone');
			$db->table('sessions')->indexCreate('phone');
			$db->table('sessions')->indexCreate('token');
			$db->table('sessions')->indexCreate('user_id');
			$db->table( 'users' )->insert( [
				'phone' => '19102974810',
				'admin' => true,
				'lives' => 1000,
				'score' => 0,
				'status' => 'not-playing'
			] )->run( $conn );
		}
		catch (Exception $exception) {
			// nothing to do here
		}
	}
	return $conn;
}
global $plivo;
global $conn;

$conn = prep();

/* --- Global server options -------------------------------------------------------------------- */

const AERYS_OPTIONS = [
	"keepAliveTimeout" => 60,
	"user" => "nobody",
	"defaultContentType" => "application/json",
	//"deflateMinimumLength" => 0,
];

$auth_id = "MAMDYZMZRKN2IYMDC0MT";
$auth_token = "NjlmOGI1YzlkZGJiMzQ1Y2E0MGNmNWVjZmE5MDM0";
$plivo = new \Plivo\RestAPI($auth_id, $auth_token);
unset($auth_id);
unset($auth_token);

/* --- http://localhost:1337/ ------------------------------------------------------------------- */

$router = router()
	->get("/", function(Request $req, Response $res) {
		$res->end("<html><body><h1>Hello, world. yo...</h1></body></html>");
	});

$websocket = websocket(new class implements Aerys\Websocket {
	/**
	 * @var Websocket\Endpoint;
	 */
	private $endpoint;
	private $stopRefresher;

	/**
	 * Generates a one-time code for logging in
	 * @return string The code
	 */
	private function generateOneTimeCode() : string {
		$number = '' . random_int(1, 9);
		for($i = 0; $i < 4; $i++) {
			$number .= random_int(0, 9);
		}

		return $number;
	}

	/**
	 * Gets or creates a user given a phone number
	 * @param $phone string The phone number
	 * @return array The user object (may or may not contain a user id
	 */
	private function getOrCreateUser(string $phone) {
		global $conn;
		$user = r\db('converser')->table('users')->filter(['phone' => $phone])->limit(1)->run($conn)->toArray();
		if (count($user) == 1) {
			return $user[0];
		}

		$user = [
			'phone' => $phone,
			'lives' => 0,
			'status' => 'not-playing',
			'opponent' => null,
			'score' => 0
		];

		echo "Created new user for $phone\n";

		r\db('converser')->table('users')->insert($user)->run($conn);
		return $user;
	}

	/**
	 * Creates a session for a user, which still requires verification
	 * @param $phone string The phone number to create the session for
	 * @param $client int The client id
	 * @param $password string The password to use to create the session
	 */
	private function createSession(string $phone, int $client, string $password) {
		global $conn;
		$user = $this->getOrCreateUser($phone);
		$session = [
			'user_id' => $user['id'],
			'clientId' => $client,
			'password' => $password,
			'verified' => false,
			'valid' => true
		];
		echo "Created new session for with password: $password\n";
		r\db('converser')->table('sessions')->insert($session)->run($conn);
	}

	/**
	 * Verifies a session for use, completing the login process
	 * @param $client int The client id
	 * @param $password string The password
	 *
	 * @return bool|string false if verification wasn't successful, otherwise the auth token
	 */
	private function verifySession(int $client, string $password) {
		global $conn;
		$sessions = r\db('converser')->table('sessions')->filter([
			'clientId' => $client,
			'password' => $password,
			'verified' => false
		])->limit(1)->run($conn);

		$sessions = $sessions->toArray();

		foreach($sessions as $session) {
			$token = r\uuid($client . $password)->run($conn);
			r\db('converser')->table('sessions')->filter([
				'clientId' => $client,
				'password' => $password,
				'verified' => false
			])->limit(1)->update(['verified' => true, 'token' => $token])->run($conn);
			return $token;
		}

		return false;
	}

	/**
	 * Cleans a phone number
	 * @param $phone string The phone number to clean
	 * @return string The clean phone number
	 */
	private function cleanPhone(string $phone) : string {
		return preg_replace('/\D+/', '', $phone);
	}

	/**
	 * Verifies a request's session
	 * @param string $userID The user id
	 * @param int $client The client id
	 * @param string $token The token from the request
	 *
	 * @return bool Whether the session is valid
	 */
	private function isVerified($userID, $client, $token = false) : bool {
		global $conn;
		$check = [
			'user_id' => $userID,
			'verified' => true,
			'valid' => true,
			'token' => $token['token']
		];

		$session = r\db('converser')->table('sessions')->filter($check)->limit(1)->run($conn);
		foreach($session as $sess) {
			return true;
		}
		return false;
	}

	/**
	 * Invalidates a token
	 * @param string $token The token to invalidate
	 */
	private function invalidate($token) : void {
		global $conn;
		r\db('converser')->table('sessions')->filter(['token' => $token])->update([
			'valid' => false
		])->run($conn);
	}

	/**
	 * Get a player's information
	 * @param string $userId The user's id
	 *
	 * @return array The player information
	 */
	private function getPlayerInfo($userId) {
		global $conn;
		echo "Refreshing $userId\n";
		$user = r\db('converser')->table('users')->get($userId)->run($conn);
		$display = [
			'type'  => 'user',
			'lives' => $user['lives'],
			'score' => $user['score'],
			'status' => $user['status'],
			'opponent' => $user['opponent']
		];

		return $display;
	}

	/**
	 * Takes money from people
	 * @param string $userId The user's id
	 * @param string $payToken The payment token from the request
	 * @param int $packageId The package to purchase
	 *
	 * @return bool Whether or not the charge was successful
	 */
	private function pay($userId, $payToken, $packageId) {
		global $conn;
		//todo: make these not hard coded
		$packages = [
			1 => [
				'cost' => 100,
				'description' => '1 life',
				'lives' => 1
			],
			2 => [
				'cost' => 300,
				'description' => '3 lives',
				'lives' => 3
			],
			3 => [
				'cost' => 2000,
				'description' => '25 lives',
				'lives' => 25
			]
		];

		$package = $packages[$packageId];

		$payment = [
			'amount' => $package['cost'],
			'currency' => 'usd',
			'source' => $payToken['id'],
			'description' => $package['description'],
			'metadata' => [
				'userId' => $userId
			]
		];

		Stripe\Stripe::setApiKey('sk_test_osM11tRI7n2u8cChs2J3R4kx');

		try {
			$charge = Stripe\Charge::create($payment);
			if ($charge->amount === $payment['amount']) {
				echo "Increasing ${userId} lives by ${package['lives']}\n";
				// update the user object
				r\db('converser')->table('users')->get($userId)->update([
					'lives' => r\row('lives')->add($package['lives'])->rDefault(0)
				])->run($conn);
				return true;
			} else if ($charge->captured) {
				echo "$userId charge was partial, refunding\n";
				//todo: refund & fail;
			}
			else {
				echo "$userId charge failed\n";
				//todo: fail
			}
		}
		catch(Exception $exception) {
			//todo: fail
			echo "$userId Charge failed for reason: (${payToken})\n";
			echo $exception->getMessage() . "\n";
		}

		return false;
	}

	/**
	 * Notify the client of some event
	 * @param int $clientId The client id
	 * @param string $message The message to send
	 */
	private function notify(int $clientId, string $message) : void {
		$this->endpoint->send($clientId, json_encode([
			'type' => 'notification',
			'message' => $message
		]));
	}

	public function autoRefresh($clientId, $userId) {
		global $conn;
		echo "Waiting for changes\n";
		$changes = r\db('converser')->table('users')->get($userId)->changes()->run($conn);
		echo "Pusher installed\n";
		\Amp\repeat(function($watcherId) use ($clientId, $userId, $changes) {
			$sent = false;

			echo "Looking for changes for $userId\n";

			$client = array_filter($this->endpoint->getClients(), function($item) use ($clientId) {
				return $clientId == $item;
			});

			if (count($client) == 0) {
				echo "No longer sending changes to $userId\n";
				Amp\cancel($watcherId);
				return;
			}

			foreach($changes as $change) {
				if (!$sent) {
					echo "Sent changes to $userId\n";
					$this->endpoint->send( $clientId, json_encode( $this->getPlayerInfo( $userId ) ) );
					$sent = true;
				}
			}
		}, 1000);
	}

	/**
	 * Called when a websocket first connects
	 * @param Websocket\Endpoint $endpoint
	 */
	public function onStart(Websocket\Endpoint $endpoint) {
		$this->endpoint = $endpoint;
	}

	public function onHandshake(Request $request, Response $response) {
		/* check origin header here */
	}

	public function onOpen(int $clientId, $handshakeData) {

	}

	public function onData(int $clientId, Websocket\Message $msg) {
		global $plivo, $conn;
		$request = json_decode(yield $msg, true);
		if ($request['token']) {
			if ($this->isVerified($request['token']['userId'], $clientId, $request['token'])) {
				$this->autoRefresh($clientId, $request['token']['userId']);
				switch ( $request['command'] ) {
					case 'logout':
						$this->invalidate( $request['token'] );
						break;
					case 'refresh':
						$this->endpoint->send( $clientId, json_encode( $this->getPlayerInfo( $request['token']['userId'] ) ) );
						break;
					case 'pay':
						$userId = $request['token']['userId'];
						echo "Preparing to accept payment from $userId for ${request['packageId']}\n";
						if ( $this->pay( $request['token']['userId'], $request['payToken'], $request['packageId'] ) ) {
							$this->endpoint->send( $clientId, json_encode( $this->getPlayerInfo( $request['token']['userId'] ) ) );
						}
						break;
				}
			}
			else {
				echo "Not verified\n";
			}
		}
		else {
			switch($request['command']) {
				case 'login':
					$phone = $this->cleanPhone($request['phone']);
					print "Logging $clientId in with $phone\n";
					$this->endpoint->send($clientId, json_encode([
						'type' => 'logging_in',
						'phone' => $phone
					]));
					$number = $this->generateOneTimeCode();
					$this->getOrCreateUser($phone);
					$this->createSession($phone, $clientId, $number);
					Amp\immediately(function() use ($plivo, $phone, $number) {
						$plivo->send_message([
							'src' => '18037143889',
							'dst' => $phone,
							'text' => "Your converser login code is ${number}"
						]);
						echo "Notified $phone of password\n";
					});
					break;
				case 'verify':
					echo "Verifying session of $clientId with password ${request['password']}\n";
					$token = $this->verifySession($clientId, $request['password']);
					if ($token !== false) {
						$user = $this->getOrCreateUser( $this->cleanPhone( $request['phone'] ));
						echo "${user['id']} is logged in and verified\n";
						$this->endpoint->send( $clientId, json_encode( [
							'type'   => 'token',
							'userId' => $user['id'],
							'token'  => $token
						] ) );
						$this->endpoint->send( $clientId, json_encode( $this->getPlayerInfo($user['id']) ) );
					}
					break;
			}
		}
	}

	public function onClose(int $clientId, int $code, string $reason) {

	}

	public function onStop() {

	}
});

$router->get("/ws", $websocket);

// If none of our routes match try to serve a static file
$root = root($docrootPath = __DIR__);

// If no static files match fallback to this
$fallback = function(Request $req, Response $res) {
	$res->end("<html><body><h1>I don't know! \o/</h1></body></html>");
};

(new Host)->expose("*", 1337)->use($router)->use($root)->use($fallback);
