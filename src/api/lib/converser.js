const uuid = require( 'uuid' );
const QueueActor = require( './onlyActor' );
const Timer = require( './timer' );
const User = require( './user' );
const Game = require( './game' );

class Converser extends QueueActor {
	constructor( id, container ) {
		if (!container) {
			container = id;
		}
		super( 'converser', container );

		/* user tracking
		this.doit( 'created_session' );
		this.doit( 'active_session_changed' );
		this.doit( 'set_lives' );

		// player tracking
		this.doit( 'entered_lobby' );
		this.doit( 'stopped_playing' );

		// payment tracking
		this.doit( 'payment_attempt' );
		this.doit( 'payment_success' );
		this.doit( 'payment_fraud' );
		console.log( 'new: ', this._instanceId );
		*/

		this._state[ 'waiting' ] = [];
		this._state[ 'ice-bucket' ] = [];
		this._state[ 'games' ] = [];

		this.timer = new Timer( 'timer_5', container );
		this.timer.Load();
		this.ListenFor( 'timer_5', 'tick', 'tock', Infinity, Infinity );
	}

	async Load() {
		await super.Load();
		this.timer.StartTimer( new Date() );
		this.timer = undefined;
	}

	doit( name ) {
		this._container.storage.SubscribeToName( name, ( event ) => this.ApplyEvent( event, event.replay ) );
	}

	/**
	 * Called on each tick...
	 * @param data
	 */
	tock( data ) {
		if ( ! this._replaying ) {
			console.log( 'tick' );
		}

		while ( this._state[ 'waiting' ].length >= 2 ) {
			const user1 = this._state[ 'waiting' ].shift();
			const user2 = this._state[ 'waiting' ].shift();
			if ( ! this._replaying ) {
				this.Fire( 'start_game', {
					user1,
					user2
				} );
			}
		}

		if ( this._state[ 'ice-bucket' ] > 1 ) {
			// todo: look for matches here
		}

		//todo: for everyone who's been waiting longer than 30s, tell them they can press * to get a callback
	}

	async start_game( data ) {
		if ( ! this._replaying ) {
			const { user1, user2 } = data;
			const game = new Game( uuid(), this._container );
			await game.Load();
			await game.AddPlayer( user1.user_id, user1.data.callId );
			await game.AddPlayer( user2.user_id, user2.data.callId );

			//todo: listen for game_over
		}
	}

	/* Listening for events */

	entered_lobby( data, raw ) {
		if ( data.callId === undefined ) {
			throw 'undefined callId';
		}
		const wrapper = {
			data,
			user_id: raw.id[ 0 ],
			since: raw.at
		};
		this.Fire( 'player_waiting_for_game', wrapper );
	}

	stopped_playing( data, raw ) {
		const wrapper = {
			data,
			user_id: raw.id[ 0 ],
			since: raw.at
		};
		this.Fire( 'remove_player', wrapper );
	}

	set_lives( data ) {
		this.Fire( 'issued_lives', data );
	}

	payment_attempt( data ) {
		this.Fire( 'payment_is_started', data );
	}

	payment_success( data ) {
		this.Fire( 'payment_is_complete', data );
	}

	payment_fraud( data ) {
		this.Fire( 'payment_might_be_fraud', data );
	}

	active_session_changed( data ) {
		this.Fire( 'user_signed_in', data );
	}

	created_session( data ) {
		this.Fire( 'user_logging_in', data );
	}

	/* Internal event handlers */

	player_waiting_for_game( data ) {
		console.log( 'WTF: Add player to game', data, this._replaying );
		this._state[ 'waiting' ].push( data );

		const seen = [];
		this._state[ 'waiting' ] = this._state.waiting.filter( ( caller ) => {
			const hasSeen = seen.indexOf( caller.user_id ) >= 0;
			if ( hasSeen ) {
				return false;
			}
			seen.push( caller.user_id );
			return true;
		} );

		console.log( 'WTF:', this._state );
	}

	remove_player( data ) {
		// remove the player from both queues
		this._state[ 'waiting' ] = this._state[ 'waiting' ]
			.filter( ( player ) => player.user_id != data.user_id );
		this._state[ 'ice-bucket' ] = this._state[ 'ice-bucket' ]
			.filter( ( player ) => player.user_id != data.user_id );
	}
}

module.exports = Converser;