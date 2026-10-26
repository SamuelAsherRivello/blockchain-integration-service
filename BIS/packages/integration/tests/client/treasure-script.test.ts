import test from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey,CSVMultisigTapscript,buildOffchainTx} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {buildTreasureScript,treasureDeadlineSeconds} from '../../src/client/wallet-layer-arkade/treasure-script.ts';
import {inspectTreasureSpendPlan} from '../../src/client/wallet-layer-arkade/treasure-spend-plan.ts';

// Public test-only keys. These fixtures never load wallet storage or contact a provider.
const identities=[1,2,3,4].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
const [player,game,operator,emulator]=await Promise.all(identities.map(async identity=>hex.encode(await identity.xOnlyPublicKey())));
const terms={network:'mutinynet' as const,offerSessionId:'offer-a',hostReference:'run-a',startedAtMs:1_800_000_000_123,
  player,game,operator,emulator,playerDestination:player,gameDestination:game,exitDelay:2048};

test('treasure deadline never exceeds the original 90-second window',()=>{
  for(let offset=0;offset<1000;offset++){
    const start=1_800_000_000_000+offset,deadline=treasureDeadlineSeconds(start);
    assert.ok(deadline*1000<=start+90_000);assert.ok(deadline*1000>start+89_000);
  }
  for(const value of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER])assert.throws(()=>treasureDeadlineSeconds(value));
});

test('treasure script binds original offer, run, network, time, keys and destinations',()=>{
  const original=buildTreasureScript(terms);
  for(const change of [{offerSessionId:'offer-b'},{hostReference:'run-b'},{network:'signet' as const},
    {startedAtMs:terms.startedAtMs+1},{playerDestination:game},{gameDestination:player}])
    assert.notDeepEqual(buildTreasureScript({...terms,...change}).script.pkScript,original.script.pkScript);
  assert.equal(original.deadlineSeconds,Math.floor(terms.startedAtMs/1000)+90);
  assert.deepEqual(Object.keys(original.program.functions),['claim','reject','cancel','refund','exit']);
  assert.deepEqual(original.program.functions.exit.tapscript.signers,['$game']);
  assert.deepEqual(original.program.functions.reject.tapscript.signers,['$operator','$player','$game']);
});

test('treasure compiler rejects malformed and ambiguous original bindings',()=>{
  for(const change of [{offerSessionId:''},{hostReference:' run'},{hostReference:'run\n'},
    {player:game},{emulator:operator},{exitDelay:513},{exitDelay:0},{playerDestination:'zz'.repeat(32)},
    {hostReference:'😀'.repeat(256)}, {network:'mainnet'}])
    assert.throws(()=>buildTreasureScript({...terms,...change} as typeof terms));
});

test('treasure original-spend verification follows the real SDK checkpoint chain for each branch',async()=>{
  const built=buildTreasureScript(terms);
  const unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operator)],timelock:{type:'seconds',value:2048n}});
  for(const [branch,signerIndexes] of [['claim',[0]],['refund',[1]],['reject',[0,1]],['cancel',[0,1]]] as const){
    const fn=built.script.functionByName(branch),destination='5120'+(branch==='claim'?player:game);
    const {arkTx,checkpoints}=buildOffchainTx([{txid:'ab'.repeat(32),vout:0,value:1000,
      tapLeafScript:fn.tapLeafScript,tapTree:built.script.encode()}],
      [{script:hex.decode(destination),amount:1000n},{script:hex.decode('6a'),amount:0n}],unroll);
    let tx=arkTx,cp=checkpoints[0];
    const binding={funding:{txid:'ab'.repeat(32),vout:0,script:hex.encode(built.script.pkScript)},
      destinationScript:destination,participantKeys:signerIndexes.map(i=>i===0?player:game)};
    const inspect=()=>inspectTreasureSpendPlan(base64.encode(tx.toPSBT()),[base64.encode(cp.toPSBT())],binding);
    assert.throws(inspect);
    for(const i of signerIndexes){tx=await identities[i].sign(tx,[0]);cp=await identities[i].sign(cp,[0]);}
    assert.equal(inspect().transactionId,tx.id);
    assert.notEqual(hex.encode(tx.getInput(0).txid!),binding.funding.txid);
    for(const change of [{destinationScript:'5120'+emulator},
      {funding:{...binding.funding,txid:'cd'.repeat(32)}}, {funding:{...binding.funding,script:'5120'+emulator}}])
      assert.throws(()=>inspectTreasureSpendPlan(base64.encode(tx.toPSBT()),[base64.encode(cp.toPSBT())],{...binding,...change}));
    const wrong=buildOffchainTx([{txid:'ab'.repeat(32),vout:0,value:1000,
      tapLeafScript:fn.tapLeafScript,tapTree:built.script.encode()}],
      [{script:hex.decode(destination),amount:999n},{script:hex.decode('6a'),amount:0n}],unroll);
    let changed=wrong.arkTx;
    for(const i of signerIndexes)changed=await identities[i].sign(changed,[0]);
    assert.throws(()=>inspectTreasureSpendPlan(base64.encode(changed.toPSBT()),[base64.encode(cp.toPSBT())],binding));
  }
});
