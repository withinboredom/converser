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

		this._isWinner = true;
	}

	async ApplyEvent( event, replay = true ) {
		this.lastEvent = event;
		await super.ApplyEvent( event, replay );
	}

	async Fire( name, data ) {
		if ( this._isWinner ) {
			const timeout = setTimeout( () => {
				this._isWinner = false;
			}, 1000 );
			await super.Fire( name, data, () => {
				clearTimeout( timeout );
				this._isWinner = true;
				console.log( `${this._instanceId} is the onlyActor` )
			} );
		}
		else {
			console.log( `${this.constructor.name}:${this._instanceId} is waiting for expected event: ${name}` );
			const oldVersion = this._nextVersion;
			setTimeout( async() => {
				const lastEvent = this.lastEvent;
				if ( oldVersion == this._nextVersion || ! this.isDupe( lastEvent, { name, data } ) ) {
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
		       ) < 0.75;
	}
}

module.exports = OnlyActor;