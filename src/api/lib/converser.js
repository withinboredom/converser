const LiveActor = require( './liveActor' );

class Converser extends LiveActor {
	constructor( container ) {
		super( 'converser', container );
		this.doit( 'created_session' );
		this.doit( 'zombie' );
		this.doit( 'active_session_changed' );
		console.log( 'new: ', this._instanceId )
	}

	doit( name ) {
		this._container.storage.SubscribeToName( name, ( event ) => this.ApplyEvent( event ) );
	}

	/* Listening for events */

	active_session_changed( data ) {
		this.Fire( 'user signed in', data );
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