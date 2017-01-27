<?php
namespace Model;

require_once 'vendor/autoload.php';

use r, Amp;

/**
 * Class Actor
 *
 * Creates a managed actor
 */
class Actor {

	/**
	 * @var \ArrayObject The records that represent this model
	 */
	private $records;

	/**
	 * @var r\Connection The connection to the db
	 */
	private $conn;

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

	public function Store( callable $callback = null ) {
		Amp\immediately( function () use ( $callback ) {
			$toStore = array_filter( $this->records, function ( $record ) {
				return ! $record['stored'];
			} );

			foreach ( $toStore as $event ) {
				r\db( 'records' )
					->table( 'events' )
					->insert( $event )
					->run( $this->conn );
			}

			$this->Load( $callback );
		} );
	}

	public function Id() {
		return $this->id;
	}

	private function ReduceEvents() {
		$counter = 0;
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
					$this->$func( $event['data'] );
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

	public function Fire( $name, $data ) {
		if ( method_exists( $this, $name ) ) {
			Amp\immediately( function () use ( $name, $data ) {
				$this->$name( $data );
				$this->records[] = [
					'model_id' => $this->id,
					'version'  => $this->nextVersion ++,
					'type'     => 'event',
					'name'     => $name,
					'data'     => $data,
					'stored'   => false
				];
			} );
		}
	}
}