<?php

namespace Model;

use Amp;

class ConcurrencyError extends \Exception {
	protected $message = "General Concurrency Error";
}

interface iStore {
	/**
	 * Stores all unstored events in an array
	 *
	 * @param array $events The events
	 *
	 * @return \Generator
	 */
	public function Store( $id, $instanceId, array &$events, $callback, $deferred ): \Generator;

	/**
	 * Loads the latest snapshot of an id
	 *
	 * @param $id
	 *
	 * @return \Generator
	 */
	public function LoadSnapshot( $id );

	/**
	 * Loads events from a specific version
	 *
	 * @param $id
	 * @param int $from
	 *
	 * @return \Generator
	 */
	public function LoadEvents( $id, $from = - 1 );

	/**
	 * @param $id
	 * @param $callback
	 *
	 * @return mixed
	 */
	public function SetProjector($id, $callback);
	public function UnsetProjector($id);

	public function SetSnapshot($id, $callback);
	public function UnsetSnapshot($id);

	public function SoftLock($id);
	public function HardLock($id);
	public function Unlock($id);

	public function isHardLocked($id);
	public function isLocked($id);
}