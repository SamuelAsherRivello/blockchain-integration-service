import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTransactionDetail, formatTransactionSummary, formatTransactions, transactionExplorerUrl } from '../src/core/activity.ts';

test('explorer routes Bitcoin, Arkade and commitment IDs without treating operation IDs as transactions', () => {
 const row={id:'local',amountSats:1000,direction:'Incoming',status:'Pending',identifier:''};
 const txid='a'.repeat(64), ark='b'.repeat(64);
 assert.equal(transactionExplorerUrl({...row,bitcoin:{txid},identifier:`ark:${ark}`}),`https://mempool.space/signet/tx/${txid}`);
 for(const identifier of [txid,`${txid}:0`,`commitment:${txid}`])
  assert.equal(transactionExplorerUrl({...row,identifier}),`https://mempool.space/signet/tx/${txid}`);
 assert.equal(transactionExplorerUrl({...row,identifier:`ark:${ark} commitment:${txid}`}),`https://explorer.signet.arkade.sh/tx/${ark}`);
 for(const identifier of ['operation:6c8f5a87-9414-451d-aed2-1718accb979c',`operation:${txid}`,`intent:${txid}`,'Identifier unavailable','ark:invalid','ark:https://example.com'])
  assert.equal(transactionExplorerUrl({...row,identifier}),undefined);
 assert.equal(transactionExplorerUrl({...row,bitcoin:{txid:'invalid'}}),undefined);
});

test('transaction timestamp uses recorded milliseconds and explicitly labels UTC or missing time', () => {
 const row={id:'receipt',amountSats:1000,direction:'Incoming',status:'Pending',identifier:'abc:0'};
 assert.match(formatTransactionDetail({...row,createdAt:Date.parse('2026-09-04T12:34:56Z')}),/Timestamp \(UTC\): 2026-09-04 12:34:56/);
 for(const createdAt of [undefined,0,-1,NaN,Infinity,1e20]) {
  assert.match(formatTransactionDetail({...row,createdAt}),/Timestamp \(UTC\): Not yet reported/);
 }
});
test('onchain details show confirmation progress without promising an ETA', () => {
 const row={id:'receipt',amountSats:1000,direction:'Incoming',status:'Pending',identifier:'abc:0',bitcoin:{txid:'a'.repeat(64),confirmations:0}};
 assert.match(formatTransactionDetail(row),/Confirmations: 0/);
 assert.match(formatTransactionDetail(row),/Waiting for the first block/);
 assert.match(formatTransactionDetail(row),/Confirmation time is unpredictable/);
 assert.doesNotMatch(formatTransactionDetail(row),/Explorer:|https:\/\/mempool/);
 assert.match(formatTransactionDetail({...row,bitcoin:{...row.bitcoin,confirmations:3,blockHeight:100}}),/Confirmations: 3\nConfirmed in block: 100/);
 assert.match(formatTransactionDetail({...row,bitcoin:{txid:'a'.repeat(64)}}),/Confirmations: Unavailable/);
 assert.doesNotMatch(formatTransactionDetail({...row,bitcoin:undefined}),/Confirmations:|Waiting for the first block/);
});
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
