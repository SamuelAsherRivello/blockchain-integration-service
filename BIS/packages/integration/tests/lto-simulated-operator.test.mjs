import test from 'node:test';
import assert from 'node:assert/strict';
import {Transaction} from '@scure/btc-signer';
import {hex,base64} from '@scure/base';
import {MnemonicIdentity,SingleKey,CSVMultisigTapscript,RestArkProvider,RestIndexerProvider,VtxoScript,Extension} from '@arkade-os/sdk';
import {prepareLtoRecovery,submitLtoSpend,reconcileLtoSpend,resumeLtoFinalization} from '../src/arkade/lto-contract.ts';
import {startLto,emptyContractLedger,beginContractOperation} from '../src/core/contracts.ts';
import {signHostedClaim} from '../src/arkade/hosted-claim.ts';
import {openVault} from '../../wallet-service/src/vault.mjs';
import {createWalletRuntime} from '../../wallet-service/src/runtime.mjs';
import {resolve} from 'node:path';

// This operator exists only inside a test process: no HTTP requests, saved user
// identities, faucet, real funds, or production capability override are involved.
async function simulator(t,{assetCarrier=false}={}) {
  t.mock.method(globalThis,'fetch',async()=>{assert.fail('Simulation attempted a network request');});
  const identities=[1,2,3].map(value=>SingleKey.fromPrivateKey(new Uint8Array(32).fill(value)));
  const operator=identities[0],operatorKey=await operator.xOnlyPublicKey();
  const game={profileId:'game',phrase:'simulated-game'},player={profileId:'player',phrase:'simulated-player'};
  t.mock.method(MnemonicIdentity,'fromMnemonic',phrase=>{assert.ok([game.phrase,player.phrase].includes(phrase));return identities[phrase===game.phrase?1:2];});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
  const info={network:'signet',fees:{txFeeRate:'0',intentFee:{}},signerPubkey:hex.encode(operatorKey),unilateralExitDelay:512n,vtxoMinAmount:1n,vtxoMaxAmount:0n,
    checkpointTapscript:hex.encode(CSVMultisigTapscript.encode({pubkeys:[operatorKey],timelock:{type:'seconds',value:512n}}).script)};
  t.mock.method(RestArkProvider.prototype,'getInfo',async()=>info);
  const coins=new Map(),journal=new Map(),submitted=new Map(),locks=new Map();
  const key=coin=>`${coin.txid}:${coin.vout}`;
  const state={submits:0,finalizes:0,loseFinalizeAck:false,hideReceipts:false,wrongSigner:false};
  t.mock.method(RestIndexerProvider.prototype,'getVtxos',async query=>({vtxos:
    query.scripts?[...coins.values()].filter(coin=>query.scripts.includes(coin.script)&&(!query.spendableOnly||!coin.spentBy)):
    state.hideReceipts?[]:query.outpoints.map(point=>coins.get(key(point))).filter(Boolean)}));
  t.mock.method(RestArkProvider.prototype,'submitTx',async(encoded,checkpoints)=>{
    const transaction=Transaction.fromPSBT(base64.decode(encoded)),entry=journal.get(transaction.id)??await state.readJournal?.(transaction.id);
    assert.ok(entry,'exact spend must be durably journaled before submission');
    assert.equal(entry.record.operation.submission,'submitted');state.submits++;
    await state.beforeSubmit?.();
    for(const input of entry.recovery.spend.inputs) {
      assert.ok(coins.has(key(input))&&!coins.get(key(input)).spentBy,'input is already spent');
      assert.ok(!locks.has(key(input)),'input is reserved by a competing submission');
    }
    for(const input of entry.recovery.spend.inputs)locks.set(key(input),transaction.id);
    submitted.set(transaction.id,{...entry,transaction});
    const signer=state.wrongSigner?identities[2]:operator;
    return {arkTxid:transaction.id,finalArkTx:base64.encode((await signer.sign(transaction)).toPSBT()),
      signedCheckpointTxs:await Promise.all(checkpoints.map(async checkpoint=>base64.encode((await signer.sign(Transaction.fromPSBT(base64.decode(checkpoint)))).toPSBT())))};
  });
  t.mock.method(RestArkProvider.prototype,'finalizeTx',async(id,checkpoints)=>{
    const entry=submitted.get(id);assert.ok(entry);state.finalizes++;
    assert.deepEqual((journal.get(id)??await state.readJournal?.(id)).recovery.finalization.checkpoints,checkpoints,'signed finalization is saved before transmission');
    const spend=entry.recovery.spend;
    for(const input of spend.inputs) {
      const coin=coins.get(key(input));assert.ok(!coin.spentBy||coin.arkTxId===id);
      coins.set(key(input),{...coin,spentBy:'ff'.repeat(32),arkTxId:id,isSpent:true});
    }
    const groups=spend.change?.assets?.length?Extension.fromTx(entry.transaction).getAssetPacket().groups:[];
    for(const group of groups) {
      assert.equal(group.outputs.length,1);assert.equal(group.outputs[0].vout,1,'assets must remain in game change');
      const total=group.inputs.reduce((sum,input)=>sum+input.amount,0n);assert.equal(group.outputs[0].amount,total);
      for(const input of group.inputs)assert.equal(coins.get(key(spend.inputs[input.vin])).assets.find(a=>a.assetId===group.assetId.toString()).amount,input.amount);
    }
    for(let vout=0;vout<entry.transaction.outputsLength;vout++) {
      const output=entry.transaction.getOutput(vout),assets=groups.flatMap(group=>group.outputs.filter(o=>o.vout===vout).map(o=>({assetId:group.assetId.toString(),amount:o.amount})));
      coins.set(`${id}:${vout}`,{txid:id,vout,script:hex.encode(output.script),value:Number(output.amount),...(assets.length?{assets}:{})});
    }
    if(state.loseFinalizeAck)throw Error('Simulated lost acknowledgement');
  });
  const recovery=await prepareLtoRecovery(game,player),script=name=>hex.encode(VtxoScript.decode(hex.decode(recovery[name])).pkScript);
  const carrierAssets=Array.from({length:6},(_,i)=>({assetId:String(i+1).repeat(64)+'0000',amount:i===5?9007199254740993n:1n}));
  for(const [id,value,assets] of assetCarrier?[['a',53000,carrierAssets]]:[['a',600],['b',800],['c',10000],['d',500,[{assetId:'preserved',amount:'1'}]]]) {
    const coin={txid:id.repeat(64),vout:0,value,script:script('gameScript'),...(assets?{assets}:{})};coins.set(key(coin),coin);
  }
  const untouched=(assetCarrier?[]:['c','d']).map(id=>structuredClone(coins.get(`${id.repeat(64)}:0`)));
  const now=Date.now(),record=startLto(emptyContractLedger(),{id:'offer',sessionId:'session',operationId:'fund',purpose:'treasureLTO',hostReference:'chest',amountSats:1000,startedAt:now,expiresAt:now+90000,scope:{playerId:'player',gameId:'game',operator:'https://signet.arkade.sh',network:'signet',exclusivityKey:'treasure'}},now).contract;
  const commit=async(record,recovery)=>{if(recovery.spend)journal.set(recovery.spend.transactionId,structuredClone({record,recovery}));};
  const spend=(record,recovery)=>submitLtoSpend(record,recovery,record.operation.kind==='claim'?player:game,commit,()=>true);
  const next=(funded,kind)=>({record:beginContractOperation(funded.record,kind,kind,Date.now()),recovery:{...funded.recovery,spend:undefined,finalization:undefined}});
  const balance=scriptName=>[...coins.values()].filter(coin=>coin.script===script(scriptName)&&!coin.spentBy).reduce((sum,coin)=>sum+coin.value,0);
  const preserved=()=>untouched.forEach(coin=>assert.deepEqual(coins.get(key(coin)),coin));
  return {state,record,recovery,spend,next,balance,preserved,carrierAssets,coins,commit,player,game,playerPublicKey:hex.encode(await identities[2].compressedPublicKey())};
}

test('hosted service funds and completes the full browser signing exchange through the real SDK',async t=>{
 const s=await simulator(t,{assetCarrier:true}),vault=openVault(resolve('output/tests/hosted-wallet',crypto.randomUUID()));
 const runtime=createWalletRuntime(vault,{walletDependencies:{restore:async()=>s.game,addresses:async()=>({arkadeAddress:'public-game'}),balance:async()=>({availableSats:s.balance('gameScript')})}});
 s.state.readJournal=async id=>{const doc=await runtime.storage.load(),record=doc.ledger.contracts.find(r=>doc.recovery[r.id]?.spend?.transactionId===id);return record?{record,recovery:doc.recovery[record.id]}:undefined;};
 try {
  assert.equal(await runtime.admin('importWallet',['synthetic-input']),true);
  for(let i=0;i<100&&runtime.wallet.getState().status!=='ready';i++)await new Promise(r=>setTimeout(r,5));
  const player={profileId:'player',publicKey:s.playerPublicKey},now=Date.now();
  const funded=await runtime.call(player,'start',{request:{sessionId:'hosted',hostReference:'treasure:hosted',purpose:'treasureLTO',exclusivityKey:'treasure',amountSats:1000,startedAt:now,expiresAt:now+90000}});
  assert.equal(funded.result.contract.financial,'funded');assert.equal(s.balance('playerScript'),0);
  await navigator.locks.request('bis-signet-contracts-v1',()=>{});await new Promise(r=>setTimeout(r,20));
  assert.equal((await runtime.call(player,'claim',{id:funded.result.contract.id})).result.status,'pending');
  let signatures=0,completed=false;
  for(let i=0;i<100;i++) {
   const sync=await runtime.call(player,'sync',{filter:{includeResolved:true}});
   if(sync.result.contracts.contracts[0].financial==='claimed'){completed=true;break;}
   for(const challenge of sync.result.signatures) {
    const transaction=await signHostedClaim(challenge,s.player,'game');signatures++;
    await runtime.call(player,'signature',{id:challenge.id,transaction});
   }
   await new Promise(r=>setTimeout(r,10));
  }
  assert.ok(completed);assert.equal(signatures,2);assert.equal(s.balance('playerScript'),1000);assert.equal(s.balance('gameScript'),52000);
  const events=(await runtime.call(player,'query',{after:0})).events.map(e=>e.message);
  assert.ok(events.includes('Offer funding pending'));assert.ok(events.includes('Contract claim confirmed: 1,000 sats'));
 }finally{await runtime.close();vault.close();}
});

test('hosted claim resumes its persisted checkpoint after service restart without duplicate submission',async t=>{
 const s=await simulator(t,{assetCarrier:true}),directory=resolve('output/tests/hosted-wallet',crypto.randomUUID());
 let vault=openVault(directory),runtime;
 const startRuntime=()=>createWalletRuntime(vault,{walletDependencies:{restore:async()=>s.game,addresses:async()=>({arkadeAddress:'public-game'}),balance:async()=>({availableSats:s.balance('gameScript')})}});
 runtime=startRuntime();
 s.state.readJournal=async id=>{const doc=await runtime.storage.load(),record=doc.ledger.contracts.find(r=>doc.recovery[r.id]?.spend?.transactionId===id);return record?{record,recovery:doc.recovery[record.id]}:undefined;};
 try {
  await runtime.admin('importWallet',['synthetic-input']);
  for(let i=0;i<100&&runtime.wallet.getState().status!=='ready';i++)await new Promise(r=>setTimeout(r,5));
  const player={profileId:'player',publicKey:s.playerPublicKey},now=Date.now();
  const funded=await runtime.call(player,'start',{request:{sessionId:'restart-signing',hostReference:'treasure:restart-signing',purpose:'treasureLTO',amountSats:1000,startedAt:now,expiresAt:now+90000}});
  await navigator.locks.request('bis-signet-contracts-v1',()=>{});await new Promise(r=>setTimeout(r,20));
  assert.equal((await runtime.call(player,'claim',{id:funded.result.contract.id})).result.status,'pending');
  let checkpoint;
  for(let i=0;i<100&&!checkpoint;i++) {
   const sync=await runtime.call(player,'sync',{filter:{includeResolved:true}});
   for(const challenge of sync.result.signatures) {
    if(challenge.stage==='checkpoint'){checkpoint=challenge;break;}
    await runtime.call(player,'signature',{id:challenge.id,transaction:await signHostedClaim(challenge,s.player,'game')});
   }
   await new Promise(r=>setTimeout(r,10));
  }
  assert.ok(checkpoint);assert.equal(s.state.submits,2);assert.equal(s.state.finalizes,1);
  await runtime.close();vault.close();vault=openVault(directory);runtime=startRuntime();
  for(let i=0;i<100&&runtime.wallet.getState().status!=='ready';i++)await new Promise(r=>setTimeout(r,5));
  await navigator.locks.request('bis-signet-contracts-v1',()=>{});await new Promise(r=>setTimeout(r,20));
  const sync=await runtime.call(player,'sync',{filter:{includeResolved:true}});
  assert.ok(sync.result.signatures.some(c=>c.id===checkpoint.id));
  await runtime.call(player,'signature',{id:checkpoint.id,transaction:await signHostedClaim(checkpoint,s.player,'game')});
  const doc=await runtime.storage.load();assert.equal(doc.ledger.contracts[0].financial,'claimed');
  assert.equal(s.state.submits,2);assert.equal(s.state.finalizes,2);assert.equal(s.balance('playerScript'),1000);assert.equal(s.balance('gameScript'),52000);
 }finally{await runtime.close();vault.close();}
});

test('hosted claim uses browser-only player signatures over the verified SDK claim graph',async t=>{
 const s=await simulator(t,{assetCarrier:true}),funded=await s.spend(s.record,s.recovery),claim=s.next(funded,'claim');let signatures=0,signingError;
 const remote={xOnlyPublicKey:async()=>hex.decode(claim.recovery.playerKey),sign:async tx=>{signatures++;try{return Transaction.fromPSBT(base64.decode(await signHostedClaim({id:'challenge',contractId:claim.record.id,transaction:base64.encode(tx.toPSBT()),record:claim.record,recovery:claim.recovery},s.player,'game')));}catch(error){signingError=error;throw error;}}};
 const result=await submitLtoSpend(claim.record,claim.recovery,{profileId:'player',phrase:''},s.commit,()=>true,remote);
 assert.ifError(signingError);assert.equal(result.record.financial,'claimed');assert.equal(signatures,2);assert.equal(s.balance('playerScript'),1000);
});

test('53000-sat game asset carrier funds a clean 1000-sat contract and retains all six assets',async t=>{
  const s=await simulator(t,{assetCarrier:true}),funded=await s.spend(s.record,s.recovery);
  assert.equal(funded.record.financial,'funded');
  assert.equal(s.balance('gameScript'),52000);
  const id=funded.recovery.spend.transactionId;
  assert.equal(s.coins.get(`${id}:0`).assets,undefined);
  assert.deepEqual(s.coins.get(`${id}:1`).assets,s.carrierAssets);
  const claim=s.next(funded,'claim');assert.equal((await s.spend(claim.record,claim.recovery)).record.financial,'claimed');
  assert.equal(s.balance('playerScript'),1000);assert.deepEqual(s.coins.get(`${id}:1`).assets,s.carrierAssets);
});

test('real SDK signs funding and zero-balance player claim against an isolated operator with preserved assets/change',async t=>{
  const s=await simulator(t);assert.equal(s.balance('playerScript'),0);
  const before=s.balance('gameScript'),funded=await s.spend(s.record,s.recovery);
  assert.equal(funded.record.financial,'funded');assert.equal(funded.recovery.spend.inputs.length,2);assert.equal(funded.recovery.spend.change.value,400);
  const claim=s.next(funded,'claim'),claimed=await s.spend(claim.record,claim.recovery);
  assert.equal(claimed.record.financial,'claimed');assert.equal(s.balance('playerScript'),1000);assert.equal(s.balance('gameScript'),before-1000);s.preserved();
});

test('cooperative refund returns the exact reward without needing player funds',async t=>{
  const s=await simulator(t),before=s.balance('gameScript'),funded=await s.spend(s.record,s.recovery);
  const refund=s.next(funded,'refund'),returned=await s.spend(refund.record,refund.recovery);
  assert.equal(returned.record.financial,'refunded');assert.equal(s.balance('playerScript'),0);assert.equal(s.balance('gameScript'),before);s.preserved();
});

test('lost finalization acknowledgement recovers from exact receipts without another spend',async t=>{
  const s=await simulator(t);s.state.loseFinalizeAck=true;
  const unknown=await s.spend(s.record,s.recovery);assert.equal(unknown.record.financial,'unknown');
  s.state.hideReceipts=true;assert.equal((await reconcileLtoSpend(unknown.record,unknown.recovery)).record.financial,'unknown');
  s.state.hideReceipts=false;const recovered=await resumeLtoFinalization(unknown.record,unknown.recovery);
  assert.equal(recovered.record.financial,'funded');assert.equal(s.state.submits,1);s.preserved();
});

test('SDK rejects a simulated operator response lacking the correct operator signature',async t=>{
  const s=await simulator(t);s.state.wrongSigner=true;const result=await s.spend(s.record,s.recovery);
  assert.equal(result.record.financial,'unknown');assert.equal(s.state.finalizes,0);s.preserved();
});

test('competing claim/refund allows one spend and never treats the loser as confirmed',async t=>{
  const s=await simulator(t),before=s.balance('gameScript'),funded=await s.spend(s.record,s.recovery);
  let arrived=0,release;const gate=new Promise(resolve=>{release=resolve;});
  s.state.beforeSubmit=()=>{if(++arrived===2)release();return gate;};
  const a=s.next(funded,'claim'),b=s.next(funded,'refund');
  const results=await Promise.all([s.spend(a.record,a.recovery),s.spend(b.record,b.recovery)]);
  assert.equal(results.filter(result=>['claimed','refunded'].includes(result.record.financial)).length,1);
  assert.equal(results.filter(result=>result.record.financial==='unknown').length,1);
  assert.equal(s.balance('gameScript')+s.balance('playerScript'),before);s.preserved();
});
