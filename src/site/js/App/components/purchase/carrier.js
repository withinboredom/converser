import React from 'react';
import StripeCheckout from 'react-stripe-checkout';

import Button from '../button';
import styles from './carrier.css';
import me from '../me/style.css';

const Carrier = (props) => {
    return (
    <div className={me.status}>
        <div className={me.label}>
            {`${props.lives} ${props.lives === 1 ? 'life' : 'lives'}`}
        </div>
        <StripeCheckout
            token={props.token}
            stripeKey={props.stripeKey}
            name="Paid That Company"
            description={`${props.lives} ${props.lives === 1 ? 'life' : 'lives'}`}
            amount={props.cost * 100}
            zipCode={true}
            allowRememberMe
            ComponentClass={Button}
        >
            ${props.cost}
        </StripeCheckout>
    </div>
    );
};

export default Carrier;