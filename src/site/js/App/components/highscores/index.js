import React, {PureComponent, PropTypes} from 'react';

import Hide from '../hidden';
import styles from './style.css';

class HighScores extends PureComponent {
    render() {
        return (
            <div className={styles.highscores}>
                <div className={styles.headertabs}>
                    <div className={styles.active}>24 hrs</div>
                    <div className={styles.tab}>All Time</div>
                    <div className={styles.tab}>Me</div>
                </div>
                <div className={styles.table}>
                    <div className={styles.header}>Rank</div>
                    <div className={styles.header}>Player</div>
                    <div className={styles.header}>Score</div>
                    {
                        this.props.players.map((player) => {
                            return [
                                <div className={styles.rank}>
                                    <span>{player.rank}.</span>
                                </div>,
                                <div className={styles.converser}>
                                    <span className={styles.text}>
                                        {`${player.country} `}
                                        {player.start}
                                        <Hide hidden={player.hidden} />
                                        {player.end}
                                    </span>
                                </div>,
                                <div className={styles.score}>
                                    <span>{player.score}</span>
                                </div>
                            ];
                        })
                    }
                </div>
            </div>
        );
    }
}

HighScores.propTypes = {
    players: PropTypes.array
};

export default HighScores;