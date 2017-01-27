<?php

namespace Model;

use r;

require_once 'actor.php';

class User extends Actor {
	/**
	 * @var Plivo\RestAPI The plivo client
	 */
	private $plivo;

	/**
	 * User constructor.
	 *
	 * @param string $id
	 * @param r\Connection $conn
	 * @param $plivo
	 */
	public function __construct( $id, r\Connection $conn, $plivo ) {
		parent::__construct( $id, $conn );

		$this->plivo = $plivo;
	}

	/**
	 * Cleans a string containing a phone number
	 *
	 * @param $phone
	 *
	 * @return mixed
	 */
	public static function cleanPhone( $phone ) {
		return preg_replace( '/\D+/', '', $phone );
	}

	/**
	 * Generates a one time password
	 * @return string
	 */
	public static function oneTimeCode() {
		$number = '' . random_int( 1, 9 );
		for ( $i = 0; $i < 4; $i ++ ) {
			$number .= random_int( 0, 9 );
		}

		return $number;
	}

	/**
	 * This event brings a user to life as a 'zombie', a non-paying, non-playing user
	 *
	 * @param $data array
	 */
	protected function zombie( $data ) {
		$this->state = [
			'phone'    => $data['phone'],
			'lives'    => 0,
			'status'   => 'not-playing',
			'opponent' => 'null',
			'score'    => '0',
			'created'  => $data['at'],
			'sessions' => []
		];
	}

	/**
	 * This event means a user is ready to verify!
	 *
	 * @param $data array
	 */
	protected function readied( $data ) {
		$begins                    = \DateTimeImmutable::createFromMutable( $data['at'] );
		$ends                      = $begins->add( new \DateInterval( 'P1D' ) );
		$this->state['sessions'][] = [
			'id'       => $data['id'],
			'phone'    => $data['phone'],
			'ip'       => $data['ip'],
			'password' => $data['password'],
			'begins'   => $begins,
			'ends'     => $ends,
			'used'     => false
		];
	}

	/**
	 * Sets off the beginning of a login
	 *
	 * @param $phone
	 * @param $ip
	 */
	public function DoLogin( $phone, $ip ) {
		$phone    = self::cleanPhone( $phone );
		$password = self::oneTimeCode();
		if ( ! isset( $this->state['status'] ) ) {
			$this->Fire( 'zombie', [
				'phone' => $phone,
				'at'    => new \DateTime()
			] );
		}
		$this->Fire( 'readied', [
			'id'       => r\uuid()->run( $this->conn ),
			'password' => $password,
			'ip'       => $ip,
			'at'       => new \DateTime()
		] );
		$this->plivo->send_message( [
			'src'  => CALL,
			'dst'  => $phone,
			'text' => "${password} is your Converser login code."
		] );
		$this->Fire( 'password_text', [
			'text' => "${password} is your Converser login code."
		] );
	}

	/**
	 * Projects the current state
	 */
	protected function Project() {
		r\db( DB_NAME )->table( 'users' )->replace( [
			'id'      => $this->Id(),
			'phone'   => $this->state['phone'],
			'lives'   => $this->state['lives'],
			'status'  => $this->state['status'],
			'score'   => $this->state['score'],
			'created' => $this->state['created']
		] )->run( $this->conn );

		foreach ( $this->state['sessions'] as $session ) {
			r\db( DB_NAME )->table( 'sessions' )->replace( $session );
		}
	}
}