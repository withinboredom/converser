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
            r.dbCreate(config.db.name).run(conn);
            r.db(config.db.name).tableCreate('version').run(conn);
            r.db(config.db.name).table('version').insert({
                id: 'db',
                value: 0
            }).run(conn);
        }

        const db = r.db(config.db.name);

        const currentVersion = await db.table('version').get('db').run(conn);
        const expectedVersion = 13;

        switch (currentVersion.value + 1) {
            case 1:
                db.tableCreate('users').run(conn);
            case 2:
                db.table('users').indexCreate('phone').run(conn);
            case 3:
                db.tableCreate('calls').run(conn);
            case 4:
                db.tableCreate('sessions').run(conn);
            case 5:
                db.tableCreate('sms').run(conn);
            case 6:
                db.table('sessions').indexCreate('phone').run(conn);
                db.table('sessions').indexCreate('token').run(conn);
                db.table('sessions').indexCreate('user_id').run(conn);
            case 7:
                r.dbCreate('records').run(conn);
            case 8:
                r.db('records').tableCreate('events').run(conn);
                r.db('records').tableCreate('snapshots').run(conn);
            case 9:
                r.db('records').table('events').indexCreate('model_id').run(conn);
            case 10:
                db.tableCreate('payments').run(conn);
        }

        if (currentVersion.value != expectedVersion) {
            db.table('version').update({
                id: 'db',
                value: expectedVersion
            }).run(conn);
        }
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
};

module.exports = doMigration;