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
		$this->conn    = $conn;
		$this->id      = $id;
		$this->records = r\db( 'records' )
			->table( 'events' )
			->getAll( $id, [ 'index' => 'model_id' ] )
			->orderBy( 'version' )
			->run( $conn )
			->toArray();

		$this->ReduceEvents();
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
					break;
				case 'memo':
					$this->data = $event['data'];
					$counter    = 0;
					break;
			}

			if ( $counter >= $this->optimizeAt ) {
				// todo: generate memo
			}
		}
	}

	public function Fire( $name, $data ) {
		if (method_exists($this, $name)) {
			Amp\run(function() use ($name, $data) {
				$this->$name( $data );
				$this->records[] = [
					'model_id' => $this->id,
					'version' => $this->nextVersion++,
					'type' => 'event',
					'name' => $name,
					'data' => $data,
					'stored' => false
				];
			});
		}
	}
}