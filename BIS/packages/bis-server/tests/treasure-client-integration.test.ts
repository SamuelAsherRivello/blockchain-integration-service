import test from 'node:test';
import assert from 'node:assert/strict';
import {MnemonicIdentity,DefaultVtxo,CSVMultisigTapscript,buildOffchainTx,verifyTapscriptSignatures,type ArkInfo,type VirtualCoin} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {createHostedHandler} from '../src/server/hosted.ts';
import {readPaymentContext} from '../src/server/payment-context.ts';
import type {SigningClaim,SigningStore} from '../src/server/signing-store.ts';
import {configureBisServer,probeGameSigner,remoteSigningIdentity,serverContractRequest,type ServerContractIntent,type ServerSigningOperation} from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import {authenticatePlayerProof} from '../../integration/src/client/wallet-layer-arkade/player-proof-client.ts';
import {encodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {TREASURE_EMULATOR} from '../../integration/src/client/wallet-layer-arkade/treasure-capability.ts';

// Entirely synthetic, public fixture keys. Genuine SDK/HMAC/proof/signature
// implementations run in process; there is no provider, wallet Vault or funding.
const phrases=['abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about','legal winner thank year wave sausage worth useful legal winner thank yellow','letter advice cage absurd amount doctor acoustic avoid letter advice cage above'];
const [game,player,operator]=phrases.map(phrase=>MnemonicIdentity.fromMnemonic(phrase,{isMainnet:false}));
const playerPublicKey=hex.encode(await player.compressedPublicKey()),gamePublicKey=hex.encode(await game.compressedPublicKey()),operatorPublicKey=hex.encode(await operator.compressedPublicKey());
const gameKey=hex.encode(await game.xOnlyPublicKey()),operatorKey=hex.encode(await operator.xOnlyPublicKey());
type Call={path:string;body:any;authorization:string|null;grant:string|null;status:number;response:any};
async function fixture(owner:boolean,loseRootAck=false){
 let clock=Date.now();const initialClock=clock,ownerToken='public-synthetic-integration-owner-'.repeat(3),endpoint=`https://treasure-${owner}.example.test/api/bis/`;
 const contract:ServerContractIntent={artifactVersion:3,kind:'fund',branch:'fund',offerSessionId:'actual-client-offer',hostReference:'actual-client-run',startedAtMs:initialClock-100,playerPublicKey};
 const own=new DefaultVtxo.Script({pubKey:hex.decode(gameKey),serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds',value:2048n}}),unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operatorKey)],timelock:{type:'seconds',value:86016n}});
 const info={network:'mutinynet',signerPubkey:operatorPublicKey,forfeitPubkey:operatorPublicKey,unilateralExitDelay:2048n,checkpointTapscript:hex.encode(unroll.script),dust:330n,vtxoMinAmount:330n,vtxoMaxAmount:-1n,fees:{txFeeRate:'0',intentFee:{offchainInput:'amount*0.001'}}} as unknown as ArkInfo;
 const point={txid:'11'.repeat(32),vout:0},coin={...point,value:3000,script:hex.encode(own.pkScript),status:{confirmed:true},createdAt:new Date(),isSpent:false,isSwept:false,isPreconfirmed:false,spentBy:'',isUnrolled:false,expiresAt:new Date('2100-01-01'),virtualStatus:{state:'settled'},assets:[]} as unknown as VirtualCoin;
 const reader={info:async()=>info,coins:async()=>({vtxos:[coin]})},context=await readPaymentContext({network:'mutinynet',gamePublicKey,playerPublicKey,outpoints:[point],maximumExposureSats:5000,signal:new AbortController().signal,contract:serverContractRequest(contract)},reader);
 const pair=buildOffchainTx([...context.inputs],[{script:context.recipientScript,amount:1000n},{script:context.changeScript,amount:2000n}],context.serverUnrollScript);
 const rows=new Map<string,{digest:string;result?:unknown;done:boolean}>(),claims:SigningClaim[]=[],completions:SigningClaim[]=[];let acquired=0;
 const store:SigningStore={ping:async()=>{},consumePublicRequest:async()=>{},assetAllowed:async()=>false,session:async()=>{throw Error('No MuSig session expected');},claim:async claim=>{
  const key=claim.scope+':'+claim.id,row=rows.get(key);claims.push(structuredClone(claim));
  if(row){if(row.digest!==claim.digest)throw Error('Changed original digest');if(!row.done)throw Error('Original claim unresolved');return {status:'replay',result:structuredClone(row.result)};}
  acquired++;rows.set(key,{digest:claim.digest,done:false});return {status:'acquired',owner:key};
 },complete:async(claim,_owner,result)=>{const row=rows.get(claim.scope+':'+claim.id)!;row.result=structuredClone(result);row.done=true;completions.push(structuredClone(claim));}};
 const env={BIS_OWNER_TOKEN:ownerToken,BIS_GAME_WALLET_MUTINYNET_01_MNEMONIC:phrases[0],BIS_PUBLIC_PAYMENT_SIGNING:'true',BIS_PUBLIC_SIGNING_NETWORKS:'mutinynet',BIS_PUBLIC_CONTRACT_SIGNING:'true',BIS_PUBLIC_ASSET_SIGNING:'false',BIS_SIGNING_OPERATION_CAP_SATS:'5000',BIS_SIGNING_DAILY_CAP_SATS:'10000'};
 let contextReads=0;const calls:Call[]=[],handler=createHostedHandler({env,store,now:()=>clock,paymentContext:options=>{contextReads++;return readPaymentContext(options,reader);}});
 const send=async(path:string,body:unknown,authorization:string|null=null,grant:string|null=null)=>{
  // Fresh-context reads use the real local clock; keep the injected handler
  // clock monotonic with it until the test explicitly advances into the future.
  clock=Math.max(clock,Date.now());
  const response=await handler(new Request(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{}),...(grant?{'X-BIS-Signing-Grant':grant}:{})},body:JSON.stringify(body)}));
  const value=await response.clone().json();calls.push({path,body:structuredClone(body),authorization,grant,status:response.status,response:structuredClone(value)});return response;
 };
 let lost=false;const fetcher:typeof fetch=async(url,init)=>{
  assert.equal(new URL(String(url)).origin,new URL(endpoint).origin);const path=new URL(String(url)).pathname.split('/api/bis/')[1],response=await send(path,JSON.parse(String(init?.body)),new Headers(init?.headers).get('authorization'),new Headers(init?.headers).get('x-bis-signing-grant'));
  if(loseRootAck&&!lost&&path==='sign'&&response.ok){lost=true;throw Error('Synthetic lost root acknowledgement');}return response;
 };
 let proofCalls=0;const payment:NonNullable<ServerSigningOperation['payment']>={active:{outpoints:[point],contract}},operation:ServerSigningOperation={id:'actual-treasure-'+owner,payment,playerProof:async options=>{
  proofCalls++;return authenticatePlayerProof({endpoint,identity:player,binding:{gameId:options.account.server.gameId,network:options.account.network,profileId:options.account.profileId,operationId:options.operationId},signal:options.signal,fetcher:options.fetcher,now:()=>clock});
 }};
 configureBisServer(owner?{ownerToken}:{});const probe=await probeGameSigner('mutinynet',{endpoint,fetcher});assert.equal(probe.status,'connected');if(probe.status!=='connected')throw Error('Synthetic hosted signer unavailable');
 const identity=remoteSigningIdentity(probe.account,()=>operation);
 const reconnect=()=>probeGameSigner('mutinynet',{endpoint,fetcher}),authority=(useOwner:boolean)=>configureBisServer(useOwner?{ownerToken}:{});
 return {owner,clock:(value:number)=>{clock=value;},initialClock,deadlineMs:(Math.floor(contract.startedAtMs/1000)+90)*1000,contract,payment,operation,pair,context,identity,account:probe.account,calls,send,reconnect,authority,claims,completions,rows,acquired:()=>acquired,contextReads:()=>contextReads,proofCalls:()=>proofCalls};
}
function denied(response:Response,body:any){
 assert.ok([403,503].includes(response.status));assert.deepEqual(Object.keys(body),['error']);assert.equal(typeof body.error,'string');
 for(const value of [...phrases,'treasureRootReceipt','actual-client-offer','actual-client-run',gamePublicKey,playerPublicKey])assert.equal(JSON.stringify(body).includes(value),false);
}
async function replay(f:Awaited<ReturnType<typeof fixture>>,call:Call,body=call.body){return f.send(call.path,body,call.authorization,call.grant);}
async function authorize(f:Awaited<ReturnType<typeof fixture>>,request:any){
 const last=f.calls.filter(call=>call.path===(f.owner?'owner/authorize':'payment/authorize')).at(-1)!;
 return f.send(last.path,{...last.body,request},last.authorization);
}

for(const owner of [false,true])test(`real hosted ${owner?'owner':'Player-proof'} V3 client preserves original root authority and completes operator checkpoint after deadline`,async t=>{
 t.after(()=>configureBisServer({}));const f=await fixture(owner),signedRoot=await f.identity.sign(f.pair.arkTx,[0]);verifyTapscriptSignatures(signedRoot,0,[gameKey]);
 assert.equal(f.context.treasure?.terms.emulator,TREASURE_EMULATOR.key.slice(2));assert.equal(f.pair.arkTx.getOutput(0).amount,1000n);
 const active=f.payment.active!;assert.equal(active.treasureRootId,f.pair.arkTx.id);assert.equal(typeof active.treasureRootReceipt,'string');assert.ok(active.treasureRootReceipt!.includes('.'));
 assert.equal(JSON.stringify(f.account).includes('treasureRootReceipt'),false);assert.equal('phrase' in f.account,false);
 const planCall=f.calls.find(call=>call.path.endsWith('/plan'))!,rootCall=f.calls.find(call=>call.path==='sign')!;
 const originalRequest=active.treasureRootRequest!;assert.equal(originalRequest.id,rootCall.body.id);assert.equal(originalRequest.transactionId,f.pair.arkTx.id);assert.equal(originalRequest.argsJson,JSON.stringify(rootCall.body.args));assert.equal(originalRequest.authority,owner?'owner':'player-proof');
 assert.deepEqual(planCall.body.contract,serverContractRequest(f.contract));assert.equal(planCall.body.contractPlayerPublicKey,owner?playerPublicKey:undefined);
 assert.equal(planCall.body.request.id,rootCall.body.id);assert.deepEqual(planCall.body.request.args,rootCall.body.args);assert.equal(rootCall.body.treasureRootReceipt,undefined);assert.equal(rootCall.response.treasureRootReceipt,active.treasureRootReceipt);
 assert.equal(f.proofCalls(),owner?0:1);assert.equal(f.calls.filter(call=>call.path==='player/challenge').length,owner?0:1);assert.equal(f.calls.filter(call=>call.path==='player/authenticate').length,owner?0:1);
 assert.equal(f.contextReads(),1);assert.equal(f.acquired(),1);assert.equal(f.completions.length,1);
 // Complete the real SDK operator signature before the client asks for its
 // original Game checkpoint signature. No submit/finalize/provider is simulated.
 const operatorCheckpoint=await operator.sign(f.pair.checkpoints[0],[0]);verifyTapscriptSignatures(operatorCheckpoint,0,[operatorKey]);
 f.clock(f.deadlineMs+1);assert.equal((await f.reconnect()).status,'connected');
 const refreshedConnection=f.calls.filter(call=>call.path==='connect').at(-1)!.response.token;assert.notEqual(refreshedConnection,originalRequest.connectionToken);
 const signedCheckpoint=await f.identity.sign(operatorCheckpoint,[0]);verifyTapscriptSignatures(signedCheckpoint,0,[gameKey,operatorKey]);
 const checkpointCall=f.calls.filter(call=>call.path==='sign').at(-1)!;assert.equal(checkpointCall.body.treasureRootReceipt,active.treasureRootReceipt);assert.equal(checkpointCall.response.treasureRootReceipt,undefined);
 assert.equal(owner?checkpointCall.body.connectionToken:checkpointCall.authorization,owner?originalRequest.connectionToken:'Bearer '+originalRequest.connectionToken);
 const checkpointAuthorization=f.calls.filter(call=>call.path.endsWith('/authorize')).at(-1)!;assert.equal(checkpointAuthorization.body.request.treasureRootReceipt,active.treasureRootReceipt);assert.equal(f.calls.filter(call=>call.path.endsWith('/plan')).length,1);assert.equal(f.contextReads(),1);
 assert.equal(f.proofCalls(),owner?0:2);assert.equal(f.acquired(),2);assert.equal(f.completions.length,2);assert.equal(new Set(f.claims.map(claim=>claim.operationId)).size,1);assert.ok(f.claims.every(claim=>claim.exposureId===f.pair.arkTx.id&&claim.exposureSats===1000));
 // Both exact HTTP replay and the repaired client retry reuse the original root
 // request and connection. Refreshing the probe cannot migrate that authority.
 const renewed=await authorize(f,rootCall.body);assert.equal(renewed.status,200);const renewedGrant=(await renewed.json()).grant;
 const exact=await f.send('sign',rootCall.body,rootCall.authorization,renewedGrant);assert.equal(exact.status,200);assert.deepEqual(await exact.json(),rootCall.response);assert.equal(f.acquired(),2);assert.equal(f.completions.length,2);
 const rootRetry=await f.identity.sign(f.pair.arkTx,[0]);verifyTapscriptSignatures(rootRetry,0,[gameKey]);assert.equal(f.acquired(),2);assert.equal(f.completions.length,2);
 const retriedCall=f.calls.filter(call=>call.path==='sign').at(-1)!;assert.equal(retriedCall.body.id,originalRequest.id);assert.deepEqual(retriedCall.body.args,rootCall.body.args);assert.equal(retriedCall.body.treasureRootReceipt,undefined);assert.deepEqual(retriedCall.response,rootCall.response);
 let before=f.calls.length;await assert.rejects(f.identity.sign(f.pair.arkTx),/arguments changed/);assert.equal(f.calls.length,before);
 await assert.rejects(f.identity.sign(signedRoot,[0]),/arguments changed/);assert.equal(f.calls.length,before);
 const changedId=await authorize(f,{...rootCall.body,id:crypto.randomUUID()});denied(changedId,await changedId.json());
 const changedArgs=await authorize(f,{...rootCall.body,args:encodeSigningValue([signedRoot,[0]])});denied(changedArgs,await changedArgs.json());
 const changedScope=await authorize(f,{...rootCall.body,operationId:'different-operation'});denied(changedScope,await changedScope.json());
 const tampered=f.pair.checkpoints[0].clone();tampered.updateOutput(0,{amount:999n});await assert.rejects(f.identity.sign(await operator.sign(tampered,[0]),[0]),/authorization/);assert.equal(f.acquired(),2);
 const changedIntent=await replay(f,planCall,{...planCall.body,contract:{...planCall.body.contract,hostReference:'changed-host-reference'}});denied(changedIntent,await changedIntent.json());
 const changedRequest={...checkpointCall.body,untrustedExtra:'changed-but-bound-digest'},changedGrant=await authorize(f,changedRequest);assert.equal(changedGrant.status,200);
 const changedReplay=await f.send('sign',changedRequest,checkpointCall.authorization,(await changedGrant.json()).grant);denied(changedReplay,await changedReplay.json());assert.equal(f.acquired(),2);
 // A new plan after expiry fails; the old root receipt cannot create fresh root authority.
 const freshPlan=await replay(f,planCall,{...planCall.body,request:{...planCall.body.request,id:crypto.randomUUID()}});denied(freshPlan,await freshPlan.json());
 // A credential-mode change is rejected in the private lease before transport.
 f.authority(!owner);if(!owner)assert.equal((await f.reconnect()).status,'connected');before=f.calls.length;
 await assert.rejects(f.identity.sign(f.pair.arkTx,[0]),/authority changed/);await assert.rejects(f.identity.sign(operatorCheckpoint,[0]),/authority changed/);assert.equal(f.calls.length,before);
 f.authority(owner);assert.equal((await f.reconnect()).status,'connected');
 const connection=f.calls.find(call=>call.path==='connect')!.response.token,connectionScope=JSON.parse(Buffer.from(connection.split('.')[0],'base64url').toString('utf8'));
 const latestConnection=f.calls.filter(call=>call.path==='connect').at(-1)!.response.token,latestScope=JSON.parse(Buffer.from(latestConnection.split('.')[0],'base64url').toString('utf8'));assert.ok(latestScope.expires>connectionScope.expires+1);
 assert.equal(connectionScope.expires>=f.initialClock+600000,true);f.clock(connectionScope.expires+1);await assert.rejects(f.identity.sign(operatorCheckpoint,[0]),/authorization/);assert.equal(f.acquired(),2);
 for(const call of f.calls){const wire=JSON.stringify(call.body);for(const phrase of phrases)assert.equal(wire.includes(phrase),false);}
 assert.equal(f.calls.filter(call=>call.path==='sign').every(call=>call.authorization?.startsWith('Bearer ')),true);
 // Receipt/plan retention here is the actual private in-memory payment lease.
 // There is no persistence callback in this API, so this test proves no restart recovery.
});
test('lost hosted root acknowledgement recovers through the exact active-lease client retry without another signature',async t=>{
 t.after(()=>configureBisServer({}));const f=await fixture(false,true);
 await assert.rejects(f.identity.sign(f.pair.arkTx,[0]),/Synthetic lost root acknowledgement/);assert.equal(f.acquired(),1);assert.equal(f.completions.length,1);
 assert.equal(typeof f.payment.active!.plan,'string');assert.equal(f.payment.active!.treasureRootReceipt,undefined);assert.equal(f.payment.active!.treasureRootId,undefined);
 const original=f.calls.find(call=>call.path==='sign')!;assert.equal(original.status,200);assert.equal(typeof original.response.treasureRootReceipt,'string');
 const rootRequest=f.payment.active!.treasureRootRequest!;assert.equal(rootRequest.id,original.body.id);assert.equal(rootRequest.argsJson,JSON.stringify(original.body.args));
 let before=f.calls.length;await assert.rejects(f.identity.sign(f.pair.checkpoints[0],[0]),/root signing result is unresolved/);assert.equal(f.calls.length,before);
 await assert.rejects(f.identity.sign(f.pair.arkTx),/arguments changed/);assert.equal(f.calls.length,before);
 f.clock(f.deadlineMs+1);const recovered=await f.identity.sign(f.pair.arkTx,[0]);verifyTapscriptSignatures(recovered,0,[gameKey]);assert.equal(f.acquired(),1);assert.equal(f.completions.length,1);
 const retry=f.calls.filter(call=>call.path==='sign').at(-1)!;assert.equal(retry.body.id,original.body.id);assert.deepEqual(retry.body.args,original.body.args);assert.deepEqual(retry.response,original.response);
 assert.equal(f.payment.active!.treasureRootReceipt,original.response.treasureRootReceipt);assert.equal(f.payment.active!.treasureRootId,f.pair.arkTx.id);
 const cp=await f.identity.sign(await operator.sign(f.pair.checkpoints[0],[0]),[0]);verifyTapscriptSignatures(cp,0,[gameKey,operatorKey]);assert.equal(f.acquired(),2);assert.equal(f.completions.length,2);
 // The real private active lease retains these values; this API still provides
 // no durable persistence callback and this test proves no browser restart recovery.
});
