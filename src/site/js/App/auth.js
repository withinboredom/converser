
let token = false;
let websocket = new WebSocket(process.env.API_HOST);

const tokenResp = [];

const sendCache = [];

let player = false;

const ret = {
    onPlayerUpdate: null,
    onNotify: null
};

websocket.onopen = (event) => {
    if ( sendCache.length > 0 ) {
        let s;
        while(s = sendCache.pop()) {
            send(s);
        }
    }

    if (getToken()) {
        const t = getToken();
        send({
            command: 'refresh',
            token: t.token,
            userId: t.userId
        });
    }
    else {
        let match,
            pl     = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
            query  = window.location.search.substring(1);

        const urlParams = {};
        while (match = search.exec(query))
            urlParams[decode(match[1])] = decode(match[2]);

        send({
            command: 'connect',
            campaign: urlParams
        });
    }
};

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
    if (player && !isRefreshing) {
        isRefreshing = true;
        setInterval(() => {
            const t = getToken();
            send({
                command: 'refresh',
                token: t.token,
                userId: t.userId
            });
        }, 5000);
    }
};

websocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch(msg.type) {
        case 'token':
            window.ga('send','event','user','login', '', -1);
            localStorage.setItem('token', JSON.stringify(msg));
            token = msg;
            tokenResp.forEach((cb) => {
                cb(msg);
                tokenResp.pop();
            });
            break;
        case 'user':
            localStorage.setItem('player', JSON.stringify(msg));
            player = msg;
            if (ret.onPlayerUpdate) {
                ret.onPlayerUpdate(player);
            }
            autoRefresh();
            break;
        case 'logout':
            console.log('logging out due to invalid key/token');
            logout();
            break;
        case 'notification':
            window.ga('send', 'event', 'user', 'received_notification');
            if (ret.onNotify) {
                const notification = {
                    ...msg.notification,
                    dismissible: false
                };
                ret.onNotify(notification);
            }
            break;
    }
};

const send = (message, retries = 100) => {
    if (retries == 0) { location.reload() }
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
        const connect = websocket.onopen;
        websocket = new WebSocket('ws://localhost:1337/ws');
        websocket.onopen = connect;
        websocket.onmessage = mess;
        if (message.command !== 'refresh') {
            sendCache.push(message);
        }

        mess({
            data: JSON.stringify({
                type: 'notification',
                notification: {
                    message: 'please reconnect to the internet',
                    title: 'disconnected',
                    level: 'error',
                    autoDismiss: 5
                }
            })
        });
    }
};

const login = (phone, cb) => {
    tokenResp.push(cb);
    window.ga('send', 'event', 'user', 'login_attempt');
    send({
        command: 'login',
        phone: phone
    });
    return (pass) => {
        auth(phone, pass, cb);
    }
};

const auth = (phone, pass, cb) => {
    window.ga('send','event','user','verify_attempt');
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

const getPlayer = () => {
    try {
        player = player || JSON.parse(localStorage.getItem('player'));
    }
    catch(e) {
        player;
    }

    if(!player) {
        player = {
            lives: 0,
            score: 0,
            status: 'loading'
        };
    }
    return player;
};

const loggedIn = () => {
    return !!getToken();
};

const makePayment = (packageId, payToken) => {
    const t = getToken();
    send({
        command: 'pay',
        token: t.token,
        userId: t.userId,
        packageId,
        payToken
    });
};

ret.login = login;
ret.getToken = getToken;
ret.loggedIn = loggedIn;
ret.logout = logout;
ret.makePayment = makePayment;
ret.getPlayer = getPlayer;

export default ret;
