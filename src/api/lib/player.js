const LiveActor = require( './liveActor' );

const NOTPLAYING = 'not-playing';
const INITIALIZED = 'initialized';
const UNKOWN = 'unknown';
const ONICE = 'on-ice';

const WELCOME_VERSION = 'alpha.3';
const WELCOME_TEXT = `
Welcome to Converser! We hope you enjoy playing. Please wait while we find you someone to converse with...
You may find our terms and conditions, as well as the privacy policy at http://converser.space
`;

const REMINDER_TEXT = `
Welcome to Converser! Please wait while we find you someone to converse with...
`;

const DEAD_TEXT = `
You don't seem to have any credits. Please visit http://converser.space to buy some.
You may press 1, to have the link sent to your phone.
`;

class Player extends LiveActor {
	constructor( id, container ) {
		super( id, container );
		this._state[ 'status' ] = NOTPLAYING;
		this._state[ 'lives' ] = 0;
	}

	/**
	 * Called when a player calls in
	 * @param {Response} response
	 */
	AnswerCall( response, callId ) {
		const lives = this._state[ 'lives' ] || 0;
		if ( lives <= 0 ) {
			this.Fire('called_but_dead', {});
			const digits = response.addGetDigits( {
				action: `${this._container.callHost}reply_text`,
				method: 'GET',
				timeout: '7',
				numDigits: '1',
				retries: '1'
			} );
			digits.addSpeak( DEAD_TEXT, {
				'language': 'en-GB',
				'voice': 'MAN'
			} );
			response.addSpeak( 'Hope to see you soon, Goodbye!', {
				language: 'en-GB',
				voice: 'MAN'
			} );
			return;
		}

		this.Fire( 'call_received', {
			status: this._state[ 'status' ],
			callId
		} );

		if ( this._state[ 'welcomed' ] != WELCOME_VERSION ) {
			//todo: flesh this out!
			response.addSpeak( WELCOME_TEXT, {
				'language': 'en-GB',
				'voice': 'MAN'
			} );
			this.Fire( 'welcomed', {
				version: WELCOME_VERSION
			} );
		} else {
			response.addSpeak( REMINDER_TEXT, {
				'language': 'en-GB',
				'voice': 'MAN'
			} );
		}

		response.addConference('lobby', {
			muted: true,
			waitSound: `${this._container.callHost}pretty_music`,
			callbackUrl: `${this._container.callHost}lobby`,
			callbackMethod: 'GET'
		});

		return response;
	}

	Hangup( request ) {
		const data = {
			hangupReason: request[ 'HangupCause' ] || 'in-progress',
			duration: request[ 'Duration' ] || 'unknown',
			billedFor: request[ 'BillDuration' ] || 'unknown',
			TotalCost: request[ 'TotalCost' ] || 'unknown'
		};
		this.Fire( 'hungup', data );
	}

	/**
	 * Called when a player enters a game
	 * @param {string} gameId
	 */
	EnterGame( gameId ) {
		if ( this._state[ 'status' ] != 'waiting' ) {
			throw new Error( 'tried to enter game with incorrect state' );
		}

		this.Fire( 'entered_game', { gameId } );
	}

	/**
	 * Called when a player is given points
	 * @param {int} amount
	 */
	GivePoints( amount ) {
		this.Fire( 'got_points', {
			amount,
			from: this._state[ 'points' ]
		} );
	}

	/**
	 * Puts a player on ice
	 */
	PutOnIce() {
	}

	/**
	 * Called when a player answers the phone
	 */
	ReceiveCall() {
	}


	/* Event handlers */
	set_lives( data ) {
		this._state.lives = this._state.lives == data.existingLives ? (
		                                                              this._state.lives || 0
		                                                              ) + data.lives : this._state.lives;
	}

	welcomed( data ) {
		this._state[ 'welcomed' ] = data.version;
	}

	entered_game( data ) {
		this._state[ 'status' ] = 'playing';
	}

	call_received( data ) {
		const from = data.status || UNKOWN;
		if ( from !== this._state[ 'status' ] ) {
			return;
		}
		if ( from == NOTPLAYING || from == ONICE || from == UNKOWN ) {
			this._state[ 'status' ] = INITIALIZED;
			this.Fire( 'was_initialized', {
				callId: data.callId
			} );
		} else {
			this.Fire( 'invalid_state_transition', {
				from,
				to: INITIALIZED,
				reason: 'call_received cannot initialize from here'
			} );
		}
	}

	hungup( data ) {
		let status = NOTPLAYING;

		this.Fire( 'stopped_playing', {} );

		this._state[ 'status' ] = status;
	}
}

module.exports = Player;