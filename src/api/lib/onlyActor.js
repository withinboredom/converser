const r = require( 'rethinkdb' );
const LiveActor = require( './liveActor' );

/**
 * This is a special LiveActor that detects other instances with the same id,
 * in order to prevent race conditions.
 * @augments LiveActor
 */
class OnlyActor extends LiveActor {
	constructor( id, container ) {
		super( id, container );

		this._isWinner = false;

	}

	async ApplyEvent( event, replay = true ) {
		if ( ! replay ) {
			console.log( `APPLY ${event.name}` );
			this._records.push( event );
		}
		else {
			console.log( `REPLAY ${event.name}` );
		}

		await super.ApplyEvent( event, replay );
	}

	async Fire( name, data ) {
		const oldVersion = this._nextVersion;
		if ( this._isWinner ) {
			console.log( `${this.constructor.name}:${this._instanceId} fired ${name}` );
			const timeout = setTimeout( () => {
				console.log( `${this.constructor.name}:${this._instanceId} not leader` );
				this._isWinner = false;
			}, 1000 );
			await super.Fire( name, data, () => {
				clearTimeout( timeout );
				if (this._nextVersion != oldVersion + 1) {
					this._isWinner = false;
					console.log(`${this.constructor.name}:${this._instanceId} has lost leadership`);
					return;
				}
				this._isWinner = true;
				console.log( `${this.constructor.name}:${this._instanceId} is the onlyActor` )
			} );
		}
		else {
			console.log( `${this.constructor.name}:${this._instanceId} is waiting for expected event: ${name}` );
			setTimeout( async() => {
				const hasPassed = this._records
				                      .filter( ( event ) => event.version >= oldVersion )
				                      .reduce( ( carry, current ) => {
					                      if ( carry ) {
						                      return carry;
					                      }
					                      return this.isDupe( current, { name, data } )
				                      }, false );
				if ( oldVersion == this._nextVersion || ! hasPassed ) {
					this._isWinner = true;
					console.log( `${this._instanceId} is firing expected event: ${name}` );
					await this.Fire( name, data );
				} else {
					console.log( `${this._instanceId} is skipping ${name}` );
				}
			}, Math.floor( Math.random() * 1000 + 500 ) );
		}
	}

	isDupe( oldEvent, newEvent ) {
		if ( ! oldEvent || ! newEvent ) {
			return false;
		}

		if ( oldEvent.name != newEvent.name ) {
			return false;
		}

		const keys = Object.keys( newEvent.data );
		if ( keys.length == 0 ) {
			return false;
		}
		const differences = keys.filter( ( key ) => oldEvent.data[ key ] == newEvent.data[ key ] );
		return (
			       differences.length / keys.length
		       ) > 0.75;
	}
}

module.exports = OnlyActor;