import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, Link, browserHistory } from 'react-router'

import App from './App';
import Purchase from './App/components/purchase';
import Me from './App/components/me';
import Login from './App/components/login';
import Logout from './App/components/logout';
import auth from './App/auth';

const requireAuth = (nextState, replace) => {
    if(!auth.loggedIn()) {
        replace({
            pathname: '/login',
            state: { nextPathname: nextState.location.pathname }
        });
    }
};

const render = () => {
    ReactDOM.render(
        <Router history={browserHistory}>
            <Route path="/" component={App}>
                <Route path="continue" component={Purchase} onEnter={requireAuth} />
                <Route
                    path="me"
                    component={(props) =>
                        <Me
                            {...props}
                            player={{
                                lives: 3,
                                score: 100,
                                isPlaying: true
                            }}
                            status={{
                                type: 'in-call',
                                opponent: {
                                    country: '+1',
                                    start: '843',
                                    hidden: 3,
                                    end: '5937'
                                }
                            }}
                        />}
                    onEnter={requireAuth}
                />
                <Route path="login" component={Login} />
                <Route path="logout" component={Logout} />
            </Route>
        </Router>,
        document.getElementById('root')
    );
};

render();