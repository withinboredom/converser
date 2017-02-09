class Container {
	constructor() {
		/**
		 *
		 * @type {Table}
		 */
		this.records = null;

		/**
		 *
		 * @type {Table}
		 */
		this.snapshots = null;

		/**
		 *
		 * @type {Db}
		 */
		this.R = null;

		/**
		 *
		 * @type {Connection}
		 */
		this.conn = null;

		this.plivo = null;
		this.charge = null;

		/**
		 *
		 * @type {memStorage}
		 */
		this.storage = null;
	}
}

module.exports = Container;