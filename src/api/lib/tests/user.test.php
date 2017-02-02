<?php

namespace Model\Test;

require_once 'framework.php';
require_once 'lib/user.php';

define( 'CALL', 'CALL' );

( new Given( 'Model\User', [] ) )
	->When( 'DoLogin', '910297', '123' )
	->Then( [
		'zombie'        => [
			'phone' => '910297',
			'at'    => ofType( 'DateTime' )
		],
		'readied'       => [
			'id'       => [ 123 ],
			'phone'    => '910297',
			'password' => ofType( 'string' ),
			'ip'       => 123,
			'at'       => ofType( 'DateTime' )
		],
		'password_text' => [
			'text' => ofType( 'string' )
		]
	] );