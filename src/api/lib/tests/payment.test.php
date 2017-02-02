<?php


namespace Model\Test;

require_once 'framework.php';
require_once 'lib/payment.php';

(new Given('A simple Payment', 'Model\Payment'))
	->When('DoPay', '123456789', [ 'id' => 'tokenId' ], 1)
	->Then([
		'payment_attempt' => [
			'amount' => 136,
			'currency' => 'usd',
			'source' => 'tokenId',
			'description' => '1 life',
			'package' => 1,
			'user_id' => '123456789',
			'attempt_id' => 'uuid',
			'payment' => [
				'amount' => 136,
				'currency' => 'usd',
				'source' => 'tokenId',
				'description' => '1 life',
				'metadata' => [
					'user_id' => '123456789',
					'attempt_id' => 'uuid'
				]
			]
		],
		'payment_success' => [
			'data' => ofType('stdClass'),
			'attempt_id' => 'uuid',
			'user_id' => '123456789',
			'package_id' => 1,
			'lives' => 1,
			'amount' => 136
		]
	]);