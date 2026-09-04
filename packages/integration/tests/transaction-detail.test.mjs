import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTransactionDetail, formatTransactionSummary, formatTransactions } from '../src/core/activity.ts';
test('row summary contains only grouped sats, direction and short status', () => {
 const row={id:'internal',amountSats:1000,direction:'Arkade → Bitcoin',status:'Pending — registered, awaiting verification',identifier:'ark:abc',kind:'Asset transfer',assets:[{assetId:'asset-1',quantity:'10'}]};
 assert.equal(formatTransactionSummary(row),'1,000 sats | Arkade → Bitcoin | Pending');
 assert.equal(formatTransactionSummary({...row,status:'Confirmed'}),'1,000 sats | Arkade → Bitcoin | Confirmed');
 assert.equal(formatTransactionSummary({...row,satsUnknown:true}),'Sats unknown | Arkade → Bitcoin | Pending');
 assert.match(formatTransactionDetail(row),/Pending — registered, awaiting verification/);
});
test('transaction details label fields and separate identifiers and assets without rounding', () => {
 const row={id:'internal',amountSats:123,direction:'Incoming',status:'Pending',identifier:'ark:abc commitment:def',kind:'Asset transfer',assets:[{assetId:'asset-1',quantity:'9007199254740993'}]};
 const text=formatTransactionDetail(row);
 assert.match(text,/Amount: 123 sats\nDirection: Incoming\nStatus: Pending/);
 assert.match(text,/ark:abc\ncommitment:def/);
 assert.match(text,/Quantity: 9007199254740993 base units/);
 assert.ok(!text.includes('internal'));
 assert.match(formatTransactions([row]),/^123 sats \| Incoming/);
 assert.match(formatTransactionDetail({...row,satsUnknown:true}),/Amount: Sats not yet reported/);
});
