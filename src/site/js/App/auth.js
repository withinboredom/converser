
let token = false;

const login = (phone, cb) => {
    //todo: send phone num to server
    return (pass) => {
        auth(phone, pass, cb);
    }
};

const auth = (phone, pass, cb) => {
    //todo: send pass response to server
    token = 123;
    cb(token);
};

const onChange = () => {};

const getToken = () => {
    try {
        return token = token || localStorage.getItem('token');
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

export default {
    login,
    getToken,
    loggedIn,
    logout,
    onChange
}
