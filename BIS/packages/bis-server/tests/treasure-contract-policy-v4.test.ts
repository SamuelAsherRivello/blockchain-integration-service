import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MnemonicIdentity,SingleKey,Transaction,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx,Extension,EmulatorPacket,PrevArkTxField,setArkPsbtField,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {RawWitness} from '@scure/btc-signer';
import {hex} from '@scure/base';
import {playerProofMessage} from '../../integration/src/client/wallet-layer-arkade/player-proof-protocol.ts';
import {assertTreasureV4AuthorizationPair,assertTreasureSigningTransaction,type TreasureSigningPolicy} from '../src/server/treasure-contract-policy.ts';
import {validateTreasureContractTransaction} from '../src/server/treasure-contract-policy.ts';
import {assertTreasureSignatureRetention} from '../../integration/src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';
import {gameContractScripts,parseGameContractIntent,validateGameContractTransaction} from '../src/server/contract-policy.ts';
import {createPaymentAuthorization} from '../src/server/payment-authorization.ts';
import {decodeSigningValue,encodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {createHostedHandler} from '../src/server/hosted.ts';
import {createWalletPool} from '../src/server/wallet-pool.ts';
import {signingDigest} from '../src/server/signing-authorization.ts';
import type {SigningClaim,SigningStore,TreasureCheckpointClaim} from '../src/server/signing-store.ts';
import {TREASURE_EMULATOR} from '../../integration/src/client/wallet-layer-arkade/treasure-capability.ts';
import {buildAuthorizedTreasureScript,treasureAuthorizationDigest} from '../../integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts';

const [game,player,operator]=[2,1,3].map(value=>SingleKey.fromHex(value.toString(16).padStart(64,'0')));
const [gameKey,playerKey,operatorKey]=await Promise.all([game,player,operator].map(async key=>hex.encode(await key.xOnlyPublicKey())));
const start=1_800_000_000_123,unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operatorKey)],timelock:{type:'seconds' as const,value:86_016n}});
const wallet=(key:string)=>new DefaultVtxo.Script({pubKey:hex.decode(key),serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds',value:2048n}});
const gameWallet=wallet(gameKey),playerWallet=wallet(playerKey);
const terms={network:'mutinynet' as const,offerSessionId:'server-offer',hostReference:'server-run',startedAtMs:start,player:playerKey,game:gameKey,
  operator:operatorKey,emulator:TREASURE_EMULATOR.key.slice(2),playerDestination:hex.encode(playerWallet.pkScript.slice(2)),
  gameDestination:hex.encode(gameWallet.pkScript.slice(2)),exitDelay:2048};
const build=(previous:Transaction,branch:'reject'|'cancel'|'refund',proofs:readonly Uint8Array[],funding:{txid:string;vout:number;value:1000})=>{
  const built=buildAuthorizedTreasureScript(terms),leaf=built.script.functionByName(branch)!;
  const packet=Extension.create([EmulatorPacket.create([{vin:0,script:leaf.arkadeScript!,witness:RawWitness.encode([...proofs])}])]);
  const pair=buildOffchainTx([{...funding,tapLeafScript:leaf.tapLeafScript,tapTree:built.script.encode()}],
    [{script:gameWallet.pkScript,amount:1000n},packet.txOut()],unroll);
  setArkPsbtField(pair.arkTx,0,PrevArkTxField,previous.toBytes(false,false));return pair;
};

test('V4 server policy independently reconstructs the exact proof-bearing ROOT/checkpoint pair',async()=>{
  const branch='reject' as const,built=buildAuthorizedTreasureScript(terms),previous=new Transaction({version:3});
  previous.addInput({txid:'ab'.repeat(32),index:0,witnessUtxo:{script:gameWallet.pkScript,amount:1000n}});
  previous.addOutput({script:built.script.pkScript,amount:1000n});previous.addOutput({script:hex.decode('51024e73'),amount:0n});
  const funding={txid:previous.id,vout:0,value:1000 as const},zero=new Uint8Array(64),empty=build(previous,branch,[zero,zero],funding);
  const message=treasureAuthorizationDigest(terms,branch,{arkTx:empty.arkTx,checkpoint:empty.checkpoints[0],funding,checkpointTapscript:unroll});
  const playerProof=await player.signMessage(message,'schnorr'),gameProof=await game.signMessage(message,'schnorr');
  const actual=build(previous,branch,[playerProof,gameProof],funding),policy:TreasureSigningPolicy={artifactVersion:4,
    intent:{artifactVersion:4,kind:'refund',branch,offerSessionId:terms.offerSessionId,hostReference:terms.hostReference,startedAtMs:start},
    terms,observedAtMs:start+1000,deadlineMs:start+90_000,checkpointTapscript:hex.encode(unroll.script),
    fundingOutpoint:{txid:previous.id,vout:0},
    previousTransactionDigest:createHash('sha256').update(previous.toBytes(false,false)).digest('hex')};
  assert.doesNotThrow(()=>assertTreasureV4AuthorizationPair(actual.arkTx,actual.checkpoints[0],policy));
  const wrongBranch:TreasureSigningPolicy={...policy,intent:{...policy.intent,branch:'cancel'}};
  assert.throws(()=>assertTreasureV4AuthorizationPair(actual.arkTx,actual.checkpoints[0],wrongBranch));
  const actorless=build(previous,branch,[playerProof,zero],funding);
  assert.throws(()=>assertTreasureV4AuthorizationPair(actorless.arkTx,actorless.checkpoints[0],policy));
  const wrongPlayer=await game.signMessage(message,'schnorr'),substituted=build(previous,branch,[wrongPlayer,gameProof],funding);
  assert.throws(()=>assertTreasureV4AuthorizationPair(substituted.arkTx,substituted.checkpoints[0],policy));
});

test('V4 fund uses a versioned plan/grant domain while V3 parsing remains strict',async()=>{
  const startedAtMs=Date.now()-5000,intent=parseGameContractIntent({artifactVersion:4,kind:'fund',branch:'fund',offerSessionId:'fund-offer',hostReference:'fund-run',startedAtMs});
  const scripts=gameContractScripts(intent,gameWallet,{gameKey:hex.decode(gameKey),playerKey:hex.decode(playerKey),operatorKey:hex.decode(operatorKey),exitDelay:2048n},
    {network:'mutinynet',observedAtMs:Date.now()});
  assert.ok('treasure' in scripts);
  assert.throws(()=>parseGameContractIntent({artifactVersion:4,kind:'refund',branch:'claim',offerSessionId:'fund-offer',hostReference:'fund-run',startedAtMs}));
  assert.throws(()=>parseGameContractIntent({artifactVersion:4,kind:'fund',branch:'fund',offerSessionId:'fund-offer',hostReference:'fund-run',startedAtMs,previousTransaction:'untrusted'}));
  const input={txid:'de'.repeat(32),vout:0,value:1500,tapLeafScript:gameWallet.forfeit(),tapTree:gameWallet.encode(),assets:[]};
  const context={inputs:[input],changeScript:gameWallet.pkScript,recipientScript:scripts.recipientScript,serverUnrollScript:unroll,
    maximumExposureSats:5000,treasure:scripts.treasure};
  const pair=buildOffchainTx([input],[{script:scripts.recipientScript,amount:1000n},{script:gameWallet.pkScript,amount:500n}],unroll);
  const operationId='fund-operation',playerPublicKey=hex.encode(await player.compressedPublicKey()),profileId=createHash('sha256').update(hex.decode(playerPublicKey)).digest('hex'),
    request={id:'fund-root',operationId,network:'mutinynet',profileId,method:'sign',args:encodeSigningValue([pair.arkTx,[0]])};
  const binding={audience:'https://bis.invalid',gameId:'stealth-and-steel',network:'mutinynet' as const,profileId,operationId,connectionId:'test-connection'};
  const auth=createPaymentAuthorization('a'.repeat(64),()=>Date.now());
  const plan=auth.plan(binding,playerPublicKey,
    validateGameContractTransaction(pair.arkTx,context,intent),request);
  const planned={...request,paymentPlan:plan},grant=auth.authorize(plan,planned,binding,playerPublicKey);
  assert.equal(auth.verify(grant,plan,planned,binding).contractPolicy,true);
  const [payload,signature]=plan.split('.'),body=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  body.treasurePolicy.artifactVersion=3;body.treasurePolicy.intent.artifactVersion=3;
  const relabeled=`${Buffer.from(JSON.stringify(body)).toString('base64url')}.${signature}`;
  assert.throws(()=>auth.authorize(relabeled,planned,binding,profileId));
});

test('V4 ROOT claim-day and two CP families survive midnight, with exact recovery after connection expiry',async t=>{
 const phrase='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',secret='v4-recovery-owner-secret-'.repeat(2);
 const gameIdentity=MnemonicIdentity.fromMnemonic(phrase,{isMainnet:false}),gameX=await gameIdentity.xOnlyPublicKey(),gameCompressed=hex.encode(await gameIdentity.compressedPublicKey()),contractPlayerPublicKey=hex.encode(await player.compressedPublicKey());
 let now=new Date().setUTCHours(23,59,59,500);
 t.mock.method(Date,'now',()=>now);
 const activeGameWallet=new DefaultVtxo.Script({pubKey:gameX,serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds',value:2048n}}),startedAtMs=now-5000;
 const intent=parseGameContractIntent({artifactVersion:4,kind:'fund',branch:'fund',offerSessionId:'recovery-offer',hostReference:'recovery-run',startedAtMs});
 const scripts=gameContractScripts(intent,activeGameWallet,{gameKey:gameX,playerKey:hex.decode(playerKey),operatorKey:hex.decode(operatorKey),exitDelay:2048n},{network:'mutinynet',observedAtMs:now-2000});
 assert.ok('treasure' in scripts);
 const input={txid:'de'.repeat(32),vout:0,value:1500,tapLeafScript:activeGameWallet.forfeit(),tapTree:activeGameWallet.encode(),assets:[]},input2={...input,txid:'cf'.repeat(32),vout:1,value:1500};
 const context={inputs:[input,input2],changeScript:activeGameWallet.pkScript,recipientScript:scripts.recipientScript,serverUnrollScript:unroll,maximumExposureSats:5000,treasure:scripts.treasure};
 const pair=buildOffchainTx([input,input2],[{script:scripts.recipientScript,amount:1000n},{script:activeGameWallet.pkScript,amount:2000n}],unroll);
 const publicInput={...input,txid:'91'.repeat(32),vout:2},publicInput2={...input2,txid:'92'.repeat(32),vout:3},
  publicContext={...context,inputs:[publicInput,publicInput2]},publicPair=buildOffchainTx([publicInput,publicInput2],
   [{script:scripts.recipientScript,amount:1000n},{script:activeGameWallet.pkScript,amount:2000n}],unroll);
 assert.notEqual(publicPair.arkTx.id,pair.arkTx.id,'the public completion has its own independently funded ROOT');
 assert.equal(hex.encode(publicPair.checkpoints[1].getInput(0).txid!),publicInput2.txid,'the public CP spends its own original source');
 assert.equal(hex.encode(pair.arkTx.getInput(0).txid!),pair.checkpoints[0].id,'ROOT consumes checkpoint 0 output 0');
 assert.equal(pair.arkTx.getInput(0).index,0);
 assert.equal(hex.encode(pair.arkTx.getInput(1).txid!),pair.checkpoints[1].id,'ROOT consumes checkpoint 1 output 0');
 assert.equal(pair.arkTx.getInput(1).index,0);
 assert.equal(hex.encode(pair.checkpoints[0].getInput(0).txid!),input.txid,'CP0 consumes original source 0');
 assert.equal(pair.checkpoints[0].getInput(0).index,input.vout);
 assert.equal(hex.encode(pair.checkpoints[1].getInput(0).txid!),input2.txid,'CP1 consumes original source 1');
 assert.equal(pair.checkpoints[1].getInput(0).index,input2.vout);
 assert.doesNotThrow(()=>validateTreasureContractTransaction(pair.arkTx,context,intent));
 assert.doesNotThrow(()=>validateGameContractTransaction(pair.arkTx,context,intent));
 const gameId='stealth-and-steel',operationId='v4-recovery-operation',publicOperationId='v4-public-recovery-operation',rows=new Map<string,{digest:string;result?:unknown;done:boolean;owner?:string}>(),
  counters={reads:0,claims:0,checkpointClaims:0,completions:0,quotas:0},reservations=new Map<string,string>(),exposures=new Map<string,number>(),families=new Map<string,string>(),locks=new Set<string>(),checkpointClaims:TreasureCheckpointClaim[]=[];
 const store:SigningStore={
  async readCompleted(lookup){counters.reads++;const row=rows.get(`${lookup.scope}:${lookup.id}`);if(!row)return {status:'missing'};if(row.digest!==lookup.digest)throw Error('changed');return row.done?{status:'completed',result:structuredClone(row.result)}:{status:'unresolved'};},
  async claim(claim){counters.claims++;const key=`${claim.scope}:${claim.id}`,prior=rows.get(key);if(prior){if(prior.digest!==claim.digest)throw Error('changed');return prior.done?{status:'replay',result:structuredClone(prior.result)}:(()=>{throw Error('unresolved')})();}
   if(locks.has(claim.scope))throw Error('busy');if(claim.inputs.some(outpoint=>reservations.has(`${claim.scope}:${outpoint}`)&&reservations.get(`${claim.scope}:${outpoint}`)!==claim.transactionId))throw Error('conflict');
   rows.set(key,{digest:claim.digest,done:false,owner:key});locks.add(claim.scope);for(const outpoint of claim.inputs)reservations.set(`${claim.scope}:${outpoint}`,claim.transactionId);
   if(claim.exposureId)exposures.set(JSON.stringify([claim.scope,claim.operationId,claim.exposureId]),claim.exposureSats);return {status:'acquired',owner:key};},
  async claimTreasureCheckpoint(claim){counters.checkpointClaims++;checkpointClaims.push(structuredClone(claim));
   const parent=rows.get(`${claim.parent.scope}:${claim.parent.id}`);if(!parent||parent.digest!==claim.parent.digest||!parent.done||JSON.stringify(parent.result)!==JSON.stringify(claim.parentResult))throw Error('parent-mismatch');
   if(claim.parent.inputs.some(outpoint=>reservations.get(`${claim.parent.scope}:${outpoint}`)!==claim.parent.transactionId))throw Error('parent-reservation');
   const exposureKey=JSON.stringify([claim.parent.scope,claim.parent.operationId,claim.parent.exposureId]);if(exposures.get(exposureKey)!==claim.parent.exposureSats)throw Error('parent-exposure');
   const familyKey=`${claim.parent.scope}:treasure-checkpoint:${claim.parent.transactionId}:${claim.checkpointOutpoint.txid}:${claim.checkpointOutpoint.index}`,
    family=JSON.stringify({id:claim.checkpoint.id,digest:claim.checkpoint.digest,family:claim.checkpointFamilyDigest}),priorFamily=families.get(familyKey),childKey=`${claim.checkpoint.scope}:${claim.checkpoint.id}`,prior=rows.get(childKey);
   if(priorFamily&&priorFamily!==family)throw Error('checkpoint-family');if(Boolean(priorFamily)!==Boolean(prior))throw Error('checkpoint-family');
   if(prior){if(prior.digest!==claim.checkpoint.digest)throw Error('changed');if(prior.done)return {status:'replay',result:structuredClone(prior.result)};throw Error('unresolved');}
   if(locks.has(claim.checkpoint.scope))throw Error('busy');if(claim.checkpoint.inputs.some(outpoint=>reservations.has(`${claim.checkpoint.scope}:${outpoint}`)&&reservations.get(`${claim.checkpoint.scope}:${outpoint}`)!==claim.checkpoint.transactionId))throw Error('conflict');
   families.set(familyKey,family);locks.add(claim.checkpoint.scope);for(const outpoint of claim.checkpoint.inputs)reservations.set(`${claim.checkpoint.scope}:${outpoint}`,claim.checkpoint.transactionId);
   rows.set(childKey,{digest:claim.checkpoint.digest,done:false,owner:childKey});return {status:'acquired',owner:childKey};},
  async complete(claim,owner,result){counters.completions++;const row=rows.get(`${claim.scope}:${claim.id}`);if(!row||owner!==`${claim.scope}:${claim.id}`)throw Error('owner');row.result=structuredClone(result);row.done=true;locks.delete(claim.scope);},
  async session(){return null;},async ping(){},async assetAllowed(){return false;},async consumePublicRequest(){counters.quotas++;},
 };
 const env={BIS_OWNER_TOKEN:secret,BIS_GAME_ID:gameId,BIS_GAME_WALLET_MUTINYNET_01_MNEMONIC:phrase,
  BIS_PUBLIC_PAYMENT_SIGNING:'true',BIS_PUBLIC_SIGNING_NETWORKS:'mutinynet',BIS_PUBLIC_CONTRACT_SIGNING:'true',BIS_SIGNING_OPERATION_CAP_SATS:'5000',BIS_SIGNING_DAILY_CAP_SATS:'10000'};
 let activeContext=context;
 const handler=createHostedHandler({env,store,now:()=>now,pool:createWalletPool(env),paymentContext:async()=>activeContext});
 const post=(path:string,body:unknown,headers:Record<string,string>={})=>new Request(`https://example.test/api/bis/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}),ownerHeader={Authorization:`Bearer ${secret}`};
 const connected=await(await handler(post('connect',{network:'mutinynet',gameId},ownerHeader))).json();assert.equal(connected.publicKey,gameCompressed);
 const raw=(id:string,tx:Transaction,requestOperationId=operationId)=>({id,operationId:requestOperationId,network:'mutinynet',profileId:connected.profileId,method:'sign',args:encodeSigningValue([tx,Array.from({length:tx.inputsLength},(_,index)=>index)])});
 const publicHeader={Authorization:`Bearer ${connected.token}`},issuePlayerToken=async(identity:SingleKey)=>{
  const binding={audience:'https://example.test',gameId,network:'mutinynet',profileId:connected.profileId,operationId:publicOperationId},playerPublicKey=hex.encode(await identity.compressedPublicKey());
  const challenge=await handler(post('player/challenge',{...binding,playerPublicKey}));assert.equal(challenge.status,200,await challenge.clone().text());
  const {challenge:nonce,scope}=await challenge.json(),signature=hex.encode(await identity.signMessage(createHash('sha256').update(playerProofMessage(scope)).digest(),'schnorr'));
  const authenticated=await handler(post('player/authenticate',{...binding,challenge:nonce,signature}));assert.equal(authenticated.status,200,await authenticated.clone().text());
  return (await authenticated.json()).token as string;
 },initialPlayerToken=await issuePlayerToken(player);
 const root=raw('v4-recovery-root',pair.arkTx),connectionScope=JSON.parse(Buffer.from(connected.token.split('.')[0],'base64url').toString('utf8'));
 const ownerBinding={audience:'https://example.test',gameId,network:'mutinynet' as const,profileId:connected.profileId,operationId,connectionId:connectionScope.id};
 const ownerAuth=createPaymentAuthorization(secret,()=>now,'owner'),validated=validateGameContractTransaction(pair.arkTx,context,intent);
 assert.equal(typeof ownerAuth.plan(ownerBinding,undefined,validated,root),'string');
 const planResponse=await handler(post('owner/plan',{request:root,outpoints:[{txid:input.txid,vout:input.vout},{txid:input2.txid,vout:input2.vout}],contract:intent,contractPlayerPublicKey,connectionToken:connected.token},ownerHeader));
 assert.equal(planResponse.status,200,await planResponse.clone().text());const plan=(await planResponse.json()).ownerPlan,plannedRoot={...root,ownerPlan:plan,connectionToken:connected.token};
  assert.equal(typeof ownerAuth.authorize(plan,plannedRoot,ownerBinding,undefined),'string');
 const authorize=async(request:unknown)=>handler(post('owner/authorize',{request,connectionToken:connected.token},ownerHeader));
  const rootAuthorize=await authorize(plannedRoot);assert.equal(rootAuthorize.status,200,await rootAuthorize.clone().text());
  const rootGrant=(await rootAuthorize.json()).grant,rootSigned=await handler(post('sign',plannedRoot,{...ownerHeader,'X-BIS-Signing-Grant':rootGrant}));
 assert.equal(rootSigned.status,200,await rootSigned.clone().text());const rootResponse=await rootSigned.json();assert.equal(typeof rootResponse.treasureRootReceipt,'string');
 const receiptScope=JSON.parse(Buffer.from(rootResponse.treasureRootReceipt.split('.')[0],'base64url').toString('utf8'));
 assert.equal(receiptScope.rootRequestDigest,signingDigest(plannedRoot),'V4 receipt binds the exact persisted ROOT request digest');
 assert.equal(receiptScope.rootClaimDay,new Date(now).toISOString().slice(0,10),'V4 receipt binds the actual coordinated ROOT claim day');
  assert.deepEqual(Object.keys(rootResponse).sort(),['result','treasureRootReceipt']);
 assert.equal(decodeSigningValue(rootResponse.result).id,pair.arkTx.id);
  assert.equal(ownerAuth.recoverCompleted(plan,plannedRoot,ownerBinding,rootResponse),rootResponse);
 const checkpoint={...raw('v4-recovery-checkpoint-0',pair.checkpoints[0]),ownerPlan:plan,connectionToken:connected.token,treasureRootReceipt:rootResponse.treasureRootReceipt};
  const checkpointSourceInput=pair.checkpoints[0].getInput(0);assert.ok(checkpointSourceInput.txid);
  assert.equal(hex.encode(checkpointSourceInput.txid),input.txid,'CP0 spends its original funding source');
  const checkpointAuthorize=await authorize(checkpoint);assert.equal(checkpointAuthorize.status,200,await checkpointAuthorize.clone().text());
  const checkpointGrant=(await checkpointAuthorize.json()).grant;
  assert.doesNotThrow(()=>ownerAuth.verify(checkpointGrant,plan,checkpoint,ownerBinding));
  assert.doesNotThrow(()=>ownerAuth.checkpointReference(plan,checkpoint,ownerBinding));
  assert.doesNotThrow(()=>ownerAuth.checkpointCompletion(plan,checkpoint,ownerBinding,rootResponse));
  const checkpointSigned=await handler(post('sign',checkpoint,{...ownerHeader,'X-BIS-Signing-Grant':checkpointGrant}));
 assert.equal(checkpointSigned.status,200,await checkpointSigned.clone().text());const checkpointResponse=await checkpointSigned.json();
 assert.doesNotThrow(()=>ownerAuth.verifyReplay(plan,checkpoint,ownerBinding));
 const ownerCheckpoint1={...raw('v4-recovery-owner-checkpoint-1',pair.checkpoints[1]),ownerPlan:plan,connectionToken:connected.token,treasureRootReceipt:rootResponse.treasureRootReceipt};
 activeContext=publicContext;
 const publicRootRequest={...raw('v4-public-recovery-root',publicPair.arkTx,publicOperationId),connectionToken:connected.token};
 const publicPlanResponse=await handler(post('payment/plan',{request:publicRootRequest,playerToken:initialPlayerToken,
  outpoints:[{txid:publicInput.txid,vout:publicInput.vout},{txid:publicInput2.txid,vout:publicInput2.vout}],contract:intent},publicHeader));
 assert.equal(publicPlanResponse.status,200,await publicPlanResponse.clone().text());const publicPlan=(await publicPlanResponse.json()).paymentPlan as string;
 const publicRoot={...publicRootRequest,paymentPlan:publicPlan};
 const publicAuthorize=await handler(post('payment/authorize',{request:publicRoot,playerToken:initialPlayerToken},publicHeader));
 assert.equal(publicAuthorize.status,200,await publicAuthorize.clone().text());const publicGrant=(await publicAuthorize.json()).grant as string;
 const publicRootSigned=await handler(post('sign',publicRoot,{...publicHeader,'X-BIS-Signing-Grant':publicGrant}));
 assert.equal(publicRootSigned.status,200,await publicRootSigned.clone().text());const publicRootResponse=await publicRootSigned.json();
 assert.equal(typeof publicRootResponse.treasureRootReceipt,'string');
 const publicCheckpoint1={...raw('v4-recovery-checkpoint-1',publicPair.checkpoints[1],publicOperationId),paymentPlan:publicPlan,connectionToken:connected.token,treasureRootReceipt:publicRootResponse.treasureRootReceipt};
 const planValue=JSON.parse(Buffer.from(plan.split('.')[0],'base64url').toString('utf8')) as {treasurePolicy:TreasureSigningPolicy};
 assert.equal(planValue.treasurePolicy.artifactVersion,4);assert.equal((planValue as any).checkpoints.length,2,'each of the two original source inputs has its own canonical CP');
 now+=600_001;
 const completeOwner=async(original:Record<string,any>)=>handler(post('owner/treasure/checkpoint/complete',{
  version:1,requestId:original.id,requestDigest:signingDigest(original),requestJson:JSON.stringify(original),connectionToken:connected.token,
 },ownerHeader));
 const ownerCheckpoint1Signed=await completeOwner(ownerCheckpoint1);assert.equal(ownerCheckpoint1Signed.status,200,await ownerCheckpoint1Signed.clone().text());
 const ownerCheckpoint1Response=await ownerCheckpoint1Signed.json();
 const completePublic=async(original:Record<string,any>,playerToken:string)=>handler(post('treasure/checkpoint/complete',{
  version:1,requestId:original.id,requestDigest:signingDigest(original),requestJson:JSON.stringify(original),connectionToken:connected.token,playerToken,
 },publicHeader));
 const checkpointClaimsBeforePublic=checkpointClaims.length;
 const staleProof=await completePublic(publicCheckpoint1,initialPlayerToken);assert.equal(staleProof.status,403,'expired Player proof cannot complete a checkpoint');
 const wrongPlayerToken=await issuePlayerToken(operator),wrongPlayerProof=await completePublic(publicCheckpoint1,wrongPlayerToken);
 assert.equal(wrongPlayerProof.status,403,'a fresh proof from the wrong Player key cannot complete a checkpoint');
 assert.equal(checkpointClaims.length,checkpointClaimsBeforePublic,'rejected Player proofs cannot claim checkpoint state');
 const freshPlayerToken=await issuePlayerToken(player),publicCheckpoint1Signed=await completePublic(publicCheckpoint1,freshPlayerToken);
 assert.equal(publicCheckpoint1Signed.status,200,await publicCheckpoint1Signed.clone().text());
 const publicCheckpoint1Response=await publicCheckpoint1Signed.json();
 assert.deepEqual(checkpointClaims.map(value=>`${value.checkpointOutpoint.txid}:${value.checkpointOutpoint.index}`).sort(),
  [`${pair.checkpoints[0].id}:0`,`${pair.checkpoints[1].id}:0`,`${publicPair.checkpoints[1].id}:0`].sort(),'each child family binds its actual canonical CP output 0');
 const afterMidnightClaim=checkpointClaims.find(value=>value.checkpointOutpoint.txid===pair.checkpoints[1].id)!;
 assert.equal(afterMidnightClaim.rootClaimDay,new Date(startedAtMs+5000).toISOString().slice(0,10));
 assert.notEqual(afterMidnightClaim.checkpoint.day,afterMidnightClaim.rootClaimDay,'UTC midnight completion keeps the original ROOT budget day and current child day');
 const checkpointSaved=rows.get(`stealth-and-steel:mutinynet:${connected.profileId}:${checkpoint.id}`)?.result;
 const ownerCheckpoint1Saved=rows.get(`stealth-and-steel:mutinynet:${connected.profileId}:${ownerCheckpoint1.id}`)?.result;
 const publicCheckpoint1Saved=rows.get(`stealth-and-steel:mutinynet:${connected.profileId}:${publicCheckpoint1.id}`)?.result;
 assert.ok(checkpointSaved&&ownerCheckpoint1Saved&&publicCheckpoint1Saved);const storedCheckpoint=decodeSigningValue(checkpointSaved);
 assert.ok(storedCheckpoint&&typeof storedCheckpoint.toPSBT==='function');const storedCheckpointTx=Transaction.fromPSBT(storedCheckpoint.toPSBT());
 assert.doesNotThrow(()=>assertTreasureSigningTransaction(storedCheckpointTx,pair.checkpoints[0],planValue.treasurePolicy,false));
 assert.doesNotThrow(()=>assertTreasureSignatureRetention(Buffer.from(pair.checkpoints[0].toPSBT()).toString('base64'),Buffer.from(storedCheckpointTx.toPSBT()).toString('base64'),storedCheckpointTx.inputsLength,storedCheckpointTx.outputsLength));
 assert.doesNotThrow(()=>verifyTapscriptSignatures(storedCheckpointTx,0,[planValue.treasurePolicy.terms.game],[],[0,1]));
 assert.doesNotThrow(()=>ownerAuth.recoverCompleted(plan,checkpoint,ownerBinding,checkpointSaved));
 const alternate=await completePublic({...publicCheckpoint1,id:'v4-recovery-checkpoint-alternate-id'},freshPlayerToken);assert.notEqual(alternate.status,200,'another request ID cannot claim the same CP outpoint');
 const beforeRecovery={...counters};
 const beforeFreshSign={...counters},freshRoot={...plannedRoot,id:'v4-recovery-fresh-action'};
 const freshSign=await handler(post('sign',freshRoot,{...ownerHeader,'X-BIS-Signing-Grant':rootGrant}));assert.equal(freshSign.status,403);
 assert.deepEqual(counters,beforeFreshSign,'expired original connection/plan cannot authorize a fresh signing action');
 const recover=(request:Record<string,unknown>,headers=ownerHeader)=>post('treasure/recover',{version:1,requestId:request.id,requestDigest:signingDigest(request),requestJson:JSON.stringify(request),connectionToken:connected.token},headers);
 const rootRecovered=await handler(recover(plannedRoot));assert.equal(rootRecovered.status,200,await rootRecovered.clone().text());assert.deepEqual(await rootRecovered.json(),rootResponse);
 const checkpointRecovered=await handler(recover(checkpoint));assert.equal(checkpointRecovered.status,200,await checkpointRecovered.clone().text());assert.deepEqual(await checkpointRecovered.json(),checkpointResponse);
 const ownerCheckpoint1Recovered=await handler(recover(ownerCheckpoint1));assert.equal(ownerCheckpoint1Recovered.status,200,await ownerCheckpoint1Recovered.clone().text());assert.deepEqual(await ownerCheckpoint1Recovered.json(),ownerCheckpoint1Response);
 const publicCheckpoint1Recovered=await handler(recover(publicCheckpoint1,publicHeader));assert.equal(publicCheckpoint1Recovered.status,200,await publicCheckpoint1Recovered.clone().text());assert.deepEqual(await publicCheckpoint1Recovered.json(),publicCheckpoint1Response);
 assert.equal(counters.reads,beforeRecovery.reads+4);assert.equal(counters.claims,beforeRecovery.claims);assert.equal(counters.completions,beforeRecovery.completions);
 assert.equal(counters.quotas,beforeRecovery.quotas,'expired-result recovery does not consume signing quota');
 const wrongOwner=await handler(recover(plannedRoot,{Authorization:'Bearer wrong-owner-secret'}));assert.equal(wrongOwner.status,403);
 assert.equal(counters.reads,beforeRecovery.reads+4,'foreign owner credentials are rejected before storage lookup');
});
