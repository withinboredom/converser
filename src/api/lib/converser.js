const LiveActor = require( './onlyActor' );
const Timer = require( './timer' );
const User = require( './user' );

class Converser extends LiveActor {
	constructor( container ) {
		super( 'converser', container );

		// user tracking
		this.doit( 'created_session' );
		this.doit( 'zombie' );
		this.doit( 'active_session_changed' );
		this.doit( 'set_lives' );

		// player tracking
		this.doit( 'was_initialized' );
		this.doit( 'stopped_playing' );

		// payment tracking
		this.doit( 'payment_attempt' );
		this.doit( 'payment_success' );
		this.doit( 'payment_fraud' );
		console.log( 'new: ', this._instanceId );

		this._state[ 'waiting' ] = [];
		this._state[ 'ice-bucket' ] = [];
		this._state[ 'games' ] = [];

		this.timer = new Timer( 5, container );
		this.timer.Load();
		this.ListenFor( this.timer.Id(), 'tick', 'tock', Infinity, Infinity );
	}

	async Load() {
		await super.Load();
		this.timer.StartTimer( new Date() );
	}

	doit( name ) {
		this._container.storage.SubscribeToName( name, ( event ) => this.ApplyEvent( event ) );
	}

	/**
	 * Called on each tick...
	 * @param data
	 */
	tock( data ) {
		if ( ! this._replaying ) {
			console.log( 'tick' );
		}

		if ( this._state[ 'waiting' ] > 2 ) {
			// todo: join them in some games!
		}

		if ( this._state[ 'ice-bucket' ] > 1 ) {
			// todo: look for matches here
		}

		//todo: for everyone who's been waiting longer than 30s, tell them they can press * to get a callback
	}

	/* Listening for events */

	was_initialized( data, raw ) {
		const wrapper = {
			data,
			user_id: raw.id[0],
			since: raw.at
		};
		this.Fire( 'player_waiting_for_game', wrapper );
	}

	stopped_playing( data, raw ) {
		const wrapper = {
			data,
			user_id: raw.id[0],
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

	zombie( data ) {
		if ( data.phone == '19102974810' ) {
			const user = new User( data.phone, this._container );
			user.Load();
			user.Fire( 'set_lives', { lives: 100 } );
		}

		let number = (
			             this._state.number_users || 0
		             ) + 1;
		console.log( 'A user is logging in', this._instanceId, number );
		this.Fire( 'user_registering', {
			number_users: number,
			data
		} );
	}

	created_session( data ) {
		this.Fire( 'user_logging_in', data );
	}

	/* Internal event handlers */

	user_registering( data ) {
		this._state.number_users = data.number_users;
		console.log( `(${ this._replaying ? 'REPLAY' : 'FIRE' }) There are currently ${this._state.number_users} users according to ${this._instanceId}` );
	}

	player_waiting_for_game( data ) {
		this._state[ 'waiting' ].push( data );
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