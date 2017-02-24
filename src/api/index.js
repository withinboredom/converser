require( 'harmonize' );
const app = require( 'express' )();
const http = require( 'http' ).Server( app );
const io = require( 'socket.io' )( http );
const plivo = require( 'plivo' );

const config = require( './config' );

const User = require( './lib/user' );
const Player = require( './lib/player' );
const Container = require( './lib/container' );
const Storage = require( './lib/rqlStorage' );
const Converser = require( './lib/converser' );

const log = console.log;

console.log = ( ...args ) => {
	if ( process.env.NODE_ENV != 'production' ) {
		log( ...args );
	}
};

const container = new Container();
container.snapshots = config.container.snapshots;
container.records = config.container.records;
container.plivo = config.container.plivo;
container.uuid = config.container.uuid;
container.r = config.container.r;
container.charge = config.container.charge;
container.textFrom = config.container.textFrom;
container.callHost = config.plivo.host;

config.container.conn.then( ( conn ) => {
	container.conn = conn;
	container.storage = new Storage( container );

	const converser = new Converser( container );
	converser.Load();

	const junk = new Converser( container );
	junk.Load();

	app.get( '/', ( request, response ) => {
		response.send( '<h1>Hello World</h1>' );
	} );

	app.get( '/call', async( request, response ) => {
		console.log( `incoming call from ${request.query[ 'From' ]}` );
		const r = plivo.Response();
		const player = new Player( request.query[ 'From' ], container );
		await player.Load();
		await player.AnswerCall( r, request.query[ 'CallUUID' ] );
		response.set( {
			'Content-Type': 'text/xml'
		} );
		response.end( r.toXML() );
		player.Destroy();
	} );

	app.get( '/sms', async( request, response ) => {
		const user = new User( request.query[ 'From' ], container );
		await user.Load();
		await user.DoRecordSms( request.query[ 'From' ], request.query[ 'To' ], request.query[ 'Text' ] );
		user.Destroy();
		response.end();
	} );

	app.get( '/reply_text', ( request, response ) => {
		const send = request.query[ 'From' ];
		const r = plivo.Response();
		const digit = request.query[ 'Digits' ];

		if ( digit && digit == '1' ) {
			r.addSpeak( 'It has been sent! Hope to see you soon, Goodbye!', {
				language: 'en-GB',
				voice: 'MAN'
			} );
			container.plivo.send_message( {
				src: container.textFrom,
				dst: send,
				text: `Please visit to purchase credits. Hope to see you soon!`
			} );
		}
		else {
			r.addSpeak( `I apologize, but I didn't get that!`, {
				language: 'en-GB',
				voice: 'MAN'
			} );
		}

		response.set( {
			'Content-Type': 'text/xml'
		} );
		response.end( r.toXML() );
	} );

	app.get( '/hangup', async( request, response ) => {
		console.log( request.query );
		console.log( `Hangup` );
		const player = new Player( request.query[ 'From' ], container );
		await player.Load();
		player.Hangup( request.query );
		response.end();
	} );

	io.on( 'connection', ( socket ) => {

		let continuousUpdate = false;
		let lastUpdate = null;
		let unSubToken = null;

		console.log( 'connected' );

		const sendUpdate = ( id, token ) => {
			if ( ! continuousUpdate ) {
				continuousUpdate = async() => {
					console.log( 'maybe update?' );
					const now = new Date();
					if ( lastUpdate === null ) {
						lastUpdate = new Date();
						setTimeout( continuousUpdate, 1000 );
						console.log( 'waiting' );
					} else if ( now - lastUpdate >= 800 ) {
						if ( socket.connected ) {
							console.log( 'sending update' );
							const user = new User( id, container );
							await user.Load();
							if ( await ValidateUser( user, token ) ) {
								socket.emit( 'refresh', user.GetPlayerInfo() );
								lastUpdate = null;
							}
							else {
								socket.emit( 'logout' );
							}
							user.Destroy();
						}
						else {
							container.storage.Unsubscribe( id, continuousUpdate );
						}
					}
				};
				console.log( `continuous update is enabled for ${id}` );
				container.storage.SubscribeTo( id, continuousUpdate );
				unSubToken = id;
			}
		};

		/**
		 *
		 * @param {User} user
		 * @param {string} token
		 * @returns {boolean}
		 */
		const ValidateUser = async( user, token ) => {
			const isValid = await user.GetActiveToken() === token;

			console.log( `validate: ${token} == ${await user.GetActiveToken()}` );

			if ( isValid ) {
				sendUpdate( user.Id(), token );
			} //todo logout?
			return isValid;
		};

		socket.emit( 'identify' );
		socket.on( 'iam', async( data ) => {
			console.log( 'validating user', data );
			if ( data && data.userId && data.token ) {
				const user = new User( data.userId, container );
				await user.Load();
				if ( ! await ValidateUser( user, data.token ) ) {
					socket.emit( 'logout' );
				}
				user.Destroy();
			}
		} );

		socket.on( 'login', async( data ) => {
			const user = new User( data.phone, container );
			await user.Load();
			await user.DoLogin( data.phone, {
				ip: socket.request.connection.remoteAddress,
				headers: socket.handshake.headers
			} );
			socket.emit( 'logging_in', { phone: user.Id() } );
			user.Destroy();
		} );
		socket.on( 'verify', async( data ) => {
			const user = new User( data.phone, container );
			await user.Load();
			await user.DoVerify( user.Id(), data.password );
			await user.Store();

			const token = await user.GetActiveToken( data.password );
			if ( token ) {
				socket.emit( 'token', {
					userId: user.Id(),
					token
				} );
				sendUpdate( user.Id(), token );
			}
			else {
				socket.emit( 'notification', {
					title: 'Invalid password',
					message: 'Please check your sms messages',
					level: 'info',
					position: 'tc'
				} )
			}
			user.Destroy();
		} );
		socket.on( 'pay', async( data ) => {
			const user = new User( data.userId, container );
			await user.Load();

			if ( await ValidateUser( user, data.token ) ) {
				await user.DoPurchase( data.payToken, data.packageId );
			}
			user.Destroy();
		} );
		socket.on( 'disconnect', () => {
			container.storage.Unsubscribe( unSubToken, continuousUpdate );
			console.log( 'disconnect' );
		} )
	} );

	http.listen( 1337, () => {
		console.log( 'Listening' );
	} );
} );
