const r = require( 'rethinkdbdash' );

const connection = async( host ) => {
	return await r( {
		servers: [
			host
		]
	} );
};

const doMigration = async( host, config ) => {
	try {
		const r = await connection( host );
		let dbs = await r.dbList().run();
		dbs = dbs.filter( ( db ) => {
			return db == config.db.name;
		} );

		if ( dbs.length == 0 ) {
			await r.dbCreate( config.db.name ).run();
			await r.db( config.db.name ).tableCreate( 'version' ).run();
			await r.db( config.db.name ).table( 'version' ).wait();
			await r.db( config.db.name ).table( 'version' ).insert( {
				id: 'db',
				value: 0
			} ).run();
		}

		let currentVersion = await r.db( config.db.name ).table( 'version' ).get( 'db' ).run();
		if ( ! currentVersion ) {
			currentVersion = 0;
		}

		const expectedVersion = 13;

		switch ( currentVersion.value + 1 ) {
			case 1:
				await r.db( config.db.name ).tableCreate( 'users' ).run();
				await r.db( config.db.name ).table( 'users' ).wait();
			case 2:
				await r.db( config.db.name ).table( 'users' ).indexCreate( 'phone' ).run();
			case 3:
				await r.db( config.db.name ).tableCreate( 'calls' ).run();
				await r.db( config.db.name ).table( 'calls' ).wait();
			case 4:
				await r.db( config.db.name ).tableCreate( 'sessions' ).run();
				await r.db( config.db.name ).table( 'sessions' ).wait();
			case 5:
				await r.db( config.db.name ).tableCreate( 'sms' ).run();
			case 6:
				await r.db( config.db.name ).table( 'sessions' ).indexCreate( 'phone' ).run();
				await r.db( config.db.name ).table( 'sessions' ).indexCreate( 'token' ).run();
				await r.db( config.db.name ).table( 'sessions' ).indexCreate( 'user_id' ).run();
			case 7:
				await r.dbCreate( 'records' ).run();
			case 8:
				await r.db( 'records' ).tableCreate( 'events' ).run();
				await r.db( 'records' ).tableCreate( 'snapshots' ).run();
			case 9:
				await r.db( 'records' ).table( 'events' ).indexCreate( 'model_id' ).run();
			case 10:
				await r.db( config.db.name ).tableCreate( 'payments' ).run();
			case 11:
				await r.db( 'records' ).table( 'events' ).indexCreate( 'version' ).run();
			case 12:
				await r.db( config.db.name ).tableDrop( 'calls' ).run();
				await r.db( config.db.name ).tableCreate( 'games' ).run();
			case 13:
				await r.db( config.db.name ).table( 'games' ).indexCreate( 'progress' ).run();
		}

		if ( currentVersion.value != expectedVersion ) {
			r.db( config.db.name ).table( 'version' ).update( {
				id: 'db',
				value: expectedVersion
			} ).run();
		}

		return r;
	} catch ( err ) {
		console.log( err );
		process.exit( 1 );
	}
};

module.exports = doMigration;