import React, {PureComponent, PropTypes} from 'react';
import {PhoneNumberFormat, PhoneNumberUtil, AsYouTypeFormatter} from 'google-libphonenumber';
import { browserHistory } from 'react-router';

import Button from '../button';
import me from '../me/style.css';
import auth from '../../auth';

import styles from './style.css';

class Login extends PureComponent {
    componentWillMount() {
        document.title = "Converser: Login";

        this.setState({
            hasPhone: false,
            currentPhone: '',
            currentPass: '',
            state: null,
            waiting: false
        });
    }

    /**
     *
     * @param {SyntheticEvent} ev
     */
    validate = (ev) => {
        let val = ev.target.value.replace(/\D/g, '');
        let newVal = '';
        const formatter = new AsYouTypeFormatter('US');

        for(let i = 0; i < val.length; i++) {
            newVal = formatter.inputDigit(val[i])
        }

        this.setState({
            currentPhone: newVal
        });
    };

    next = (ev) => {
        if (ev.key && ev.key !== 'Enter') {
            return;
        }
        if (this.state.state !== null) {
            this.state.state(this.state.currentPass);
        }
        else {
            const phoneUtil = PhoneNumberUtil.getInstance();
            let parsed = phoneUtil.parse(this.state.currentPhone, 'US');
            parsed = phoneUtil.format(parsed, PhoneNumberFormat.INTERNATIONAL);
            this.setState({
                currentPhone: parsed,
                state: auth.login(parsed, this.login),
                waiting: true
            });
        }
    };

    login = (token) => {
        const { location } = this.props;

        if (location.state && location.state.nextPathname) {
            browserHistory.push(location.state.nextPathname);
        }
        else {
            browserHistory.push('/me');
        }
    };

    passInput = (input) => {
        this.setState({
            currentPass: input.target.value
        });
    };

    render() {
        return (
            <form noValidate="noValidate" onSubmit={(ev) => {ev.preventDefault()}}>
                <div className={me.me}>
                    { this.state.waiting
                        ? <div className={styles.item} >
                            <div className={styles.label}>Your Code:</div>
                            <input
                                name="password"
                                className={styles.input}
                                type="number"
                                pattern="[0-9]*"
                                onChange={this.passInput}
                                onKeyPress={this.next}
                                value={this.state.currentPass}
                            />
                        </div>
                        : <div className={styles.item} >
                            <div className={styles.label}>Your phone number:</div>
                            <div className={me.content}>
                                <input
                                    name="phone"
                                    className={styles.input}
                                    type="tel"
                                    onChange={this.validate}
                                    onKeyPress={this.next}
                                    value={this.state.currentPhone}
                                />
                            </div>
                        </div>}
                    <div className={me.status}>
                        <Button onClick={this.next}>
                            {this.state.waiting ? 'Login' : 'Send verification sms'}
                        </Button>
                    </div>
                </div>
            </form>
        );
    }
}

export default Login;