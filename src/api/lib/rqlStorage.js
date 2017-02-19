const r = require( 'rethinkdb' );
const Storage = require( './storage' );

let counter = 0;

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

		setInterval( () => {
			const idSubs = Object.keys( this.subs ).reduce( ( carry, current ) => {
				return carry + this.subs[ current ].length;
			}, 0 );
			const nameSubs = Object.keys( this.subR ).reduce( ( carry, current ) => {
				return carry + this.subR[ current ].length;
			}, 0 );
			console.log( `Currently ${idSubs} id subscriptions, ${nameSubs} name subscriptions` )
		}, 5000 );
	}

	LoadSnapshot( id ) {
		return this.container.snapshots
		           .get( id )
		           .run( this.container.conn );
	}

	LoadEvents( id, from = - 1 ) {
		return this.container.records
		           .between( [ id, from ], [ id, r.maxval ], { leftBound: 'open', rightBound: 'closed' } )
		           .orderBy( { index: 'id' } );
	}

	async Store( id, instanceId, events, ignoreConcurrencyError = false ) {
		if ( this.IsLocked( instanceId ) ) {
			await this.locks[ instanceId ]();
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
				if ( ! ignoreConcurrencyError ) {
					console.error( 'concurrency exception attempting to store: ', event );
				}

				this.UnsetProjector( instanceId );
				this.UnsetSnapshot( instanceId );

				return false;
			}
		} );

		const projector = this.projectors[ instanceId ];
		if ( projector ) {
			projector();
		}

		if ( events.length > 0 && events[ events.length - 1 ].version % this.optimizeAt == 0
		     && events[ events.length - 1 ].version > 1 ) {
			const snap = this.snaps[ instanceId ];
			if ( snap ) {
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
		}

		this.UnsetProjector( instanceId );
		this.UnsetSnapshot( instanceId );
	}

	SetProjector( instanceId, callback ) {
		this.projectors[ instanceId ] = callback;
	}

	UnsetProjector( instanceId ) {
		this.projectors[ instanceId ] = undefined;
		delete this.projectors[ instanceId ];
	}

	SetSnapshot( instanceId, callback ) {
		this.snaps[ instanceId ] = callback;
	}

	UnsetSnapshot( instanceId ) {
		this.snaps[ instanceId ] = undefined;
		delete this.snaps[ instanceId ];
	}

	SubscribeTo( id, cb, sinceVersion = - 1 ) {
		if ( ! this.subs[ id ] ) {
			this.subs[ id ] = [];
		}

		const promise = this.container.records
		                    .between( [ id, sinceVersion ], [ id, r.maxval ] )
		                    .changes( { includeInitial: true, includeStates: true } )
		                    .run( this.container.conn );

		return promise.then( ( cursor ) => {
			console.log( `Subscribed to ${id}` );
			const tie = [ cb, cursor ];
			this.subs[ id ].push( tie );
			let holder = false;

			let resolver;

			const promise = new Promise( ( resolve, reject ) => {
				resolver = resolve;
			} );


			cursor.each( ( err, event ) => {
				if ( err ) {
					console.log( `cursor closed for ${id}` );
					return;
				}

				if ( event.state && event.state == 'initializing' ) {
					console.log( `Initializing subscription for ${id}` );
					holder = [];
					return;
				}

				if ( event.state && event.state == 'ready' ) {
					console.log( `Subscription for ${id} ready` );
					holder = holder.sort( ( left, right ) => {
						return left.new_val.version < right.new_val.version ? - 1 : 1;
					} );

					holder.forEach( async( event ) => {
						console.log( `replay event: ${event.new_val.name}:${event.new_val.version} ` );
						await cb( event.new_val );
					} );

					holder = null;

					resolver();

					return;
				}

				if ( holder ) {
					holder.push( event );
					return;
				}

				console.log( `broadcast event: ${event.new_val.name}:${event.new_val.version} ` );
				cb( event.new_val );
			} );

			return promise;
		} );
	}

	/**
	 * Subscribe to all events of a given name
	 * @param name
	 * @param cb
	 */
	SubscribeToName( name, cb ) {
		if ( ! this.subR[ name ] ) {
			this.subR[ name ] = [];
		}

		const promise = this.container.records
		                    .filter( { name } )
		                    .changes( { includeInitial: false } )
		                    .run( this.container.conn );
		promise.then( ( cursor ) => {
			this.subR[ name ].push( [ cb, cursor ] );
			cursor.each( ( err, event ) => {
				if ( err ) {
					console.log( err );
					return;
				}
				cb( event.new_val );
			} );
		} )
	}

	Unsubscribe( id, cb ) {
		if ( this.subs[ id ] ) {
			this.unsub( 'subs', id, cb );
			console.log( `Unsubscribed from ${id} -- ${this.subs[ id ] ? this.subs[ id ].length : 0} still attached` );
		}

		if ( this.subR[ id ] ) {
			this.unsub( 'subR', id, cb );
			console.log( `Unsubscribed from ${id} -- ${this.subR[ id ] ? this.subR[ id ].length : 0} still attached` );
		}
	}

	/**
	 * @private
	 */
	unsub( item, id, cb ) {
		this[ item ][ id ] = this[ item ][ id ]
			.filter( ( pair ) => {
				if ( pair[ 0 ] === cb ) {
					pair[ 1 ].close();
					return false;
				}
				return true;
			} )
	}
}

module.exports = RqlStorage;