import test from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey,DefaultVtxo,Transaction,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {tapLeafHash} from '@scure/btc-signer/payment.js';
import {schnorr,secp256k1} from '@noble/curves/secp256k1.js';
import {base64,hex} from '@scure/base';
import {buildAuthorizedTreasureScript,treasureAuthorizationActors,treasureAuthorizationDigest} from '../../src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {treasureStagedBranches,type TreasureStagedBranch} from '../../src/client/wallet-layer-arkade/treasure-staged-script.ts';
import {createStagedTreasureState,validateStagedTreasureBinding,validateStagedTreasureState,transitionStagedTreasureState,type StagedTreasureBinding} from '../../src/client/wallet-layer-arkade/treasure-staged-state.ts';
import {TREASURE_EMULATOR} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';
import {createContractStorage,type ContractBackend,type ContractDocument} from '../../src/client/state-layer-core/contract-storage.ts';
import {startLto,emptyContractLedger,finishContractOperation,beginContractOperation,markContractSubmission} from '../../src/client/state-layer-core/contracts.ts';
import {exportContractRecovery,decryptContractRecovery,mergeContractRecovery} from '../../src/client/state-layer-core/contract-portable-recovery.ts';
import {inspectLtoRecoveryDescriptor} from '../../src/client/wallet-layer-arkade/lto-recovery-descriptor.ts';

// Local public test identities and synthetic unsigned funding only. The pinned
// emulator public key is compiled, but no emulator signature/provider is used.
const identities=[1,2,3].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
const [player,game,operator]=await Promise.all(identities.map(async key=>hex.encode(await key.xOnlyPublicKey())));
const defaults={serverPubKey:hex.decode(operator),csvTimelock:{type:'seconds' as const,value:2048n}};
const playerScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(player)}),gameScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(game)});
const terms={network:'mutinynet' as const,offerSessionId:'authorized-offer',hostReference:'authorized-run',startedAtMs:1_800_000_000_123,
  player,game,operator,emulator:TREASURE_EMULATOR.key.slice(2),playerDestination:hex.encode(playerScript.pkScript.slice(2)),
  gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:2048};
const scope={network:'mutinynet' as const,playerId:'public-synthetic-player',gameId:'public-synthetic-game'};
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT());

async function fixture(branch:TreasureStagedBranch='claim',emulator=terms.emulator){
  const boundTerms={...terms,emulator},built=buildAuthorizedTreasureScript(boundTerms),leaf=built.script.functionByName(branch)!;
  const unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operator)],timelock:{type:'seconds',value:2048n}});
  const previous=new Transaction({version:3});previous.addInput({txid:'a4'.repeat(32),index:0,witnessUtxo:{script:gameScript.pkScript,amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
  const funding={txid:previous.id,vout:0,value:1000 as const};
  const pairFor=(proofs:readonly Uint8Array[])=>buildOffchainTx([{...funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:branch==='claim'?playerScript.pkScript:gameScript.pkScript,amount:1000n},
      Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:RawWitness.encode([...proofs])}])]).txOut()],unroll);
  const actors=treasureAuthorizationActors(branch),placeholder=pairFor(actors.map(()=>new Uint8Array(64)));
  const digest=treasureAuthorizationDigest(boundTerms,branch,{arkTx:placeholder.arkTx,checkpoint:placeholder.checkpoints[0],funding,checkpointTapscript:unroll});
  const proofs=await Promise.all(actors.map(actor=>identities[actor==='player'?0:1].signMessage(digest,'schnorr')));
  const pair=pairFor(proofs);setArkPsbtField(pair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));
  const binding:StagedTreasureBinding={artifactVersion:4,contractId:'authorized-contract',operationId:'authorized-claim',branch,terms:boundTerms,
    funding,previousTransaction:hex.encode(previous.toBytes(false,false)),checkpointTapscript:hex.encode(unroll.script),
    original:{arkTx:encode(pair.arkTx),checkpoints:[encode(pair.checkpoints[0])]}};
  const at=branch==='refund'?built.deadlineSeconds*1000:terms.startedAtMs+1000;
  return {binding,built,pair,proofs,at,leaf};
}

// An additional public test scalar is used only to exercise signed state
// transitions. It is not the configured service key or remote admission proof.
async function emulatorFixture(branch:TreasureStagedBranch){
  const emulator=hex.encode(await SingleKey.fromHex('4'.padStart(64,'0')).xOnlyPublicKey()),f=await fixture(branch,emulator);
  const n=secp256k1.Point.CURVE().n,point=secp256k1.Point.BASE.multiply(4n),base=point.toBytes(true)[0]===3?n-4n:4n;
  const tweak=BigInt('0x'+hex.encode(schnorr.utils.taggedHash('ArkScriptHash',f.leaf.arkadeScript!)))%n;
  const secret=hex.decode(((base+tweak)%n).toString(16).padStart(64,'0')),key=f.leaf.signerKeys[1];
  assert.equal(hex.encode(schnorr.getPublicKey(secret)),hex.encode(key));
  const signed=[f.pair.arkTx,f.pair.checkpoints[0]].map(original=>{
    const tx=Transaction.fromPSBT(original.toPSBT()),input=tx.getInput(0),script=input.tapLeafScript![0][1];
    const message=tx.preimageWitnessV1(0,[input.witnessUtxo!.script],0,[input.witnessUtxo!.amount],undefined,script.subarray(0,-1),script.at(-1));
    tx.updateInput(0,{tapScriptSig:[[{pubKey:key,leafHash:tapLeafHash(script.subarray(0,-1),script.at(-1))},schnorr.sign(message,secret,new Uint8Array(32))]]});
    return tx;
  });
  return {...f,response:{signedArkTx:encode(signed[0]),signedCheckpointTxs:[encode(signed[1])]}};
}
function storage(){let envelope:Awaited<ReturnType<ContractBackend['read']>>;
  return createContractStorage({read:async()=>envelope&&structuredClone(envelope),write:async(next,revision)=>{
    assert.equal(envelope?.revision??0,revision);envelope=structuredClone(next);
  }},'mutinynet');}
function allocation():ContractDocument{
  const built=buildAuthorizedTreasureScript(terms),ledger=startLto(emptyContractLedger(),{id:'authorized-contract',sessionId:terms.offerSessionId,
    operationId:'authorized-fund',purpose:'treasureLTO',hostReference:terms.hostReference,amountSats:1000,startedAt:terms.startedAtMs,
    expiresAt:built.deadlineSeconds*1000,scope:{...scope,operator:'https://mutinynet.arkade.sh',exclusivityKey:'authorized-slot'}},terms.startedAtMs).ledger;
  return {version:1,revision:0,ledger:{...ledger,contracts:ledger.contracts.map(record=>({...record,validationMode:'arkade-covenant-v2'}))},
    recovery:{'authorized-contract':{treasureArtifactVersion:4,treasure:terms,playerKey:player,gameKey:game,operatorKey:operator,exitDelay:'2048',
      contractScript:hex.encode(built.script.encode()),playerScript:hex.encode(playerScript.encode()),gameScript:hex.encode(gameScript.encode())}}};
}

test('v4 stage validates actual SDK actor proofs for each branch and retains its explicit artifact across unknown state',async()=>{
  for(const branch of treasureStagedBranches){
    const f=await fixture(branch);validateStagedTreasureBinding(f.binding);
    const prepared=createStagedTreasureState(f.binding,f.at),pending=transitionStagedTreasureState(prepared,{type:'emulator-request',atMs:f.at},f.binding);
    const unknown=transitionStagedTreasureState(pending,{type:'unknown',atMs:f.at+1},f.binding);
    validateStagedTreasureState(JSON.parse(JSON.stringify(unknown)),f.binding);
    assert.equal(unknown.artifactVersion,4);assert.equal(unknown.phase,'emulator-unknown');assert.deepEqual(unknown.original,f.binding.original);
    assert.throws(()=>transitionStagedTreasureState(unknown,{type:'emulator-request',atMs:f.at+2},f.binding));
  }
});

test('v4 preparation refuses changed, missing and reordered actor authorization proofs',async()=>{
  const f=await fixture('reject');
  for(const proofs of [[],[f.proofs[0]], [...f.proofs].reverse(),f.proofs.map(proof=>{const copy=proof.slice();copy[0]^=1;return copy;})]){
    const root=Transaction.fromPSBT(f.pair.arkTx.toPSBT());root.updateOutput(1,{script:Extension.create([EmulatorPacket.create([
      {vin:0,script:f.leaf.arkadeScript!,witness:RawWitness.encode(proofs)},
    ])]).txOut().script});
    assert.throws(()=>validateStagedTreasureBinding({...f.binding,original:{...f.binding.original,arkTx:encode(root)}}));
  }
});

test('v4 bytes and states cannot be relabelled as v3 or rebound to another offer',async()=>{
  const f=await fixture(),prepared=createStagedTreasureState(f.binding,f.at);
  assert.throws(()=>validateStagedTreasureBinding({...f.binding,artifactVersion:3}));
  assert.throws(()=>validateStagedTreasureState({...prepared,artifactVersion:3},f.binding));
  assert.throws(()=>validateStagedTreasureBinding({...f.binding,terms:{...terms,offerSessionId:'another-offer'}}));
  assert.throws(()=>validateStagedTreasureBinding({...f.binding,funding:{...f.binding.funding,vout:1}}));
});

test('verified v4 emulator authorization permits delayed response, ROOT and operator completion without a new late admission',async()=>{
  for(const branch of treasureStagedBranches){
    const f=await emulatorFixture(branch),b=f.binding,deadline=f.built.deadlineSeconds*1000,at=branch==='refund'?deadline:deadline-1;
    const prepared=createStagedTreasureState(b,at),pending=transitionStagedTreasureState(prepared,{type:'emulator-request',atMs:at},b);
    if(branch!=='refund')assert.throws(()=>transitionStagedTreasureState(prepared,{type:'emulator-request',atMs:deadline},b));
    const unknown=transitionStagedTreasureState(pending,{type:'unknown',atMs:deadline+1},b);
    const admitted=transitionStagedTreasureState(unknown,{type:'emulator-response',atMs:deadline+2,response:f.response},b);
    let root=Transaction.fromPSBT(base64.decode(admitted.emulator!.signedArkTx));
    for(const actor of treasureAuthorizationActors(branch))root=await identities[actor==='player'?0:1].sign(root,[0]);
    const actorRoot=transitionStagedTreasureState(admitted,{type:'actor-root',atMs:deadline+3,arkTx:encode(root)},b);
    const submitted=transitionStagedTreasureState(actorRoot,{type:'submit',atMs:deadline+4},b);
    const operatorRoot=await identities[2].sign(root,[0]),operatorCp=await identities[2].sign(Transaction.fromPSBT(base64.decode(admitted.emulator!.signedCheckpointTxs[0])),[0]);
    const received=transitionStagedTreasureState(submitted,{type:'operator-response',atMs:deadline+5,
      response:{arkTxid:root.id,finalArkTx:encode(operatorRoot),signedCheckpointTxs:[encode(operatorCp)]}},b);
    let cp=Transaction.fromPSBT(base64.decode(received.operator!.signedCheckpointTxs[0]));
    for(const actor of treasureAuthorizationActors(branch))cp=await identities[actor==='player'?0:1].sign(cp,[0]);
    const completed=transitionStagedTreasureState(received,{type:'actor-checkpoints',atMs:deadline+6,checkpoints:[encode(cp)]},b);
    const final=transitionStagedTreasureState(completed,{type:'finalize',atMs:deadline+7},b);
    validateStagedTreasureState(JSON.parse(JSON.stringify(final)),b);
    assert.equal(final.finalizeRequest?.arkTxid,root.id);assert.equal(final.observationClock,'local-observation-not-signed-server-time');
  }
});

test('a different valid actor proof cannot replace the packet already committed by an emulator ROOT signature',async()=>{
  const f=await emulatorFixture('claim'),b=f.binding,signedRoot=Transaction.fromPSBT(base64.decode(f.response.signedArkTx));
  const packet=Extension.fromTx(signedRoot).getEmulatorPacket()!.entries[0],unroll=CSVMultisigTapscript.decode(hex.decode(b.checkpointTapscript));
  const message=treasureAuthorizationDigest(b.terms,'claim',{arkTx:signedRoot,checkpoint:f.pair.checkpoints[0],funding:b.funding,checkpointTapscript:unroll});
  const replacement=await identities[0].signMessage(message,'schnorr');assert.notDeepEqual(replacement,f.proofs[0]);
  const root=Transaction.fromPSBT(f.pair.arkTx.toPSBT());
  root.updateOutput(1,{script:Extension.create([EmulatorPacket.create([{vin:0,script:packet.script,witness:RawWitness.encode([replacement])}])]).txOut().script});
  root.updateInput(0,{tapScriptSig:signedRoot.getInput(0).tapScriptSig});
  assert.throws(()=>verifyTapscriptSignatures(root,0,[hex.encode(f.leaf.signerKeys[1])],[],[0,1]));
  const prepared=createStagedTreasureState(b,f.at),pending=transitionStagedTreasureState(prepared,{type:'emulator-request',atMs:f.at},b);
  assert.throws(()=>transitionStagedTreasureState(pending,{type:'emulator-response',atMs:f.built.deadlineSeconds*1000+1,
    response:{...f.response,signedArkTx:encode(root)}},b));
});

test('v4 allocation uses its exact descriptor and survives explicit encrypted export/import without downgrade',async()=>{
  const source=storage(),saved=await source.save(allocation()),record=saved.ledger.contracts[0],r=saved.recovery[record.id];
  assert.equal(await inspectLtoRecoveryDescriptor(record,r),hex.encode(buildAuthorizedTreasureScript(terms).script.pkScript));
  await assert.rejects(inspectLtoRecoveryDescriptor(record,{...r,treasureArtifactVersion:3}));
  const password='public synthetic recovery password',exported=await exportContractRecovery(saved,scope,password);
  assert.equal(exported.includes(r.contractScript),false);
  const incoming=await decryptContractRecovery(exported,scope,password),target=storage();
  const imported=await target.save(mergeContractRecovery(await target.load(),incoming,scope));
  assert.equal(imported.recovery[record.id].treasureArtifactVersion,4);assert.deepEqual(imported.recovery[record.id],r);
  await assert.rejects(target.reset());
});

test('encrypted v4 pending/unknown stages retain signed actor intent and original reservations across portable recovery',async()=>{
  const f=await fixture(),document=allocation(),record=beginContractOperation(finishContractOperation(document.ledger.contracts[0],
    {operationId:'authorized-fund',kind:'fund',outcome:'confirmed'}),'claim','authorized-claim',f.at);
  const prepared=createStagedTreasureState(f.binding,f.at);
  const source=storage(),initial=await source.save({...document,ledger:{...document.ledger,contracts:[record]},recovery:{[record.id]:{
    ...document.recovery[record.id],fundingOutput:f.binding.funding,
    spend:{operationId:record.operation.id,transactionId:f.pair.arkTx.id,inputs:[f.binding.funding],destinationScript:hex.encode(playerScript.pkScript),amountSats:1000},
    treasureStage:{binding:f.binding,state:prepared},
  }}});
  const pending=transitionStagedTreasureState(prepared,{type:'emulator-request',atMs:f.at+1},f.binding);
  const saved=await source.save({...initial,ledger:{...initial.ledger,contracts:[markContractSubmission(record,record.operation.id,f.at+1)]},
    recovery:{[record.id]:{...initial.recovery[record.id],treasureStage:{binding:f.binding,state:pending}}}});
  const unknown=transitionStagedTreasureState(pending,{type:'unknown',atMs:f.at+2},f.binding);
  const held=await source.save({...saved,ledger:{...saved.ledger,contracts:[markContractSubmission(saved.ledger.contracts[0],record.operation.id,f.at+2,true)]},
    recovery:{[record.id]:{...saved.recovery[record.id],treasureStage:{binding:f.binding,state:unknown}}}});
  const password='public synthetic stage password',portable=await exportContractRecovery(held,scope,password),target=storage();
  const imported=await target.save(mergeContractRecovery(await target.load(),await decryptContractRecovery(portable,scope,password),scope));
  assert.deepEqual(imported.recovery[record.id],held.recovery[record.id]);assert.equal(imported.ledger.contracts[0].recoveryRequired,true);
  assert.equal(imported.recovery[record.id].treasureStage?.state.phase,'emulator-unknown');await assert.rejects(target.reset());
});
