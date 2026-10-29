import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Transaction } from '@arkade-os/sdk';
import { createHostedHandler } from '../src/server/hosted.ts';
import { signingDigest } from '../src/server/signing-authorization.ts';
import { encodeSigningValue } from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { configureBisServer, finalizeServerArkadeTransaction, probeGameSigner, submitServerArkadeTransaction, type ServerSigningOperation } from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import type { ArkadeSubmissionKey, ArkadeSubmissionStore } from '../src/server/arkade-submission-store.ts';
import type { SigningStore } from '../src/server/signing-store.ts';

const phrase='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
function signedFixture(seed:number){
  const original=new Transaction({version:2});original.addInput({txid:seed.toString(16).padStart(2,'0').repeat(32),index:0,witnessUtxo:{script:Uint8Array.of(0x51),amount:1200n}});
  original.addOutput({script:Uint8Array.of(0x51),amount:1000n});const signed=Transaction.fromPSBT(original.toPSBT());signed.updateInput(0,{tapKeySig:new Uint8Array(64).fill(seed)});
  return {original,signed,encoded:Buffer.from(signed.toPSBT()).toString('base64')};
}
function submissionStore():ArkadeSubmissionStore{
  const rows=new Map<string,{digest:string;owner:string;status:'pending'|'completed';result?:unknown}>(),key=(i:Pick<ArkadeSubmissionKey,'stage'|'scope'|'operationId'|'transactionId'>)=>JSON.stringify([i.stage,i.scope,i.operationId,i.transactionId]);
  return{
    async claim(input){const id=key(input),prior=rows.get(id);if(prior){if(prior.digest!==input.digest)return{status:'conflict'} as const;if(prior.status==='pending')return{status:'pending'} as const;return{status:'replay',result:prior.result} as const;}const owner=randomUUID();rows.set(id,{digest:input.digest,owner,status:'pending'});return{status:'acquired',owner} as const;},
    async complete(input,owner,result){const row=rows.get(key(input));if(!row||row.owner!==owner||row.status!=='pending'||row.digest!==input.digest)return false;row.status='completed';row.result=result;return true;},
    async read(input){const row=rows.get(key(input));if(!row)return{status:'missing'} as const;if(row.status==='pending')return{status:'pending'} as const;return{status:'completed',digest:row.digest,result:row.result} as const;},
  };
}

test('hosted Signet write accepts only completed exact signatures and journals one upstream attempt through replay and timeout',async()=>{
  const secret='hosted-signet-write-test-owner-'.repeat(2);
  const completed=new Map<string,unknown>(),claims:SigningStore={
    async readCompleted(i){return completed.get(`${i.scope}:${i.id}:${i.digest}`)?{status:'completed',result:completed.get(`${i.scope}:${i.id}:${i.digest}`)}:{status:'missing'};},
    async consumePublicRequest(){},async ping(){},async assetAllowed(){return false;},async claim(){throw Error('unexpected signing claim');},async complete(){throw Error('unexpected signing completion');},async session(){return null;},
  };
  let calls=0,timeoutNext=false;
  const env={BIS_GAME_WALLET_SIGNET_01_MNEMONIC:phrase,BIS_OWNER_TOKEN:secret,BIS_PUBLIC_PAYMENT_SIGNING:'true',BIS_PUBLIC_SIGNING_NETWORKS:'signet'};
  const handler=createHostedHandler({env,store:claims,submissionStore:submissionStore(),arkadeFetch:async(input,init)=>{
    calls++;const url=String(input);assert.equal(init?.method,'POST');
    if(url==='https://signet.arkade.sh/v1/tx/finalize')return new Response(null,{status:204});
    assert.equal(url,'https://signet.arkade.sh/v1/tx/submit');
    if(timeoutNext){timeoutNext=false;throw Error('synthetic upstream timeout');}
    const body=JSON.parse(String(init?.body));const submitted=Transaction.fromPSBT(Buffer.from(body.signedArkTx,'base64'));
    return Response.json({arkTxid:submitted.id,finalArkTx:body.signedArkTx,signedCheckpointTxs:body.checkpointTxs});
  }});
  const post=(path:string,body:unknown,headers:Record<string,string>={})=>handler(new Request(`https://bis.example/api/bis/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
  const connected=await(await post('connect',{network:'signet',gameId:'stealth-and-steel'},{Authorization:`Bearer ${secret}`})).json();
  const bind=(fixture:ReturnType<typeof signedFixture>,id:string,operationId:string)=>{
    const request={id,operationId,network:'signet',profileId:connected.profileId,method:'sign',args:encodeSigningValue([fixture.original,[0]])};
    completed.set(`stealth-and-steel:signet:${connected.profileId}:${id}:${signingDigest(request)}`,encodeSigningValue(fixture.signed));
    return{request,connectionToken:connected.token};
  };
  const first=signedFixture(0x31),authorization=bind(first,'write-sign-1','write-operation-1'),submission={operationId:'write-operation-1',signedArkTx:first.encoded,checkpointTxs:[],authorizations:[authorization]};
  assert.equal((await post('arkade/signet/v1/tx/submit',{...submission,authorizations:[]})).status,403,'missing grant');
  assert.equal((await post('arkade/signet/v1/tx/submit',{...submission,authorizations:[{...authorization,request:{...authorization.request,network:'mutinynet'}}]})).status,403,'wrong network');
  assert.equal((await post('arkade/signet/v1/tx/submit',{...submission,authorizations:[{...authorization,connectionToken:'wrong-connection-token'}]})).status,403,'wrong wallet session');
  const changed=Transaction.fromPSBT(first.original.toPSBT());changed.addOutput({script:Uint8Array.of(0x51),amount:1n});
  assert.equal((await post('arkade/signet/v1/tx/submit',{...submission,signedArkTx:Buffer.from(changed.toPSBT()).toString('base64')})).status,403,'altered transaction');
  assert.equal(calls,0);
  const response=await post('arkade/signet/v1/tx/submit',submission),receipt=await response.json();assert.equal(response.status,200);assert.equal(receipt.arkTxid,first.original.id);assert.equal(calls,1);
  assert.deepEqual(await(await post('arkade/signet/v1/tx/submit',submission)).json(),receipt,'same operation returns exact durable receipt');assert.equal(calls,1,'same request is never broadcast twice');
  const finalize={...submission,arkTxid:receipt.arkTxid,signedArkTx:first.encoded,finalCheckpointTxs:[]};
  assert.equal((await post('arkade/signet/v1/tx/finalize',finalize)).status,204);assert.equal(calls,2);
  assert.equal((await post('arkade/signet/v1/tx/finalize',finalize)).status,204);assert.equal(calls,2,'finalization exact replay is idempotent');
  const second=signedFixture(0x32),secondAuth=bind(second,'write-sign-2','write-operation-2'),secondSubmission={operationId:'write-operation-2',signedArkTx:second.encoded,checkpointTxs:[],authorizations:[secondAuth]};
  timeoutNext=true;assert.equal((await post('arkade/signet/v1/tx/submit',secondSubmission)).status,503);assert.equal(calls,3);
  assert.equal((await post('arkade/signet/v1/tx/submit',secondSubmission)).status,409);assert.equal(calls,3,'unknown upstream result remains pending and is not retried');
});

test('the remote client reaches hosted submit and finalize only after recording the completed server signature',async t=>{
  t.after(()=>configureBisServer({}));
  const secret='hosted-signet-client-write-test-owner-'.repeat(2),completed=new Map<string,unknown>(),submission=submissionStore();
  const store:SigningStore={
    async readCompleted(input){const result=completed.get(`${input.scope}:${input.id}:${input.digest}`);return result===undefined?{status:'missing'}:{status:'completed',result};},
    async consumePublicRequest(){},async ping(){},async assetAllowed(){return false;},
    async claim(input){return{status:'acquired',owner:input.id};},
    async complete(input,_owner,result){completed.set(`${input.scope}:${input.id}:${input.digest}`,result);},
    async session(){return null;},
  };
  const env={BIS_GAME_WALLET_SIGNET_01_MNEMONIC:phrase,BIS_OWNER_TOKEN:secret,BIS_PUBLIC_PAYMENT_SIGNING:'true',BIS_PUBLIC_SIGNING_NETWORKS:'signet',BIS_SIGNING_OPERATION_CAP_SATS:'5000',BIS_SIGNING_DAILY_CAP_SATS:'10000'};
  const upstream:string[]=[],handler=createHostedHandler({env,store,submissionStore:submission,arkadeFetch:async(input,init)=>{
    const url=String(input);upstream.push(url);assert.equal(init?.method,'POST');
    if(url==='https://signet.arkade.sh/v1/tx/finalize')return new Response(null,{status:204});
    assert.equal(url,'https://signet.arkade.sh/v1/tx/submit');const body=JSON.parse(String(init?.body));
    const tx=Transaction.fromPSBT(Buffer.from(body.signedArkTx,'base64'));
    return Response.json({arkTxid:tx.id,finalArkTx:body.signedArkTx,signedCheckpointTxs:body.checkpointTxs});
  }});
  const clientPaths:string[]=[],clientFailures:string[]=[];let connectionToken='';
  const clientFetch:typeof fetch=async(input,init)=>{const path=new URL(String(input)).pathname;clientPaths.push(path);const response=await handler(new Request(String(input),init));
    if(path.endsWith('/connect')&&response.ok)connectionToken=(await response.clone().json()).token;
    if(!response.ok)clientFailures.push(`${path}:${response.status}:${await response.clone().text()}`);return response;};
  configureBisServer({});
  const probe=await probeGameSigner('signet',{endpoint:'https://bis.example/api/bis/',fetcher:clientFetch});
  assert.equal(probe.status,'connected');if(probe.status!=='connected')throw Error(probe.message);
  const operation:ServerSigningOperation={id:'client-submit-operation',submission:{authorizations:[]}},original=new Transaction({version:2}),checkpoint=new Transaction({version:2});
  original.addInput({txid:'42'.repeat(32),index:1,witnessUtxo:{script:Uint8Array.of(0x51),amount:1200n}});original.addOutput({script:Uint8Array.of(0x51),amount:1000n});
  checkpoint.addInput({txid:'43'.repeat(32),index:1,witnessUtxo:{script:Uint8Array.of(0x51),amount:1100n}});checkpoint.addOutput({script:Uint8Array.of(0x51),amount:900n});
  const signed=Transaction.fromPSBT(original.toPSBT());signed.updateInput(0,{tapKeySig:new Uint8Array(64).fill(0x71)});
  const checkpointOperator=Transaction.fromPSBT(checkpoint.toPSBT());checkpointOperator.updateInput(0,{tapKeySig:new Uint8Array(64).fill(0x72)});
  const checkpointPlayer=Transaction.fromPSBT(checkpointOperator.toPSBT());checkpointPlayer.updateInput(0,{tapScriptSig:[[{pubKey:new Uint8Array(32).fill(0x73),leafHash:new Uint8Array(32).fill(0x74)},new Uint8Array(64).fill(0x75)]]});
  const bind=(id:string,transaction:Transaction,result:Transaction)=>{
    const request={id,operationId:operation.id,network:'signet',profileId:probe.account.profileId,method:'sign',args:encodeSigningValue([transaction,[0]])};
    completed.set(`stealth-and-steel:signet:${probe.account.profileId}:${request.id}:${signingDigest(request)}`,encodeSigningValue(result));
    return{request,connectionToken};
  };
  const rootAuthorization=bind('client-submit-root-sign-request',original,signed),operatorAuthorization=bind('client-submit-checkpoint-operator-request',checkpoint,checkpointOperator),
    playerAuthorization=bind('client-submit-checkpoint-player-request',checkpoint,checkpointPlayer);
  operation.submission!.authorizations.push(rootAuthorization,operatorAuthorization);
  assert.ok(connectionToken);assert.equal(operation.submission?.authorizations.length,2,'the completed Signet root and checkpoint requests are retained');
  const signedArkTx=Buffer.from(signed.toPSBT()).toString('base64');
  const checkpointTx=Buffer.from(checkpointOperator.toPSBT()).toString('base64'),receipt=await submitServerArkadeTransaction(probe.account,operation,signedArkTx,[checkpointTx]);
  assert.equal(receipt.arkTxid,original.id);assert.deepEqual(upstream,['https://signet.arkade.sh/v1/tx/submit']);
  operation.submission!.authorizations.push(playerAuthorization);
  const finalCheckpoint=Buffer.from(checkpointPlayer.toPSBT()).toString('base64');
  const unapproved=Transaction.fromPSBT(checkpointPlayer.toPSBT());unapproved.updateInput(0,{partialSig:[[Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex'),new Uint8Array(64).fill(0x76)]]});
  await assert.rejects(()=>finalizeServerArkadeTransaction(probe.account,operation,receipt.arkTxid,[Buffer.from(unapproved.toPSBT()).toString('base64')]),/Original Signet submit outcome is unavailable/);
  assert.deepEqual(upstream,['https://signet.arkade.sh/v1/tx/submit'],'unreceipted final checkpoint signature is rejected before upstream finalization');
  await finalizeServerArkadeTransaction(probe.account,operation,receipt.arkTxid,[finalCheckpoint]);
  assert.deepEqual(upstream,['https://signet.arkade.sh/v1/tx/submit','https://signet.arkade.sh/v1/tx/finalize']);
  assert.ok(clientPaths.includes('/api/bis/arkade/signet/v1/tx/submit'));assert.ok(clientPaths.includes('/api/bis/arkade/signet/v1/tx/finalize'));
});
