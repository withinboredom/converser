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

		/**
		 *
		 * @type {plivo}
		 */
		this.plivo = null;

		/**
		 *
		 * @type {string}
		 */
		this.textFrom = null;

		this.charge = null;

		/**
		 *
		 * @type {memStorage}
		 */
		this.storage = null;
	}
}

module.exports = Container;