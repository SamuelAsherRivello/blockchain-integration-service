import test from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey,Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,UnknownPacket,
  PrevArkTxField,setArkPsbtField,type ArkInfo,type VirtualCoin} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {schnorr} from '@noble/curves/secp256k1.js';
import {base64,hex} from '@scure/base';
import {deriveTreasureGameActorAuthorization,type TreasureActorAuthorizationReader,type AuthenticatedTreasureActorScope} from '../src/server/treasure-actor-authorization.ts';
import {buildAuthorizedTreasureScript,treasureAuthorizationDigest} from '../../integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {TREASURE_EMULATOR} from '../../integration/src/client/wallet-layer-arkade/treasure-capability.ts';
import {decodeTreasurePsbtMaps,encodeTreasurePsbtMaps} from '../../integration/src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';

// Public synthetic fixture keys and local SDK message signatures only.
// Reader injection is privileged test infrastructure, never a request context.
// No native VM, real emulator/provider, wallets, funding or hosted route is used.
const [game,player,operator]=[1,2,3].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
const [gamePublicKey,playerPublicKey,operatorPublicKey]=await Promise.all([game,player,operator].map(async key=>hex.encode(await key.compressedPublicKey())));
const [gameKey,playerKey,operatorKey]=[gamePublicKey,playerPublicKey,operatorPublicKey].map(key=>hex.decode(key.slice(2)));
const unroll=CSVMultisigTapscript.encode({pubkeys:[operatorKey],timelock:{type:'seconds',value:86016n}});
const info={network:'mutinynet',signerPubkey:operatorPublicKey,forfeitPubkey:operatorPublicKey,unilateralExitDelay:2048n,
  checkpointTapscript:hex.encode(unroll.script),dust:330n,vtxoMinAmount:330n,vtxoMaxAmount:-1n,fees:{txFeeRate:'0',intentFee:{offchainInput:'amount*0.001'}}} as unknown as ArkInfo;
type Branch='reject'|'cancel'|'refund';
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT());
async function fixture(branch:Branch='reject'){
  const startedAtMs=1_800_000_000_123,baseNow=startedAtMs+(branch==='refund'?91_000:1000);
  const scope:AuthenticatedTreasureActorScope={network:'mutinynet',gamePublicKey,playerPublicKey,operationId:'actor-operation'};
  const wallet=(pubKey:Uint8Array)=>new DefaultVtxo.Script({pubKey,serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:2048n}});
  const gameWallet=wallet(gameKey),playerWallet=wallet(playerKey);
  const originalOffer={offerSessionId:'actor-offer',hostReference:'actor-run',startedAtMs};
  const terms={network:'mutinynet' as const,...originalOffer,player:hex.encode(playerKey),game:hex.encode(gameKey),operator:hex.encode(operatorKey),
    emulator:TREASURE_EMULATOR.key.slice(2),playerDestination:hex.encode(playerWallet.pkScript.slice(2)),gameDestination:hex.encode(gameWallet.pkScript.slice(2)),exitDelay:2048};
  const built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName(branch)!;
  const previous=new Transaction({version:3});previous.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{script:gameWallet.pkScript,amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
  const funding={txid:previous.id,vout:0},coin={...funding,value:1000,script:hex.encode(built.script.pkScript),status:{confirmed:true},
    createdAt:new Date(startedAtMs),isSpent:false,isSwept:false,isPreconfirmed:false,spentBy:'',isUnrolled:false,
    expiresAt:new Date('2100-01-01'),virtualStatus:{state:'settled'},assets:[]} as unknown as VirtualCoin;
  const build=(witness:Uint8Array,extra=false,output=gameWallet.pkScript,amount=1000n,vm=leaf.arkadeScript!)=>{
    const packet=Extension.create([EmulatorPacket.create([{vin:0,script:vm,witness}]),...(extra?[new UnknownPacket(9,new Uint8Array([1]))]:[])]);
    const pair=buildOffchainTx([{...funding,value:1000,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],[{script:output,amount},packet.txOut()],unroll);
    setArkPsbtField(pair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));return pair;
  };
  const initial=build(RawWitness.encode(branch==='refund'?[new Uint8Array(64)]:[new Uint8Array(64),new Uint8Array(64)]));
  const message=treasureAuthorizationDigest(terms,branch,{arkTx:initial.arkTx,checkpoint:initial.checkpoints[0],funding:{...funding,value:1000},checkpointTapscript:unroll});
  const proof=branch==='refund'?undefined:await player.signMessage(message,'schnorr');
  const witness=RawWitness.encode(proof?[proof,new Uint8Array(64)]:[new Uint8Array(64)]),pair=build(witness);
  const request={artifactVersion:4,branch,operationId:scope.operationId,...originalOffer,funding,arkTx:encode(pair.arkTx),checkpoint:encode(pair.checkpoints[0]),...(proof?{playerProof:hex.encode(proof)}:{})};
  const calls:string[]=[];
  const reader:TreasureActorAuthorizationReader={authenticatedScope:async()=>{calls.push('scope');return scope;},info:async()=>{calls.push('info');return info;},
    coins:async outpoints=>{calls.push('coins');assert.deepEqual(outpoints,[funding]);return {vtxos:[coin]};},
    transactions:async ids=>{calls.push('transactions');assert.deepEqual(ids,[funding.txid]);return {txs:[hex.encode(previous.toBytes(false,false))]};},now:()=>baseNow};
  return {scope,reader,request,pair,build,witness,proof,message,terms,coin,previous,baseNow,calls};
}

test('derives only the exact V4 Game message from fresh independent facts for Reject, Cancel and Refund',async()=>{
  for(const branch of ['reject','cancel','refund'] as const){
    const f=await fixture(branch),result=await deriveTreasureGameActorAuthorization(f.request,f.reader);
    assert.deepEqual(result.message,f.message);assert.equal(result.gamePublicKey,gamePublicKey);assert.equal(result.branch,branch);
    assert.equal(result.checkpointId,f.pair.checkpoints[0].id);assert.equal(result.templateRootId,f.pair.arkTx.id);
    assert.equal(result.deadlineMs,1_800_000_090_000);assert.deepEqual(f.calls,['scope','info','coins','transactions']);
    const gameProof=await game.signMessage(result.message,'schnorr');assert.equal(schnorr.verify(gameProof,result.message,gameKey),true);
    if(f.proof)assert.equal(schnorr.verify(f.proof,result.message,playerKey),true);
  }
});

test('request cannot supply authority, keys, arbitrary messages, unknown fields or a Game Claim branch',async()=>{
  const f=await fixture();
  for(const change of [{message:'aa'.repeat(32)},{digest:'aa'.repeat(32)},{scope:f.scope},{terms:f.terms},{playerPublicKey},{emulator:TREASURE_EMULATOR.key},
    {artifactVersion:3},{branch:'claim'},{branch:'fund'},{funding:{...f.request.funding,value:1000}},{funding:{...f.request.funding,vout:-1}},
    {offerSessionId:'actor-other'},{operationId:'other-operation'},{startedAtMs:f.request.startedAtMs+1}])
    await assert.rejects(deriveTreasureGameActorAuthorization({...f.request,...change},f.reader),/policy/);
  const refund=await fixture('refund');await assert.rejects(deriveTreasureGameActorAuthorization({...refund.request,playerProof:'00'.repeat(64)},refund.reader));
  await assert.rejects(deriveTreasureGameActorAuthorization(f.request,{...f.reader,authenticatedScope:async()=>{throw Error('Player unauthenticated');}}));
});

test('Reject and Cancel require authentic exact-branch Player proof before any Game message',async()=>{
  for(const branch of ['reject','cancel'] as const){
    const f=await fixture(branch);
    for(const proof of [undefined,'','00'.repeat(64),hex.encode(await game.signMessage(f.message,'schnorr'))]){
      const changed={...f.request,playerProof:proof};await assert.rejects(deriveTreasureGameActorAuthorization(changed,f.reader));
    }
    const other=await fixture(branch==='reject'?'cancel':'reject');
    const badWitness=RawWitness.encode([other.proof!,new Uint8Array(64)]),bad=f.build(badWitness);
    await assert.rejects(deriveTreasureGameActorAuthorization({...f.request,playerProof:hex.encode(other.proof!),arkTx:encode(bad.arkTx)},f.reader));
  }
});

test('authenticated keys/network and request metadata must match the actual source commitment',async()=>{
  const f=await fixture();
  for(const scope of [{...f.scope,network:'signet'},{...f.scope,gamePublicKey:playerPublicKey},{...f.scope,playerPublicKey:gamePublicKey},
    {...f.scope,operationId:'other-operation'}])
    await assert.rejects(deriveTreasureGameActorAuthorization(f.request,{...f.reader,authenticatedScope:async()=>scope as AuthenticatedTreasureActorScope}));
  for(const changed of [{...f.request,offerSessionId:'other-offer'},{...f.request,hostReference:'other-run'},
    {...f.request,startedAtMs:f.request.startedAtMs+1}])
    await assert.rejects(deriveTreasureGameActorAuthorization(changed,f.reader));
  for(const changed of [{...info,network:'signet'},{...info,fees:{...info.fees,txFeeRate:'1'}},{...info,signerPubkey:playerPublicKey},
    {...info,forfeitPubkey:playerPublicKey},{...info,unilateralExitDelay:4096n},{...info,vtxoMinAmount:1001n}])
    await assert.rejects(deriveTreasureGameActorAuthorization(f.request,{...f.reader,info:async()=>changed as ArkInfo}));
});

test('fresh original funding must be exact, asset-free, unspent, unexpired and independently present',async()=>{
  const f=await fixture();
  for(const changed of [{...f.coin,value:999},{...f.coin,isSpent:true},{...f.coin,isSwept:true},{...f.coin,isUnrolled:true},{...f.coin,spentBy:'11'.repeat(32)},
    {...f.coin,isPreconfirmed:true},{...f.coin,expiresAt:new Date(f.baseNow)},{...f.coin,expiresAt:new Date(NaN)},
    {...f.coin,expiresAtHeight:123},{...f.coin,script:'5120'+hex.encode(gameKey)},{...f.coin,assets:[{assetId:'ab'.repeat(34),amount:1n}]}])
    await assert.rejects(deriveTreasureGameActorAuthorization(f.request,{...f.reader,coins:async()=>({vtxos:[changed] as VirtualCoin[]})}));
  for(const response of [{vtxos:[]},{vtxos:[f.coin,f.coin]},{vtxos:[f.coin],page:{next:true}}])
    await assert.rejects(deriveTreasureGameActorAuthorization(f.request,{...f.reader,coins:async()=>response}));
  for(const response of [{txs:[]},{txs:['00']},{txs:[hex.encode(f.pair.arkTx.toBytes(false,false))]}])
    await assert.rejects(deriveTreasureGameActorAuthorization(f.request,{...f.reader,transactions:async()=>response}));
});

test('strict canonical pair rejects altered value/destination/VM/packet/witness and metadata before digest use',async()=>{
  const f=await fixture();
  for(const pair of [f.build(f.witness,false,hex.decode('5120'+hex.encode(playerKey))),f.build(f.witness,false,undefined,999n),
    f.build(f.witness,true),f.build(f.witness,false,undefined,1000n,new Uint8Array([0x51])),
    f.build(RawWitness.encode([new Uint8Array(64),f.proof!]))])
    await assert.rejects(deriveTreasureGameActorAuthorization({...f.request,arkTx:encode(pair.arkTx)},f.reader));
  const root=f.pair.arkTx.clone();root.updateInput(0,{index:1});await assert.rejects(deriveTreasureGameActorAuthorization({...f.request,arkTx:encode(root)},f.reader));
  const cp=f.pair.checkpoints[0].clone();cp.updateInput(0,{sequence:123});await assert.rejects(deriveTreasureGameActorAuthorization({...f.request,checkpoint:encode(cp)},f.reader));
  for(const field of ['arkTx','checkpoint'] as const){
    const maps=decodeTreasurePsbtMaps(f.request[field],1,field==='arkTx'?3:2).map(map=>[...map]);
    maps[0].push({key:new Uint8Array([0xfc,0x01,0x71,0x01]),value:new Uint8Array([1])});
    await assert.rejects(deriveTreasureGameActorAuthorization({...f.request,[field]:encodeTreasurePsbtMaps(maps)},f.reader));
  }
  const signed=await game.sign(f.pair.arkTx,[0]);await assert.rejects(deriveTreasureGameActorAuthorization({...f.request,arkTx:encode(signed)},f.reader));
});

test('server clock enforces before-deadline Reject/Cancel and at-or-after Refund, including slow-read crossing',async()=>{
  for(const branch of ['reject','cancel','refund'] as const){
    const f=await fixture(branch),deadline=1_800_000_090_000;
    for(const now of [deadline-1,deadline,deadline+1]){
      const run=deriveTreasureGameActorAuthorization(f.request,{...f.reader,now:()=>now});
      if(branch==='refund'?now>=deadline:now<deadline)await assert.doesNotReject(run);else await assert.rejects(run);
    }
    let reads=0;const crossing={...f.reader,now:()=>++reads===3?deadline:f.baseNow};
    if(branch!=='refund')await assert.rejects(deriveTreasureGameActorAuthorization(f.request,crossing));
    let slow=0;await assert.rejects(deriveTreasureGameActorAuthorization(f.request,{...f.reader,now:()=>f.baseNow+(++slow===3?10_001:0)}));
  }
});
