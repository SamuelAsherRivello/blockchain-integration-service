import test from 'node:test';
import assert from 'node:assert/strict';
import {MnemonicIdentity,DefaultVtxo,CSVMultisigTapscript,Transaction,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField,createAssetPacket,UnknownPacket,type ArkInfo,type VirtualCoin} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {readPaymentContext} from '../src/server/payment-context.ts';
import {parseGameContractIntent,validateGameContractTransaction,type GameContractIntent} from '../src/server/contract-policy.ts';
import {assertTreasureSigningTransaction,assertTreasureRawSigningValue,type TreasureContractIntent,type TreasureSigningPolicy} from '../src/server/treasure-contract-policy.ts';
import {createPaymentAuthorization} from '../src/server/payment-authorization.ts';
import {signingDigest} from '../src/server/signing-authorization.ts';
import {coordinatedSigning,type SigningStore,type SigningClaim} from '../src/server/signing-store.ts';
import {createHostedHandler} from '../src/server/hosted.ts';
import {authenticatePlayerProof} from '../../integration/src/client/wallet-layer-arkade/player-proof-client.ts';
import {encodeSigningValue,decodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {buildStagedTreasureScript} from '../../integration/src/client/wallet-layer-arkade/treasure-staged-script.ts';
import {decodeTreasurePsbtMaps,encodeTreasurePsbtMaps} from '../../integration/src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';
import {stagedFixture,signFixtureEmulator,decode,encode} from '../../integration/tests/client/treasure-staged-fixture.ts';

// Public synthetic keys and injected fresh facts. No provider, wallet storage,
// emulator availability or funded/co-signer qualification is claimed here.
const phrases=['abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about','legal winner thank year wave sausage worth useful legal winner thank yellow','letter advice cage absurd amount doctor acoustic avoid letter advice cage above'];
const [game,player,operator]=phrases.map(phrase=>MnemonicIdentity.fromMnemonic(phrase,{isMainnet:false}));
const gamePublicKey=hex.encode(await game.compressedPublicKey()),playerPublicKey=hex.encode(await player.compressedPublicKey()),operatorPublicKey=hex.encode(await operator.compressedPublicKey());
const gameKey=await game.xOnlyPublicKey(),playerKey=await player.xOnlyPublicKey(),operatorKey=await operator.xOnlyPublicKey();
const own=new DefaultVtxo.Script({pubKey:gameKey,serverPubKey:operatorKey,csvTimelock:{type:'seconds',value:2048n}});
const unroll=CSVMultisigTapscript.encode({pubkeys:[operatorKey],timelock:{type:'seconds',value:86016n}});
const info={network:'mutinynet',signerPubkey:operatorPublicKey,forfeitPubkey:operatorPublicKey,unilateralExitDelay:2048n,checkpointTapscript:hex.encode(unroll.script),dust:330n,vtxoMinAmount:330n,vtxoMaxAmount:-1n,fees:{txFeeRate:'0',intentFee:{offchainInput:'amount*0.001'}}} as unknown as ArkInfo;
type Branch=TreasureContractIntent['branch'];
async function fixture(branch:Branch='fund'){
 const intent=parseGameContractIntent({artifactVersion:3,kind:branch==='fund'?'fund':'refund',branch,offerSessionId:'server-offer',hostReference:'server-run',startedAtMs:Date.now()-(branch==='refund'?91_000:100)}) as TreasureContractIntent;
 const defaults={serverPubKey:operatorKey,csvTimelock:{type:'seconds' as const,value:2048n}},target=new DefaultVtxo.Script({...defaults,pubKey:playerKey});
 const terms={network:'mutinynet' as const,offerSessionId:intent.offerSessionId,hostReference:intent.hostReference,startedAtMs:intent.startedAtMs,player:hex.encode(playerKey),game:hex.encode(gameKey),operator:hex.encode(operatorKey),emulator:'f823b9b2febc81f4af967e77aed2f541cbd3397c6d8f5a72e32eb7b471af889a',playerDestination:hex.encode(target.pkScript.slice(2)),gameDestination:hex.encode(own.pkScript.slice(2)),exitDelay:2048};
 const built=buildStagedTreasureScript(terms),previous=new Transaction({version:3});previous.addInput({txid:'aa'.repeat(32),index:0,witnessUtxo:{script:own.pkScript,amount:1000n}});previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
 const outpoint={txid:branch==='fund'?'11'.repeat(32):previous.id,vout:0};
 const coin={...outpoint,value:branch==='fund'?3000:1000,script:hex.encode(branch==='fund'?own.pkScript:built.script.pkScript),status:{confirmed:true},createdAt:new Date(),isSpent:false,isSwept:false,isPreconfirmed:false,spentBy:'',isUnrolled:false,expiresAt:new Date('2100-01-01'),virtualStatus:{state:'settled'},assets:[]} as unknown as VirtualCoin;
 const options={network:'mutinynet' as const,gamePublicKey,playerPublicKey,outpoints:[outpoint],maximumExposureSats:5000,signal:new AbortController().signal,contract:intent};
 const reader={info:async()=>info,coins:async()=>({vtxos:[coin]}),transactions:async()=>({txs:[hex.encode(previous.toBytes(false,false))]})};
 const context=await readPaymentContext(options,reader);
 const outputs=branch==='fund'?[{script:built.script.pkScript,amount:1000n},{script:own.pkScript,amount:2000n}]:[{script:own.pkScript,amount:1000n},Extension.create([EmulatorPacket.create([{vin:0,script:built.script.functionByName(branch)!.arkadeScript!,witness:new Uint8Array([0])}])]).txOut()];
 const pair=buildOffchainTx([...context.inputs],outputs,context.serverUnrollScript);if(branch!=='fund')setArkPsbtField(pair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));
 return {intent,built,previous,coin,options,reader,context,pair,outputs};
}
const binding={audience:'https://example.test',gameId:'stealth-and-steel',network:'mutinynet' as const,profileId:'aa'.repeat(32),operationId:'treasure-operation',connectionId:crypto.randomUUID()};
const request=(tx:Transaction,id='treasure-root')=>({id,...binding,method:'sign',args:encodeSigningValue([tx,undefined])});

test('V3 parser is strict, versioned and preserves legacy intent behavior',()=>{
 assert.deepEqual(parseGameContractIntent({kind:'fund',secretHash:'ab'.repeat(32)}),{kind:'fund',secretHash:'ab'.repeat(32)});
 const base={artifactVersion:3,kind:'fund',branch:'fund',offerSessionId:'offer',hostReference:'run',startedAtMs:Date.now()};assert.doesNotThrow(()=>parseGameContractIntent(base));
 for(const changed of [{...base,artifactVersion:2},{...base,kind:'claim'},{...base,branch:'claim'},{...base,kind:'refund'},{...base,secretHash:'ff'.repeat(32)},{...base,hostReference:' run'},{...base,startedAtMs:NaN},{...base,player:'untrusted'}])assert.throws(()=>parseGameContractIntent(changed),/policy/);
});
test('all V3 Game paths reconstruct exact SDK source, compiled tree, payout and VM without trusting client artifacts',async()=>{
 for(const branch of ['fund','reject','cancel','refund'] as const){
  const f=await fixture(branch),plan=validateGameContractTransaction(f.pair.arkTx,f.context,f.intent);if(!('treasurePolicy' in plan))throw Error('Expected V3 plan');assert.equal(plan.exposureSats,branch==='fund'?1000:0);assert.equal(plan.recipientSats,1000);assert.equal(plan.treasurePolicy.deadlineMs,(Math.floor(f.intent.startedAtMs/1000)+90)*1000);
  assert.equal(f.context.treasure?.terms.emulator,'f823b9b2febc81f4af967e77aed2f541cbd3397c6d8f5a72e32eb7b471af889a');assert.equal(f.context.treasure?.terms.gameDestination,hex.encode(own.pkScript.slice(2)));
  for(const mutate of [(tx:Transaction)=>tx.updateOutput(0,{amount:999n}),(tx:Transaction)=>tx.updateOutput(0,{script:hex.decode('5120'+hex.encode(playerKey))}),(tx:Transaction)=>tx.updateInput(0,{witnessUtxo:{...tx.getInput(0).witnessUtxo!,amount:999n}})]){const tx=f.pair.arkTx.clone();mutate(tx);assert.throws(()=>validateGameContractTransaction(tx,f.context,f.intent),/policy|metadata/);}
  if(branch!=='fund'){
   const maps=decodeTreasurePsbtMaps(encode(f.pair.arkTx),1,3).map(map=>map.map(entry=>({key:entry.key,value:hex.encode(entry.key)==='de7072657661726b7478'?new Uint8Array([1]):entry.value})));const tx=decode(encodeTreasurePsbtMaps(maps));assert.throws(()=>validateGameContractTransaction(tx,f.context,f.intent));
   const wrongVm=Extension.create([EmulatorPacket.create([{vin:0,script:new Uint8Array([0x51]),witness:new Uint8Array([0])}])]);const bad=buildOffchainTx([...f.context.inputs],[f.outputs[0],wrongVm.txOut()],f.context.serverUnrollScript);setArkPsbtField(bad.arkTx,0,PrevArkTxField,f.previous.toBytes(false,false));assert.throws(()=>validateGameContractTransaction(bad.arkTx,f.context,f.intent));
  }
 }
});
test('fresh context rejects unavailable ancestry, foreign actors, spent funding, assets, fees and wrong timing/network',async()=>{
 const f=await fixture('refund');
 for(const changed of [{...f.reader,transactions:undefined},{...f.reader,transactions:async()=>({txs:[]})},{...f.reader,transactions:async()=>({txs:['00']})},{...f.reader,coins:async()=>({vtxos:[{...f.coin,value:999}]})},{...f.reader,coins:async()=>({vtxos:[{...f.coin,isSpent:true}]})},{...f.reader,coins:async()=>({vtxos:[{...f.coin,assets:[{assetId:'ab'.repeat(34),amount:1n}]}]})},{...f.reader,info:async()=>({...info,fees:{...info.fees,txFeeRate:'1'}})},{...f.reader,info:async()=>({...info,signerPubkey:playerPublicKey})}])await assert.rejects(readPaymentContext(f.options,changed));
 for(const contract of [{...f.intent,branch:'reject'},{...f.intent,branch:'cancel'},{...f.intent,branch:'fund',kind:'fund'},{...f.intent,startedAtMs:Date.now()+1000}])await assert.rejects(readPaymentContext({...f.options,contract:contract as GameContractIntent},f.reader));
 await assert.rejects(readPaymentContext({...f.options,network:'signet'},f.reader));
 await assert.rejects(readPaymentContext({...f.options,playerPublicKey:gamePublicKey},f.reader));
});
test('V3 canonical comparison rejects global proprietary metadata and preserves it across raw RPC decode',async()=>{
 const f=await fixture(),encoded=encode(f.pair.arkTx),maps=decodeTreasurePsbtMaps(encoded,f.pair.arkTx.inputsLength,f.pair.arkTx.outputsLength).map(map=>[...map]);
 maps[0].push({key:new Uint8Array([0xfc,0x01,0x71,0x01]),value:new Uint8Array([1])});const changed=encodeTreasurePsbtMaps(maps),tx=decode(changed);
 assert.throws(()=>validateGameContractTransaction(tx,f.context,f.intent));
 const raw=encodeSigningValue([tx,undefined]);assert.doesNotThrow(()=>assertTreasureRawSigningValue(raw,tx));
 assert.throws(()=>assertTreasureRawSigningValue([{$type:'transaction',value:hex.encode(base64.decode(changed))},null],f.pair.arkTx));
});
test('real SDK tweaked emulator/Player/operator signatures are required at V3 signing, with no Game claim authority',async()=>{
 for(const branch of ['reject','cancel','refund'] as const){
  const f=await stagedFixture(branch),policy:TreasureSigningPolicy={artifactVersion:3,intent:{artifactVersion:3,kind:'refund',branch,offerSessionId:f.binding.terms.offerSessionId,hostReference:f.binding.terms.hostReference,startedAtMs:f.binding.terms.startedAtMs},terms:f.binding.terms,observedAtMs:f.binding.terms.startedAtMs,deadlineMs:f.deadlineMs};
  const emu=signFixtureEmulator(f);let root=emu.signedArkTx;if(branch!=='refund')root=encode(await f.identities[0].sign(decode(root),[0]));
  assert.doesNotThrow(()=>assertTreasureSigningTransaction(decode(root),decode(f.binding.original.arkTx),policy,true));
  assert.throws(()=>assertTreasureSigningTransaction(decode(f.binding.original.arkTx),decode(f.binding.original.arkTx),policy,true));
  let cp=await f.identities[2].sign(decode(emu.signedCheckpointTxs[0]),[0]);if(branch!=='refund')cp=await f.identities[0].sign(cp,[0]);assert.doesNotThrow(()=>assertTreasureSigningTransaction(cp,decode(f.binding.original.checkpoints[0]),policy,false));
  assert.throws(()=>assertTreasureSigningTransaction(decode(emu.signedCheckpointTxs[0]),decode(f.binding.original.checkpoints[0]),policy,false));
  const maps=decodeTreasurePsbtMaps(root,1,3).map(map=>map.map(entry=>({key:entry.key,value:entry.key[0]===0x14?new Uint8Array(64):entry.value}))),wrong=decode(encodeTreasurePsbtMaps(maps));assert.throws(()=>assertTreasureSigningTransaction(wrong,decode(f.binding.original.arkTx),policy,true));
 }
 const claim=await stagedFixture('claim');assert.throws(()=>parseGameContractIntent({artifactVersion:3,kind:'refund',branch:'claim',offerSessionId:'offer',hostReference:'run',startedAtMs:claim.binding.terms.startedAtMs}));
});

test('durable root receipt permits exact checkpoint completion after expiry and exact root replay without another sign',async()=>{
 const f=await fixture(),plan=validateGameContractTransaction(f.pair.arkTx,f.context,f.intent);if(!('treasurePolicy' in plan))throw Error('Expected V3 plan');let clock=Date.now(),calls=0;
 for(const authority of ['player','owner'] as const){
  const auth=createPaymentAuthorization('treasure-root-receipt-test-'.repeat(3),()=>clock,authority),raw=request(f.pair.arkTx),token=auth.plan(binding,authority==='player'?playerPublicKey:undefined,plan,raw),signedRequest={...raw,[authority==='owner'?'ownerPlan':'paymentPlan']:token};
  const grant=auth.authorize(token,signedRequest,binding,authority==='player'?playerPublicKey:undefined);auth.verify(grant,token,signedRequest,binding);
  let durable:any;const store:SigningStore={ping:async()=>{},assetAllowed:async()=>false,consumePublicRequest:async()=>{},session:async()=>null,claim:async()=>durable?{status:'replay',result:durable}:{status:'acquired',owner:'fixture'},complete:async(_claim,_owner,result)=>{durable=structuredClone(result);}};
  const claim:SigningClaim={scope:'stealth-and-steel:mutinynet:fixture',id:raw.id,digest:'aa'.repeat(32),inputs:plan.sourceOutpoints,transactionId:plan.arkTx.id,operationId:binding.operationId,exposureSats:1000,day:'2026-10-26',dailyCapSats:10000,operationCapSats:5000};
  const run=()=>coordinatedSigning(store,claim,()=>auth.sign(token,signedRequest,binding,async()=>{calls++;return encodeSigningValue(await game.sign(f.pair.arkTx));}));
  const envelope:any=await run();assert.equal(typeof envelope.treasureRootReceipt,'string');assert.deepEqual(auth.response(envelope),envelope);
  clock=plan.treasurePolicy!.deadlineMs+1;
  const replayGrant=auth.authorize(token,signedRequest,binding,authority==='player'?playerPublicKey:undefined);auth.verify(replayGrant,token,signedRequest,binding);assert.deepEqual(await run(),envelope);
  const cp={...request(f.pair.checkpoints[0],'treasure-checkpoint'),[authority==='owner'?'ownerPlan':'paymentPlan']:token,treasureRootReceipt:envelope.treasureRootReceipt};
  assert.doesNotThrow(()=>auth.authorize(token,cp,binding,authority==='player'?playerPublicKey:undefined));
  assert.throws(()=>auth.authorize(token,{...cp,treasureRootReceipt:'forged'},binding,authority==='player'?playerPublicKey:undefined));
  await assert.rejects(auth.sign(token,signedRequest,binding,async()=>{throw Error('Must not sign a new late root');}));
  assert.throws(()=>auth.authorize(token,{...signedRequest,id:'new-root'},binding,authority==='player'?playerPublicKey:undefined));
  const changedArgs=encodeSigningValue([await game.sign(f.pair.arkTx),undefined]);assert.throws(()=>auth.authorize(token,{...signedRequest,args:changedArgs},binding,authority==='player'?playerPublicKey:undefined));
  assert.throws(()=>auth.plan(binding,authority==='player'?playerPublicKey:undefined,plan,raw));
  clock=Date.now();
 }
 assert.equal(calls,2);
});
test('a first root signature that finishes after the local deadline retains an unresolved durable claim',async()=>{
 const f=await fixture(),plan=validateGameContractTransaction(f.pair.arkTx,f.context,f.intent);if(!('treasurePolicy' in plan))throw Error('Expected V3 plan');
 let clock=Date.now(),claimed=false,completed=false;const auth=createPaymentAuthorization('treasure-late-root-test-'.repeat(3),()=>clock),raw=request(f.pair.arkTx),token=auth.plan(binding,playerPublicKey,plan,raw),body={...raw,paymentPlan:token};
 const store:SigningStore={ping:async()=>{},assetAllowed:async()=>false,consumePublicRequest:async()=>{},session:async()=>null,claim:async()=>{if(claimed)throw Error('Original claim unresolved');claimed=true;return {status:'acquired',owner:'fixture'};},complete:async()=>{completed=true;}};
 const claim:SigningClaim={scope:'stealth-and-steel:mutinynet:fixture',id:raw.id,digest:'ab'.repeat(32),inputs:plan.sourceOutpoints,transactionId:plan.arkTx.id,operationId:binding.operationId,exposureSats:1000,day:'2026-10-26',dailyCapSats:10000,operationCapSats:5000};
 const run=()=>coordinatedSigning(store,claim,()=>auth.sign(token,body,binding,async()=>{const signed=await game.sign(f.pair.arkTx);clock=plan.treasurePolicy.deadlineMs;return encodeSigningValue(signed);}));
 await assert.rejects(run());assert.equal(claimed,true);assert.equal(completed,false);await assert.rejects(run(),/unresolved/);
});
test('public and owner hosted routes accept only independently reconstructed V3 emulator packets with asset signing disabled',async()=>{
 for(const owner of [false,true])for(const branch of ['fund','reject','cancel','refund'] as const){
  const f=await fixture(branch),ownerToken='v3-hosted-owner-test-'.repeat(3),rows=new Map<string,{digest:string;result?:unknown}>();
  const store:SigningStore={ping:async()=>{},assetAllowed:async()=>false,consumePublicRequest:async()=>{},session:async()=>null,claim:async(claim)=>{const row=rows.get(claim.id);if(row){if(row.digest!==claim.digest||!row.result)throw Error('Changed or unresolved original');return {status:'replay',result:row.result};}rows.set(claim.id,{digest:claim.digest});return {status:'acquired',owner:'fixture'};},complete:async(claim,_owner,result)=>{rows.get(claim.id)!.result=structuredClone(result);}};
  const env={BIS_OWNER_TOKEN:ownerToken,BIS_GAME_WALLET_MUTINYNET_01_MNEMONIC:phrases[0],BIS_PUBLIC_PAYMENT_SIGNING:'true',BIS_PUBLIC_CONTRACT_SIGNING:'true',BIS_PUBLIC_ASSET_SIGNING:'false',BIS_SIGNING_OPERATION_CAP_SATS:'5000',BIS_SIGNING_DAILY_CAP_SATS:'10000'};
  const handler=createHostedHandler({env,store,paymentContext:options=>readPaymentContext(options,f.reader)});
  const send=(path:string,body:unknown,token?:string,grant?:string)=>handler(new Request('https://example.test/api/bis/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(grant?{'X-BIS-Signing-Grant':grant}:{})},body:JSON.stringify(body)}));
  const connected=await (await send('connect',{gameId:'stealth-and-steel',network:'mutinynet'})).json(),scope={gameId:'stealth-and-steel',network:'mutinynet' as const,profileId:connected.profileId,operationId:'v3-'+branch};
  const proof=owner?undefined:await authenticatePlayerProof({endpoint:'https://example.test/api/bis/',binding:scope,identity:player,signal:new AbortController().signal,fetcher:async(url,init)=>handler(new Request(String(url),init))});
  const raw=(tx=f.pair.arkTx)=>({id:'v3-root-'+branch,...scope,method:'sign',args:encodeSigningValue([tx,undefined])});
  const payload=(tx=f.pair.arkTx)=>({request:raw(tx),outpoints:f.options.outpoints,contract:f.intent,...(owner?{connectionToken:connected.token,contractPlayerPublicKey:playerPublicKey}:{playerToken:proof!.token})});
  const prefix=owner?'owner/':'payment/',token=owner?ownerToken:connected.token,response=await send(prefix+'plan',payload(),token);assert.equal(response.status,200,await response.clone().text());
  const planned=await response.json(),plan=planned[owner?'ownerPlan':'paymentPlan'],sign={...raw(),[owner?'ownerPlan':'paymentPlan']:plan,...(owner?{connectionToken:connected.token}:{})};
  const grantResponse=await send(prefix+'authorize',{request:sign,...(owner?{connectionToken:connected.token}:{playerToken:proof!.token})},token);
  if(branch==='fund'){
   assert.equal(grantResponse.status,200,await grantResponse.clone().text());const grant=(await grantResponse.json()).grant;
   const signed=await send('sign',sign,token,grant);assert.equal(signed.status,200,await signed.clone().text());const body=await signed.json();assert.equal(typeof body.treasureRootReceipt,'string');assert.equal(decodeSigningValue(body.result).id,f.pair.arkTx.id);
   assert.deepEqual(await (await send('sign',sign,token,grant)).json(),body);assert.equal(rows.size,1);
   const recovery=await send('treasure/recover',{version:1,requestId:sign.id,requestDigest:signingDigest(sign),requestJson:JSON.stringify(sign),connectionToken:connected.token},token);
   assert.equal(recovery.status,403,'V3 results do not enter the V4 recovery route');
  }else{
   // A structural plan is unsigned authority only. Real pinned emulator/Player
   // signatures remain mandatory before the server will authorize any Game sign.
   assert.equal(grantResponse.status,403);
   const vm=f.built.script.functionByName(branch)!.arkadeScript!,emulator=EmulatorPacket.create([{vin:0,script:vm,witness:new Uint8Array([0])}]);
   const asset=createAssetPacket(new Map([[0,[{assetId:'ab'.repeat(34),amount:1n}]]]),[],{address:'',amount:1000,assets:[{assetId:'ab'.repeat(34),amount:1n}]});
   for(const packet of [Extension.create([emulator,new UnknownPacket(9,new Uint8Array([1]))]),Extension.create([emulator,asset]),Extension.create([EmulatorPacket.create([{vin:0,script:new Uint8Array([0x51]),witness:new Uint8Array([0])}])])]){
    const pair=buildOffchainTx([...f.context.inputs],[f.outputs[0],packet.txOut()],f.context.serverUnrollScript);setArkPsbtField(pair.arkTx,0,PrevArkTxField,f.previous.toBytes(false,false));assert.equal((await send(prefix+'plan',payload(pair.arkTx),token)).status,403);
   }
  }
 }
});
