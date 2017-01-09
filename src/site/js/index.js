import React, {PureComponent} from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, Link, browserHistory } from 'react-router'

import auth from './App/auth';

const track = (previousState, nextState, replace) => {
    window.ga('send', 'pageview', nextState.location.pathname);
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
            <Route path="/" getComponent={ ( nextState, cb ) => {
                import( './App' ).then( ( module ) => {
                    cb( null, module.default );
                } )
            }} onChange={track}>
                <Route path="continue" getComponent={ ( nextState, cb ) => {
                    import( './App/components/purchase' ).then( ( module ) => {
                        const Purchase = module.default;
                        cb( null, () => <State><Purchase/></State> );
                    } )
                }} onEnter={requireAuth} />
                <Route
                    path="me"
                    getComponent={ ( nextState, cb ) => {
                        import( './App/components/me' ).then( ( module ) => {
                            const Me = module.default;
                            cb( null, () => <State><Me player={{lives: 0, score: 0}} /></State> )
                        } )
                    } }
                    onEnter={requireAuth}
                />
                <Route path="login" getComponent={ ( nextState, cb ) => {
                    import( './App/components/login' ).then( ( module ) => {
                        cb( null, module.default );
                    } )
                } } />
                <Route path="logout" getComponent={ ( nextState, cb ) => {
                    import( './App/components/logout' ).then( ( module ) => {
                        cb( null, module.default );
                    } )
                } } />
            </Route>
        </Router>,
        document.getElementById('root')
    );
};

render();