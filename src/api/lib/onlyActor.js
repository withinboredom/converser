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

	async Fire( name, data ) {
		if ( this._isWinner ) {
			const timeout = setTimeout( () => {
				this._isWinner = false;
			}, 100 );
			await super.Fire( name, data, () => {
				clearTimeout( timeout );
				this._isWinner = true;
				console.log( `${this._instanceId} is the onlyActor` )
			} );
		}
		else {
			console.log( `${this._instanceId} is waiting for expected event: ${name}` );
			const oldVersion = this._nextVersion;
			setTimeout( async() => {
				if ( oldVersion === this._nextVersion ) {
					this._isWinner = true;
					await this.Fire( name, data );
				}
			}, Math.floor( 500 ) );
		}
	}
}

module.exports = OnlyActor;