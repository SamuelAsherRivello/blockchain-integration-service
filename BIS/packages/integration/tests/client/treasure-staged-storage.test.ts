import test from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey,DefaultVtxo,Transaction,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {createContractStorage,type ContractDocument,type ContractRecovery} from '../../src/client/state-layer-core/contract-storage.ts';
import {emptyContractLedger,startLto,finishContractOperation,beginContractOperation,markContractSubmission} from '../../src/client/state-layer-core/contracts.ts';
import {exportContractRecovery,decryptContractRecovery,mergeContractRecovery} from '../../src/client/state-layer-core/contract-portable-recovery.ts';
import {buildStagedTreasureScript} from '../../src/client/wallet-layer-arkade/treasure-staged-script.ts';
import {TREASURE_EMULATOR} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';
import {createStagedTreasureState,transitionStagedTreasureState,type StagedTreasureBinding} from '../../src/client/wallet-layer-arkade/treasure-staged-state.ts';
import {inspectLtoRecoveryDescriptor} from '../../src/client/wallet-layer-arkade/lto-recovery-descriptor.ts';

const keys=await Promise.all([1,2,3].map(async n=>hex.encode(await SingleKey.fromHex(n.toString().padStart(64,'0')).xOnlyPublicKey())));
const scope={network:'mutinynet' as const,playerId:'synthetic-player',gameId:'synthetic-game'};
function fixture():ContractDocument {
  const [player,game,operator]=keys,startedAtMs=1_792_980_000_123,defaults={serverPubKey:hex.decode(operator),csvTimelock:{type:'seconds' as const,value:2048n}};
  const playerScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(player)}),gameScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(game)});
  const terms={network:scope.network,offerSessionId:'synthetic-session',hostReference:'synthetic-chest',startedAtMs,
    player,game,operator,emulator:TREASURE_EMULATOR.key.slice(2),playerDestination:hex.encode(playerScript.pkScript.slice(2)),
    gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:2048};
  const built=buildStagedTreasureScript(terms),ledger=startLto(emptyContractLedger(),{id:'synthetic-contract',sessionId:terms.offerSessionId,
    operationId:'synthetic-fund',purpose:'treasureLTO',hostReference:terms.hostReference,amountSats:1000,startedAt:startedAtMs,
    expiresAt:built.deadlineSeconds*1000,scope:{...scope,operator:'https://mutinynet.arkade.sh',exclusivityKey:'synthetic-slot'}},startedAtMs).ledger;
  return {version:1,revision:0,ledger:{...ledger,contracts:ledger.contracts.map(record=>({...record,validationMode:'arkade-covenant-v2'}))},
    recovery:{'synthetic-contract':{treasureArtifactVersion:3,treasure:terms,playerKey:player,gameKey:game,operatorKey:operator,exitDelay:'2048',
      playerScript:hex.encode(playerScript.encode()),gameScript:hex.encode(gameScript.encode()),contractScript:hex.encode(built.script.encode())}}};
}
function storage(){let envelope:unknown;return createContractStorage({read:async()=>structuredClone(envelope) as never,
  write:async(value,revision)=>{if(((envelope as {revision?:number})?.revision??0)!==revision)throw Error('CAS conflict');envelope=structuredClone(value);}},scope.network);}

function pendingFixture():ContractDocument {
  // Synthetic transaction ancestry only. No funded-network claim is made.
  const document=fixture(),r=document.recovery['synthetic-contract'],t=r.treasure!,built=buildStagedTreasureScript(t);
  const leaf=built.script.functionByName('claim')!,unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(t.operator)],timelock:{type:'seconds',value:2048n}});
  const previous=new Transaction({version:3});previous.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{script:hex.decode('5120'+t.game),amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
  const raw=previous.toBytes(false,false),funding={txid:previous.id,vout:0,value:1000 as const};
  const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:new Uint8Array([0])}])]);
  const pair=buildOffchainTx([{...funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:hex.decode('5120'+t.playerDestination),amount:1000n},packet.txOut()],unroll);
  setArkPsbtField(pair.arkTx,0,PrevArkTxField,raw);
  const record=beginContractOperation(finishContractOperation(document.ledger.contracts[0],{operationId:'synthetic-fund',kind:'fund',outcome:'confirmed'}),
    'claim','synthetic-claim',t.startedAtMs+1000);
  const binding:StagedTreasureBinding={artifactVersion:3,contractId:record.id,operationId:record.operation.id,branch:'claim',terms:t,
    funding,previousTransaction:hex.encode(raw),checkpointTapscript:hex.encode(unroll.script),
    original:{arkTx:base64.encode(pair.arkTx.toPSBT()),checkpoints:[base64.encode(pair.checkpoints[0].toPSBT())]}};
  return {...document,ledger:{...document.ledger,contracts:[record]},recovery:{[record.id]:{...r,fundingOutput:funding,
    spend:{operationId:record.operation.id,transactionId:pair.arkTx.id,inputs:[funding],destinationScript:'5120'+t.playerDestination,amountSats:1000},
    treasureStage:{binding,state:createStagedTreasureState(binding,t.startedAtMs+1000)}}}};
}

test('v3 artifact is pinned in encrypted allocation before a funding output or spend-stage exists',async()=>{
  const source=storage(),saved=await source.save(fixture());
  assert.equal(saved.recovery['synthetic-contract'].treasureArtifactVersion,3);
  assert.equal(saved.recovery['synthetic-contract'].treasureStage,undefined);
  assert.deepEqual(await source.load(),saved);
  const descriptor=saved.recovery['synthetic-contract'];
  assert.equal(await inspectLtoRecoveryDescriptor(saved.ledger.contracts[0],descriptor),hex.encode(buildStagedTreasureScript(descriptor.treasure!).script.pkScript));
  await assert.rejects(inspectLtoRecoveryDescriptor(saved.ledger.contracts[0],{...descriptor,treasureArtifactVersion:undefined}),
    /binding could not be verified/,'an unversioned reader must not reinterpret a v3 output as v2');
  for(const patch of [{treasureArtifactVersion:undefined},{treasureArtifactVersion:4},{treasure:undefined},
    {contractScript:'00'},{playerScript:'00'},{emulatorSubmission:{transactionId:'11'.repeat(32),arkTx:'AA==',checkpoints:['AA==']}}]){
    const changed=structuredClone(saved);Object.assign(changed.recovery['synthetic-contract'],patch);
    await assert.rejects(source.save(changed));assert.deepEqual(await source.load(),saved);
  }
});

test('pre-funding v3 recovery exports encrypted and imports without downgrading its artifact or releasing the offer',async()=>{
  const source=storage(),saved=await source.save(fixture()),password='synthetic recovery password only';
  const exported=await exportContractRecovery(saved,scope,password);
  assert.equal(exported.includes(saved.recovery['synthetic-contract'].contractScript),false);
  const incoming=await decryptContractRecovery(exported,scope,password),target=storage();
  const imported=await target.save(mergeContractRecovery(await target.load(),incoming,scope));
  assert.equal(imported.recovery['synthetic-contract'].treasureArtifactVersion,3);
  assert.deepEqual(imported.recovery['synthetic-contract'],saved.recovery['synthetic-contract']);
  assert.equal(imported.ledger.contracts[0].recoveryRequired,true);
  assert.equal(imported.ledger.contracts[0].financial,'funding');
  await assert.rejects(target.reset());assert.deepEqual(await target.load(),imported);
});

test('a stage cannot appear without its artifact, actual funding and exact spend binding',async()=>{
  for(const patch of [{treasureArtifactVersion:undefined,treasureStage:{binding:{},state:{}}},
    {treasureStage:{binding:{},state:{}}},{treasureStage:{binding:{},state:{},phrase:'never-export'}}]){
    const data=fixture();Object.assign(data.recovery['synthetic-contract'],patch as Partial<ContractRecovery>);
    await assert.rejects(storage().save(data));
  }
});

test('encrypted CAS retains exact pending/unknown originals, refuses skipped stages and blocks reset',async()=>{
  const source=storage(),prepared=await source.save(pendingFixture()),r=prepared.recovery['synthetic-contract'],stage=r.treasureStage!,at=r.treasure!.startedAtMs+2000;
  const pending=transitionStagedTreasureState(stage.state,{type:'emulator-request',atMs:at},stage.binding);
  const unknown=transitionStagedTreasureState(pending,{type:'unknown',atMs:at+1},stage.binding);
  const change=(document:ContractDocument,state:typeof pending,isUnknown=false):ContractDocument=>({...document,
    ledger:{...document.ledger,contracts:[markContractSubmission(document.ledger.contracts[0],'synthetic-claim',at,isUnknown)]},
    recovery:{'synthetic-contract':{...document.recovery['synthetic-contract'],treasureStage:{binding:stage.binding,state}}}});
  await assert.rejects(source.save(change(prepared,unknown,true)),'one CAS cannot skip the durable request intent');
  const savedPending=await source.save(change(prepared,pending)),savedUnknown=await source.save(change(savedPending,unknown,true));
  assert.deepEqual((await source.load()).recovery['synthetic-contract'].treasureStage?.binding.original,stage.binding.original);
  await assert.rejects(source.save(change(savedUnknown,pending)));
  const removed=structuredClone(savedUnknown);delete (removed.recovery['synthetic-contract'] as {treasureStage?:unknown}).treasureStage;
  await assert.rejects(source.save(removed));await assert.rejects(source.reset());
  await assert.rejects(source.save(savedPending));assert.deepEqual(await source.load(),savedUnknown);
});

test('portable unknown stages retain original bytes, reservations and monotonic history on another store',async()=>{
  const source=storage(),data=pendingFixture(),r=data.recovery['synthetic-contract'],stage=r.treasureStage!,at=r.treasure!.startedAtMs+2000;
  const pending=transitionStagedTreasureState(stage.state,{type:'emulator-request',atMs:at},stage.binding);
  const unknown=transitionStagedTreasureState(pending,{type:'unknown',atMs:at+1},stage.binding);
  const record=markContractSubmission(data.ledger.contracts[0],'synthetic-claim',at,true);
  const saved=await source.save({...data,ledger:{...data.ledger,contracts:[record]},
    recovery:{[record.id]:{...r,treasureStage:{binding:stage.binding,state:unknown}}}});
  const password='synthetic portable stage password',file=await exportContractRecovery(saved,scope,password);
  const decoded=await decryptContractRecovery(file,scope,password),target=storage(),imported=await target.save(mergeContractRecovery(await target.load(),decoded,scope));
  assert.equal(imported.ledger.contracts[0].financial,'unknown');assert.equal(imported.ledger.contracts[0].recoveryRequired,true);
  assert.deepEqual(imported.recovery[record.id].treasureStage,saved.recovery[record.id].treasureStage);
  await assert.rejects(target.reset());
  const stale={...decoded,recovery:{...decoded.recovery,[record.id]:{...decoded.recovery[record.id],treasureStage:stage}}};
  assert.throws(()=>mergeContractRecovery(imported,stale,scope));assert.deepEqual(await target.load(),imported);
});
