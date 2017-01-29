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

	private $optimizeAt = 100;
	private $id;
	private $nextVersion = 0;

	private $repeater = [];

	/**
	 * @var \ArrayObject
	 */
	protected $state = [];

	/**
	 * Actor constructor.
	 *
	 * @param $id string Id of actor to load
	 * @param $conn r\Connection A connection to a rql db
	 */
	public function __construct( $id, $conn ) {
		$this->conn = $conn;
		$this->id   = get_class( $this ) . '_' . $id;
		$this->Load();
	}

	/**
	 * Load events and recreate current state
	 *
	 * @param callable|null $callback Calls this function after a completed load
	 */
	public function Load( callable $callback = null ) {
		$latestSnapshot = r\db( 'records' )
			->table( 'snapshots' )
			->get( $this->id );

		if ( $latestSnapshot ) {
			$this->state = $latestSnapshot['state'];
		} else {
			$latestSnapshot = [ 'version' => 0 ];
		}

		$this->records = r\db( 'records' )
			->table( 'events' )
			->getAll( $this->id, [ 'index' => 'model_id' ] )
			->filter( r\row( 'version' )->gt( $latestSnapshot->version ) )
			->orderBy( 'version' )
			->run( $this->conn );

		$this->ReduceEvents();
		if ( $callback ) {
			$callback();
		}
	}

	protected function ListenForId( $id, $callback ) {
		$listener = r\db( 'records' )
			->table( 'events' )
			->filter( [ 'model_id' => $id ] )
			->changes( [ 'includeInitial' => false, 'squash' => true ] )
			->run( $this->conn );

		$check = $listener->changes();

		$isChanges      = $check->current();
		$firstIteration = true;

		$this->repeater[] = Amp\repeat( function () use ( $check, $listener, $callback, $isChanges, $firstIteration ) {
			$isChanges = $check->current();
			var_dump( $isChanges );
			if ( $isChanges ) {
				if ( $callback ) {
					$callback( $isChanges->getArrayCopy() );
				}
			}
			$check->next();
		}, 1000 );
	}


	/**
	 * Projects the current state
	 */
	protected abstract function Project();

	public function Store( callable $callback = null ) {
		Amp\immediately( function () use ( $callback ) {
			$toStore = array_filter( $this->records, function ( $record ) {
				return ! $record['stored'];
			} );

			foreach ( $toStore as $event ) {
				$event['stored'] = true;
				r\db( 'records' )
					->table( 'events' )
					->insert( $event )
					->run( $this->conn );
			}

			$this->Project();

			if ( count( $this->records ) >= $this->optimizeAt ) {
				$snapshot = [
					'id'      => $this->id,
					'state'   => $this->Snapshot(),
					'version' => $this->nextVersion - 1
				];
				r\db( 'records' )
					->table( 'snapshots' )
					->get( $this->id )
					->replace( $snapshot )
					->run( $this->conn );
			}

			$this->Load( $callback );
		} );
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
	 * @return string The current id
	 */
	public function Id() {
		return $this->id;
	}

	/**
	 * Reduce the events to a stable state
	 */
	private function ReduceEvents() {
		$counter = 0;
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
						$this->$func( $event['data'] );
					}
					$counter = $event['version'];
					break;
				case 'memo':
					$this->data = $event['data'];
					$counter    = $event['version'];
					break;
			}
		}
		$this->nextVersion = $counter + 1;
	}

	/**
	 * Fires an event
	 *
	 * @param $name string The name of this event
	 * @param $data array The body of the event
	 */
	public function Fire( $name, $data ) {
		Amp\immediately( function () use ( $name, $data ) {
			$this->records[] = [
				'model_id' => $this->id,
				'version'  => $this->nextVersion ++,
				'type'     => 'event',
				'name'     => $name,
				'data'     => $data,
				'stored'   => false
			];
			if ( method_exists( $this, $name ) ) {
				$this->$name( $data );
			}
		} );
	}
}