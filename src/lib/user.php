<?php

namespace Model;

use r;

require_once 'actor.php';

class User extends Actor {
	public function __construct( $id, r\Connection $conn ) {
		parent::__construct( $id, $conn );
	}

	public static function cleanPhone( $phone ) {
		return preg_replace( '/\D+/', '', $phone );
	}

	public static function oneTimeCode() {
		$number = '' . random_int( 1, 9 );
		for ( $i = 0; $i < 4; $i ++ ) {
			$number .= random_int( 0, 9 );
		}

		return $number;
	}

	/**
	 * This event brings a user to life as a 'zombie', a non-paying, non-playing user
	 * @param $data array
	 */
	protected function zombie($data) {
		$this->state = [
			'phone' => $data['phone'],
			'lives' => 0,
			'status' => 'not-playing',
			'opponent' => 'null',
			'score' => '0',
			'created' => new \DateTime('now'),
			'sessions' => []
		];
	}

	/**
	 * This event means a user is ready to verify!
	 * @param $data array
	 */
	protected function readied($data) {
		$this->state['sessions'][] = [
			'phone' => $data['phone'],
			'ip' => $data['ip']
		];
	}

	public function DoLogin( $phone, $ip ) {
		$phone    = self::cleanPhone( $phone );
		$password = self::oneTimeCode();
		if ( ! isset( $this->state['status'] ) ) {
			$this->Fire('zombie', [ 'phone' => $phone ]);
		}
		$this->Fire('readied', [
			'password' => $password,
			'ip' => $ip
		]);
		// todo: send text
		echo "Would have sent text here";
	}
}