import React, {PureComponent} from 'react';
import Carrier from './carrier';
import {browserHistory} from 'react-router';
import auth from '../../auth';

import Button from '../button';
import me from '../me/style.css';

class Purchase extends PureComponent {
    componentWillMount() {
        document.title = "Purchase more lives";
        fbq('track', 'InitiateCheckout');
    }

    fund = (packageId, amount) => (token) => {
        window.ga('send', 'event', 'user', 'payment', '', packageId);
        auth.makePayment(packageId, token);
        fbq('track', 'Purchase', {
		    value: amount,
		    currency: 'USD'
	    });
	    browserHistory.push('/me');
    };

    render() {
        const stripeKey = process.env.STRIPE_P_KEY;
        return (
            <div className={me.me}>
                <Carrier token={this.fund(1, 2)} stripeKey={stripeKey} cost={1} lives={1}/>
                <Carrier token={this.fund(2, 6)} stripeKey={stripeKey} cost={3} lives={3}/>
                <Carrier token={this.fund(3, 20)} stripeKey={stripeKey} cost={20} lives={25}/>
                <div className={me.status}>
                    { auth.getPlayer().lives > 0 ? <Button onClick={ () => {
                            browserHistory.push('/me');
                        } }>Continue</Button> : null }
                </div>
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