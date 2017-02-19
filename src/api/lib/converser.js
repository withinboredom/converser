const LiveActor = require( './liveActor' );
const Timer = require( './timer' );

class Converser extends LiveActor {
	constructor( container ) {
		super( 'converser', container );

		// user tracking
		this.doit( 'created_session' );
		this.doit( 'zombie' );
		this.doit( 'active_session_changed' );
		this.doit( 'set_lives' );

		// payment tracking
		this.doit( 'payment_attempt' );
		this.doit( 'payment_success' );
		this.doit( 'payment_fraud' );
		console.log( 'new: ', this._instanceId )

		this.timer = new Timer( 10, container );
		this.timer.Load();
		this.ListenFor( this.timer.Id(), 'tick', 'tick', Infinity, Infinity );
		this.timer.StartTimer( new Date() );
	}

	doit( name ) {
		this._container.storage.SubscribeToName( name, ( event ) => this.ApplyEvent( event ) );
	}

	/**
	 * Called on each tick...
	 * @param data
	 */
	tick( data ) {
		if ( ! this._replaying ) {
			console.log( 'tick' );
		}
	}

	/* Listening for events */

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


}

module.exports = Converser;