import React from 'react';
import {createRoot} from 'react-dom/client';
import {AccountActivity} from '../../integration/src/ui/AccountActivity';
import {withTransferActivity} from '../../integration/src/core/activity';
import type {BoardingRecord} from '../../integration/src/core/boarding-record';
import '@bis/integration/style.css';
// Isolated display fixture. No wallet, account storage, signing or network calls.
const record={id:'display-test-operation',profileId:'display-test-account',status:'pending',phase:'registered',intentId:'display-test-intent',quote:{amountSats:1000,direction:'to-bitcoin'}} as BoardingRecord;
const transactions=withTransferActivity([],record,'display-test-account');
createRoot(document.getElementById('root')!).render(<main><h1>Transfer activity display check</h1><p>Isolated fixture; no transaction submitted.</p><AccountActivity activity={{status:'unavailable',transactions}} /></main>);
