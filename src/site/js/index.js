import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, Link, browserHistory } from 'react-router'

import App from './App';

const render = () => {
    ReactDOM.render(
        <Router history={browserHistory}>
            <Route path="/" component={App}>
            </Route>
        </Router>,
        document.getElementById('root')
    );
};

render();