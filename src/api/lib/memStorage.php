<?php

namespace Model;

require_once 'storage.php';

use Amp;

class MemStorage implements iStore {

	private $container;
	private $events = [];
	private $locks = [];

	public function __construct( $container ) {
		$this->container = $container;
	}

	public function Inject($id, $data) {
		$this->events[$id] = $data;
	}

	/**
	 * Stores all unstored events in an array
	 *
	 * @param array $events The events
	 *
	 * @return \Generator
	 */
	public function Store( $id, array &$events, $callback, $deferred ): \Generator {
		while($this->isLocked($id)) {
			yield;
		}

		$lastVersion = -1;
		$toStore = array_filter( $events, function ( $record ) use (&$lastVersion) {
			$lastVersion = max($lastVersion, $record['version']);
			return ! $record['stored'];
		} );

		if (!isset($this->events[$id])) {
			$this->events[$id] = [];
		}

		foreach ( $toStore as $event ) {
			$event['stored'] = true;
			yield;
			yield;
			yield;
			$this->events[$id][] = $event;
		}

		yield $deferred->succeed( $toStore );
	}

	/**
	 * Loads the latest snapshot of an id
	 *
	 * @param $id
	 *
	 * @return \Generator
	 */
	public function LoadSnapshot( $id ) {
		return new Amp\Success([]);
	}

	/**
	 * Loads events from a specific version
	 *
	 * @param $id
	 * @param int $from
	 *
	 * @return \Generator
	 */
	public function LoadEvents( $id, $from = - 1 ) {
		if ( isset( $this->events[ $id ] ) ) {
			return new Amp\Success($this->events[ $id ]);
		}

		return new Amp\Success([]);
	}

	/**
	 * @param $id
	 * @param $callback
	 *
	 * @return mixed
	 */
	public function SetProjector( $id, $callback ) {
	}

	public function UnsetProjector( $id ) {
	}

	public function SetSnapshot( $id, $callback ) {
	}

	public function UnsetSnapshot( $id ) {
	}

	public function SoftLock( $id ) {
		$this->locks[ $id ] = true;
	}

	public function HardLock( $id ) {
		$this->locks[ $id ] = 1;
	}

	public function Unlock( $id ) {
		unset( $this->locks[ $id ] );
	}

	public function isHardLocked( $id ) {
		return isset( $this->locks[ $id ] )
			? $this->locks[ $id ] === 1
			: false;
	}

	public function isLocked( $id ) {
		return isset( $this->locks[ $id ] );
	}
}