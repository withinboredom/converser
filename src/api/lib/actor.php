<?php
namespace Model;

require_once 'vendor/autoload.php';

use r, Amp;

/**
 * Class Actor
 *
 * Creates a managed actor
 */
abstract class Actor {

	/**
	 * @var \ArrayObject The records that represent this model
	 */
	private $records = [];

	/**
	 * @var r\Connection The connection to the db
	 */
	protected $conn;

	/**
	 * @var int When to automatically take a snapshot
	 */
	private $optimizeAt = 10;

	/**
	 * @var string The actor id
	 */
	private $id;

	/**
	 * @var int The next version to use when storing an event
	 */
	private $nextVersion = 0;

	/**
	 * @var array List of active 'Amp\Repeaters in use
	 */
	private $repeater = [];

	/**
	 * @var \ArrayObject The current state, which is serialized when taking a snapshot
	 */
	protected $state = [];

	/**
	 * @var bool Whether or not the actor is replaying
	 */
	protected $replaying = false;

	/**
	 * @var array Events to fire off
	 */
	private $firing = [];

	/**
	 * @var null|Amp\Promisor Allow cojoining storages
	 */
	private $storagePromise = null;

	/**
	 * @var r\Queries\Tables\Table
	 */
	private $r;

	/**
	 * @var r\Queries\Tables\Table
	 */
	private $rSnapshots;

	/**
	 * @var Container
	 */
	protected $container;

	/**
	 * Actor constructor.
	 *
	 * @param $id string Id of actor to load
	 * @param Container $container The injection container
	 */
	public function __construct( $id, Container $container ) {
		$this->r          = $container->records;
		$this->rSnapshots = $container->snapshots;
		$this->container  = $container;

		$this->conn = $container->conn;
		$this->id   = get_class( $this ) . '_' . $id;
	}

	/**
	 * Load events and recreate current state
	 *
	 * @param callable|null $callback Calls this function after a completed load
	 *
	 * @return \Generator
	 */
	public function Load( callable $callback = null ) {

		$latestSnapshot = yield $this->container->storage->LoadSnapshot( $this->id );

		if ( $latestSnapshot ) {
			$this->state       = $latestSnapshot['state'];
			$this->nextVersion = $latestSnapshot['version'] + 1;
		} else {
			$latestSnapshot    = [ 'version' => - 1 ];
			$this->nextVersion = 0;
		}

		$this->records = yield $this->container->storage->LoadEvents( $this->id, $latestSnapshot['version'] );

		yield from $this->ReduceEvents();
		if ( $callback ) {
			$callback();
		}
	}

	/**
	 * @param $id
	 * @param $callback
	 *
	 * @return \Generator
	 */
	protected function ListenForId( $id, $callback ) {
		$listener = yield $this->r
			->filter( [ 'model_id' => $id ] )
			->changes( [ 'include_initial' => false, 'squash' => true ] )
			->run( $this->conn );

		foreach ( $listener as $change ) {
			var_dump( $change );
		}
	}


	/**
	 * Projects the current state
	 */
	protected abstract function Project();

	public function __destruct() {
		$this->Close();
	}

	/**
	 * @param callable|null $callback
	 *
	 * @return \Generator
	 */
	public function Store( callable $callback = null ) {
		$this->Close();

		if ( $this->storagePromise ) {
			$result = yield $this->storagePromise->promise();

			return $result;
		}

		$deferred = new Amp\deferred();

		$this->storagePromise = $deferred;

		$this->container->storage->SetProjector( $this->id, function () {
			$this->Project();
		} );
		$this->container->storage->SetSnapshot( $this->id, function() {
			yield from $this->Snapshot();
		} );
		$store = $this->container->storage->Store( $this->id, $this->records, $callback, $deferred );

		yield from $store;

		$result = yield $deferred->promise();

		yield from $this->Load();

		return $result;
	}

	/**
	 * Get's a snapshot of the state
	 */
	public function Snapshot() {
		$copy = new \ArrayObject( $this->state, \ArrayObject::STD_PROP_LIST );
		$copy = $copy->getArrayCopy();

		return $copy;
	}

	/**
	 * Get's the id of the model
	 *
	 * @param bool $raw True to return the raw id
	 *
	 * @return string The current id
	 */
	public function Id( $raw = false ) {
		if ( $raw ) {
			return $this->id;
		}

		return explode( '_', $this->id )[1];
	}

	/**
	 * Close this model for writing
	 */
	public function Close() {
		foreach ( $this->repeater as $watcherId ) {
			Amp\cancel( $watcherId );
		}
	}

	/**
	 * Reduce the events to a stable state
	 */
	private function ReduceEvents() {
		$this->replaying = true;

		$counter = $this->nextVersion - 1;
		//if (!is_array($this->records)) return;
		foreach ( $this->records as $event ) {
			/**
			 * Expecting an array of the keys:
			 * [
			 *  model_id: The id of this actor
			 *  version: The ordinal of the event
			 *  type: event or memo
			 *  name: function to call
			 *  data: parameters to pass on
			 * ]
			 */
			switch ( $event['type'] ) {
				case 'event':
					$func = $event['name'];
					if ( method_exists( $this, $func ) ) {
						yield $this->$func( $event['data'] );
					}
					$counter = $event['version'];
					break;
				case 'memo':
					$this->data = $event['data'];
					$counter    = $event['version'];
					break;
			}
			$this->nextVersion = $counter + 1;
		};

		$this->replaying = false;
	}

	/**
	 * Fires an event
	 *
	 * @param $name string The name of this event
	 * @param $data array The body of the event
	 */
	public function Fire( $name, $data ) {
		$fire = function () {
			if ( $this->container->storage->isHardLocked( $this->id ) ) {
				return;
			}

			$this->container->storage->HardLock( $this->id );

			while ( true ) {
				$toFire = array_shift( $this->firing );

				if ( $toFire ) {
					$name = $toFire['name'];
					if ( method_exists( $this, $name ) ) {
						yield $this->$name( $toFire['data'] );
					}
					$this->records[] = $toFire;
				} else {
					break;
				}
			}
			$this->container->storage->Unlock( $this->id );
			yield from $this->Store();
		};

		if ( ! $this->replaying ) {
			if ( count( $this->firing ) == 0 ) {
				if ( ! $this->container->storage->isLocked( $this->id ) ) {
					$this->container->storage->SoftLock( $this->id );
					Amp\immediately( $fire );
				}
			}

			$this->firing[] = [
				'model_id' => $this->id,
				'version'  => $this->nextVersion ++,
				'type'     => 'event',
				'name'     => $name,
				'data'     => $data,
				'stored'   => false,
				'at'       => new \DateTime()
			];
		}
	}
}