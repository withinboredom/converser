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
		this.subs = [];
		this.isStoring = false;
	}

	async ApplyEvent( event, replay = true ) {
		const apply = async() => {
			if ( replay ) {
				this._replaying = true;
			}
			await super.ApplyEvent( event );
			if ( replay ) {
				this._replaying = false;
			}
		};

		const next = this._firing.shift();

		if ( next && next.version == event.version
		     && next.name == event.name
		     && next.at == event.at ) {
			console.log( `event matches already applied event, skipping ${event.name}:${event.version}` );
		}
		else {
			if ( next ) {
				this._firing.unshift( next );
			}
			console.log( `Applying event ${event.name}:${event.version} to ${this._instanceId}` );
			await apply();
		}
	}

	Destroy() {
		super.Destroy();
		this.subs.forEach( ( sub ) => {
			this._container.storage.Unsubscribe( sub[ 0 ], sub[ 1 ] );
		} );
	}

	async Load() {
		const latestSnapshot = await this.ApplySnapshot();

		const cb = ( event ) => this.ApplyEvent( event );

		this.subs.push( [ this.Id(), cb ] );

		await this._container.storage.SubscribeTo( this.Id(), cb, latestSnapshot.version );
	}

	async Store() {
		return await this._container.storage.Store( this, [], true );
	}

	async Fire( name, data, successCallback = null ) {
		this.isStoring = true;
		const event = this.CreateEvent( name, data );
		//const apply = super.ApplyEvent( event, false );
		this._container.storage.SetProjector( this._instanceId, async() => {
			if ( ! this._replaying ) {
				await this.Project();
			}
		} );
		this._container.storage.SetSnapshot( this._instanceId, async() => {
			return await this.Snapshot();
		} );

		await this.ApplyEvent( event, false );

		this._firing.push( event );

		const result = await this._container.storage.Store( this, [ event ], true );

		if ( result && result !== false && successCallback ) {
			successCallback();
		}

		this.isStoring = false;
	}
}

module.exports = LiveActor;