const uuid = require( 'uuid/v4' );
const Actor = require( './actor' );

class User extends Actor {
	constructor( id, container ) {
		id = User._CleanPhone( id );
		super( id, container );
	}

	static _CleanPhone( phone ) {
		return phone.replace( /D+/g, '' );
	}

	static _OneTimeCode() {
		let code = `${Math.floor(Math.random() * (9))}`
		for(let i = 0; i < 4; i++) {
			code += `${Math.floor(Math.random() * (9))}`
		}
		return code;
	}

	zombie(data) {
		this._state = Object.assign({}, this._state, {
			phone: data.phone,
			lives: 0,
			status: 'not-playing',
			opponent: null,
			score: 0,
			sessions: [],
			payments: []
		});
	}

	readied(data) {
		const begins = new Date();
		const ends = new Date(begins.valueOf());
		ends.setDate(begins.getDate() + 1);

		this._state.sessions.push({
			id: data.id,
			phone: data.phone,
			ip: data.ip,
			password: data.password,
			begins,
			ends,
			used: false,
			active: false
		});
	}

	DoLogin(phone, ip) {
		phone = User._CleanPhone(phone);
		const password = User._OneTimeCode();
		if (this._state.status === undefined) {
			this.Fire('zombie', {
				phone
			});
		}

		this.Fire('readied', {
			id: uuid(),
			phone,
			password,
			ip
		});

		//todo: send message

		this.Fire('password_text', {
			text: `${password} is your Converser login code.`
		});
	}
}

module.exports = User;