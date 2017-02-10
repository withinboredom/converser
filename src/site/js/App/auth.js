import io from 'socket.io-client';

let token = false;
let websocket = io.connect( process.env.API_HOST );

const tokenResp = [];

const sendCache = [];

let player = false;

const ret = {
	onPlayerUpdate: null,
	onNotify: null
};

websocket.on( 'connect', () => {
	if ( sendCache.length > 0 ) {
		let s;
		while ( s = sendCache.pop() ) {
			send( s );
		}
	}

	if ( getToken() ) {
		const t = getToken();
		send( {
			command: 'refresh',
			token: t.token,
			userId: t.userId
		} );
	}
	else {
		let match,
			pl = /\+/g,  // Regex for replacing addition symbol with a space
			search = /([^&=]+)=?([^&]*)/g,
			decode = function ( s ) {
				return decodeURIComponent( s.replace( pl, " " ) );
			},
			query = window.location.search.substring( 1 );

		const urlParams = {};
		while ( match = search.exec( query ) ) {
			urlParams[decode( match[1] )] = decode( match[2] );
		}

		send( {
			command: 'initial_connect',
			campaign: urlParams
		} );
	}
} );

const logout = () => {
	try {
		localStorage.clear();
	}
	finally {
		token = false;
		player = {
			lives: 0,
			score: 0,
			status: 'loading'
		};
		location.reload();
	}
};

let isRefreshing = false;
const autoRefresh = () => {
	if ( player && ! isRefreshing ) {
		isRefreshing = true;
		/*setInterval(() => {
		 const t = getToken();
		 send({
		 command: 'refresh',
		 token: t.token,
		 userId: t.userId
		 });
		 }, 5000);*/
	}
};

websocket.on( 'token', ( data ) => {
	window.ga( 'send', 'event', 'user', 'login', '', - 1 );
	localStorage.setItem( 'token', JSON.stringify( data ) );
	token = data;
	tokenResp.forEach( ( cb ) => {
		cb( data );
		tokenResp.pop();
	} )
} );

websocket.on( 'notification', ( data ) => {
	window.ga( 'send', 'event', 'user', 'received_notification' );
	if ( ret.onNotify ) {
		const notification = {
			...data,
			dismissible: false
		};
		ret.onNotify( notification );
	}
} );

websocket.on( 'identify', () => {
	websocket.emit( 'iam', getToken() );
} );

websocket.on( 'refresh', ( data ) => {
	localStorage.setItem( 'player', JSON.stringify( data ) );
	player = data;
	if ( ret.onPlayerUpdate ) {
		ret.onPlayerUpdate( player );
	}
} );

websocket.on( 'message', ( event ) => {
	const msg = JSON.parse( event.data );

	switch ( msg.type ) {
		case 'logout':
			console.log( 'logging out due to invalid key/token' );
			logout();
			break;
	}
} );

const send = ( message, retries = 100 ) => {
	websocket.emit( message.command, message );
};

const login = ( phone, cb ) => {
	tokenResp.push( cb );
	window.ga( 'send', 'event', 'user', 'login_attempt' );
	send( {
		command: 'login',
		phone: phone
	} );
	return ( pass ) => {
		auth( phone, pass, cb );
	}
};

const auth = ( phone, pass, cb ) => {
	window.ga( 'send', 'event', 'user', 'verify_attempt' );
	send( {
		command: 'verify',
		phone: phone,
		password: pass
	} );
};

const onChange = () => {
};

const getToken = () => {
	try {
		return token = token || JSON.parse( localStorage.getItem( 'token' ) );
	}
	catch ( e ) {
		return token;
	}
};

const getPlayer = () => {
	try {
		player = player || JSON.parse( localStorage.getItem( 'player' ) );
	}
	catch ( e ) {
		player;
	}

	if ( ! player ) {
		player = {
			lives: 0,
			score: 0,
			status: 'loading'
		};
	}
	return player;
};

const loggedIn = () => {
	return ! ! getToken();
};

const makePayment = ( packageId, payToken ) => {
	const t = getToken();
	send( {
		command: 'pay',
		token: t.token,
		userId: t.userId,
		packageId,
		payToken
	} );
};

ret.login = login;
ret.getToken = getToken;
ret.loggedIn = loggedIn;
ret.logout = logout;
ret.makePayment = makePayment;
ret.getPlayer = getPlayer;

export default ret;
