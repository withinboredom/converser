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

	protected $state = [];

	/**
	 * Actor constructor.
	 *
	 * @param $id string Id of actor to load
	 * @param $conn r\Connection A connection to a rql db
	 */
	public function __construct( $id, $conn ) {
		$this->conn = $conn;
		$this->id   = $id;
		$this->Load();
	}

	/**
	 * Load events and recreate current state
	 *
	 * @param callable|null $callback Calls this function after a completed load
	 */
	public function Load( callable $callback = null ) {
		$this->records = r\db( 'records' )
			->table( 'events' )
			->getAll( $this->id, [ 'index' => 'model_id' ] )
			->orderBy( 'version' )
			->run( $this->conn );

		$this->ReduceEvents();
		if ( $callback ) {
			$callback();
		}
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

			$this->Load( $callback );
		} );
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