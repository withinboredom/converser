require('harmonize');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const config = require('./config');

const User = require('./lib/user');
const Given = require('./lib/tests/framework');

app.get('/', (request, response) => {
    response.send('<h1>Hello World</h1>');
});

io.on('connection', (socket) => {
    console.log('connected');
    socket.on('disconnect', () => {
        console.log('disconnect');
    })
});

http.listen(1337, () => {
    console.log('Listening');
});

new Given('test', User, []).When('DoLogin', '910297', '123').Then([
	{
		name: 'zombie',
		data: {
			phone: '910297',
		}
	},
	{
		name: 'readied',
		data: {
			id: '{STRING}',
			phone: '910297',
			password: '{STRING}',
			ip: '123',
		}
	},
	{
		name: 'password_text',
		data: {
			text: '{STRING}'
		}
	}
]);