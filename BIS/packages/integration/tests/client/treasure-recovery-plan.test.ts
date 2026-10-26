import test from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {buildTreasureScript} from '../../src/client/wallet-layer-arkade/treasure-script.ts';
import {TREASURE_EMULATOR} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';
import {inspectTreasureRecoveryPlan} from '../../src/client/wallet-layer-arkade/treasure-recovery-plan.ts';
import {resumeTreasureSpend} from '../../src/client/wallet-layer-arkade/treasure-contract.ts';
import {reconcileLtoSpend} from '../../src/client/wallet-layer-arkade/lto-contract.ts';

// Deterministic SDK signatures with public test keys. No wallet storage or network.
const identities=[1,2,3].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
const [player,game,operator]=await Promise.all(identities.map(async i=>hex.encode(await i.xOnlyPublicKey())));
async function fixture(branch='claim') {
  const defaults={serverPubKey:hex.decode(operator),csvTimelock:{type:'seconds',value:2048n}};
  const playerScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(player)});
  const gameScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(game)});
  const t={network:'mutinynet',offerSessionId:'offer',hostReference:'run',startedAtMs:1_800_000_000_123,
    player,game,operator,emulator:TREASURE_EMULATOR.key.slice(2),exitDelay:2048,
    playerDestination:hex.encode(playerScript.pkScript.slice(2)),gameDestination:hex.encode(gameScript.pkScript.slice(2))};
  const built=buildTreasureScript(t),fund={txid:'ab'.repeat(32),vout:0,value:1000};
  const destination=hex.encode(branch==='claim'?playerScript.pkScript:gameScript.pkScript);
  const fn=built.script.functionByName(branch);
  const unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operator)],timelock:{type:'seconds',value:2048n}});
  const {arkTx,checkpoints}=buildOffchainTx([{...fund,tapLeafScript:fn.tapLeafScript,tapTree:built.script.encode()}],
    [{script:hex.decode(destination),amount:1000n},{script:hex.decode('6a'),amount:0n}],unroll);
  let tx=arkTx,cp=checkpoints[0];
  for(const i of branch==='claim'?[0]:branch==='refund'?[1]:[0,1]){
    tx=await identities[i].sign(tx,[0]);cp=await identities[i].sign(cp,[0]);
  }
  const record={version:1,type:'lto',id:'contract',scope:{network:'mutinynet',operator:'https://mutinynet.arkade.sh',
    playerId:'player',gameId:'game',exclusivityKey:'treasure'},purpose:'treasureLTO',sessionId:'offer',hostReference:'run',
    startedAt:t.startedAtMs,expiresAt:built.deadlineSeconds*1000,amountSats:1000,validationMode:'arkade-covenant-v2',
    financial:'unknown',operation:{id:'spend',kind:branch==='claim'?'claim':'refund',submission:'unknown'},
    ...(branch==='reject'?{ended:'rejected'}:branch==='cancel'?{ended:'session-ended'}:{})};
  const recovery={treasure:t,playerKey:player,gameKey:game,operatorKey:operator,exitDelay:'2048',
    playerScript:hex.encode(playerScript.encode()),gameScript:hex.encode(gameScript.encode()),contractScript:hex.encode(built.script.encode()),
    fundingOutput:fund,spend:{operationId:'spend',transactionId:tx.id,inputs:[fund],destinationScript:destination,amountSats:1000},
    emulatorSubmission:{transactionId:tx.id,arkTx:base64.encode(tx.toPSBT()),checkpoints:[base64.encode(cp.toPSBT())]}};
  return {record,recovery};
}
const inspect=({record,recovery})=>inspectTreasureRecoveryPlan(record,recovery);

test('original recovery validates actual signed claim, reject, cancel and refund checkpoint chains',async()=>{
  for(const branch of ['claim','reject','cancel','refund']){
    const f=await fixture(branch),before=structuredClone(f);
    assert.equal(inspect(f).transactionId,f.recovery.spend.transactionId);
    assert.deepEqual(f,before);
  }
});

test('recovery rejects changed scope, original terms, signer and operation identity',async()=>{
  const f=await fixture();
  for(const patch of [{scope:{...f.record.scope,network:'signet'}},{scope:{...f.record.scope,operator:'https://untrusted.invalid'}},
    {scope:{...f.record.scope,gameId:'player'}},{sessionId:'other'},{hostReference:'other'},
    {startedAt:f.record.startedAt+1},{expiresAt:f.record.expiresAt+1000},{amountSats:999},
    {purpose:'other'},{validationMode:'browser-policy-v1'},{operation:{...f.record.operation,id:'other'}},
    {operation:{...f.record.operation,kind:'fund'}},{operation:{...f.record.operation,submission:'prepared'}}])
    assert.throws(()=>inspect({...f,record:{...f.record,...patch}}),/original contract/);
  for(const patch of [{playerKey:game},{gameKey:player},{operatorKey:game},{exitDelay:'4096'},
    {treasure:{...f.recovery.treasure,emulator:game}},{contractScript:'00'}])
    assert.throws(()=>inspect({...f,recovery:{...f.recovery,...patch}}),/original contract/);
});

test('recovery rejects payout replacement, input substitution and mismatched saved transactions',async()=>{
  const f=await fixture();
  for(const patch of [{playerScript:f.recovery.gameScript},{gameScript:f.recovery.playerScript},
    {playerScript:f.recovery.gameScript,spend:{...f.recovery.spend,
      destinationScript:'5120'+f.recovery.treasure.gameDestination}},
    {fundingOutput:{...f.recovery.fundingOutput,value:999}},
    {spend:{...f.recovery.spend,destinationScript:'5120'+game}},
    {spend:{...f.recovery.spend,inputs:[{...f.recovery.fundingOutput,vout:1}]}},
    {spend:{...f.recovery.spend,inputs:[]}},
    {fundingOutput:{...f.recovery.fundingOutput,txid:'cd'.repeat(32)},
      spend:{...f.recovery.spend,inputs:[{...f.recovery.fundingOutput,txid:'cd'.repeat(32)}]}},
    {spend:{...f.recovery.spend,change:{script:'5120'+game,value:1}}},
    {emulatorSubmission:{...f.recovery.emulatorSubmission,transactionId:'cd'.repeat(32)}},
    {spend:{...f.recovery.spend,transactionId:'cd'.repeat(32)},
      emulatorSubmission:{...f.recovery.emulatorSubmission,transactionId:'cd'.repeat(32)}},
    {emulatorSubmission:{...f.recovery.emulatorSubmission,checkpoints:[]}},
    {emulatorSubmission:{...f.recovery.emulatorSubmission,arkTx:'private-malformed-material'}}])
    assert.throws(()=>inspect({...f,recovery:{...f.recovery,...patch}}),/original contract/);
});

test('invalid recovery cannot become confirmed through receipt lookup or trigger replay',async t=>{
  const f=await fixture(),before=structuredClone(f);
  let reconciliations=0,networkCalls=0;
  t.mock.method(globalThis,'fetch',async()=>{networkCalls++;throw Error('unexpected network');});
  await assert.rejects(resumeTreasureSpend(f.record,{...f.recovery,
    spend:{...f.recovery.spend,destinationScript:'5120'+game}},async()=>{
      reconciliations++;return {record:{...f.record,financial:'claimed'},recovery:f.recovery};
    }),/original contract/);
  assert.equal(reconciliations,0);assert.equal(networkCalls,0);assert.deepEqual(f,before);
});

test('an original claim receipt can confirm after expiry without another provider submission',async t=>{
  const f=await fixture();let calls=0;
  t.mock.method(Date,'now',()=>f.record.expiresAt+60_000);
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('unexpected network');});
  const confirmed={...f.record,financial:'claimed',operation:{...f.record.operation,submission:'confirmed'}};
  const result=await resumeTreasureSpend(f.record,f.recovery,async()=>({record:confirmed,recovery:f.recovery}));
  assert.equal(result.record,confirmed);assert.equal(calls,0);
});

test('direct receipt reconciliation checks original recovery before querying an operator',async t=>{
  const f=await fixture();let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('unexpected network');});
  const corrupt={...f.recovery,spend:{...f.recovery.spend,destinationScript:'5120'+game}};
  await assert.rejects(reconcileLtoSpend(f.record,corrupt),/original contract/);
  assert.equal(calls,0);assert.equal(f.record.operation.submission,'unknown');
});
