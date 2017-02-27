const Actor = require( './liveActor' );
const Queue = require( 'rethinkdb-job-queue' );

const HOST = process.env.DB_HOST;

class QueueActor extends Actor {
	constructor( id, container, process = true ) {
		super( id, container );

		if ( ! QueueActor.queue ) {
			QueueActor.queue = new Queue( {
				host: HOST || 'localhost',
				db: 'Queues'
			}, {
				name: 'DomainEvents',
				removeFinishedJobs: 1000 * 60 * 60,
			} );

			if ( process ) {
				const idMap = new Map();
				QueueActor.queue.process( async( job, next, cancel ) => {
					console.log( `Processing job ${job.event.name} for ${job.for} from ${job.from}` );
					const inst = require( `./${job.from[ 0 ].toLowerCase()}${job.from.substr( 1 )}` );
					let actor = null;
					if ( idMap.has( job.for ) ) {
						actor = idMap.get( job.for );
					}
					else {
						actor = new inst( job.for, container );
						actor.processing = true;
						await actor.Load();
						idMap.set( job.for, actor );
					}
					await actor.SoftFire( job.event.name, job.event.data );
					await actor.Store();
					next();
				} );
			}
		}

		/**
		 * The domain queue
		 * @type {Queue}
		 */
		this.queue = QueueActor.queue;
		this.SoftFire = super.Fire;
	}

	async Fire( name, data ) {
		if ( ! this._replaying ) {
			const job = this.queue.createJob( {
				event: {
					name,
					data
				},
				from: this.constructor.name,
				phases: {
					fired: true,
					applied: false,
					stored: false
				},
				for: this.Id()
			} );

			await this.queue.addJob( job );
		}
	}

	ListenFor( id, eventToHear, eventToFire, number = 1, time = 60000 ) {
		const wait = ( event ) => {
			if ( event.name == eventToHear ) {
				if ( ! event.replay && this.processing ) {
					number -= 1;
					this.Fire( eventToFire, event.data );
				}
			}

			if ( number <= 0 ) {
				console.log( 'Unsubscribe due to repeat exhaustion' );
				try {
					this._container.storage.Unsubscribe( id, wait );
				} catch ( err ) {
				}
			}
		};

		this._container.storage.SubscribeTo( id, wait );

		if ( time < Infinity ) {
			setTimeout( () => {
				if ( number > 0 ) {
					try {
						console.log( 'Unsubscribe due to timeout' )
						this._container.storage.Unsubscribe( id, wait );
					} catch ( err ) {
					}
				}
			}, time );
		}
	}
}

module.exports = QueueActor;