import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadonlyWallet,RestIndexerProvider,Wallet,RestArkProvider} from '@arkade-os/sdk';
import {reconcileBoarding} from '../src/arkade/boarding.ts';
import {readBoardingRecord,readBoardingRecords} from '../src/core/boarding-record.ts';
import {transferStatus,formatTransferRecoveryReport} from '../src/core/boarding-status.ts';
import {walletReservations} from '../src/core/wallet-reservations.ts';
import {testLocks} from './locks-fixture.mjs';

const baseKey='bis-signet-boarding-operation-v1';
const id='11111111-1111-4111-8111-111111111111',intentId='22222222-2222-4222-8222-222222222222';
const commitment='d'.repeat(64),assetId='a'.repeat(64)+'0000';
const account={profileId:'legacy-player',phrase:'abandon '.repeat(11)+'about'};
function fixture(t,{scoped=false,knownCommitment=false,evidence='valid'}={}) {
 const record={version:1,id,profileId:account.profileId,status:'pending',phase:'registered',intentId,
  inputs:[{txid:'b'.repeat(64),vout:1}],bitcoinAddress:'tb1-legacy-fixture',
  quote:{profileId:account.profileId,direction:'to-bitcoin',amountSats:1000,feeSats:0,netSats:1000,maxSats:1670,inputSats:2000,bitcoinAfterSats:1000,arkadeAfterSats:1000,totalAfterSats:2000,expiresAt:1000,fingerprint:'c'.repeat(64)},
  assetChange:{script:'5120'+'e'.repeat(64),sats:1000,assets:[{assetId,amount:'9007199254740993'}]},
  ...(knownCommitment?{commitmentTxid:commitment}:{})};
 const raw=JSON.stringify(record),key=scoped?`${baseKey}:${account.profileId}`:baseKey;
 const data=new Map([[key,raw]]);let writes=0;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes++;data.set(k,v);}}});
 Object.defineProperty(navigator,'locks',{configurable:true,value:testLocks()});
 t.mock.method(globalThis,'fetch',async()=>{throw Error('No live network in legacy recovery fixture');});
 t.mock.method(Wallet,'create',async()=>{throw Error('Recovery must not construct a signing wallet');});
 for(const method of ['registerIntent','deleteIntent'])t.mock.method(RestArkProvider.prototype,method,async()=>{throw Error('Recovery must not mutate the operator');});
 const tx={txid:commitment,status:{confirmed:evidence!=='unconfirmed'},vout:[{scriptpubkey_address:record.bitcoinAddress,value:evidence==='wrong-bitcoin'?999:1000}]};
 const change={txid:'f'.repeat(64),vout:0,value:1000,script:record.assetChange.script,assets:[{assetId,amount:evidence==='wrong-assets'?1n:9007199254740993n}],commitmentTxIds:[commitment]};
 t.mock.method(ReadonlyWallet,'create',async()=>({dispose:async()=>{},getProviderConnectionState:()=>({mode:'online',source:'live'}),getVtxos:async()=>[change],onchainProvider:{getTransactions:async()=>evidence==='absent'?[]:[tx]}}));
 t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>({vtxos:record.inputs.map(input=>({...input,isSpent:true,settledBy:evidence==='wrong-attribution'?'0'.repeat(64):commitment}))}));
 return {record,raw,key,data,writes:()=>writes};
}
for(const scoped of [false,true])for(const knownCommitment of [false,true])test(`legacy ${scoped?'scoped':'unscoped'} recovery ${knownCommitment?'with':'without'} known commitment preserves identity and assets`,async t=>{
 const f=fixture(t,{scoped,knownCommitment});
 const before=transferStatus(readBoardingRecord(account.profileId));
 assert.equal(before.failure,undefined);assert.equal(before.observedAt,undefined);
 assert.equal(before.execution,knownCommitment?'awaiting-confirmation':'unknown');
 const other=await reconcileBoarding({...account,profileId:'different-player'},new AbortController().signal);
 assert.equal(other,undefined);assert.equal(f.writes(),0);
 const resolved=await reconcileBoarding(account,new AbortController().signal);
 assert.equal(resolved.status,'succeeded');assert.equal(resolved.commitmentTxid,commitment);
 assert.equal(resolved.id,id);assert.equal(resolved.intentId,intentId);
 assert.deepEqual(resolved.inputs,f.record.inputs);assert.deepEqual(resolved.assetChange,f.record.assetChange);
 assert.equal(resolved.failure,undefined);assert.equal(readBoardingRecords(account.profileId).length,1);
 assert.equal(walletReservations(account.profileId).length,0);
 if(!scoped)assert.equal(f.data.get(baseKey),f.raw,'Original legacy evidence remains intact');
 const writes=f.writes();await reconcileBoarding(account,new AbortController().signal);
 assert.equal(f.writes(),writes,'Resolved legacy operation is not rewritten or replayed');
});
for(const evidence of ['absent','wrong-bitcoin','wrong-assets','unconfirmed','wrong-attribution'])test(`known legacy commitment stays reserved with ${evidence} evidence`,async t=>{
 const f=fixture(t,{knownCommitment:true,evidence});
 const result=await reconcileBoarding(account,new AbortController().signal);
 assert.equal(result.status,'pending');assert.equal(f.writes(),0);
 assert.deepEqual(result,f.record);assert.equal(walletReservations(account.profileId).length,1);
 const report=formatTransferRecoveryReport(transferStatus(result));
 assert.ok(report.includes(id)&&report.includes(intentId)&&report.includes(commitment));
 assert.match(report,/completion has not been verified/);
});
