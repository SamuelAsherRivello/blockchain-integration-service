import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {arkade,Transaction,buildOffchainTx,CSVMultisigTapscript,Extension,EmulatorPacket} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {hex} from '@scure/base';
import {buildTreasureScript,type TreasureScriptTerms} from '../../src/client/wallet-layer-arkade/treasure-script.ts';
import {buildStagedTreasureScript,treasureStagedBranches} from '../../src/client/wallet-layer-arkade/treasure-staged-script.ts';
import {buildAuthorizedTreasureScript,treasureAuthorizationScope,treasureAuthorizationDigest,treasureAuthorizationActors,
  type AuthorizedTreasureBranch} from '../../src/client/wallet-layer-arkade/treasure-authorized-script.ts';

// Public key literals and unsigned transactions only. Zero-filled proof placeholders
// are bytes for packet compilation, never valid signatures or financial evidence.
const keys=[
  '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
  'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
  'e493dbf1c10d80f3581e4904930b1404cc6c13900ee0758474fa94abe8c4cd13',
];
const terms:TreasureScriptTerms={network:'mutinynet',offerSessionId:'offer-a',hostReference:'run-a',startedAtMs:1_800_000_000_123,
  player:keys[0],game:keys[1],operator:keys[2],emulator:keys[3],playerDestination:keys[0],gameDestination:keys[1],exitDelay:2048};
const hash=(bytes:Uint8Array)=>new Uint8Array(createHash('sha256').update(bytes).digest());
function fixture(branch:AuthorizedTreasureBranch='claim',inputTerms=terms,checkpointKey=inputTerms.operator){
  const built=buildAuthorizedTreasureScript(inputTerms),leaf=built.script.functionByName(branch)!;
  const unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(checkpointKey)],timelock:{type:'seconds',value:2048n}});
  const funding={txid:'0123456789abcdef'.repeat(4),vout:7,value:1000 as const};
  const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,
    witness:RawWitness.encode(treasureAuthorizationActors(branch).map(()=>new Uint8Array(64)))}])]);
  const pair=buildOffchainTx([{...funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:hex.decode('5120'+(branch==='claim'?inputTerms.playerDestination:inputTerms.gameDestination)),amount:1000n},packet.txOut()],unroll);
  return {built,leaf,pair,context:{arkTx:pair.arkTx,checkpoint:pair.checkpoints[0],funding,checkpointTapscript:unroll}};
}

test('canonical checkpoint digest binds a distinct advertised forfeit key without replacing the operator signer',()=>{
  const forfeit='2f8bde4d1a07209355b4a7250a5c5128e88b84bddc619ab7cba8d569b240efe4';
  for(const branch of ['claim','reject','cancel','refund'] as const){
    const distinct=fixture(branch,terms,forfeit),original=fixture(branch);
    const digest=treasureAuthorizationDigest(terms,branch,distinct.context);
    assert.equal(digest.length,32);
    assert.notDeepEqual(digest,treasureAuthorizationDigest(terms,branch,original.context));
    assert.equal(hex.encode(distinct.leaf.signerKeys[0]),terms.operator);
    assert.throws(()=>treasureAuthorizationDigest(terms,branch,{...distinct.context,checkpointTapscript:original.context.checkpointTapscript}));
    assert.throws(()=>treasureAuthorizationDigest(terms,branch,{...original.context,checkpointTapscript:distinct.context.checkpointTapscript}));
  }
});

test('candidate v4 compiles distinctly and leaves original v2/v3 byte vectors intact',()=>{
  const old=buildTreasureScript(terms),staged=buildStagedTreasureScript(terms),candidate=buildAuthorizedTreasureScript(terms);
  assert.equal(hex.encode(old.script.pkScript),'51209584a0280b2a8bd7e080e98c23967c4ad85f493c73254b63e5eaef785d2d9f4e');
  assert.equal(hex.encode(staged.script.pkScript),'5120301e93314424db0c4594be0e906c0a34d9016499bb83ad5fae38bdb4e49f22f3');
  assert.notDeepEqual(candidate.script.pkScript,old.script.pkScript);assert.notDeepEqual(candidate.script.pkScript,staged.script.pkScript);
  assert.equal(candidate.artifactVersion,4);assert.equal(candidate.program.name,'BISTreasureV4');assert.equal(Object.isFrozen(candidate),true);
  assert.equal(candidate.deadlineSeconds,1_800_000_090);
  assert.deepEqual(candidate.script.functionByName('exit')!.leafScript,old.script.functionByName('exit')!.leafScript);
  assert.deepEqual(buildTreasureScript(terms).script.pkScript,old.script.pkScript);
  assert.deepEqual(buildStagedTreasureScript(terms).script.pkScript,staged.script.pkScript);
});

test('each branch has exact typed witness order, required proof checks, positive expiry and unchanged original rules',()=>{
  const candidate=buildAuthorizedTreasureScript(terms),old=buildTreasureScript(terms),staged=buildStagedTreasureScript(terms);
  for(const branch of treasureStagedBranches){
    const expected=branch==='claim'?['player']:branch==='refund'?['game']:['player','game'];
    const fn=candidate.program.functions[branch],leaf=candidate.script.functionByName(branch)!;
    assert.deepEqual(treasureAuthorizationActors(branch),expected);
    assert.deepEqual(fn.inputs,expected.map(name=>({name:name+'Proof',type:'sig'})));
    assert.deepEqual(fn.arkadeScript!.witness,expected.map(name=>name+'Proof'));
    const prefix:Array<string|number>=['PUSHEXPIRY',0,'GREATERTHAN','VERIFY'];
    for(const name of [...expected].reverse())prefix.push(0,'INSPECTINPUTOUTPOINT',0,'EQUALVERIFY','$'+branch+'Authorization','CAT','SHA256','$'+name,'CHECKSIGFROMSTACK','VERIFY');
    assert.deepEqual(fn.arkadeScript!.asm.slice(0,prefix.length),prefix);
    assert.deepEqual(fn.arkadeScript!.asm.slice(prefix.length),old.program.functions[branch].arkadeScript.asm);
    assert.deepEqual(fn.tapscript,staged.program.functions[branch].tapscript);
    const encoded=arkade.ArkadeScript.encode(['PUSHEXPIRY',0,'GREATERTHAN','VERIFY']);
    assert.deepEqual(leaf.arkadeScript!.subarray(0,encoded.length),encoded);
    assert.equal(hex.encode(leaf.signerKeys[0]),terms.operator);
    assert.deepEqual(leaf.signerKeys.slice(2).map(key=>hex.encode(key)),expected.map(name=>terms[name as 'player'|'game']));
  }
});

test('scope independently matches the fixed-field canonical encoding and separates every immutable term and branch',()=>{
  const expected=hash(new TextEncoder().encode(JSON.stringify(['bis:treasure:actor-authorization:v4',4,'claim',terms.network,
    terms.offerSessionId,terms.hostReference,terms.startedAtMs,1_800_000_090,terms.player,terms.game,terms.operator,terms.emulator,
    terms.playerDestination,terms.gameDestination,terms.exitDelay,1000])));
  assert.deepEqual(treasureAuthorizationScope(terms,'claim'),expected);
  for(const change of [{network:'signet' as const},{offerSessionId:'offer-b'},{hostReference:'run-b'},{startedAtMs:terms.startedAtMs+1},
    {player:keys[1],game:keys[0]},{operator:keys[3],emulator:keys[2]},
    {playerDestination:keys[1]},{gameDestination:keys[0]},{exitDelay:4096}]){
    assert.notDeepEqual(treasureAuthorizationScope({...terms,...change},'claim'),expected);
    assert.notDeepEqual(buildAuthorizedTreasureScript({...terms,...change}).script.pkScript,buildAuthorizedTreasureScript(terms).script.pkScript);
  }
  assert.equal(new Set(treasureStagedBranches.map(branch=>hex.encode(treasureAuthorizationScope(terms,branch)))).size,4);
  for(const change of [{startedAtMs:12},{exitDelay:513},{hostReference:' run'},{emulator:'00'}])
    assert.throws(()=>buildAuthorizedTreasureScript({...terms,...change}));
  assert.throws(()=>treasureAuthorizationScope(terms,'unrecognized' as AuthorizedTreasureBranch));
});

test('digest binds canonical actual checkpoint wire-order bytes, all four branches, and original funding linkage',()=>{
  for(const branch of treasureStagedBranches){
    const f=fixture(branch),scope=treasureAuthorizationScope(terms,branch);
    const wireHash=hex.decode(f.context.checkpoint.id).reverse(),message=new Uint8Array(64);
    message.set(wireHash);message.set(scope,32);
    const digest=treasureAuthorizationDigest(terms,branch,f.context);
    assert.deepEqual(digest,hash(message));assert.equal(digest.length,32);
    const wrongEndian=new Uint8Array(64);wrongEndian.set(hex.decode(f.context.checkpoint.id));wrongEndian.set(scope,32);
    assert.notDeepEqual(digest,hash(wrongEndian));
    assert.throws(()=>treasureAuthorizationDigest(terms,branch,{...f.context,funding:{...f.context.funding,txid:'22'.repeat(32)}}));
    assert.throws(()=>treasureAuthorizationDigest(terms,branch,{...f.context,funding:{...f.context.funding,vout:8}}));
    assert.throws(()=>treasureAuthorizationDigest({...terms,hostReference:'other-run'},branch,f.context));
    const other=branch==='claim'?'refund':'claim';assert.throws(()=>treasureAuthorizationDigest(terms,other,f.context));
  }
});

test('digest refuses noncanonical checkpoint, wrong root vout, duplicate input and wrong operator closure',()=>{
  const f=fixture();
  const cp=Transaction.fromPSBT(f.context.checkpoint.toPSBT());cp.updateInput(0,{sequence:123});
  assert.throws(()=>treasureAuthorizationDigest(terms,'claim',{...f.context,checkpoint:cp}));
  const root=Transaction.fromPSBT(f.context.arkTx.toPSBT());root.updateInput(0,{index:1});
  assert.throws(()=>treasureAuthorizationDigest(terms,'claim',{...f.context,arkTx:root}));
  const duplicated=Transaction.fromPSBT(f.context.arkTx.toPSBT());duplicated.addInput(f.context.arkTx.getInput(0));
  assert.throws(()=>treasureAuthorizationDigest(terms,'claim',{...f.context,arkTx:duplicated}));
  const wrong=CSVMultisigTapscript.encode({pubkeys:[hex.decode(terms.game)],timelock:{type:'seconds',value:2048n}});
  assert.throws(()=>treasureAuthorizationDigest(terms,'claim',{...f.context,checkpointTapscript:wrong}));
});
