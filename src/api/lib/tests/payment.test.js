const Given = require( './framework' );
const Payment = require( '../payment' );

const test = async() => {
	await new Given( 'A simple payment', Payment, [] )
		.When( 'DoPay', '123456789', {id: 'token'}, 1 )
		.Then( [
			{
				name: 'payment_attempt',
				data: {
					amount: 150,
					attempt: '{string}',
					currency: 'usd',
					description: '1 life',
					package: 1,
					payment: '{object}',
					source: 'token',
					userId: '123456789'
				}
			},
			{
				name: 'payment_success',
				data: {
					amount: 150,
					attempt: '{string}',
					data: '{object}',
					lives: 1,
					packageId: 1,
					userId: '123456789'
				}
			}
		] );

	await (
		await new Given( 'A different package', Payment, [] )
			.When( 'DoPay', '123456789', {id: 'token'}, 2 )
			.Then( [
				{
					name: 'payment_attempt',
					data: {
						amount: 300,
						attempt: '{string}',
						currency: 'usd',
						description: '2 lives',
						package: 2,
						payment: '{object}',
						source: 'token',
						userId: '123456789'
					}
				},
				{
					name: 'payment_success',
					data: {
						amount: 300,
						attempt: '{string}',
						data: '{object}',
						lives: 2,
						packageId: 2,
						userId: '123456789'
					}
				}
			] )
	)
};

module.exports = test;