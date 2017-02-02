<?php

namespace Model\Test;

require_once 'framework.php';
require_once 'lib/user.php';

define( 'CALL', 'CALL' );

( new Given( 'An Initial Login', 'Model\User', [] ) )
	->When( 'DoLogin', '910297', '123' )
	->Then( [
		'zombie'        => [
			'phone' => '910297',
			'at'    => ofType( 'DateTime' )
		],
		'readied'       => [
			'id'       => 'uuid',
			'phone'    => '910297',
			'password' => ofType( 'string' ),
			'ip'       => 123,
			'at'       => ofType( 'DateTime' )
		],
		'password_text' => [
			'text' => ofType( 'string' )
		]
	] );

( new Given( 'A Text from a non-user', 'Model\User', [] ) )
	->When( 'DoRecordSms', 'from', 'to', 'text' )
	->Then( [
		'received_message' => [
			'from' => 'from',
			'to'   => 'to',
			'text' => 'text'
		],
		'sent_message'     => [
			'text' => ofType( 'string' )
		],
		'zombie'           => [
			'phone' => 'from',
			'at'    => ofType( 'DateTime' )
		]
	] );

( new Given( 'A text from an existing user', 'Model\User', [
	'zombie' => [
		'phone' => 'from',
		'at'    => new \DateTime()
	]
] ) )->When( 'DoRecordSms', 'from', 'to', 'text' )
     ->Then( [
	     'received_message' => [
		     'from' => 'from',
		     'to'   => 'to',
		     'text' => 'text'
	     ],
	     'sent_message'     => [
		     'text' => ofType( 'string' )
	     ]
     ] );

( new Given( 'Login Verification (2nd step)', 'Model\User', [
	'zombie'        => [
		'phone' => '910297',
		'at'    => new \DateTime()
	],
	'readied'       => [
		'id'       => 'uuid',
		'phone'    => 'phone',
		'password' => 'password',
		'ip'       => 123,
		'at'       => new \DateTime()
	],
	'password_text' => [
		'text' => 'text'
	]
] ) )
	->When( 'DoVerify', 'phone', 'password' )
	->Then( [
		'set_active_session' => [
			'id'    => 'uuid',
			'token' => 'uuid'
		]
	] );

$loggedInUser = [
	'zombie'        => [
		'phone' => '910297',
		'at'    => new \DateTime()
	],
	'readied'       => [
		'id'       => 'uuid',
		'phone'    => 'phone',
		'password' => 'password',
		'ip'       => 123,
		'at'       => new \DateTime()
	],
	'password_text' => [
		'text' => 'text'
	],
	'set_active_session' => [
		'id'    => 'uuid',
		'token' => 'uuid'
	]
];

(new Given('A logged in user makes a payment', 'Model\User', $loggedInUser))
	->When('DoPurchase', [
		'id' => 'payToken'
	], 1)
	->Then([
		'attempt_payment' => [
			'paymentToken' => [
				'id' => 'payToken'
			],
			'packageId' => 1,
			'paymentId' => 'uuid'
		],
		'set_lives' => [
			'lives' => 1,
			'payment_for_lives' => 1,
			'from_payment' => 'uuid',
			'amount_paid' => 136
		]
	]);