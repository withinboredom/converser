const Storage = require( './storage' );

/**
 * A simple in-memory storage adapter, useful for testing or volatile experiences
 * @augments Storage
 */
class memStorage extends Storage {
	/**
	 * Creates a memory storage
	 * @constructor
	 * @param {Container} container
	 */
	constructor( container ) {
		super( container );
		this.events = {};
		this.subs = {};
	}

	/**
	 * Injects the given state into an ID space
	 * @param {string} id
	 * @param {object} data
	 */
	Inject( id, data ) {
		this.events[id] = data;
	}

	/**
	 * Stores the given events in the store
	 * @param {string} id
	 * @param {string} instanceId
	 * @param {Array} events
	 * @returns {Promise<Array>}
	 */
	async Store( id, instanceId, events ) {
		if ( this.IsLocked( instanceId ) ) {
			await this.locks[instanceId]();
		}

		let lastVersion = - 1;
		const toStore = events.filter( ( event ) => ! event.stored );
		if ( this.events[id] === undefined ) {
			this.events[id] = [];
		}

		toStore.forEach( ( event ) => {
			event.stored = true;
			event.new = true;
			this.events[id].push( event );
			if ( this.subs[id] ) {
				this.subs[id].forEach( ( cb ) => {
					cb( event );
				} )
			}
		} );

		const changesTotal = this.events[id].filter( ( event ) => event.new );

		return changesTotal;
	}

	/**
	 * Loads a snapshot from memory
	 * @param id
	 * @returns {Promise.<Array>}
	 */
	LoadSnapshot( id ) {
		return Promise.resolve( null );
	}

	LoadEvents( id, from = - 1 ) {
		if ( this.events[id] ) {
			return Promise.resolve( this.events[id].filter( ( event ) => event.version > from ) );
		}

		return Promise.resolve( [] );
	}

	SubscribeTo( id, cb ) {
		if ( ! this.subs[id] ) {
			this.subs[id] = [];
		}

		this.subs[id].push( cb );

		if ( this.events[id] ) {
			this.events[id].forEach( cb );
		}
	}

	Unsubscribe( id, cb ) {
		if ( this.subs[id] ) {
			this.subs[id] = this.subs[id].filter( ( sub ) => sub !== cb );
		}
	}

	SetProjector( instanceId ) {
	}

	UnsetProjector( instanceId ) {
	}

	SetSnapshot( instanceId ) {
	}

	UnsetSnapshot( instanceId ) {
	}
}

module.exports = memStorage;