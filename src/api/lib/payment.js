const uuid = require( 'uuid' );
const LiveActor = require( './liveActor' );

/**
 * Represents a payment
 * @augments LiveActor
 */
class Payment extends LiveActor {
	constructor( id, container ) {
		super( id, container );
		this._packages = {
			1: {
				cost: 150,
				description: '1 life',
				lives: 1
			},
			2: {
				cost: 300,
				description: '2 lives',
				lives: 2
			},
			3: {
				cost: 2000,
				description: '25 lives',
				lives: 25
			}
		};
	}

	async DoPay( userId, payToken, packageId ) {
		const pack = this._packages[packageId];
		const attempt = uuid();
		const payment = {
			amount: pack.cost,
			currency: 'usd',
			source: payToken.id,
			description: pack.description,
			metadata: {
				user_id: userId,
				attempt_id: attempt
			}
		};

		const data = {
			amount: pack.cost,
			currency: 'usd',
			source: payToken.id,
			description: pack.description,
			package: packageId,
			userId,
			attempt,
			payment
		};

		this.Fire( 'payment_attempt', data );

		const stripe = this._container.charge;
		const charge = await stripe.charges.create( payment );

		if ( charge.outcome.risk_level == 'elevated' ) {
			this.Fire( 'payment_fraud', {
				data: charge
			} )
		}

		if ( charge.amount == payment.amount ) {
			this.Fire( 'payment_success', {
				data: charge,
				attempt,
				userId,
				packageId,
				lives: pack.lives,
				amount: charge.amount
			} );
		}
	}
}

module.exports = Payment;