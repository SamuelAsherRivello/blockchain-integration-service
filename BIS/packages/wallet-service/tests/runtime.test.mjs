import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {openVault} from '../src/vault.mjs';
import {createWalletRuntime} from '../src/runtime.mjs';
import {markContractSubmission,finishContractOperation} from '../../integration/src/core/contracts.ts';

const wait=async check=>{for(let i=0;i<200;i++){if(await check())return;await new Promise(r=>setTimeout(r,5));}assert.fail('Runtime did not settle');};
const request=(sessionId)=>{const startedAt=Date.now();return{sessionId,hostReference:`treasure:${sessionId}`,purpose:'treasureLTO',exclusivityKey:'treasure',amountSats:1000,startedAt,expiresAt:startedAt+90000};};
const player={profileId:'player',publicKey:'02'+'23'.repeat(32)},other={profileId:'other',publicKey:'03'+'24'.repeat(32)};
function fixture(directory=resolve('output/tests/hosted-wallet',crypto.randomUUID())) {
 const vault=openVault(directory),calls=[];
 const recovery={secretHex:'12'.repeat(32),playerKey:'23'.repeat(32),gameKey:'34'.repeat(32),operatorKey:'45'.repeat(32),exitDelay:'512',gameScript:'00',playerScript:'01',contractScript:'02'};
 const control={unknown:false};
 const runtime=createWalletRuntime(vault,{walletDependencies:{restore:async()=>({profileId:'game',phrase:'synthetic-private-game'}),addresses:async()=>({arkadeAddress:'public-game'}),balance:async()=>({availableSats:5000})},adapter:{
  prepare:async()=>recovery,reconcile:async(record,recovery)=>({record,recovery}),resume:async(record,recovery)=>({record,recovery}),
  submit:async(record,recovery,account,commit,current)=>{
   assert.ok(current());calls.push(record.operation.kind);
   const transactionId=(record.operation.kind==='fund'?'b':'c').repeat(64),material={...recovery,spend:{operationId:record.operation.id,transactionId,inputs:[recovery.fundingOutput??{txid:'a'.repeat(64),vout:0,value:1000}],destinationScript:'00',amountSats:1000}};
   record=markContractSubmission(record,record.operation.id,Date.now());await commit(record,material);
   if(control.unknown){record=markContractSubmission(record,record.operation.id,Date.now(),true);await commit(record,material);return{record,recovery:material};}
   record=finishContractOperation(record,{operationId:record.operation.id,kind:record.operation.kind,outcome:'confirmed'});
   if(record.operation.kind==='fund')material.fundingOutput={txid:transactionId,vout:0,value:1000};
   await commit(record,material);return{record,recovery:material};
  }}});
 return{runtime,vault,calls,control,directory,async close(){await runtime.close();vault.close();}};
}
test('one Admin import supports multiple clients; duplicate funding and another player ending the session are prevented',async()=>{
 const s=fixture();try{
  assert.equal(await s.runtime.admin('importWallet',['synthetic-input']),true);
  await wait(()=>s.runtime.wallet.getState().status==='ready');
  const req=request('one');const [a,b]=await Promise.all([s.runtime.call(player,'start',{request:req}),s.runtime.call(player,'start',{request:req})]);
  assert.equal(a.result.contract.id,b.result.contract.id);assert.deepEqual(s.calls,['fund']);
  assert.equal(JSON.stringify(s.runtime.publicState()).includes('synthetic-private-game'),false);
  await s.runtime.call(other,'end',{sessionId:'one'});assert.deepEqual(s.calls,['fund']);
  assert.equal((await s.runtime.call(other,'claim',{id:a.result.contract.id})).result.status,'unavailable');
  const claimed=await s.runtime.call(player,'claim',{id:a.result.contract.id});assert.equal(claimed.result.status,'pending');
  await wait(async()=> (await s.runtime.call(player,'query',{filter:{includeResolved:true}})).result.contracts[0].financial==='claimed');
  assert.deepEqual(s.calls,['fund','claim']);
 }finally{await s.close();}
});
test('service restart restores the selected wallet and unknown submission without a second funding attempt',async()=>{
 const s=fixture();await s.runtime.admin('importWallet',['synthetic-input']);await wait(()=>s.runtime.wallet.getState().status==='ready');s.control.unknown=true;
 const req=request('restart');await s.runtime.call(player,'start',{request:req});await s.close();
 const restored=fixture(s.directory);try{
  await wait(()=>restored.runtime.wallet.getState().status==='ready');
  const result=await restored.runtime.call(player,'query',{filter:{includeResolved:true}});assert.equal(result.result.contracts[0].financial,'unknown');
  await restored.runtime.call(player,'start',{request:req});assert.deepEqual(restored.calls,[]);
 }finally{await restored.close();}
});
test('Reject returns the original reward and an unresolved refund prevents replacement',async()=>{
 const s=fixture();try{
  await s.runtime.admin('importWallet',['synthetic-input']);await wait(()=>s.runtime.wallet.getState().status==='ready');
  const offer=(await s.runtime.call(player,'start',{request:request('reject')})).result.contract;s.control.unknown=true;
  await wait(()=>s.runtime.wallet.getState().status==='ready');await navigator.locks.request('bis-signet-contracts-v1',()=>{});
  assert.equal((await s.runtime.call(player,'reject',{id:offer.id})).result.status,'pending');
  await wait(()=>s.calls.includes('refund'));
  assert.equal((await s.runtime.call(player,'start',{request:request('next')})).result.status,'unavailable');assert.deepEqual(s.calls,['fund','refund']);
 }finally{await s.close();}
});
