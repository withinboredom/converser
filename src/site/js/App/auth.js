
let token = false;
let websocket = new WebSocket('ws://localhost:1337/ws');

const tokenResp = [];

websocket.onopen = (event) => {
    if (getToken()) {
        send({
            command: 'refresh',
            token: getToken()
        });
    }
};

websocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    console.log('got msg', msg);

    switch(msg.type) {
        case 'token':
            localStorage.setItem('token', JSON.stringify(msg));
            token = msg;
            tokenResp.forEach((cb) => {
                cb(msg);
                tokenResp.pop();
            });
            break;
    }
};

const send = (message, retries = 100) => {
    if (retries == 0) return; //todo: show error message
    try {
        if (websocket.readyState === 1) {
            websocket.send(JSON.stringify(message));
        }
        else {
            throw(new Error("WebSocket is not in OPEN state."));
        }
    }
    catch (e) {
        const mess = websocket.onmessage;
        websocket = new WebSocket('ws://localhost:1337/ws');
        websocket.onmessage = mess;
        setTimeout(() => send(message, retries - 1), 5000);
    }
};

const login = (phone, cb) => {
    tokenResp.push(cb);
    send({
        command: 'login',
        phone: phone
    });
    return (pass) => {
        auth(phone, pass, cb);
    }
};

const auth = (phone, pass, cb) => {
    send({
        command: 'verify',
        phone: phone,
        password: pass
    });
};

const onChange = () => {};

const getToken = () => {
    try {
        return token = token || JSON.parse(localStorage.getItem('token'));
    }
    catch(e) {
        return token;
    }
};

const logout = () => {
    try {
        localStorage.clear();
    }
    finally {
        token = false;
    }
};

const loggedIn = () => {
    return !!getToken();
};

const makePayment = () => {

};

export default {
    login,
    getToken,
    loggedIn,
    logout,
    onChange
}
