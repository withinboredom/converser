import React from 'react';
import styles from './app.css';

import Homepage from './components/homepage';

const App = (props) => (
    <div className={styles.app}>
        { props.children ? props.children : <Homepage /> }
    </div>
);

export default App;