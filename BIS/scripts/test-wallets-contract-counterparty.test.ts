import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {entropyToMnemonic} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english.js';
import {register} from './test-wallets/inventory.ts';
import {Operations} from './test-wallets/operations.ts';

// Public deterministic BIP39 fixtures in memory only. No real Vault, provider,
// registered private test wallet, funding or actual network receipt is used.
async function fixture(){
  const state:{accounts:any[];pairs:any[];operations?:any[]}={accounts:[],pairs:[]};
  const vault={transaction:async<T>(use:(snapshot:typeof state)=>T|Promise<T>)=>use(state)};
  await register(vault,[0,1].map((value)=>({label:value?'game':'player',phrase:entropyToMnemonic(new Uint8Array(16).fill(value),wordlist)})),'supplied');
  const [player,game]=state.accounts;
  const intent={id:'original-contract-claim',account:player.label,profileId:player.profileId,generation:player.generation,network:'mutinynet',
    kind:'claim',recipient:'original-contract',amountSats:1000,feeSats:0,sourceOrigin:null,
    target:{account:game.label,profileId:game.profileId,generation:game.generation}};
  return {state,vault,player,game,intent,ledger:new Operations(vault)};
}
test('pending and unknown contract spends quarantine both original participants across other wallet operations',async()=>{
  for(const kind of ['claim','refund'])for(const unknown of [false,true]){
    const f=await fixture(),intent={...f.intent,kind};await f.ledger.prepare(intent);
    const original=await f.ledger.submit(intent.id,async()=>{if(unknown)throw Error('Lost original acknowledgement');return {providerId:'a'.repeat(64)};});
    assert.equal(original.state,unknown?'unknown':'pending');assert.deepEqual(original.intent.target,intent.target);
    for(const account of [f.player,f.game])await assert.rejects(f.ledger.prepare({...intent,id:'competing-'+account.label,kind:'arkade-send',target:undefined,
      account:account.label,profileId:account.profileId,generation:account.generation}),/operation-scope-pending/);
  }
});
test('unregistered, wrong-key and changed-generation contract targets refuse before submission',async()=>{
  for(const change of [{account:'unregistered'},{profileId:'f'.repeat(64)},{generation:2}]){
    const f=await fixture();
    await assert.rejects(f.ledger.prepare({...f.intent,target:{...f.intent.target,...change}}),/operation-target-changed/);
    assert.equal(f.state.operations?.length??0,0);
  }
  const f=await fixture();await f.ledger.prepare(f.intent);f.game.generation++;
  let calls=0;await assert.rejects(f.ledger.submit(f.intent.id,async()=>{calls++;return {providerId:'a'.repeat(64)};}),/operation-target-changed/);
  assert.equal(calls,0);assert.equal((await f.ledger.list())[0].state,'prepared');
});
test('revoked counterparty grant prevents actual submission while preserving the exact original intent',async()=>{
  const f=await fixture();const saved=await f.ledger.prepare(f.intent);f.game.grant.active=false;
  await assert.rejects(f.ledger.submit(f.intent.id,async()=>assert.fail('Revoked target must never submit')),/test-target-grant-unavailable/);
  assert.deepEqual((await f.ledger.list())[0].intent,saved.intent);
});
test('unknown original contract submission is never replayed and exact receipt reconciliation releases both holds',async()=>{
  const f=await fixture();await f.ledger.prepare(f.intent);let submissions=0;
  const original=await f.ledger.submit(f.intent.id,async()=>{submissions++;throw Error('Original response lost');});
  assert.equal((await f.ledger.prepare(f.intent)).fingerprint,original.fingerprint);
  assert.equal((await f.ledger.submit(f.intent.id,async()=>{submissions++;return {providerId:'a'.repeat(64)};})).state,'unknown');
  assert.equal(submissions,1);
  await assert.rejects(f.ledger.reconcile(f.intent.id,async()=>({id:f.intent.id,fingerprint:'wrong',providerId:'a'.repeat(64),outcome:'settled',verified:true})),/operation-evidence-mismatch/);
  const settled=await f.ledger.reconcile(f.intent.id,async(record:any)=>({id:record.intent.id,fingerprint:record.fingerprint,providerId:'a'.repeat(64),outcome:'settled',verified:true}));
  assert.equal(settled.state,'settled');assert.deepEqual(settled.intent,original.intent);
  for(const account of [f.player,f.game]){
    const next=await f.ledger.prepare({...f.intent,id:'next-'+account.label,target:undefined,kind:'arkade-send',account:account.label,profileId:account.profileId,generation:account.generation});
    await f.ledger.cancelPrepared(next.intent.id);
  }
});
test('legacy Claim and Refund without target preserve their exact canonical fingerprints and histories',async()=>{
  for(const kind of ['claim','refund']){
    const f=await fixture(),{target:_target,...legacy}=f.intent;
    const intent={...legacy,kind},prepared=await f.ledger.prepare(intent);
    assert.equal(Object.hasOwn(prepared.intent,'target'),false);
    assert.equal(prepared.fingerprint,createHash('sha256').update(JSON.stringify(intent)).digest('hex'));
    const pending=await f.ledger.submit(intent.id,async()=>({providerId:'b'.repeat(64)}));
    assert.equal(pending.state,'pending');assert.equal((await f.ledger.list())[0].fingerprint,prepared.fingerprint);
  }
});
