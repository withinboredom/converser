import React, {PureComponent, PropTypes} from 'react';

import styles from './style.css';

class Button extends PureComponent {
    render() {
        return (
            <div className={styles.button} onClick={this.props.onClick}>
                {this.props.children}
            </div>
        );
    }
}

export default Button;