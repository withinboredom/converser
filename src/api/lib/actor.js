const uuid = require( 'uuid/v4' );

class Actor {
	/**
	 *
	 * @param {string} id
	 * @param {Container} container
	 */
	constructor( id, container ) {
		/**
		 *
		 * @type {string}
		 * @private
		 */
		this._id = id;

		/**
		 *
		 * @type {string}
		 * @private
		 */
		this._instanceId = uuid();

		/**
		 *
		 * @type {Container}
		 * @private
		 */
		this._container = container;

		/**
		 *
		 * @type {Array}
		 * @private
		 */
		this._records = [];

		/**
		 *
		 * @type {number}
		 * @private
		 */
		this._optimizeAt = 10;

		/**
		 *
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
		 *
		 * @type {{}}
		 * @private
		 */
		this._state = {};

		/**
		 *
		 * @type {boolean}
		 * @private
		 */
		this._replaying = false;

		/**
		 *
		 * @type {Array}
		 * @private
		 */
		this._firing = [];

		/**
		 *
		 * @type {Promise|null}
		 * @private
		 */
		this._storagePromise = null;
	}

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

	async _ReduceEvents() {
		this._replaying = true;

		let counter = this._nextVersion - 1;
		this._records.forEach( async( event ) => {
			const func = event.name;
			if ( this[func] ) {
				await this[func]( event.data );
			}
			counter = event.version;
			this._nextVersion = counter + 1;
		} );

		this._replaying = false;
	}

	async Project() {
	}

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

		const result = await this._container.storage.Store( this._id, this._instanceId, this._records );

		return result;
	}

	async Snapshot() {
		//todo: make deep copy of state
		return this._state;
	}

	Id() {
		return this._id;
	}

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
			await this.Store();
		};

		if (!this._replaying) {
			this._firing.push({
				id: [this._id, this._nextVersion],
				model_id: this._id,
				version: this._nextVersion,
				type: 'event',
				name: name,
				data: data,
				stored: false,
				at: new Date()
			});

			this._nextVersion += 1;

			if (this._firing.length == 1) {
				if (!this._container.storage.IsLocked(this._instanceId)) {
					this._container.storage.SoftLock(this._instanceId);
					fire();
				}
			}
		}
	}
}

module.exports = Actor;