const LiveActor = require( './liveActor' );

class Player extends LiveActor {
	/**
	 * Called when a player calls in
	 * @param {Response} response
	 */
	AnswerCall( response ) {
		const lives = this._state[ 'lives' ];
		this.Fire( 'call_received', {} );
		if (this._state['prepared']) {
			response.addSpeak()
		}
		this.Fire( 'instructions_played', {} );
		//todo: play current wait time
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
	entered_game( data ) {
		this._state[ 'status' ] = 'playing';
	}

	instructions_played( data ) {
		const from = this._state[ 'status' ];
		if ( from == 'initialized' ) {
			this._state[ 'status' ] = 'waiting';
		} else {
			this.Fire( 'invalid_state_transition', {
				from,
				to: 'waiting',
				reason: 'instructions_played cannot wait from here'
			} );
		}
	}

	call_received( data ) {
		const from = this._state[ 'status' ];
		if ( from == 'not_playing' || from == 'on_ice' ) {
			this._state[ 'status' ] = 'initialized';
		} else {
			this.Fire( 'invalid_state_transition', {
				from,
				to: 'initialized',
				reason: 'call_received cannot initialize from here'
			} );
		}
	}
}

module.exports = Player;