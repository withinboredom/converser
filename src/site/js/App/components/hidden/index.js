import React from 'react';

import styles from './style.css';

export default (props) => {
    if (!props.hidden) {
        props.hidden = 3;
    }
    return (
        <span className={styles.hide}>
            {(new Array(props.hidden)).fill('0').join('')}
        </span>
    );
};