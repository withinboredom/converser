import React, {PureComponent} from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, Link, browserHistory } from 'react-router'

import App from './App';
import Purchase from './App/components/purchase';
import Me from './App/components/me';
import Login from './App/components/login';
import Logout from './App/components/logout';
import auth from './App/auth';

const track = (nextState, replace) => {
    window.ga('send', 'pageview');
};

const requireAuth = (nextState, replace) => {
    if(!auth.loggedIn()) {
        replace({
            pathname: '/login',
            state: { nextPathname: nextState.location.pathname }
        });
    }
};

class State extends PureComponent {
    playerUpdated = (newPlayer) => {
        this.setState({
            player: newPlayer,
            status: newPlayer.status
        });
    };

    syncPlayer = () => {
        auth.onPlayerUpdate = this.playerUpdated;
        const player = auth.getPlayer();
        this.setState({
            player,
            status: player.status
        });
    };

    componentWillMount() {
        this.syncPlayer();
    }

    componentWillReceiveProps(newProps) {
        this.syncPlayer();
    }

    componentWillUnmount() {
        auth.onPlayerUpdate = null;
    }

    render() {
        return (
            React.Children.map(this.props.children, (child) => {
                return React.cloneElement(child, {
                    ...this.state,
                    ...this.props,
                    status: this.state.player.status
                });
            })[0]
        );
    }
}

const render = () => {
    ReactDOM.render(
        <Router history={browserHistory}>
            <Route path="/" component={App} onEnter={track} onChange={track}>
                <Route path="continue" component={() => (<State><Purchase/></State>)} onEnter={requireAuth} />
                <Route
                    path="me"
                    component={() => (<State><Me player={{lives: 0, score: 0}} /></State>)}
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