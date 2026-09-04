import test from 'node:test';
import assert from 'node:assert/strict';
import {withTransferActivity,formatTransactions} from '../src/core/activity.ts';
const record={id:'operation-1',profileId:'account-1',status:'pending',phase:'registered',intentId:'intent-1',quote:{amountSats:1000,direction:'to-bitcoin'}};
const row={id:'history-1',amountSats:250,direction:'Incoming',status:'Confirmed',identifier:'unrelated-tx',createdAt:100};
test('registered transfer appears first before SDK history, with copyable explicit status and IDs',()=>{
 const rows=withTransferActivity([row],record,'account-1');
 assert.equal(rows.length,2);assert.equal(rows[0].createdAt,undefined);
 assert.equal(formatTransactions(rows).split('\n')[0],'1000 sats | Arkade → Bitcoin | Pending — registered, awaiting verification | operation:operation-1 intent:intent-1');
 assert.equal(rows[1],row);assert.deepEqual(withTransferActivity([row],record,'other'),[row]);
});
test('same commitment is annotated without adding a duplicate transaction',()=>{
 const sdk={...row,identifier:'commitment:abc'};
 const rows=withTransferActivity([sdk],{...record,commitmentTxid:'abc'},'account-1');
 assert.equal(rows.length,1);assert.equal(rows[0].status,'Pending — registered, awaiting verification');
 assert.match(rows[0].identifier,/operation:operation-1 intent:intent-1/);
});
test('uncertainty and verified/not-submitted outcomes stay distinct, including without SDK history',()=>{
 for(const [patch,expected] of [[{phase:'submitting'},'Pending — outcome unknown'],[{phase:undefined},'Pending — outcome unknown'],[{phase:'prepared'},'Pending — preparing'],[{status:'not-submitted'},'Not submitted'],[{status:'succeeded',commitmentTxid:'abc'},'Transfer verified']]) {
  assert.equal(withTransferActivity([],{...record,...patch},'account-1')[0].status,expected);
 }
 assert.equal(withTransferActivity([],{...record,quote:{amountSats:1000,direction:'to-arkade'}},'account-1')[0].direction,'Bitcoin → Arkade');
});
