<?php

namespace Model;

use r;
use Stripe;

require_once 'actor.php';

class Payment extends Actor {

	private $buckets;

	public function __construct( $id, Container $conn ) {
		parent::__construct( $id, $conn );

		$this->buckets = [
			'packages' => [
				1 => [
					'cost'        => 136,
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
				],
				4 => [
					'cost'        => 200,
					'description' => '1 life',
					'lives'       => 1
				],
				5 => [
					'cost'        => 600,
					'description' => '3 lives',
					'lives'       => 3
				],
				6 => [
					'cost'        => 3500,
					'description' => '25 lives',
					'lives'       => 25
				]
			]
		];
	}

	public function DoPay( $userId, $payToken, $packageId ) {
		$package = $this->buckets['packages'][ $packageId ];
		$attempt = yield $this->container->uuid->run( $this->conn );
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

		$data = [
			'amount'      => $package['cost'],
			'currency'    => 'usd',
			'source'      => $payToken['id'],
			'description' => $package['description'],
			'package'     => $packageId,
			'user_id'     => $userId,
			'attempt_id'  => $attempt,
			'payment'     => $payment
		];

		$this->Fire( 'payment_attempt', $data );

		$this->state['payment_status'] = 'attempt';
		$this->state['attempt_id']     = $attempt;
		$this->state['package_id']     = $packageId;
		$this->state['amount']         = $package['cost'];

		try {
			$stripe = $this->container->charge;
			$charge = $stripe::create( $payment );

			// breaks for good reasons
			if ( $charge->outcome->risk_level == 'elevated' ) {
				//$this->notify( $clientId, 'Please try a different card', 'Payment Failed' );
				$this->Fire( 'payment_fraud', [
					'data'       => json_decode( json_encode( $charge ) ),
					'attempt_id' => $attempt,
					'user_id'    => $userId
				] );
			}

			if ( $charge->amount === $payment['amount'] ) {
				$this->Fire( 'payment_success', [
					'data'       => json_decode( json_encode( $charge ) ),
					'attempt_id' => $data['attempt_id'],
					'user_id'    => $data['user_id'],
					'package_id' => $data['package'],
					'lives'      => $package['lives'],
					'amount'     => $payment['amount']
				] );
			} else if ( $charge->captured ) {
				$this->Fire( 'payment_partial', [
					'data'       => json_decode( json_encode( $charge ) ),
					'attempt_id' => $data['attempt_id'],
					'user_id'    => $data['user_id'],
					'package_id' => $data['package']
				] );
			} else {
				$this->Fire( 'payment_failed', [
					'data'       => json_decode( json_encode( $charge ) ),
					'attempt_id' => $data['attempt_id'],
					'user_id'    => $data['user_id'],
					'package_id' => $data['package']
				] );
			}
		} catch ( \Exception $exception ) {
			$this->Fire( 'payment_exception', [
				'data'       => $exception->getMessage(),
				'attempt_id' => $data['attempt_id'],
				'user_id'    => $data['user_id'],
				'package_id' => $data['package']
			] );
		}
	}

	protected function payment_attempt() {
		$this->state['total_lives'] = isset( $this->state['total_lives'] )
			? $this->state['total_lives']
			: 0;
	}

	protected function payment_fraud() {
		$this->state['payment_status'] = 'too_risky';
	}

	protected function payment_success( $data ) {
		$this->state['payment_status'] = 'success';
		$this->state['amount']         = $data['amount'];
		if ( ! isset( $this->state['total_lives'] ) ) {
			$this->state['total_lives'] = 0;
		}
		$this->state['total_lives'] += $data['lives'];
	}

	protected function payment_partial() {
		$this->state['payment_status'] = 'partial_success';
	}

	protected function payment_failed() {
		$this->state['payment_status'] = 'failed';
	}

	protected function payment_exception() {
		$this->state['payment_status'] = 'exception';
	}

	public function GetLives() {
		return $this->state['total_lives'];
	}

	public function GetAmount() {
		return $this->state['amount'];
	}

	/**
	 * Projects the current state
	 */
	protected function Project() {
		$this->container->R
			->table( 'payments' )
			->get( $this->Id() )
			->replace( [
				'id'             => $this->Id(),
				'payment_status' => $this->state['payment_status'],
				'attempt_id'     => $this->state['attempt_id'],
				'package_id'     => $this->state['package_id'],
				'amount'         => $this->state['amount']
			] )
			->run( $this->conn );
	}
}