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
		return this._state[ 'next_tick' ].getTime() - now.getTime();
	}

	StartTimer( nextTick ) {
		this.Fire( 'initialize_tick', { nextTick } );
	}

	initialize_tick( data ) {
		const now = new Date();
		if ( this._state[ 'initialized' ] ) {
			if ( this._state[ 'next_tick' ] <= now ) {
				this.Fire( 'tick', {
					nextTick: this.getNextTick( now )
				} );
			} else {
				const wait = this.getMsToNextTick( now );
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
		setTimeout( () => {
			this.Fire( 'tick', {
				nextTick
			} );
		}, this.getMsToNextTick( now ) );
	}
}

module.exports = Timer;