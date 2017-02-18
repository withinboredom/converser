console.log( 'Running all tests' );

require( './user.test' )().then( () => {
	return require( './payment.test' )();
} ).then( () => {
	return require( './timer.test' )();
} ).then( () => {
	process.exit( 0 );
} );