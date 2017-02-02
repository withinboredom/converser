<?php

namespace Model;

use r;

/**
 * Class Container
 *
 * A simple container for dependency Injection
 *
 * @package Model
 */
class Container {
	/**
	 * @var r\Queries\Tables\Table
	 */
	public $records;

	/**
	 * @var r\Queries\Tables\Table
	 */
	public $snapshots;

	/**
	 * @var r\Connection
	 */
	public $conn;

	public $plivo;
}