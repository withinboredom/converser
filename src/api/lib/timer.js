const QueueActor = require( './queueActor' );

class Timer extends QueueActor {
	constructor( resolution, container ) {
		const id = typeof resolution === 'string' ? resolution : `timer_${resolution}`;
		super( id, container );
		this._resolution = typeof resolution == 'string' ? resolution.replace( /\D+/g, '' ) : resolution;
	}

	getNextTick( now ) {
		const next = new Date( now.getTime() + this._resolution * 10000 );
		return next;
	}

	getMsToNextTick( now ) {
		const ms = (
			           this._state[ 'next_tick' ].getTime() - now.getTime()
		           ) / 10;
		if ( ms <= 0 ) {
			return 1;
		}
		return ms;
	}

	StartTimer( nextTick ) {
		this.Fire( 'initialize_tick', { nextTick } );
	}

	initialize_tick( data ) {
		if ( this._replaying ) {
			return;
		}
		const now = new Date();
		if ( this._state[ 'initialized' ] ) {
			console.log( 'Starting already initialized timer' );
			console.log( `next tick at ${this._state[ 'next_tick' ]}` );
			if ( this._state[ 'next_tick' ] <= now ) {
				console.log( 'firing tick immediately' );
				this.Fire( 'tick', {
					nextTick: this.getNextTick( now )
				} );
			} else {
				const wait = this.getMsToNextTick( now );
				console.log( `waiting ${wait}ms to fire` );
				setTimeout( () => {
					this.Fire( 'tick', {
						nextTick: this.getNextTick( now )
					} )
				}, wait );
			}

			return;
		}

		this._state[ 'initialized' ] = true;
		this._state[ 'next_tick' ] = data[ 'nextTick' ];

		setTimeout( () => {
			this.Fire( 'tick', {
				nextTick: this.getNextTick( now )
			} );
		} );
	}

	tick( data ) {
		if ( ! this._replaying ) {
			const now = new Date();
			const nextTick = this._state[ 'next_tick' ] = this.getNextTick( now );
			setTimeout( () => {
				if ( nextTick == this._state[ 'next_tick' ] ) {
					this.Fire( 'tick', {
						nextTick
					} );
				}
			}, this.getMsToNextTick( now ) );
		}
	}
}

module.exports = Timer;