const OnlyActor = require( './onlyActor' );

class Timer extends OnlyActor {
	constructor( resolution, container ) {
		super( `timer_${resolution}`, container );
		this._resolution = resolution;
	}

	getNextTick( now ) {
		return new Date( now.getTime() + this._resolution * 10000 );
	}

	getMsToNextTick( now ) {
		return (
			       this._state[ 'next_tick' ].getTime() - now.getTime()
		       ) / 10;
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
		const now = new Date();
		const nextTick = this._state[ 'next_tick' ] = this.getNextTick( now );
		if ( ! this._replaying ) {
			setTimeout( () => {
				this.Fire( 'tick', {
					nextTick
				} );
			}, this.getMsToNextTick( now ) );
		}
	}
}

module.exports = Timer;