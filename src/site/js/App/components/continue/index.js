import React, {PureComponent} from 'react';
import {Link} from 'react-router';

import styles from './style.css';

class Continue extends PureComponent {
    
    onClick = (event) => {
        
    };
    
    render() {
        return (
            <Link to='/continue' className={styles.insertCoin}>
                <div className={styles.helper}>press here to</div>
                <div></div>
                <div className={styles.insert}>INSERT COIN</div>
                <div></div>
            </Link>
        );
    }
}

export default Continue;