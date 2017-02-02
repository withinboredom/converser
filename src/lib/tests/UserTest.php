<?php

use PHPUnit\Framework\TestCase;

require 'user.php';

class UserTest extends TestCase {
	public function testCreate() {
		$mockConn = $this->createMock(r\Connection::class);
		$mockConn->method('run')->will($this->onConsecutiveCalls([]));
		$mockPlivo = $this->createMock(Plivo\RestAPI::class);
		$user = new \Model\User('19102974810', $mockConn, $mockPlivo);
		$this->assertEquals('19102974810', $user->Id(), 'id matches');
	}

	public function testLogin() {
		$mockConn = $this->createMock(r\Connection::class);
		$mockConn->method('run')->will($this->onConsecutiveCalls([]));
		$mockPlivo = $this->createMock(Plivo\RestAPI::class);
		$user = new \Model\User('19102974810', $mockConn, $mockPlivo);
		$user->DoLogin('19102974180', '127.0.0.1');
	}
}