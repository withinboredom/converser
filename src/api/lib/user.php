<?php

namespace Model;

use r;
use Amp;
use Plivo;

require_once 'actor.php';
require_once 'payment.php';

class User extends Actor {
	/**
	 * @var Plivo\RestAPI The plivo client
	 */
	private $plivo;

	/**
	 * User constructor.
	 *
	 * @param string $id
	 * @param Container $container
	 * @param $plivo
	 *
	 * @internal param r\Connection $conn
	 */
	public function __construct( $id, Container $container ) {
		$id = self::cleanPhone( $id );
		parent::__construct( $id, $container );

		$this->plivo = $container->plivo;
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
			'score'    => 0,
			'created'  => $data['at'],
			'sessions' => [],
			'payments' => []
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
			'used'     => false,
			'active'   => false
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
			'id'       => yield $this->container->uuid->run( $this->conn ),
			'phone'    => $phone,
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

	protected function set_active_session( $data ) {
		$this->state['sessions'] = array_map( function ( $session ) use ( $data ) {
			if ( $session['id'] === $data['id'] ) {
				$session['used']   = true;
				$session['active'] = true;
				$session['token']  = $data['token'];
			} else {
				$session['active'] = false;
			}

			return $session;
		}, $this->state['sessions'] );
	}

	public function DoVerify( $phone, $password ) {
		$phone   = self::cleanPhone( $phone );
		$now     = new \DateTime();
		$session = array_reduce(
			$this->state['sessions'],
			function ( $carry, $item ) use ( $phone, $password, $now ) {
				if ( empty( $password ) ) {
					return null;
				}

				if (
					$item['password'] === $password
					&& $item['ends'] >= $now
					&& $item['used'] === false
				) {
					return $item;
				}

				return $carry;
			} );

		$token = yield r\uuid( $phone . $password )->run( $this->conn );

		if ( $session ) {
			$this->Fire( 'set_active_session', [
				'id'    => $session['id'],
				'token' => $token
			] );
		}
	}

	public function DoPurchase( $paymentToken, $packageId ) {
		$payment = new Payment( yield r\uuid()->run( $this->conn ), $this->conn );
		yield from $payment->Load();
		yield from $payment->DoPay( $this->Id( true ), $paymentToken, $packageId );
		yield from $payment->Store();

		$this->Fire( 'attempt_payment', [
			'paymentToken' => $paymentToken,
			'packageId'    => $packageId,
			'paymentId'    => $payment->Id()
		] );
	}

	protected function attempt_payment( $data ) {
		$this->state['payments'][] = $data['paymentId'];

		// no need to process the payment domain if we already got it.
		if ( $this->replaying ) {
			return;
		}

		$payment = new Payment( $data['paymentId'], $this->conn );
		$promise = Amp\resolve( $payment->Load() );
		$promise = Amp\pipe( $promise, function ( $result ) use ( $payment ) {
			$lives = $payment->GetLives();
			if ( $lives > 0 ) {
				$this->Fire( 'set_lives', [
					'lives'             => $this->state['lives'] + $lives,
					'payment_for_lives' => $lives,
					'from_payment'      => $payment->Id(),
					'amount_paid'       => $payment->GetAmount()
				] );
			}
		} );

		return $promise;
	}

	protected function set_lives( $data ) {
		$this->state['lives'] = $data['lives'];
	}

	public function GetActiveToken( $password = null ) {
		$activeSession = array_reduce(
			$this->state['sessions'], function ( $carry, $item ) {
			if ( $item['active'] ) {
				return $item;
			}

			return $carry;
		} );

		if ( $password && $activeSession['password'] == $password ) {
			return $activeSession['token'];
		} elseif ( $password ) {
			return null;
		}

		return $activeSession['token'];
	}

	public function GetPlayerInfo() {
		return [
			'type'   => 'user',
			'lives'  => $this->state['lives'],
			'score'  => $this->state['score'],
			'status' => $this->state['status'],
			'userId' => $this->Id()
		];
	}

	public function DoRecordSms( $from, $to, $text ) {
		$response = "Thank you for your message, it has been stored. We will review it and get back to you as soon as possible.";

		$this->plivo->send_message( [
			'src'  => $to,
			'dst'  => $from,
			'text' => $response
		] );

		$this->Fire('received_message', [
			'from' => $from,
			'to' => $to,
			'text' => $text
		]);

		$this->Fire('sent_message', [
			'text' => $response
		]);
	}

	protected function received_message($data) {
		if ( ! isset( $this->state['status'] ) ) {
			$this->Fire( 'zombie', [
				'phone' => $data['from'],
				'at'    => new \DateTime()
			] );
		}
	}

	/**
	 * Projects the current state
	 */
	protected function Project() {
		$this->container->R
			->table( 'users' )
			->get( $this->Id() )
			->replace( [
				'id'       => $this->Id(),
				'phone'    => $this->state['phone'],
				'lives'    => $this->state['lives'],
				'status'   => $this->state['status'],
				'score'    => $this->state['score'],
				'created'  => $this->state['created'],
				'payments' => $this->state['payments']
			] )->run( $this->conn );

		foreach ( $this->state['sessions'] as $session ) {
			$this->container->R
				->table( 'sessions' )
				->get( $session['id'] )
				->replace( $session )
				->run( $this->conn );
		}
	}
}