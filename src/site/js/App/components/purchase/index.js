import React, {PureComponent} from 'react';
import Carrier from './carrier';
import { browserHistory } from 'react-router';
import auth from '../../auth';

import me from '../me/style.css';

class Purchase extends PureComponent {
    fund = (packageId) => (token) => {
        console.log(packageId, token);
        auth.makePayment(packageId, token);
        browserHistory.push('/me');
    };

    render() {
        const stripeKey = 'pk_test_b8PzUzyYEIWBIDBODWw0dQBY';
        return (
            <div className={me.me}>
                <Carrier token={this.fund(1)} stripeKey={stripeKey} cost={1} lives={1} />
                <Carrier token={this.fund(2)} stripeKey={stripeKey} cost={3} lives={3} />
                <Carrier token={this.fund(3)} stripeKey={stripeKey} cost={20} lives={25} />
            </div>
            /*
            <div>
                <StripeCheckout token={this.fund} stripeKey="pk_test_b8PzUzyYEIWBIDBODWw0dQBY">
                    Hello wrold
                </StripeCheckout>
            </div>*/
        );
    }
}

export default Purchase;