<?php

/**
 * This is based on BDD style testing:
 *
 * Given([ <previous events> ])->When( <Action> )->Then( <expected events> )
 */

namespace Model\Test;

require_once 'vendor/autoload.php';
require_once 'lib/container.php';
require_once 'lib/rqlStorage.php';

use Model\Container;
use Amp;
use Model\RqlStorage;
use r\Exceptions\RqlDriverError;

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

class Charge {
	static function create( $payment ) {
		$response                      = new \stdClass();
		$response->outcome             = new \stdClass();
		$response->outcome->risk_level = 'normal';
		$response->amount              = $payment['amount'];

		return $response;
	}
}

class When {
	private $action;
	private $previous;
	private $model;
	private $parameters;
	private $story;

	public function __construct( $model, $previous, $action, $params, $story ) {
		$this->previous   = $previous;
		$this->action     = $action;
		$this->model      = $model;
		$this->parameters = $params;
		$this->story      = $story;
	}

	public function Then( $expected ) {
		$container            = new Container();
		$container->snapshots = new DB();
		$container->records   = new DB( $this->previous );
		$container->uuid      = new DB( 'uuid' );
		$container->plivo     = new DB();
		$container->R         = new Db();
		$container->charge    = 'Model\Test\Charge';
		$container->storage   = new RqlStorage( $container );
		$model                = $this->model;
		$UT                   = new $model( 'FAKE', $container );

		$action = $this->action;
		Amp\Run( function () use ( $UT, $action, $expected ) {
			yield from $UT->Load();
			$t = $UT->$action( ...$this->parameters );
			if ( $t instanceof \Generator ) {
				yield from $t;
			} else {
				yield $t;
			}
			$results = yield from $UT->Store();
			$this->test( $expected, $results );
		} );
	}

	private function test( $expected, $results ) {
		$climate = new \League\CLImate\CLImate();
		$climate->underline()->bold()->out( "\n" . $this->story );
		$climate->blue()->out( "Given `$this->model`, with" );

		$climate->blue()->out( print_r( array_map( function ( $event ) {
			return $event['data'];
		}, $this->previous ), true ) );

		$climate->blue()->out( "When `$this->action`, Then," );
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
					$climate->green()->out( "    Event " . $event['name'] . " is expected" );
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
	private $story;

	public function __construct( $story, $object, $events = [] ) {
		$this->story  = $story;
		$this->events = $this->TransformEvents( $events );
		$this->model  = $object;
	}

	private function TransformEvents( $events ) {
		$ret     = [];
		$version = 0;
		foreach ( $events as $name => $data ) {
			$ret[] = [
				'model_id' => 'FAKE',
				'version'  => $version ++,
				'type'     => 'event',
				'name'     => $name,
				'data'     => $data,
				'stored'   => true,
				'at'       => new \DateTime()
			];
		}

		return $ret;
	}

	public function When( $action, ...$parameters ) {
		return new When( $this->model, $this->events, $action, $parameters, $this->story );
	}
}