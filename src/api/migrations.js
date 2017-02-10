const r = require('rethinkdb');

const connection = async(host) =>
{
    return await r.connect(host);
};

const doMigration = async(host, config) =>
{
    try {
        const conn = await connection(host);
        let dbs = await r.dbList().run(conn);
        dbs = dbs.filter((db) =>
        {
            return db == config.db.name;
        });

        if (dbs.length == 0) {
            await r.dbCreate(config.db.name).run(conn);
	        await r.db(config.db.name).tableCreate('version').run(conn);
            await r.db(config.db.name).table('version').wait();
	        await r.db(config.db.name).table('version').insert({
                id: 'db',
                value: 0
            }).run(conn);
        }

        const db = r.db(config.db.name);

        let currentVersion = await db.table('version').get('db').run(conn);
        if (!currentVersion) {
            currentVersion = 0;
        }

        const expectedVersion = 11;

        switch (currentVersion.value + 1) {
            case 1:
	            await db.tableCreate('users').run(conn);
	            await db.table('users').wait();
            case 2:
	            await db.table('users').indexCreate('phone').run(conn);
            case 3:
	            await db.tableCreate('calls').run(conn);
	            await db.table('calls').wait();
            case 4:
	            await db.tableCreate('sessions').run(conn);
	            await db.table('sessions').wait();
            case 5:
	            await db.tableCreate('sms').run(conn);
            case 6:
	            await db.table('sessions').indexCreate('phone').run(conn);
	            await db.table('sessions').indexCreate('token').run(conn);
	            await db.table('sessions').indexCreate('user_id').run(conn);
            case 7:
	            await r.dbCreate('records').run(conn);
            case 8:
	            await r.db('records').tableCreate('events').run(conn);
	            await r.db('records').tableCreate('snapshots').run(conn);
            case 9:
	            await r.db('records').table('events').indexCreate('model_id').run(conn);
            case 10:
	            await db.tableCreate('payments').run(conn);
	        case 11:
	        	await r.db('records').table('events').indexCreate('version').run(conn);
        }

        if (currentVersion.value != expectedVersion) {
            db.table('version').update({
                id: 'db',
                value: expectedVersion
            }).run(conn);
        }

        return conn;
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
};

module.exports = doMigration;