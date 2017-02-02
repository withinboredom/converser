<?php

namespace Model;

require_once 'storage.php';

use Amp;
use r;

class RqlStorage implements iStore {

	private $container;
	private $optimizeAt = 10;
	private $projectors = [];
	private $locks = [];
	private $snaps = [];

	public function __construct( Container $container ) {
		$this->container = $container;
	}

	/**
	 * Loads the latest snapshot of an id
	 *
	 * @param $id
	 *
	 * @return Amp\Success
	 */
	public function LoadSnapshot( $id ) {
		return $this->container->snapshots
			->get( $id )
			->run( $this->container->conn );
	}

	/**
	 * Loads events from a specific version
	 *
	 * @param $id
	 * @param int $from
	 *
	 * @return Amp\Success
	 */
	public function LoadEvents( $id, $from = - 1 ) {
		return $this->container->records
			->getAll( $id, [ 'index' => 'model_id' ] )
			->filter( r\row( 'version' )->gt( $from ) )
			->orderBy( 'version' )
			->run( $this->container->conn );
	}

	/**
	 * Stores all unstored events in an array
	 *
	 * @param array $events The events
	 *
	 * @return \Generator
	 */
	public function Store( $id, array &$events, $callback, $deferred ): \Generator {
		while ( $this->isLocked($id) ) {
			yield;
		}

		$lastVersion = -1;
		$toStore = array_filter( $events, function ( $record ) use (&$lastVersion) {
			$lastVersion = max($lastVersion, $record['version']);
			return ! $record['stored'];
		} );

		foreach ( $toStore as $event ) {
			$event['stored'] = true;
			yield $this->container->records
				->insert( $event )
				->run( $this->container->conn );
		}

		$projector = $this->projectors[$id];
		$projector();

		if ( count( $events ) >= $this->optimizeAt ) {
			$snapshot = $this->snaps[$id];
			$snapshot = [
				'id'      => $id,
				'state'   => $snapshot(),
				'version' => $lastVersion
			];
			$this->container->snapshots
				->get( $id )
				->replace( $snapshot )
				->run( $this->container->conn );
		}

		//yield from $this->Load( $callback );

		yield $deferred->succeed( $toStore );

		$this->UnsetProjector($id);
		$this->UnsetSnapshot($id);
	}

	public function SetProjector( $id, $callback ) {
		$this->projectors[$id] = $callback;
	}

	public function UnsetProjector( $id ) {
		unset($this->projectors[$id]);
	}

	public function SetSnapshot( $id, $callback ) {
		$this->snaps[$id] = $callback;
	}

	public function UnsetSnapshot( $id ) {
		unset($this->snaps[$id]);
	}

	public function SoftLock( $id ) {
		$this->locks[$id] = true;
	}

	public function HardLock( $id ) {
		$this->locks[$id] = 1;
	}

	public function Unlock( $id ) {
		unset($this->locks[$id]);
	}

	public function isHardLocked( $id ) {
		if (isset($this->locks[$id])) {
			return $this->locks[$id] === 1;
		}
		return false;
	}

	public function isLocked( $id ) {
		return isset($this->locks[$id]);
	}
}