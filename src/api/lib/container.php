<?php

namespace Model;

use r;
use Plivo;

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
	 * @var r\Queries\Dbs\Db
	 */
	public $R;

	/**
	 * @var r\Connection
	 */
	public $conn;

	/**
	 * @var Plivo\RestAPI
	 */
	public $plivo;


	public $uuid;

	/**
	 * @var Stripe\Charge
	 */
	public $charge;

	/**
	 * @var iStore
	 */
	public $storage;
}