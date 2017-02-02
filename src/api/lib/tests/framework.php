<?php

/**
 * This is based on BDD style testing:
 *
 * Given([ <previous events> ])->When( <Action> )->Then( <expected events> )
 */

namespace Model\Test;

require_once 'vendor/autoload.php';
require_once 'lib/container.php';

use Model\Container;
use Amp;

class DB {
	private $output;

	public function __construct( $output = [] ) {
		$this->output = $output;
	}

	public function __call( $name, $arguments ) {
		if ( $name == 'run' ) {
			return new Amp\Success( $this->output );
		}

		return $this;
	}
}

class When {
	private $action;
	private $previous;
	private $model;
	private $parameters;

	public function __construct( $model, $previous, $action, $params ) {
		$this->previous   = $previous;
		$this->action     = $action;
		$this->model      = $model;
		$this->parameters = $params;
	}

	public function Then( $expected ) {
		$container            = new Container();
		$container->snapshots = new DB();
		$container->records   = new DB( $this->previous );
		$container->uuid      = new DB( [ '123' ] );
		$container->plivo     = new DB();
		$container->R         = new Db();
		$model                = $this->model;
		$UT                   = new $model( 'FAKE', $container );

		$action = $this->action;
		Amp\Run( function () use ( $UT, $action, $expected ) {
			Amp\immediately( function () use ( $UT, $action, $expected ) {
				$t = $UT->$action( ...$this->parameters );
				if ( $t instanceof \Generator ) {
					yield from $t;
				} else {
					yield $t;
				}
				$results = yield from $UT->Store();
				$this->test( $expected, $results );
			} );
		} );
	}

	private function test( $expected, $results ) {
		$climate = new \League\CLImate\CLImate();
		foreach ( $results as $event ) {
			if ( ! isset( $expected[ $event['name'] ] ) ) {
				$climate->red()->out( "Event '<light_blue>" . $event['name'] . "</light_blue>' appears to be unexpected" );
			} else {
				$flags = [];
				foreach ( $event['data'] as $key => $property ) {
					if ( ! isset( $expected[ $event['name'] ][ $key ] ) || $property != $expected[ $event['name'] ][ $key ] ) {
						if ( isset( $expected[ $event['name'] ][ $key ] ) && is_callable( $expected[ $event['name'] ][ $key ] ) ) {
							$call = $expected[ $event['name'] ][ $key ];
							if ( $call( $property ) ) {
								continue;
							}
						}
						$flags[ $key ] = $property;
					}
				}

				if ( empty( $flags ) ) {
					$climate->green()->out( "    Event " . $event['name'] . " is good" );
				} else {
					$climate->out( "[" );
					$output = [];
					foreach ( $expected[ $event['name'] ] as $key => $value ) {
						if ( isset( $flags[ $key ] ) ) {
							$climate->red()->out( "  <blue>'$key'</blue> => ($value != ${flags[$key]})" );
							$output[ $key ] = true;
						} else {
							$climate->green()->out( "  <blue>'$key'</blue> => " . \print_r( $value, true ) );
							$output[ $key ] = true;
						}
					}

					foreach ( $event['data'] as $key => $value ) {
						if ( isset( $flags[ $key ] ) ) {
							if ( ! isset( $output[ $key ] ) ) {
								$climate->red()->out( "  <blue>'$key'</blue> => (unset != " . \print_r( $flags[ $key ], true ) . ' )' );
								$output[ $key ] = true;
							}
						}
					}

					$climate->out( "]" );
				}
			}
		}
	}
}

function ofType( $type ) {
	return function ( $value ) use ( $type ) {
		switch ( $type ) {
			case 'string':
				return is_string( $value );
			default:
				if ( $value instanceof $type ) {
					return true;
				}
		}

		return false;
	};
}

class Given {
	private $events;
	private $model;

	public function __construct( $object, $events = [] ) {
		$this->events = $events;
		$this->model  = $object;
	}

	public function When( $action, ...$parameters ) {
		return new When( $this->model, $this->events, $action, $parameters );
	}
}