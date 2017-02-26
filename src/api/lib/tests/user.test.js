const Given = require( './framework' );
const User = require( '../user' );

const test = async() => {

	const now = new Date();
	const day = new Date( now.valueOf() );
	day.setDate( now.getDate() + 1 );

	const loggedInUser = [
		{
			name: 'created_session',
			data: {
				id: 'session_id',
				ip: '123',
				password: 'password',
				phone: '123456789',
				begins: now,
				token: 'token'
			}
		},
		{
			name: 'password_text_sent',
			data: {
				text: 'password'
			}
		},
		{
			name: 'active_session_changed',
			data: {
				id: 'session_id',
				token: 'token'
			}
		}
	];

	await (
		await new Given( 'An initial login', User, [] )
			.When( 'DoLogin', '123456789', '123' )
			.Then( [
				{
					name: 'created_session',
					data: {
						id: '{string}',
						ip: '123',
						password: '{string}',
						phone: '123456789',
						begins: '{object}',
						token: '{string}'
					}
				},
				{
					name: 'password_text_sent',
					data: {
						text: '{string}'
					}
				}
			] )
	)
		.And( {
			lives: 0,
			opponent: null,
			payments: [],
			phone: '123456789',
			score: 0,
			sessions: '{object}',
			status: 'not-playing'
		} );
	await (
		await new Given( 'A text from a non-user', User, [] )
			.When( 'DoRecordSms', 'from', 'to', 'text' )
			.Then( [
				{
					name: 'received_text',
					data: {
						from: 'from',
						to: 'to',
						text: 'text'
					}
				},
				{
					name: 'sent_text',
					data: {
						from: null,
						text: '{string}',
						to: 'from'
					}
				}
			] )
	).And( {
		lives: 0,
		opponent: null,
		payments: [],
		phone: '123456789',
		score: 0,
		sessions: [],
		status: 'not-playing'
	} );
	await (
		await new Given( 'A text from an existing user', User, [] )
			.When( 'DoRecordSms', 'from', 'to', 'text' )
		   .Then( [
			   {
				   name: 'received_text',
				   data: {
					   from: 'from',
					   to: 'to',
					   text: 'text'
				   }
			   },
			   {
				   name: 'sent_text',
				   data: {
					   from: null,
					   text: '{string}',
					   to: 'from'
				   }
			   }
		   ] )
	).And( {
		lives: 0,
		opponent: null,
		payments: [],
		phone: '123456789',
		score: 0,
		sessions: [],
		status: 'not-playing'
	} );

	await (
		await new Given( 'Login verification step', User, [
			{
				name: 'created_session',
				data: {
					id: 'session_id',
					ip: '123',
					password: 'password',
					phone: '123456789',
					begins: now,
					token: 'token'
				}
			},
			{
				name: 'password_text_sent',
				data: {
					text: 'password'
				}
			}
		] )
			.When( 'DoVerify', 'phone', 'password' )
			.Then( [
				{
					name: 'active_session_changed',
					data: {
						id: 'session_id'
					}
				}
			] )
	).And( {
		lives: 0,
		opponent: null,
		payments: [],
		phone: '123456789',
		score: 0,
		status: 'not-playing',
		sessions: [
			{
				active: true,
				begins: now,
				ends: day,
				id: 'session_id',
				ip: '123',
				password: 'password',
				phone: '123456789',
				used: true,
				token: 'token'
			}
		]
	} );

	await (
		await new Given( 'A logged in user makes a payment', User, loggedInUser )
			.When( 'DoPurchase', { id: 'PayToken' }, 1 )
			.Then( [
				{
					name: 'attempt_payment',
					data: {
						paymentToken: {
							id: 'PayToken'
						},
						packageId: 1,
						paymentId: '{string}'
					}
				},
				{
					name: 'set_lives',
					data: {
						existingLives: 0,
						lives: 1,
						amount: 150,
						attempt: '{string}',
						packageId: 1,
						userId: '123456789',
						data: {
							amount: 150,
							outcome: {
								risk_level: 'normal'
							}
						}
					}
				}
			] )
	)
		.And( {
			lives: 1,
			opponent: null,
			payments: '{object}',
			phone: '123456789',
			score: 0,
			sessions: '{object}',
			status: 'not-playing'
		} );
};

module.exports = test;