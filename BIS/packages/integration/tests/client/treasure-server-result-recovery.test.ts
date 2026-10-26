import test from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey,Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {sha256} from '@noble/hashes/sha2.js';
import {recoverOriginalTreasureSigning} from '../../src/client/wallet-layer-arkade/treasure-server-result-recovery.ts';
import {allocateAuthorizedTreasureRecovery} from '../../src/client/wallet-layer-arkade/treasure-authorized-recovery.ts';
import {createTreasureServerJournal,prepareTreasureServerRequest,transitionTreasureServerRequest} from '../../src/client/wallet-layer-arkade/treasure-server-journal.ts';
import {encodeSigningValue} from '../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {TREASURE_EMULATOR} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';
import {emptyContractLedger,startLto} from '../../src/client/state-layer-core/contracts.ts';
import {createContractStorage,type ContractBackend,type ContractRecovery} from '../../src/client/state-layer-core/contract-storage.ts';

// Public scalar identities, closed storage and a read-result callback. This
// tests controller persistence, not remote admission or a financial receipt.
async function fixture(){
  const [player,game,operator,forfeit]=[1,2,3,5].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
  const [playerKey,gameKey,operatorKey,forfeitKey]=await Promise.all([player,game,operator,forfeit].map(async identity=>hex.encode(await identity.xOnlyPublicKey())));
  const profile=async(identity:typeof game)=>hex.encode(sha256(await identity.compressedPublicKey()));
  const startedAt=1_800_000_000_123,scope={network:'mutinynet' as const,operator:'https://mutinynet.arkade.sh',
    playerId:await profile(player),gameId:await profile(game),exclusivityKey:'original-slot'};
  const allocated=startLto(emptyContractLedger(),{id:'original-contract',operationId:'original-fund',sessionId:'original-offer',purpose:'treasureLTO',
    hostReference:'original-host',amountSats:1000,startedAt,expiresAt:1_800_000_090_000,scope},startedAt);
  const record={...allocated.contract!,validationMode:'arkade-covenant-v2' as const,recoveryRequired:true};
  const defaults={serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds' as const,value:2048n}};
  const gameScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(gameKey)}),playerScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(playerKey)});
  const terms={network:'mutinynet' as const,offerSessionId:record.sessionId,hostReference:record.hostReference,startedAtMs:startedAt,
    player:playerKey,game:gameKey,operator:operatorKey,emulator:TREASURE_EMULATOR.key.slice(2),
    playerDestination:hex.encode(playerScript.pkScript.slice(2)),gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:2048};
  const descriptor=allocateAuthorizedTreasureRecovery({...record,recoveryRequired:undefined},terms);
  const source=new Transaction({version:3});source.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{amount:1500n,script:gameScript.pkScript}});
  source.addOutput({amount:1500n,script:gameScript.pkScript});source.addOutput({amount:0n,script:hex.decode('51024e73')});
  const unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(forfeitKey)],timelock:{type:'seconds',value:4096n}});
  const contractScript=(await import('../../src/client/wallet-layer-arkade/treasure-authorized-script.ts')).buildAuthorizedTreasureScript(terms).script;
  const pair=buildOffchainTx([{txid:source.id,vout:0,value:1500,tapLeafScript:gameScript.forfeit(),tapTree:gameScript.encode()}],
    [{amount:1000n,script:contractScript.pkScript},{amount:500n,script:gameScript.pkScript}],unroll);
  const encode=(tx:Transaction)=>base64.encode(tx.toPSBT()),sealed=(name:string)=>name+'.'+'a'.repeat(43);
  let journal=createTreasureServerJournal({artifactVersion:4,kind:'fund',contractId:record.id,operationId:record.operation.id,
    endpoint:'https://original.invalid/api/bis/',gameId:'stealth-and-steel',network:'mutinynet',profileId:scope.gameId,
    publicKey:hex.encode(await game.compressedPublicKey()),authority:'player-proof',terms,checkpointTapscript:hex.encode(unroll.script),
    original:{arkTx:encode(pair.arkTx),checkpoints:pair.checkpoints.map(encode)},sourceTransactions:[hex.encode(source.toBytes(false,false))]});
  const args=encodeSigningValue([pair.arkTx,[0]]),id='original-root';
  journal=prepareTreasureServerRequest(journal,{purpose:'root',id,argsJson:JSON.stringify(args)},startedAt+1);
  journal=transitionTreasureServerRequest(journal,id,{type:'planned',atMs:startedAt+2,connectionToken:sealed('connection'),
    bodyJson:JSON.stringify({id,operationId:record.operation.id,network:'mutinynet',profileId:scope.gameId,method:'sign',args,paymentPlan:sealed('plan')})});
  journal=transitionTreasureServerRequest(journal,id,{type:'sign-pending',atMs:startedAt+3});
  journal=transitionTreasureServerRequest(journal,id,{type:'sign-unknown',atMs:startedAt+4});
  const recovery={...descriptor,treasureServerJournals:{[record.operation.id]:journal}};
  let envelope:Awaited<ReturnType<ContractBackend['read']>>;
  const storage=createContractStorage({read:async()=>structuredClone(envelope),write:async(value,revision)=>{
    assert.equal(envelope?.revision??0,revision);envelope=structuredClone(value);
  }},'mutinynet');
  let document=await storage.save({version:1,revision:0,ledger:{...allocated.ledger,contracts:[record]},recovery:{[record.id]:recovery}}),commits=0;
  return {record,recovery,journal,id,pair,game,sealed,startedAt,storage,document:()=>document,commits:()=>commits,
    commit:async(next:ContractRecovery)=>{document=await storage.save({...document,recovery:{...document.recovery,[record.id]:next}});commits++;}};
}

test('original-result recovery commits one authenticated result and retains the original financial operation and import flag',async()=>{
  const f=await fixture();let lookups=0;
  await recoverOriginalTreasureSigning(f.record,f.recovery,async persistence=>({recover:async id=>{
    lookups++;assert.equal(id,f.id);const before=await persistence.read();
    const response={result:encodeSigningValue(await f.game.sign(f.pair.arkTx,[0])),treasureRootReceipt:f.sealed('receipt')};
    const after=transitionTreasureServerRequest(before,id,{type:'completed',atMs:f.startedAt+5,responseJson:JSON.stringify(response)});
    await persistence.commit(before,after);
  }}),f.commit,()=>true);
  assert.equal(lookups,1);assert.equal(f.commits(),1);
  assert.deepEqual(f.document().ledger.contracts,[f.record]);
  assert.equal(f.document().recovery[f.record.id].treasureServerJournals![f.record.operation.id].requests[0].phase,'completed');
});

test('missing original results, a retired scope and attempted non-observation changes preserve the encrypted document',async()=>{
  const f=await fixture(),before=await f.storage.load();let lookups=0;
  await assert.rejects(recoverOriginalTreasureSigning(f.record,f.recovery,async()=>({recover:async()=>{lookups++;throw Error('unavailable');}}),f.commit,()=>true));
  await assert.rejects(recoverOriginalTreasureSigning(f.record,f.recovery,async()=>{throw Error('must not create transport');},f.commit,()=>false));
  await assert.rejects(recoverOriginalTreasureSigning(f.record,f.recovery,async persistence=>({recover:async()=>{
    const journal=await persistence.read();await persistence.commit(journal,{...journal,requests:[]});
  }}),f.commit,()=>true));
  assert.equal(lookups,1);assert.equal(f.commits(),0);assert.deepEqual(await f.storage.load(),before);
});
