const LiveActor = require( './liveActor' );
const Timer = require( './timer' );
const Player = require( './player' );

class Game extends LiveActor {
	constructor( id, container ) {
		super( id, container );
		this._state = {
			player: [],
			time: 0
		};
		this._state.progress = 'not-started';
		this.timer = new Timer( 60, container );
		this.timer.Load();
		this.ListenFor( this.timer.Id(), 'tick', 'tock', Infinity, Infinity );
	}

	Project() {
		console.log( `Projecting game:${this._instanceId}` );
		const r = this._container.r;
		const conn = this._container.conn;

		r.table( 'games' )
		 .get( this.Id() )
		 .replace( {
			 id: this.Id(),
			 players: this._state.player,
			 progress: this._state.progress
		 } ).run( conn );
	}

	tock( data ) {
		this.Fire( 'minute_passed', {
			time: this._state.time,
			numberTocks: 1
		} );
	}

	minute_passed( data ) {
		const { time } = this._state;

		if ( time == data.time && this._state.player.length == 2 ) {
			this._state.time += data.numberTocks;

			if ( this._state.time % 2 ) {
				this._state.player.forEach( async( playerContainer ) => {
					const player = new Player( playerContainer.id, this._container );
					await player.Load();
					player.GivePoints( 100 );
					player.Destroy();
				} );
			}

			if ( this._state.time > 0 && this._state.time % 10 ) {
				this.Fire( 'game_tied', {} );
			}
		}
	}

	async AddPlayer( id, callId ) {
		if ( callId === undefined ) {
			throw 'undefined callId';
		}
		this.Fire( 'player_join', {
			playerId: id,
			callId
		} );
		const player = new Player( id, this._container );
		await player.Load();
		player.EnterGame( this.Id(), callId );
		player.Destroy();
	}

	async StartGame() {
		this.Fire( 'started_game', {} );
		this.timer.StartTimer( new Date() );
	}

	player_join( data ) {
		this._state.progress = 'in-progress';
		this.ListenFor( data.playerId, 'hangup', 'hangup', 1, 600000 );
		const has = this._state.player.reduce( ( carry, current ) => {
			if ( carry ) {
				return carry;
			}

			return current.id === data.playerId;
		}, false );

		if ( ! has ) {
			this._state.player.push( {
				id: data.playerId,
				callId: data.callId
			} );
		}
	}

	started_game( data ) {
		this._state.progress = 'in-progress'
	}

	hangup( data ) {
		//this._state.progress = 'game_over';
	}
}

module.exports = Game;