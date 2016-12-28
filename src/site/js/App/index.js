import React, {PureComponent} from 'react';
import NotificationSystem from 'react-notification-system';
import styles from './app.css';

import Homepage from './components/homepage';
import Highscores from './components/highscores';
import auth from './auth';

class App extends PureComponent {
    _notificationSystem = null;

    _addNotification = ( message ) => {
        if (this._notificationSystem) {
            this._notificationSystem.addNotification(message);
        }
    };

    constructor(props) {
        super(props);
    }

    componentWillMount() {
        auth.onNotify = this._addNotification;
        this.setState({
            shouldContinue: true,
            players: [
                {
                    rank: 1,
                    country: '+1',
                    start: '910',
                    end: '4810',
                    hidden: 3,
                    score: 100
                },
                {
                    rank: 2,
                    country: '+1',
                    start: '843',
                    end: '5937',
                    hidden: 3,
                    score: 100
                }
            ]
        });
    }

    render() {
        return (
            <div className={styles.app}>
                { this.props.children ? this.props.children : <Homepage shouldContinue={this.state.shouldContinue} /> }
                <Highscores players={this.state.players} />
                <NotificationSystem ref={(ref) => { this._notificationSystem = ref } } />
            </div>
        );
    }
}

export default App;