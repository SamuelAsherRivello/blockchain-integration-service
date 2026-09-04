import test from 'node:test';
import assert from 'node:assert/strict';
import { boardingAmounts, assertQuoteUnchanged, boardingSubmissionEnabled } from '../src/core/boarding-quote.ts';
import { createContext } from '../src/core/context.ts';

test('boarding preserves partial change and only Max selects the complete deposit',()=>{
  assert.deepEqual(boardingAmounts(289715,1000,1,330),{amountSats:1000,changeSats:288715,maxSats:289715});
  assert.equal(boardingAmounts(289715,undefined,1,330).changeSats,0);
  for(const amount of [0,-1,0.5,289716,289714,NaN,Infinity])assert.throws(()=>boardingAmounts(289715,amount,1,330));
});

test('review invalidates changed inputs, fees, account, amount, projections and expiry',()=>{
  const q={profileId:'test',direction:'to-arkade',fingerprint:'inputs-and-outputs',amountSats:1000,feeSats:0,netSats:1000,totalAfterSats:289715,bitcoinAfterSats:288715,arkadeAfterSats:1000,expiresAt:2000};
  assert.doesNotThrow(()=>assertQuoteUnchanged(q,{...q},1000));
  for(const change of [{fingerprint:'new-inputs'},{feeSats:1},{profileId:'other'},{amountSats:2000},{bitcoinAfterSats:288714},{netSats:999},{arkadeAfterSats:999},{totalAfterSats:289714}]) {
    assert.throws(()=>assertQuoteUnchanged(q,{...q,...change},1000));
  }
  assert.throws(()=>assertQuoteUnchanged(q,q,2000));
});

test('direct API confirmation requires an active wallet before any wallet operation',async()=>{
  assert.equal(boardingSubmissionEnabled,true);
  const c=createContext({load:async()=>({generation:0}),subscribe:()=>()=>{}});
  await c.ready();
  await assert.rejects(c.confirmAccountTransfer({}),/An active account is required|safely coordinate wallet transfers/);
  c.dispose();
});

