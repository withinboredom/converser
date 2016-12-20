import React, {PureComponent, PropTypes} from 'react';

import Heart from './heart';
import Hide from '../hidden';
import Button from '../button';
import styles from './style.css';

class Me extends PureComponent {
    render() {

        let status = 'Not Playing';

        switch (this.props.status.type) {
            case 'in-call':
                status = (
                    <span>
                        Playing against
                        {` ${this.props.status.opponent.country} `}
                        {`${this.props.status.opponent.start} `}
                        <Hide hidden={this.props.status.opponent.hidden} />
                        {` ${this.props.status.opponent.end}`}
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
                        <div className={styles.label}>Last Score: </div>
                        <div className={styles.content}>{this.props.player.score}</div>
                    </div>);
            }
        };

        return (
            <div className={styles.me}>
                <div className={styles.life}>
                    <div className={styles.heart}>
                        <Heart />
                        <div className={styles.counter}>{this.props.player.lives}</div>
                    </div>
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
                    : null }
            </div>
        );
    }
}

Me.propTypes = {
    player: PropTypes.shape({
        lives: PropTypes.number.isRequired,
        score: PropTypes.number.isRequired,
        isPlaying: PropTypes.bool.isRequired
    }).isRequired,
    status: PropTypes.shape({
        type: PropTypes.string.isRequired,
        opponent: PropTypes.shape({
            country: PropTypes.string.isRequired,
            start: PropTypes.string.isRequired,
            end: PropTypes.string.isRequired,
            hidden: PropTypes.number
        })
    })
};

export default Me;