const r = require('rethinkdb');
const conn = require('./migrations.js');

const db = {
    name: process.env.DB_NAME ? process.env.DB_NAME : 'converser',
    host: process.env.DB_HOST ? process.env.DB_HOST : 'localhost',
};

const plivo = {
    sms: process.env.SMS ? process.env.SMS : '18037143889',
    call: process.env.CALL ? process.env.CALL : '18037143889',
    host: process.env.CALL_HOST ? process.env.CALL_HOST : 'http://dev.converser.space:2200/',
    id: process.env.PLIVO_ID,
    token: process.env.PLIVO_TOKEN
};

const stripe = {
    key: process.env.STRIPE_KEY
};

const container = {
    snapshots: r.db('records').table('snapshots'),
    records: r.db('records').table('events'),
    plivo: null, //todo
    uuid: r.uuid(),
    r: r.db(db.name),
    charge: null, //todo
    storage: null //todo
};

const config = {
    db,
    plivo,
    stripe,
    container
};

conn(db.host, config);

module.exports = config;