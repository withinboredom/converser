const r = require( 'rethinkdb' );
const Storage = require( './storage' );

/**
 * @augments Storage
 */
class RqlStorage extends Storage {
	constructor( container ) {
		super( container );
		this.optimizeAt = 10;
		this.projectors = {};
		this.snaps = {};
		this.inProgress = {};
		this.subs = {};
		this.subR = {};
	}

	LoadSnapshot( id ) {
		return this.container.snapshots
		           .get( id )
		           .run( this.container.conn );
	}

	LoadEvents( id, from = - 1 ) {
		return this.container.records
		           .getAll( id, {index: 'model_id'} )
		           .filter( r.row( 'version' ).gt( from ) )
		           .orderBy( 'version' )
		           .run( this.container.conn );
	}

	async Store( id, instanceId, events ) {
		if ( this.IsLocked( instanceId ) ) {
			await this.locks[instanceId]();
		}

		let lastVersion = - 1;
		const toStore = events.filter( ( event ) => {
			lastVersion = Math.max( lastVersion, event.version );
			return ! event.stored;
		} );

		toStore.forEach( async( event ) => {
			event.stored = true;
			const result = await this.container.records
			                         .insert( event )
			                         .run( this.container.conn );
			if ( result.errors > 0 ) {
				event.stored = false;
				throw new Error( 'Concurrency Exception' );
			}
		} );

		const projector = this.projectors[instanceId];
		projector();

		if ( events >= this.optimizeAt ) {
			const snap = this.snaps[instanceId];
			const snapshot = {
				id,
				state: await snap(),
				version: lastVersion
			};
			this.container.snapshots
			    .get( id )
			    .replace( snapshot )
			    .run( this.container.conn );
		}

		this.UnsetProjector( instanceId );
		this.UnsetSnapshot( instanceId );
	}

	SetProjector( instanceId, callback ) {
		this.projectors[instanceId] = callback;
	}

	UnsetProjector( instanceId ) {
		this.projectors[instanceId] = undefined;
	}

	SetSnapshot( instanceId, callback ) {
		this.snaps[instanceId] = callback;
	}

	UnsetSnapshot( instanceId ) {
		this.snaps[instanceId] = undefined;
	}

	SubscribeTo( id, cb ) {
		if ( this.subs[id] ) {
			this.subR[id] = this.subR[id] === undefined ? 1 : this.subR[id] + 1;
			this.subs[id].each( ( err, event ) => {
				if ( err ) {
					console.log( err );
					return;
				}
				cb( event.new_val );
			} )
		}
		else {
			const promise = this.container.records
			                    .orderBy( {index: r.desc( 'version' )} )
			                    .filter( {model_id: id} )
			                    .limit( 10 )
			                    .changes( {includeInitial: true} )
			                    .run( this.container.conn );
			promise.then( ( cursor ) => {
				this.subs[id] = cursor;
				this.SubscribeTo( id, cb );
			} )
		}
	}

	Unsubscribe( id, cb ) {
		if ( this.subR[id] <= 0 ) {
			console.log( 'real unsub' );
			this.subs[id].close();
			this.subs[id] = undefined;
			this.subR[id] = 0;
		}
		else {
			this.subR[id] -= 1;
			if ( this.subR[id] == 0 ) {
				this.Unsubscribe( id, cb );
			}
		}
	}
}

module.exports = RqlStorage;