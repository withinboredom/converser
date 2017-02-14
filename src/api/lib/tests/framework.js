const Container = require( '../container' );
const Storage = require( '../memStorage' );
process.stdout.isTTY = true;
require( 'colors' ).enabled = true;
const diff = require( 'diff' );

/**
 * A BS Class
 */
class DB {

}

const fake_plivo = {
	send_message: function () {
	}
};

const fake_stripe = {
	charges: {
		create: ( payment ) => (
			{
				outcome: {
					risk_level: 'normal'
				},
				amount: payment.amount
			}
		)
	}
};

class And {
	constructor( item ) {
		this.item = item;
	}

	async And( expected ) {
		console.log( 'with state:' );
		const snapshot = await this.item.Snapshot();
		let failure = false;

		Object.keys( expected ).forEach( ( key ) => {
			if ( typeof expected[key] === 'string'
			     && expected[key][0] === '{'
			     && expected[key][expected[key].length - 1] ) {
				const token = expected[key].substr( 1, expected[key].length - 2 );
				if ( snapshot[key]
				     && typeof snapshot[key] == token ) {
					expected[key] = snapshot[key];
				}
			}
		} );

		const d = diff.diffJson( snapshot, expected );
		d.forEach( ( part ) => {
			const color = part.added ? (
					() => {
						failure = true;
						return 'green';
					}
				)() :
				part.removed ? (
						() => {
							failure = true;
							return 'red';
						}
					)() : 'grey';
			process.stdout.write( part.value[color] );
		} );

		if ( failure ) {
			process.exit( 1 );
		}

		console.log();
	}
}

/**
 * Given, When, Then
 */
class When {

	/**
	 * Creates a new When
	 * @param {object} model
	 * @param {Array} previous
	 * @param {string} action
	 * @param {Array} params
	 * @param {string} story
	 */
	constructor( model, previous, action, params, story ) {
		this.previous = previous;
		this.action = action;
		this.model = model;
		this.parameters = params;
		this.story = story;
	}

	/**
	 * Then, finally
	 * @param {Array} expected
	 * @returns {Promise.<And>}
	 */
	async Then( expected ) {
		const container = new Container();
		container.snapshots = new DB();
		container.records = new DB( this.previous );
		container.plivo = fake_plivo;
		container.R = new DB();
		container.charge = fake_stripe;
		container.storage = new Storage( container );

		console.log( this.story['cyan']['bold']['underline'] );

		const model = this.model;
		const UT = new model( '123456789', container );
		container.storage.Inject( UT.Id(), this.previous );

		const action = this.action;
		await UT.Load();
		try {
			await UT[action]( ...this.parameters );
		}
		catch ( err ) {
			console.log( `Tried to apply ${action['magenta']} but it failed,\n with error: ${err.message['yellow']}` )
		}
		const results = await UT.Store();
		this.Test( expected, results );
		return new And( UT );
	}

	/**
	 * Compares two sets of events
	 * @param {Array} expected
	 * @param {Array} results
	 * @private
	 */
	Test( expected, results ) {
		let failure = false;
		if ( expected.length == 0 && results.length != 0 ) {
			const d = diff.diffJson( expected, results );
			d.forEach( ( part ) => {
				const color = part.added ? (
						() => {
							failure = true;
							return 'green';
						}
					)() :
					part.removed ? (
							() => {
								failure = true;
								return 'red';
							}
						)() : 'grey';
				process.stdout.write( part.value[color] );
			} );
		}

		results.forEach( ( result, i ) => {
			console.log( `${result.name['blue']}:` );
			if ( expected[i] ) {
				if ( expected[i].name === result.name ) {
					Object.keys( expected[i].data ).forEach( ( key ) => {
						if ( typeof expected[i].data[key] === 'string'
						     && expected[i].data[key][0] === '{'
						     && expected[i].data[key][expected[i].data[key].length - 1] === '}' ) {
							if ( expected[i].data[key]
							     && typeof result.data[key] === expected[i].data[key].substr( 1, expected[i].data[key].length - 2 ).toLowerCase() ) {
								expected[i].data[key] = result.data[key];
							}
						}
					} );
					const d = diff.diffJson( result.data, expected[i].data );
					d.forEach( ( part ) => {
						const color = part.added ? (
								() => {
									failure = true;
									return 'green';
								}
							)() :
							part.removed ? (
									() => {
										failure = true;
										return 'red';
									}
								)() : 'grey';
						process.stdout.write( part.value[color] );
					} );
					//console.log( d );
				} else {
					console.log( `Got event ${result.name['blue']} but expected ${expected[i].name['blue']}`['red'] );
					process.exit( 1 );
				}
			} else {
				console.log( `Unexpected event '${result.name['blue']}'`['red'] );
				process.exit( 1 );
			}
			process.stdout.write( "\n" );

			if ( failure ) {
				process.exit( 1 );
			}
		} );
	}
}

/**
 * Given a story
 */
class Given {

	/**
	 * Given, When, Then
	 * @param {string} story
	 * @param {object} object
	 * @param {Array} events
	 */
	constructor( story, object, events = [] ) {
		this.story = story;
		this.events = this.TransformEvents( events );
		this.model = object;
	}

	/**
	 * Transforms one set of events into an internal set of events
	 * @param {Array} events
	 * @returns {Array}
	 * @private
	 */
	TransformEvents( events ) {
		const ret = [];
		let version = 0;
		events.forEach( ( event ) => {
			ret.push( {
				model_id: '123456789',
				version: version ++,
				type: 'event',
				name: event.name,
				data: event.data,
				stored: true,
				at: new Date()
			} );
		} );

		return ret;
	}

	/**
	 * When
	 * @param {string} action
	 * @param {*} parameters
	 * @returns {When}
	 */
	When( action, ...parameters ) {
		return new When( this.model, this.events, action, parameters, this.story );
	}
}

module.exports = Given;