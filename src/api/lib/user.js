const uuid = require( 'uuid/v4' );
const LiveActor = require( './liveActor' );
const Payment = require( './payment' );
const r = require( 'rethinkdb' );

/**
 * Generally used to initialize a user...
 * @event zombie
 */

/**
 * Indicates a user's session has been created and can be logged into
 * @event created_session
 */

/**
 * Indicates that the user has received their password
 * @event password_text_sent
 */

/**
 * Indicates a user verified an inactive session by inputting a one-time code. The client will receive a token.
 * @event active_session_changed
 */

/**
 * Indicates a text was received from this user
 * @event received_text
 */

/**
 * Indicates a text was sent to this user
 * @event sent_text
 */

/**
 * A User
 * @augments LiveActor
 */
class User extends LiveActor {

	/**
	 * Creates a user!
	 * @param {string} id
	 * @param {Container} container
	 */
	constructor( id, container ) {
		id = User._CleanPhone( id );
		super( id, container );

		this._state = {
			phone: id,
			lives: 0,
			status: 'not-playing',
			opponent: null,
			score: 0,
			sessions: [],
			payments: []
		};
	}

	/**
	 * Returns a nice and clean phone number
	 * @param {string} phone
	 * @returns {string}
	 * @private
	 * @static
	 */
	static _CleanPhone( phone ) {
		return phone.replace( /\D+/g, '' );
	}

	/**
	 * Returns a purty password
	 * @returns {string}
	 * @private
	 * @static
	 */
	static _OneTimeCode() {
		let code = `${Math.floor( Math.random() * (
				9
			) )}`;
		for ( let i = 0; i < 4; i ++ ) {
			code += `${Math.floor( Math.random() * (
					9
				) )}`
		}
		return code;
	}

	was_initialized(data) {
		this._state.status = 'waiting';
	}

	stopped_playing(data) {
		this._state.status = 'not-playing';
	}

	/**
	 * This is the 'initializing' event of this object...
	 * @listens zombie
	 * @param {{}} data
	 */
	zombie( data ) {
		this._state = Object.assign( {}, this._state, {
			phone: data.phone,
			lives: 0,
			status: 'not-playing',
			opponent: null,
			score: 0,
			sessions: [],
			payments: []
		} );
	}

	/**
	 * Indicates a session has been created, and we're waiting for the user to login
	 * @listens created_session
	 * @param {{}} data
	 */
	created_session( data ) {
		const begins = data.begins;
		const ends = new Date( begins.valueOf() );
		ends.setDate( begins.getDate() + 1 );

		this._state.sessions.push( {
			id: data.id,
			phone: data.phone,
			ip: data.ip,
			password: data.password,
			begins,
			ends,
			used: false,
			active: false,
			token: data.token
		} );
	}

	/**
	 * Sets the active session for the user
	 * @listens active_session_changed
	 * @param data
	 */
	active_session_changed( data ) {
		this._state.sessions = this._state.sessions.map( ( session ) => {
			if ( session.id === data.id && ! session.used ) {
				session.used = true;
				session.active = true;
			} else {
				session.active = false;
			}

			return session;
		} );
	}

	attempt_payment( data ) {
		this._state.payments.push( data.paymentId );
	}

	set_lives( data ) {
		this._state.lives += this._state.lives == data.existingLives ? data.lives : 0;
	}

	/**
	 * Kicks off the beginning of a user's login by creating a session
	 * @param {string} phone
	 * @param {string} ip
	 * @fires zombie
	 * @fires created_session
	 * @fires password_text_sent
	 */
	DoLogin( phone, ip ) {
		phone = User._CleanPhone( phone );
		const password = User._OneTimeCode();
		if ( this._state.status === undefined ) {

			this.Fire( 'zombie', {
				phone
			} );
		}

		this.Fire( 'created_session', {
			id: uuid(),
			phone,
			password,
			ip,
			begins: new Date(),
			token: uuid()
		} );

		this._container.plivo.send_message( {
			src: this._container.textFrom,
			dst: phone,
			text: `${password} is your Converser login code.`
		} );

		this.Fire( 'password_text_sent', {
			text: `${password} is your Converser login code.`
		} );
	}

	/**
	 * Verifies an inactive session and sets the active session
	 * @param phone
	 * @param password
	 * @fires active_session_changed
	 */
	DoVerify( phone, password ) {
		const now = new Date();
		const session = this._state.sessions.reduce( ( carry, item ) => {
			if ( password == '' || password === null || password === undefined ) {
				return null;
			}

			if ( item.password === password
			     && item.ends >= now
			     && item.used == false ) {
				return item;
			}

			return carry;
		}, null );

		if ( session ) {
			this.Fire( 'active_session_changed', {
				id: session.id
			} );
		}
	}

	/**
	 * A user texted something to us ... a basic no-op for now, just record it occurred
	 * @param from
	 * @param to
	 * @param text
	 * @fires received_text
	 * @fires sent_text
	 */
	DoRecordSms( from, to, text ) {
		const response =
			`Thank you for your message, it has been stored. We will review it and get back to you as soon as possible.`;

		this.Fire( 'received_text', {
			from,
			to,
			text
		} );

		this._container.plivo.send_message( {
			src: this._container.textFrom,
			dst: from,
			text: response
		} );

		this.Fire( 'sent_text', {
			from: this._container.textFrom,
			to: from,
			text: response
		} );
	}

	async DoPurchase( paymentToken, packageId ) {
		const payment = new Payment( uuid(), this._container );
		await payment.Load();

		this.Fire( 'attempt_payment', {
			paymentToken,
			packageId,
			paymentId: payment.Id()
		} );

		await payment.DoPay( this.Id(), paymentToken, packageId, this._state.lives );

		this.ListenFor( payment.Id(), 'payment_success', 'set_lives', 1 );

		payment.Destroy();
	}

	Project() {
		console.log( `Projecting user ${this._instanceId}` );
		const r = this._container.r;
		r.table( 'users' )
		 .get( this.Id() )
		 .replace( {
			 id: this.Id(),
			 phone: this._state.phone,
			 lives: this._state.lives,
			 status: this._state.status,
			 score: this._state.score,
			 payments: this._state.payments
		 } ).run( this._container.conn );

		this._state.sessions.forEach( ( session ) => {
			r.table( 'sessions' )
			 .get( session.id )
			 .replace( session )
			 .run( this._container.conn );
		} );
	}

	async GetActiveToken( password ) {
		const tokenResponse = await this._container.r.table( 'sessions' )
		                                .getAll( this.Id(), { index: 'phone' } )
		                                .filter( ( session ) => {
			                                if ( password ) {
				                                return r.now().during( session( 'begins' ), session( 'ends' ) )
				                                        .and( session( 'password' ).eq( password ) );
			                                }

			                                return r.now().during( session( 'begins' ), session( 'ends' ) )
			                                        .and( session( 'active' ) );
		                                } ).pluck( 'token' ).run( this._container.conn );

		const token = await tokenResponse.toArray();

		if ( token.length == 0 ) {
			return;
		}

		const activeSession = token[ 0 ];

		return activeSession.token;
	}

	GetPlayerInfo() {
		return {
			type: 'user',
			lives: this._state.lives,
			score: this._state.score,
			status: this._state.status,
			userId: this.Id()
		};
	}
}

module.exports = User;