const Container = require( '../container' );
const Storage = require( '../memStorage' );
process.stdout.isTTY = true;
require( 'colors' ).enabled = true;
const diff = require( 'diff' );

class DB {

}

class When {
	constructor( model, previous, action, params, story ) {
		this.previous = previous;
		this.action = action;
		this.model = model;
		this.parameters = params;
		this.story = story;
	}

	async Then( expected ) {
		const container = new Container();
		container.snapshots = new DB();
		container.records = new DB( this.previous );
		container.plivo = null;
		container.R = new DB();
		container.charge = null;
		container.storage = new Storage( container );

		const model = this.model;
		const UT = new model( '123456789', container );
		container.storage.Inject( UT.Id(), this.previous );

		const action = this.action;
		await UT.Load();
		await UT[action]( ...this.parameters );
		const results = await UT.Store();
		this.Test( expected, results );
	}

	Test( expected, results ) {
		expected.forEach( ( expect, i ) => {
			if ( results[i] ) {
				if ( results[i].name === expect.name ) {
					Object.keys( expect.data ).forEach( ( key ) => {
						if ( typeof expect.data[key] === 'string'
						     && expect.data[key][0] === '{'
						     && expect.data[key][expect.data[key].length - 1] === '}' ) {
							if ( results[i].data[key]
							     && typeof results[i].data[key] === expect.data[key].substr( 1, expect.data[key].length - 2 ).toLowerCase() ) {
								expect.data[key] = results[i].data[key];
							}
						}
					} );
					const d = diff.diffJson( expect.data, results[i].data );
					d.forEach( ( part ) => {
						const color = part.added ? 'green' :
							part.removed ? 'red' : 'grey';
						process.stdout.write( part.value[color] );
					} );
					//console.log( d );
				} else {
					console.log( `expected event ${expect.name} but got ${results[i].name}` );
					process.exit( 1 );
				}
			} else {
				console.log( `expected event '${expect.name} but got nothing` );
				process.exit( 1 );
			}
			process.stdout.write( "\n" );
		} );
	}
}

class Given {
	constructor( story, object, events = [] ) {
		this.story = story;
		this.events = this.TransformEvents( events );
		this.model = object;
	}

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

	When( action, ...parameters ) {
		return new When( this.model, this.events, action, parameters, this.story );
	}
}

module.exports = Given;