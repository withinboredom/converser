import React, {PureComponent, PropTypes} from 'react';

import styles from './style.css';

import Continue from '../continue';

const Li = (props) => {
    return (
        <li className={styles.listElement}>{props.children}</li>
    );
};

class Homepage extends PureComponent {
    render() {
        return (
            <div>
                <div>The rules</div>
                <div>
                    <ol className={styles.list}>
                        <Li>One credit earns 1 life</Li>
                        <Li>Being the last one to hangup in a conversation earns 100 points</Li>
                        <Li>Every 10 minutes in a conversation earns 10 points</Li>
                        <Li>Hanging up first uses a life</Li>
                        <Li>Be nice, be respectful</Li>
                        <Li>Have an interesting conversation with a stranger</Li>
                        <Li>You are responsible for carrier charges, this will use your phone plan minutes</Li>
                    </ol>
                </div>
                { this.props.shouldContinue ? <Continue /> : null }
            </div>
        );
    }
}

Homepage.propTypes = {
    shouldContinue: PropTypes.bool.isRequired
};

export default Homepage;