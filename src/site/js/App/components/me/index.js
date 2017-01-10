import React, {PureComponent, PropTypes} from 'react';
import { browserHistory } from 'react-router';
import { PhoneNumberFormat, PhoneNumberUtil } from 'google-libphonenumber';

import Heart from './heart';
import Hide from '../hidden';
import auth from '../../auth';
import Continue from '../continue';
import Button from '../button';
import styles from './style.css';

class Me extends PureComponent {
    componentWillMount() {
        document.title = "Converser";
    }

    logout = () => {
        auth.logout();
        browserHistory.push('/');
    };

    render() {

        let status = 'Not Playing';

        switch (this.props.status) {
            case 'in-call':
                status = (
                    <span>
                        Playing against
                        {` ${this.props.opponent.country} `}
                        {`${this.props.opponent.start} `}
                        <Hide hidden={this.props.opponent.hidden} />
                        {` ${this.props.opponent.end}`}
                    </span>
                );
                break;
            case 'session-done':
            case 'not-ready':
            case 'not-playing':
                status = (
                    <span>Not Playing</span>
                );
                break;
            case 'waiting':
                status = (<span>Waiting for player 2</span>);
                break;
        }

        const score = () => {
            switch (this.props.status.type) {
                case 'in-call':
                case 'waiting':
                    return (<div className={styles.status}>
                        <div className={styles.label}>Current Score: </div>
                        <div className={styles.content}>{this.props.player.score}</div>
                    </div>);
                default:
                    return (<div className={styles.status}>
                        <div className={styles.label}>Score: </div>
                        <div className={styles.content}>{this.props.player.score}</div>
                    </div>);
            }
        };

        let mod = Math.log10(this.props.player.lives);
        if (mod < 0) mod = 0;

        const phoneUtil = PhoneNumberUtil.getInstance();
        const parsed = phoneUtil.parse(process.env.CALL, 'US');
        const intlNumber = phoneUtil.format(parsed, PhoneNumberFormat.INTERNATIONAL);
        const localNumber = phoneUtil.format(parsed, PhoneNumberFormat.NATIONAL);

        return (
            <div className={styles.me}>
                <div className={styles.life}>
                    {this.props.player.lives > 0
                        ?
                        <div
                            className={styles.heart}
                            style={{animation: `${styles.heartbeat} ${1.5 * mod}s infinite`}}
                            onClick={() => {
                                browserHistory.push('/continue');
                            }}
                        >
                            <Heart />
                            <div className={styles.counter}>{this.props.player.lives}</div>
                        </div>
                        :
                        <Continue/>
                    }
                </div>
                <div className={styles.status}>
                    <div className={styles.label}>Status: </div>
                    <div className={styles.content}>
                        {status}
                    </div>
                </div>
                {score()}
                {this.props.status.type == 'in-call'
                    ? <div className={styles.status}>
                        <div className={styles.label}>Report:</div>
                        <Button>This Call</Button>
                    </div>
                    : null
                }
                <div className={styles.status}>
                    <Button
                        style={{
                            width: '100%'
                        }}
                        onClick={this.logout}
                    >
                        Logout
                    </Button>
                </div>
                <div className={styles.status}>
                    <div className={styles.label}>
                        Dial to play:
                    </div>
                    <div className={styles.content}>
                        <a className={styles.link} href={`tel://${localNumber}`}>{`${localNumber}`}</a>
                    </div>
                </div>
            </div>
        );
    }
}

Me.propTypes = {
    player: PropTypes.shape({
        lives: PropTypes.number.isRequired,
        score: PropTypes.number.isRequired,
    }).isRequired,
    status: PropTypes.string.isRequired,
    opponent: PropTypes.shape({
        country: PropTypes.string.isRequired,
        start: PropTypes.string.isRequired,
        end: PropTypes.string.isRequired,
        hidden: PropTypes.number
    })
};

export default Me;