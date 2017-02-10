const uuid = require( 'uuid/v4' );

/**
 * An event driven model
 */
class Actor {
	/**
	 * Creates a event driven actor
	 * @param {string} id
	 * @param {Container} container
	 * @constructor
	 */
	constructor( id, container ) {

		/**
		 * The internal id
		 * @type {string}
		 * @private
		 */
		this._id = id;

		/**
		 * This instance id
		 * @type {string}
		 * @private
		 */
		this._instanceId = uuid();

		/**
		 * DI container
		 * @type {Container}
		 * @protected
		 */
		this._container = container;

		/**
		 * The history of this actor
		 * @type {Array}
		 * @private
		 */
		this._records = [];

		/**
		 * The point at which to make optimization and memoize
		 * @type {number}
		 * @private
		 */
		this._optimizeAt = 10;

		/**
		 * The next version of this actor
		 * @type {number}
		 * @private
		 */
		this._nextVersion = 0;

		/**
		 *
		 * @type {Array}
		 * @private
		 */
		this._repeater = [];

		/**
		 * The internal state
		 * @type {{}}
		 * @protected
		 */
		this._state = {};

		/**
		 * Is this a replay of the past?
		 * @type {boolean}
		 * @protected
		 */
		this._replaying = false;

		/**
		 * What events are currently firing
		 * @type {Array}
		 * @private
		 */
		this._firing = [];

		/**
		 * A promise that this aggregate will eventually be stored
		 * @type {Promise|null}
		 * @private
		 */
		this._storagePromise = null;
	}

	ListenFor( id, eventToHear, eventToFire, number = 1, time = 60000 ) {
		const wait = ( event ) => {
			if ( event.name == eventToHear ) {
				number -= 1;

				this.Fire( eventToFire, event.data );
			}

			if ( number <= 0 ) {
				this._container.storage.Unsubscribe( id, wait );
			}
		};

		this._container.storage.SubscribeTo( id, wait );

		setTimeout( () => {
			if ( number > 0 ) {
				this._container.storage.Unsubscribe( id, wait );
			}
		}, time );
	}

	/**
	 * Loads the aggregate from ES and replays past events
	 * @returns {Promise.<void>}
	 */
	async Load() {
		let latestSnapshot = await this._container.storage.LoadSnapshot( this._id );

		if ( latestSnapshot && latestSnapshot.length > 0 ) {
			this._state = latestSnapshot.state;
			this._nextVersion = latestSnapshot.version + 1;
		} else {
			latestSnapshot = {
				version: - 1
			};
			this._nextVersion = 0;
		}

		this._records = await this._container.storage.LoadEvents( this._id, latestSnapshot.version );
		await this._ReduceEvents();
	}

	/**
	 * Replays all events to recreate state
	 * @returns {Promise.<void>}
	 * @private
	 */
	async _ReduceEvents() {
		this._replaying = true;

		let counter = this._nextVersion - 1;
		this._records.forEach( async( event ) => {
			const func = event.name;
			if ( this[func] ) {
				await this[func]( event.data );
			}
			counter = event.version;
			this._nextVersion = Math.max(counter + 1, this._nextVersion);
		} );

		this._replaying = false;
	}

	/**
	 * Projects this aggregate somewhere
	 * @abstract
	 * @returns {Promise.<void>}
	 */
	async Project() {
	}

	/**
	 * Stores the current State of the aggregate
	 * @returns {Promise.<Array>}
	 */
	async Store() {
		if ( this._storagePromise && ! this._container.storage.IsLocked( this._instanceId ) ) {
			const result = await this._storagePromise;
			return result;
		}

		let resolver = null;

		this._storagePromise = new Promise( ( resolve ) => {
			resolver = resolve;
		} );

		this._container.storage.SetProjector( this._instanceId, async() => {
			await this.Project();
		} );

		this._container.storage.SetSnapshot( this._instanceId, async() => {
			await this.Snapshot();
		} );

		try {
			const result = await this._container.storage.Store( this._id, this._instanceId, this._records );
			this._storagePromise = null;
			resolver( result );
			return result;
		}
		catch ( err ) {
			const reApply = this._records.filter( ( event ) => ! event.stored );
			await this.Load();
			reApply.forEach( ( event ) => {
				event.version = this._nextVersion ++;
				this._records.push( event );
			} );
			const result = await this._container.storage.Store( this._id, this._instanceId, this._records );
			resolver( result );
			return result;
		}
	}

	/**
	 * Returns the internal state of this aggregate
	 * @returns {Promise.<object>}
	 */
	async Snapshot() {
		//todo: make deep copy of state
		return this._state;
	}

	/**
	 * Get the id of this aggregate
	 * @returns {string}
	 */
	Id() {
		return this._id;
	}

	/**
	 * Applies an event to the event store
	 * @param {string} name The name of the event
	 * @param {*} data The data about the event
	 */
	Fire( name, data ) {
		const fire = async() => {
			if ( this._container.storage.IsHardLocked( this._instanceId ) ) {
				return;
			}

			this._container.storage.HardLock( this._instanceId );
			while ( true ) {
				const toFire = this._firing.shift();

				if ( toFire ) {
					name = toFire.name;
					if ( this[name] ) {
						await this[name]( toFire.data );
					}
					this._records.push( toFire );
				}
				else {
					break;
				}
			}
			this._container.storage.Unlock( this._instanceId );
			const result = await this.Store();
			return result;
		};

		if ( ! this._replaying ) {
			this._firing.push( {
				id: [this._id, this._nextVersion],
				model_id: this._id,
				version: this._nextVersion,
				type: 'event',
				name: name,
				data: data,
				stored: false,
				at: new Date()
			} );

			this._nextVersion += 1;

			if ( this._firing.length == 1 ) {
				if ( ! this._container.storage.IsLocked( this._instanceId ) ) {
					this._container.storage.SoftLock( this._instanceId );
					fire();
				}
			}
		}
	}
}

module.exports = Actor;