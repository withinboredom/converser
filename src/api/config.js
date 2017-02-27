const conn = require( './migrations.js' );
const Stripe = require( 'stripe' );
const Plivo = require( 'plivo' );

const db = {
	name: process.env.DB_NAME ? process.env.DB_NAME : 'converser',
	host: process.env.DB_HOST ? process.env.DB_HOST : 'localhost',
};

const plivo = {
	sms: process.env.SMS ? process.env.SMS : '18037143889',
	call: process.env.CALL ? process.env.CALL : '18037143889',
	host: process.env.CALL_HOST ? process.env.CALL_HOST : 'http://dev.converser.space:1337/',
	id: process.env.PLIVO_ID,
	token: process.env.PLIVO_TOKEN
};

const stripe = {
	key: process.env.STRIPE_KEY
};

const container = {
	plivo: Plivo.RestAPI( {
		authId: plivo.id,
		authToken: plivo.token
	} ),
	charge: Stripe( stripe.key ),
	storage: null, //todo
	textFrom: plivo.sms
};

const config = {
	db,
	plivo,
	stripe,
	container
};

container.conn = conn( db.host, config );

module.exports = config;