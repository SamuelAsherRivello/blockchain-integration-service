import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey,Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {tapLeafHash} from '@scure/btc-signer/payment.js';
import {base64,hex} from '@scure/base';
import {schnorr,secp256k1} from '@noble/curves/secp256k1.js';
import {buildAuthorizedTreasureScript,treasureAuthorizationDigest} from '../../src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import type {TreasureActorSigningBody} from '../../src/client/wallet-layer-arkade/treasure-authorization-protocol.ts';
import {encodeSigningValue} from '../../src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {createTreasureServerJournal,validateTreasureServerJournal,prepareTreasureServerRequest,transitionTreasureServerRequest,
  advanceTreasureServerJournal,treasureServerResultLookup,type TreasureServerJournalBinding,type TreasureServerJournal,
  type TreasureServerRequestPurpose} from '../../src/client/wallet-layer-arkade/treasure-server-journal.ts';

// Public synthetic keys and genuine local SDK signatures. No VM, wallet,
// provider, encryption/persistence wiring, remote service or financial action.
const [player,game,operator,emulator]=[1,2,3,4].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
const [playerKey,gameKey,operatorKey,emulatorKey]=await Promise.all([player,game,operator,emulator].map(async k=>hex.encode(await k.xOnlyPublicKey())));
const publicKey=hex.encode(await game.compressedPublicKey()),profileId=createHash('sha256').update(hex.decode(publicKey)).digest('hex');
const start=1_800_000_000_123,clock=start+91_000;
const wallet=(pubKey:string)=>new DefaultVtxo.Script({pubKey:hex.decode(pubKey),serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds' as const,value:2048n}});
const gameWallet=wallet(gameKey),playerWallet=wallet(playerKey),unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operatorKey)],timelock:{type:'seconds' as const,value:2048n}});
const terms={network:'mutinynet' as const,offerSessionId:'journal-offer',hostReference:'journal-run',startedAtMs:start,
  player:playerKey,game:gameKey,operator:operatorKey,emulator:emulatorKey,
  playerDestination:hex.encode(playerWallet.pkScript.slice(2)),gameDestination:hex.encode(gameWallet.pkScript.slice(2)),exitDelay:2048};
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT()),wireArgs=(tx:Transaction)=>JSON.stringify(encodeSigningValue([tx,[...Array(tx.inputsLength).keys()]]));
const token=(name:string)=>name+'.'+'a'.repeat(43),connection=token('original-connection'),plan=token('original-plan'),receipt=token('original-root-receipt');
const common={artifactVersion:4 as const,contractId:'journal-contract',operationId:'journal-operation',endpoint:'https://journal.invalid/api/bis/',
  gameId:'stealth-and-steel',network:'mutinynet' as const,profileId,publicKey,authority:'player-proof' as 'owner'|'player-proof',terms,
  checkpointTapscript:hex.encode(unroll.script)};
async function spendFixture(branch:'refund'|'reject'='refund'){
  const built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName(branch)!;
  const previous=new Transaction({version:3});previous.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{script:gameWallet.pkScript,amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
  const funding={txid:previous.id,vout:0,value:1000 as const};
  const build=(proofs:readonly Uint8Array[])=>{
    const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:RawWitness.encode([...proofs])}])]);
    const pair=buildOffchainTx([{...funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
      [{script:gameWallet.pkScript,amount:1000n},packet.txOut()],unroll);setArkPsbtField(pair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));return pair;
  };
  const empty=build(branch==='reject'?[new Uint8Array(64),new Uint8Array(64)]:[new Uint8Array(64)]);
  const message=treasureAuthorizationDigest(terms,branch,{arkTx:empty.arkTx,checkpoint:empty.checkpoints[0],funding,checkpointTapscript:unroll});
  const playerProof=branch==='reject'?await player.signMessage(message,'schnorr'):undefined;
  const template=build(playerProof?[playerProof,new Uint8Array(64)]:[new Uint8Array(64)]);
  const binding:TreasureServerJournalBinding={...common,kind:'spend',branch,funding,previousTransaction:hex.encode(previous.toBytes(false,false)),
    actorTemplate:{arkTx:encode(template.arkTx),checkpoint:encode(template.checkpoints[0]),...(playerProof?{playerProof:hex.encode(playerProof)}:{})}};
  const actorRequest={artifactVersion:4 as const,branch,operationId:binding.operationId,offerSessionId:terms.offerSessionId,hostReference:terms.hostReference,
    startedAtMs:terms.startedAtMs,funding:{txid:funding.txid,vout:0},arkTx:binding.actorTemplate.arkTx,checkpoint:binding.actorTemplate.checkpoint,
    ...(playerProof?{playerProof:hex.encode(playerProof)}:{})};
  return {binding,message,actorRequest,template,build,playerProof,leaf};
}
function signSyntheticEmulator(original:Transaction,leaf:ReturnType<ReturnType<typeof buildAuthorizedTreasureScript>['script']['functionByName']>){
  if(!leaf?.arkadeScript)throw Error('Missing synthetic VM leaf');
  const tx=Transaction.fromPSBT(original.toPSBT()),n=secp256k1.Point.CURVE().n,point=secp256k1.Point.BASE.multiply(4n);
  const base=point.toBytes(true)[0]===3?n-4n:4n,tweak=BigInt('0x'+hex.encode(schnorr.utils.taggedHash('ArkScriptHash',leaf.arkadeScript)))%n;
  const secret=hex.decode(((base+tweak)%n).toString(16).padStart(64,'0')),key=leaf.signerKeys[1];
  assert.deepEqual(schnorr.getPublicKey(secret),key);
  const input=tx.getInput(0),script=input.tapLeafScript![0][1];
  const digest=tx.preimageWitnessV1(0,[input.witnessUtxo!.script],0,[input.witnessUtxo!.amount],undefined,script.subarray(0,-1),script.at(-1));
  tx.updateInput(0,{tapScriptSig:[...(input.tapScriptSig??[]),[{pubKey:key,leafHash:tapLeafHash(script.subarray(0,-1),script.at(-1))},schnorr.sign(digest,secret,new Uint8Array(32))]]});
  return tx;
}
function fundFixture(authority:'owner'|'player-proof'='player-proof'){
  const built=buildAuthorizedTreasureScript(terms),sources=[1500n,700n].map((amount,i)=>{
    const tx=new Transaction({version:3});tx.addInput({txid:(i?'bc':'cd').repeat(32),index:0,witnessUtxo:{script:gameWallet.pkScript,amount}});
    tx.addOutput({script:gameWallet.pkScript,amount});tx.addOutput({script:hex.decode('51024e73'),amount:0n});return tx;
  });
  const pair=buildOffchainTx(sources.map(tx=>({txid:tx.id,vout:0,value:Number(tx.getOutput(0).amount),tapLeafScript:gameWallet.forfeit(),tapTree:gameWallet.encode()})),
    [{script:built.script.pkScript,amount:1000n},{script:gameWallet.pkScript,amount:1200n}],unroll);
  const binding:TreasureServerJournalBinding={...common,authority,kind:'fund',original:{arkTx:encode(pair.arkTx),checkpoints:pair.checkpoints.map(encode)},sourceTransactions:sources.map(tx=>hex.encode(tx.toBytes(false,false)))};
  return {binding,pair,sources};
}
function prepare(journal:TreasureServerJournal,purpose:TreasureServerRequestPurpose,id:string,argsJson:string,atMs=clock,checkpointIndex?:number){
  return prepareTreasureServerRequest(journal,{purpose,id,argsJson,...(checkpointIndex===undefined?{}:{checkpointIndex})},atMs);
}
function planSign(journal:TreasureServerJournal,id:string,atMs=clock+1){
  const r=journal.requests.find(r=>r.id===id)!,root=journal.requests.find(r=>r.purpose==='root');
  const body={id,operationId:journal.binding.operationId,method:'sign',network:journal.binding.network,profileId:journal.binding.profileId,args:JSON.parse(r.argsJson),
    ...(journal.binding.authority==='owner'?{ownerPlan:plan,connectionToken:connection}:{paymentPlan:plan}),
    ...(r.purpose==='checkpoint'?{treasureRootReceipt:JSON.parse(root!.responseJson!).treasureRootReceipt}:{})};
  const planned=transitionTreasureServerRequest(journal,id,{type:'planned',bodyJson:JSON.stringify(body),connectionToken:connection,atMs});
  return transitionTreasureServerRequest(planned,id,{type:'sign-pending',atMs:atMs+1});
}
async function completeRoot(journal:TreasureServerJournal,root:Transaction,atMs=clock+4){
  const r=journal.requests.find(r=>r.purpose==='root')!,signed=await game.sign(root,[...Array(root.inputsLength).keys()]);
  return transitionTreasureServerRequest(journal,r.id,{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(signed),treasureRootReceipt:receipt}),atMs});
}
async function actorComplete(f:Awaited<ReturnType<typeof spendFixture>>,atMs=clock){
  const initial=createTreasureServerJournal(f.binding),argsJson=JSON.stringify(encodeSigningValue([f.message,'schnorr']));
  const prepared=prepare(initial,'actor-proof','actor-request',argsJson,atMs);
  const body:TreasureActorSigningBody={id:'actor-request',operationId:f.binding.operationId,method:'signMessage',network:'mutinynet',profileId,
    args:[{$type:'bytes',value:hex.encode(f.message)},'schnorr'],treasureActorProof:f.actorRequest,treasureActorPlan:token('actor-plan'),connectionToken:connection};
  const planned=transitionTreasureServerRequest(prepared,'actor-request',{type:'planned',bodyJson:JSON.stringify(body),connectionToken:connection,atMs:atMs+1});
  const pending=transitionTreasureServerRequest(planned,'actor-request',{type:'sign-pending',atMs:atMs+2});
  const proof=await game.signMessage(f.message,'schnorr');
  const journal=transitionTreasureServerRequest(pending,'actor-request',{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(proof)}),atMs:atMs+3});
  return {initial,prepared,planned,pending,journal,proof,body};
}

test('private spend journal separates actual actor-proof, eventual ROOT and checkpoint records',async t=>{
  let network=0;t.mock.method(globalThis,'fetch',async()=>{network++;throw Error('No network in journal fixture');});
  for(const branch of ['refund','reject'] as const){
    const f=await spendFixture(branch),actor=await actorComplete(f),pair=f.build(f.playerProof?[f.playerProof,actor.proof]:[actor.proof]);
    assert.notEqual(pair.arkTx.id,f.template.arkTx.id);assert.equal(pair.checkpoints[0].id,f.template.checkpoints[0].id);
    assert.throws(()=>prepare(actor.journal,'root','missing-admission-signatures',wireArgs(pair.arkTx),clock+4));
    let root=signSyntheticEmulator(pair.arkTx,f.leaf);if(branch==='reject')root=await player.sign(root,[0]);
    let j=prepare(actor.journal,'root','root-request',wireArgs(root),clock+4);j=planSign(j,'root-request',clock+5);j=await completeRoot(j,root,clock+8);
    assert.throws(()=>prepare(j,'checkpoint','missing-operator',wireArgs(pair.checkpoints[0]),clock+9,0));
    let cp=await operator.sign(signSyntheticEmulator(pair.checkpoints[0],f.leaf),[0]);if(branch==='reject')cp=await player.sign(cp,[0]);
    j=prepare(j,'checkpoint','checkpoint-request',wireArgs(cp),clock+9,0);j=planSign(j,'checkpoint-request',clock+10);
    const signed=await game.sign(cp,[0]);j=transitionTreasureServerRequest(j,'checkpoint-request',{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(signed)}),atMs:clock+12});
    validateTreasureServerJournal(JSON.parse(JSON.stringify(j)));
    assert.deepEqual(j.requests.map(r=>[r.purpose,r.phase]),[['actor-proof','completed'],['root','completed'],['checkpoint','completed']]);
    assert.equal(treasureServerResultLookup(j,'root-request').id,'root-request');assert.equal(Object.isFrozen(j.requests),true);
    assert.notEqual(treasureServerResultLookup(j,'actor-request').digest,treasureServerResultLookup(j,'root-request').digest);
  }
  assert.equal(network,0);
});

test('initial funding pins all real source transactions, exact 1000-sat contract and owned change',async()=>{
  for(const authority of ['owner','player-proof'] as const){
    const f=fundFixture(authority);let j=createTreasureServerJournal(f.binding);
    assert.throws(()=>prepare(j,'actor-proof','actor-request',JSON.stringify([{$type:'bytes',value:'00'.repeat(32)},'schnorr'])));
    j=prepare(j,'root','fund-root',wireArgs(f.pair.arkTx));j=planSign(j,'fund-root');j=await completeRoot(j,f.pair.arkTx);
    for(const [i,original] of f.pair.checkpoints.entries()){
      const cp=await operator.sign(original,[0]);j=prepare(j,'checkpoint','fund-checkpoint-'+i,wireArgs(cp),clock+5+i*4,i);j=planSign(j,'fund-checkpoint-'+i,clock+6+i*4);
      const signed=await game.sign(cp,[0]);j=transitionTreasureServerRequest(j,'fund-checkpoint-'+i,{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(signed)}),atMs:clock+8+i*4});
    }
    validateTreasureServerJournal(j);assert.equal(j.requests.length,3);assert.equal(f.pair.arkTx.getOutput(0).amount,1000n);assert.equal(f.pair.arkTx.getOutput(1).amount,1200n);
    const changed={...f.binding,sourceTransactions:[...f.binding.sourceTransactions]};changed.sourceTransactions[0]=hex.encode(f.sources[1].toBytes(false,false));assert.throws(()=>createTreasureServerJournal(changed));
  }
});

test('pending and unknown originals survive serialization and permit only exact result reconciliation',async()=>{
  const f=fundFixture(),initial=createTreasureServerJournal(f.binding),prepared=prepare(initial,'root','original-root',wireArgs(f.pair.arkTx)),pending=planSign(prepared,'original-root');
  const unknown=transitionTreasureServerRequest(pending,'original-root',{type:'sign-unknown',atMs:clock+3});
  const restored:unknown=JSON.parse(JSON.stringify(unknown));validateTreasureServerJournal(restored);
  assert.deepEqual(treasureServerResultLookup(restored,'original-root'),treasureServerResultLookup(pending,'original-root'));
  assert.equal(restored.requests[0].bodyJson,pending.requests[0].bodyJson);
  for(const type of ['sign-pending','sign-unknown'] as const)assert.throws(()=>transitionTreasureServerRequest(restored,'original-root',{type,atMs:clock+5}));
  assert.throws(()=>prepare(restored,'root','replacement-root',wireArgs(f.pair.arkTx),clock+5));
  assert.throws(()=>advanceTreasureServerJournal(restored,initial));assert.throws(()=>advanceTreasureServerJournal(restored,pending));
  const done=await completeRoot(restored,f.pair.arkTx,clock+5);advanceTreasureServerJournal(restored,done);
  assert.throws(()=>advanceTreasureServerJournal(prepared,done));assert.throws(()=>transitionTreasureServerRequest(done,'original-root',{type:'completed',responseJson:done.requests[0].responseJson!,atMs:clock+6}));
});

test('wire property order is retained and raw body digest is not reconstructed for lookup',()=>{
  const f=fundFixture(),prepared=prepare(createTreasureServerJournal(f.binding),'root','ordered-root',wireArgs(f.pair.arkTx));
  const pending=planSign(prepared,'ordered-root'),record=pending.requests[0];
  const expected=createHash('sha256').update(record.bodyJson!).digest('hex');assert.equal(treasureServerResultLookup(pending,record.id).digest,expected);
  const body=JSON.parse(record.bodyJson!),reordered=Object.fromEntries(Object.entries(body).reverse()),bodyJson=JSON.stringify(reordered);
  const other=transitionTreasureServerRequest(prepared,'ordered-root',{type:'planned',bodyJson,connectionToken:connection,atMs:clock+1});
  assert.equal(other.requests[0].bodyJson,bodyJson);assert.notEqual(other.requests[0].bodyDigest,record.bodyDigest);
  assert.throws(()=>advanceTreasureServerJournal(pending,{...pending,requests:[{...record,bodyJson,bodyDigest:createHash('sha256').update(bodyJson).digest('hex')}]}));
  assert.throws(()=>transitionTreasureServerRequest(prepared,'ordered-root',{type:'planned',bodyJson:record.bodyJson!+' ',connectionToken:connection,atMs:clock+1}));
});

test('unknown fields, owner credentials and arbitrary headers never enter the private journal schema',()=>{
  const f=fundFixture(),prepared=prepare(createTreasureServerJournal(f.binding),'root','safe-root',wireArgs(f.pair.arkTx)),pending=planSign(prepared,'safe-root');
  const body=JSON.parse(pending.requests[0].bodyJson!);
  for(const patch of [{ownerToken:'not-permitted'},{phrase:'not-permitted'},{headers:{Authorization:'not-permitted'}},{privateKey:'11'.repeat(32)},
    {ownerPlan:plan},{paymentPlan:'word word word word'}])assert.throws(()=>transitionTreasureServerRequest(prepared,'safe-root',{
      type:'planned',bodyJson:JSON.stringify({...body,...patch}),connectionToken:connection,atMs:clock+1}));
  for(const patch of [{ownerToken:'not-permitted'},{phrase:'not-permitted'},{artifactVersion:3},{publicKey:'03'+'11'.repeat(32)},
    {profileId:'11'.repeat(32)},{endpoint:'https://other.invalid/api/bis/?secret=x'},{network:'signet'}])
    assert.throws(()=>createTreasureServerJournal({...f.binding,...patch} as unknown as TreasureServerJournalBinding));
  assert.throws(()=>validateTreasureServerJournal({...pending,publicDto:pending.requests}));
});

test('actor-proof args and typed template cannot be changed or confused with ordinary transaction results',async()=>{
  const f=await spendFixture('reject'),actor=await actorComplete(f),bad={...actor.body,treasureActorProof:{...actor.body.treasureActorProof,hostReference:'another-run'}};
  assert.throws(()=>transitionTreasureServerRequest(actor.prepared,'actor-request',{type:'planned',bodyJson:JSON.stringify(bad),connectionToken:connection,atMs:clock+1}));
  const wrongArgs=JSON.stringify([{$type:'bytes',value:'00'.repeat(32)},'schnorr']);
  assert.throws(()=>prepare(actor.initial,'actor-proof','wrong-digest',wrongArgs));
  assert.throws(()=>transitionTreasureServerRequest(actor.pending,'actor-request',{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(f.template.arkTx)}),atMs:clock+3}));
  const wrong=await player.signMessage(f.message,'schnorr');
  assert.throws(()=>transitionTreasureServerRequest(actor.pending,'actor-request',{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(wrong)}),atMs:clock+3}));
  if(f.binding.kind!=='spend')throw Error('Expected spend fixture');const changed={...f.binding,actorTemplate:{...f.binding.actorTemplate,playerProof:'00'.repeat(64)}};
  assert.throws(()=>createTreasureServerJournal(changed));
  assert.throws(()=>prepare(actor.pending,'root','root-too-soon',wireArgs(f.template.arkTx),clock+4));
});

test('actual signed transaction results must retain exact original bytes, signatures and purpose',async()=>{
  const f=fundFixture(),prepared=prepare(createTreasureServerJournal(f.binding),'root','bound-root',wireArgs(f.pair.arkTx)),pending=planSign(prepared,'bound-root');
  const changed=Transaction.fromPSBT(f.pair.arkTx.toPSBT());changed.updateOutput(0,{amount:999n});const signed=await game.sign(changed,[0,1]);
  assert.throws(()=>transitionTreasureServerRequest(pending,'bound-root',{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(signed),treasureRootReceipt:receipt}),atMs:clock+4}));
  assert.throws(()=>transitionTreasureServerRequest(pending,'bound-root',{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(new Uint8Array(64)),treasureRootReceipt:receipt}),atMs:clock+4}));
  assert.throws(()=>transitionTreasureServerRequest(pending,'bound-root',{type:'completed',responseJson:JSON.stringify({result:encodeSigningValue(f.pair.arkTx),treasureRootReceipt:receipt}),atMs:clock+4}));
  assert.throws(()=>prepare(pending,'checkpoint','cp-too-soon',wireArgs(f.pair.checkpoints[0]),clock+4,0));
  let done=await completeRoot(pending,f.pair.arkTx);const cp=await operator.sign(f.pair.checkpoints[0],[0]);done=prepare(done,'checkpoint','bound-cp',wireArgs(cp),clock+5,0);
  const body={id:'bound-cp',operationId:common.operationId,method:'sign',network:'mutinynet',profileId,args:JSON.parse(wireArgs(cp)),paymentPlan:token('different-plan'),treasureRootReceipt:receipt};
  assert.throws(()=>transitionTreasureServerRequest(done,'bound-cp',{type:'planned',bodyJson:JSON.stringify(body),connectionToken:connection,atMs:clock+6}));
});
