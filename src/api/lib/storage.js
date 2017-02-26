/**
 * Base storage behavior
 */
class Storage {
	/**
	 * Creates a storage object
	 * @constructor
	 * @param container
	 */
	constructor( container ) {
		/**
		 * @protected
		 */
		this.container = container;

		this.locks = {};
	}

	/**
	 * Determines if the instance is locked at all
	 * @param instanceId
	 * @returns {boolean}
	 */
	IsLocked( instanceId ) {
		return this.locks[instanceId] !== undefined;
	}

	/**
	 * Determines if the instance is hard locked
	 * @param instanceId
	 * @returns {*}
	 */
	IsHardLocked( instanceId ) {
		return this.locks[instanceId]( false );
	}

	/**
	 * Unlocks an instance
	 * @param instanceId
	 */
	Unlock( instanceId ) {
		if ( this.locks[instanceId] ) {
			this.locks[instanceId]( true );
		}
	}

	/**
	 * Hard locks an instance
	 * @param instanceId
	 */
	HardLock( instanceId ) {
		if ( ! this.IsLocked( instanceId ) ) {
			this.SoftLock( instanceId );
		}

		this.locks[instanceId]( 1 );
	}

	/**
	 * Soft locks an instance
	 * @param instanceId
	 */
	SoftLock( instanceId ) {
		let locked = true;
		let resolver = () => {
		};

		const lockP = new Promise( ( resolve ) => {
			resolver = resolve;
		} );

		const lock = ( unlock ) => {
			if ( unlock === 1 ) {
				return locked = 1;
			}

			if ( unlock === false ) {
				return locked === 1;
			}

			if ( unlock === true ) {
				this.locks[instanceId] = undefined;
				return resolver( true );
			}

			return lockP;
		};

		/*setTimeout(() => {
		 lock(true);
		 }, 5000);*/

		this.locks[instanceId] = lock;
	}
}

module.exports = Storage;