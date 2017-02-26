const Given = require( './framework' );
const Timer = require( '../timer' );

const test = async() => {
	const now = new Date();
	await (
		await new Given( 'initialize a new timer', Timer, [] )
			.When( 'StartTimer', now )
			.Then( [
				{
					name: 'initialize_tick',
					data: {
						nextTick: now
					}
				}
			] )
	).And( {
		initialized: true,
		next_tick: now
	} );

	await new Given( 'a tick with initialized timer', Timer, [
		{
			name: 'initialize_tick',
			data: {
				nextTick: now
			}
		}
	] ).When( 'StartTimer', now )
	   .Then( [
		   {
			   name: 'initialize_tick',
			   data: {
				   nextTick: now
			   }
		   },
		   {
			   name: 'tick',
			   data: {
				   nextTick: '{object}'
			   }
		   }
	   ] );
};

module.exports = test;