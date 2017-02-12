const Actor = require( './actor' );

/**
 * Live Actors work very different from regular Actors.
 *
 * - Live actors immediately store an event, and do not apply it until it has been stored.
 * - Other instances of the given id, will automatically be applied to this Actor.
 * - LiveActors cannot project or snapshot!
 * - Fire is async!
 */
class LiveActor extends Actor {
	constructor( id, container ) {
		super( id, container );
	}

	async ApplyEvent( event, replay = true ) {
		if ( replay ) {
			this._replaying = true;
		}
		await super.ApplyEvent( event );
		if ( replay ) {
			this._replaying = false;
		}
	}

	async Load() {
		const latestSnapshot = await this.ApplySnapshot();

		await this._container.storage.SubscribeTo( this.Id(), ( event ) => this.ApplyEvent( event ), latestSnapshot.version );
	}

	async Store() {
	}

	async Fire( name, data ) {
		const event = this.CreateEvent( name, data );
		const apply = super.ApplyEvent( event, false );
		this._container.storage.SetProjector( this._instanceId, () => {
		} );
		this._container.storage.SetSnapshot( this._instanceId, () => {
		} );
		const store = this._container.storage.Store( this.Id(), this._instanceId, [event], true );

		await Promise.all( [apply, store] );
	}
}

module.exports = LiveActor;