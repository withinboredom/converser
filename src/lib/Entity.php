<?php

namespace Model;

class Entity {
	private $eventsToEmit = [];
	private $newEvents = [];
	private $replaying = false;
	private $snapshotVersion = 0;
	private $timestamp;
	private $version = 0;
	private $state = [];

	public function __construct( $snapshot, $events ) {
		$this->timestamp = new \DateTime();
		$this->state     = $snapshot['state'];
		$this->Replay($events);
	}

	protected function Emit( $event ) {
		if ( ! $this->replaying ) {
			// todo: emit this event, globally, someway
		}
	}

	protected function Enqueue( $event ) {
		if ( ! $this->replaying ) {
			$this->eventsToEmit[] = $event;
		}
	}

	public function Digest( $method, $data ) {
		if ( ! $this->replaying ) {
			$this->timestamp = new \DateTime();
			$this->version += 1;
			$this->newEvents[] = [
				'method'    => $method,
				'data'      => $data,
				'timestamp' => $this->timestamp,
				'version'   => $this->version
			];
		}
	}

	protected function Replay( $events ) {
		$this->replaying = true;

		foreach ( $events as $event ) {
			$method = $event['method'];
			if ( method_exists( $this, $method ) ) {
				$this->$method( $event['data'] );
			}
		}

		$this->replaying = false;
	}

	protected function Snapshot() {
		$snapshot = [
			'version' => $this->version,
			'state'   => $this->state
		];

		return $snapshot;
	}
}