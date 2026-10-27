import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MnemonicIdentity,DefaultVtxo,CSVMultisigTapscript,Transaction,buildOffchainTx,verifyTapscriptSignatures,
  type ArkInfo,type VirtualCoin} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {createHostedHandler} from '../../src/server/hosted.ts';
import {readPaymentContext} from '../../src/server/payment-context.ts';
import {createRedisSigningStore,type SigningClaim,type SigningStore,type TreasureCheckpointClaim} from '../../src/server/signing-store.ts';
import {createWalletPool} from '../../src/server/wallet-pool.ts';
import {authenticatePlayerProof} from '../../../integration/src/client/wallet-layer-arkade/player-proof-client.ts';
import {serverContractRequest,type ServerWalletReference} from '../../../integration/src/client/wallet-layer-arkade/server-wallet.ts';
import {createTreasureServerTransport} from '../../../integration/src/client/wallet-layer-arkade/treasure-server-transport.ts';
import {createTreasureJournalSigner} from '../../../integration/src/client/wallet-layer-arkade/treasure-journal-signer.ts';
import {advanceTreasureServerJournal,createTreasureServerJournal,type TreasureServerJournal,type TreasureServerJournalBinding} from '../../../integration/src/client/wallet-layer-arkade/treasure-server-journal.ts';
import type {AppPlayerProof} from '../../../integration/src/client/wallet-layer-arkade/app-player-proof.ts';
import {decodeSigningValue} from '../../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {assertTreasureSignatureRetention} from '../../../integration/src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';
import {TREASURE_EMULATOR} from '../../../integration/src/client/wallet-layer-arkade/treasure-capability.ts';
import {startMiniredisBridge} from './miniredis-bridge.ts';

// Published test mnemonics and synthetic outpoints only. The real hosted
// handler, HMAC/Player proofs, client journal/transport, SDK signatures, and
// production Redis Lua run in-process against the closed miniredis bridge.
// There are no live providers, imported wallet credentials, funds, or deploys.
const phrases=[
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'legal winner thank year wave sausage worth useful legal winner thank yellow',
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
];
const [game,player,operator]=phrases.map(value=>MnemonicIdentity.fromMnemonic(value,{isMainnet:false}));
const [gamePublicKey,playerPublicKey,operatorPublicKey]=await Promise.all([game,player,operator].map(async identity=>
  hex.encode(await identity.compressedPublicKey())));
const [gameKey,playerKey,operatorKey]=await Promise.all([game,player,operator].map(async identity=>
  hex.encode(await identity.xOnlyPublicKey())));
const profileId=createHash('sha256').update(hex.decode(gamePublicKey)).digest('hex');
const gameWallet=new DefaultVtxo.Script({pubKey:hex.decode(gameKey),serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds',value:2048n}});
const playerWallet=new DefaultVtxo.Script({pubKey:hex.decode(playerKey),serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds',value:2048n}});
const unroll=CSVMultisigTapscript.encode({pubkeys:[hex.decode(operatorKey)],timelock:{type:'seconds',value:86_016n}});
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT());
const tokenPayload=(token:string)=>JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8')) as {expires:number};
type WireCall={path:string;body:Record<string,any>;authorization:string|null;status:number};

for(const authority of ['owner','player-proof'] as const)test(`hosted V4 ${authority} client signs a journaled ROOT and two exact CPs, then read-recovers a lost late CP reply`,async t=>{
  const bridge=await startMiniredisBridge(t);
  t.mock.method(globalThis,'fetch',bridge.transport);
  const nextUtcBoundary=new Date();nextUtcBoundary.setUTCHours(23,50,0,0);
  if(nextUtcBoundary.getTime()<=Date.now())nextUtcBoundary.setUTCDate(nextUtcBoundary.getUTCDate()+1);
  let clock=nextUtcBoundary.getTime();t.mock.method(Date,'now',()=>clock);
  const startedAtMs=clock-5000,gameId='stealth-and-steel',operationId=`journaled-v4-${authority}`,
    endpoint=`https://journaled-${authority}.example.test/api/bis/`,ownerToken='synthetic-v4-client-owner-token-'.repeat(2);
  const terms={network:'mutinynet' as const,offerSessionId:`offer-${authority}`,hostReference:`run-${authority}`,startedAtMs,
    player:playerKey,game:gameKey,operator:operatorKey,emulator:TREASURE_EMULATOR.key.slice(2),
    playerDestination:hex.encode(playerWallet.pkScript.slice(2)),gameDestination:hex.encode(gameWallet.pkScript.slice(2)),exitDelay:2048};
  const contract={artifactVersion:4 as const,kind:'fund' as const,branch:'fund' as const,
    offerSessionId:terms.offerSessionId,hostReference:terms.hostReference,startedAtMs,playerPublicKey};
  const sourceValues=[1500,700],prefix=authority==='owner'?'a':'b';
  const sources=sourceValues.map((amount,index)=>{
    const previous=new Transaction({version:3});
    previous.addInput({txid:`${prefix}${index+1}`.repeat(32),index,witnessUtxo:{script:gameWallet.pkScript,amount:BigInt(amount)}});
    previous.addOutput({script:gameWallet.pkScript,amount:BigInt(amount)});return previous;
  });
  const outpoints=sources.map(tx=>({txid:tx.id,vout:0}));
  const info={network:'mutinynet',signerPubkey:operatorPublicKey,forfeitPubkey:operatorPublicKey,unilateralExitDelay:2048n,
    checkpointTapscript:hex.encode(unroll.script),dust:330n,vtxoMinAmount:330n,vtxoMaxAmount:-1n,
    fees:{txFeeRate:'0',intentFee:{offchainInput:'amount*0.001'}}} as unknown as ArkInfo;
  const coins=sources.map((source,index)=>({txid:source.id,vout:0,value:sourceValues[index],script:hex.encode(gameWallet.pkScript),
    status:{confirmed:true},createdAt:new Date(),isSpent:false,isSwept:false,isPreconfirmed:false,spentBy:'',isUnrolled:false,
    expiresAt:new Date('2100-01-01T00:00:00.000Z'),virtualStatus:{state:'settled'},assets:[]} as unknown as VirtualCoin));
  const reader={info:async()=>info,coins:async(points:readonly {txid:string;vout:number}[])=>({
    vtxos:points.map(point=>coins.find(coin=>coin.txid===point.txid&&coin.vout===point.vout)).filter((coin):coin is VirtualCoin=>!!coin),
  })};
  const context=await readPaymentContext({network:'mutinynet',gamePublicKey,playerPublicKey, outpoints,maximumExposureSats:5000,
    signal:new AbortController().signal,contract:serverContractRequest(contract)},reader);
  const pair=buildOffchainTx([...context.inputs],[{script:context.recipientScript,amount:1000n},{script:context.changeScript,amount:1200n}],context.serverUnrollScript);
  assert.equal(pair.checkpoints.length,2);assert.equal(pair.arkTx.inputsLength,2);
  const sourceOutpoints=sources.map(source=>`${source.id}:0`),rootOutpoints=Array.from({length:pair.arkTx.inputsLength},(_,index)=>{
    const input=pair.arkTx.getInput(index);assert.ok(input.txid);assert.notEqual(input.index,undefined);
    assert.equal(hex.encode(input.txid!),pair.checkpoints[index].id,'ROOT consumes the canonical CP transaction');
    assert.equal(input.index,0,'ROOT consumes canonical CP output 0');
    const source=pair.checkpoints[index].getInput(0);assert.ok(source.txid);
    assert.equal(`${hex.encode(source.txid!)}:${source.index}`,sourceOutpoints[index],'each CP spends its own original source');
    return `${hex.encode(input.txid!)}:${input.index}`;
  });
  const binding:TreasureServerJournalBinding={artifactVersion:4,contractId:`contract-${authority}`,operationId,endpoint,gameId,
    network:'mutinynet',profileId,publicKey:gamePublicKey,authority,terms,checkpointTapscript:hex.encode(unroll.script),kind:'fund',
    original:{arkTx:encode(pair.arkTx),checkpoints:pair.checkpoints.map(encode)},sourceTransactions:sources.map(tx=>hex.encode(tx.toBytes(false,false)))};
  let journal:TreasureServerJournal=createTreasureServerJournal(binding);
  const productionStore=createRedisSigningStore({UPSTASH_REDIS_REST_URL:bridge.endpoint,UPSTASH_REDIS_REST_TOKEN:bridge.token,VERCEL_ENV:'preview'});
  const metrics={reads:[] as Array<{scope:string;id:string;digest:string}>,claims:[] as SigningClaim[],
    checkpointClaims:[] as TreasureCheckpointClaim[],completions:0,quotas:0};
  const store:SigningStore={...productionStore,
    async readCompleted(lookup){metrics.reads.push(structuredClone(lookup));return productionStore.readCompleted!(lookup);},
    async claim(claim){metrics.claims.push(structuredClone(claim));return productionStore.claim(claim);},
    async claimTreasureCheckpoint(claim){metrics.checkpointClaims.push(structuredClone(claim));return productionStore.claimTreasureCheckpoint!(claim);},
    async complete(claim,claimOwner,result){metrics.completions++;return productionStore.complete(claim,claimOwner,result);},
    async consumePublicRequest(scope,now,limits){metrics.quotas++;return productionStore.consumePublicRequest(scope,now,limits);},
  };
  const env={BIS_OWNER_TOKEN:ownerToken,BIS_GAME_ID:gameId,BIS_GAME_WALLET_MUTINYNET_01_MNEMONIC:phrases[0],
    BIS_PUBLIC_PAYMENT_SIGNING:'true',BIS_PUBLIC_SIGNING_NETWORKS:'mutinynet',BIS_PUBLIC_CONTRACT_SIGNING:'true',BIS_SIGNING_OPERATION_CAP_SATS:'5000',BIS_SIGNING_DAILY_CAP_SATS:'10000'};
  const handler=createHostedHandler({env,store,now:()=>clock,pool:createWalletPool(env),paymentContext:options=>readPaymentContext(options,reader)});
  const calls:WireCall[]=[],publicHeader=(connectionToken:string)=>({Authorization:`Bearer ${connectionToken}`});
  let connectionToken='';
  const connectResponse=await handler(new Request(endpoint+'connect',{method:'POST',headers:{'Content-Type':'application/json',
    ...(authority==='owner'?{Authorization:`Bearer ${ownerToken}`}:{})},body:JSON.stringify({network:'mutinynet',gameId})}));
  assert.equal(connectResponse.status,200,await connectResponse.clone().text());
  const connected=await connectResponse.json();connectionToken=connected.token;assert.equal(connected.profileId,profileId);
  const account:ServerWalletReference={profileId,network:'mutinynet',server:{endpoint,publicKey:gamePublicKey,gameId}};
  let loseNextCheckpointAck=false,lostCheckpointResponse:Record<string,any>|undefined;
  const fetcher:typeof fetch=async(url,init)=>{
    const request=new Request(url,init),parsed=new URL(request.url),path=parsed.pathname.slice(new URL(endpoint).pathname.length),body=JSON.parse(String(init?.body??'{}')) as Record<string,any>;
    assert.equal(parsed.origin,new URL(endpoint).origin);const response=await handler(request);
    calls.push({path,body:structuredClone(body),authorization:request.headers.get('authorization'),status:response.status});
    if(loseNextCheckpointAck&&path.endsWith('treasure/checkpoint/complete')&&response.ok){
      loseNextCheckpointAck=false;lostCheckpointResponse=await response.clone().json();
      throw Error('synthetic lost checkpoint completion acknowledgement');
    }
    return response;
  };
  const controller=new AbortController(),proofTokens:Array<{token:string;expires:number;playerPublicKey:string}>=[];
  const playerProof:AppPlayerProof=async options=>{
    const proof=await authenticatePlayerProof({endpoint,identity:player,binding:{gameId:options.account.server.gameId,
      network:options.account.network,profileId:options.account.profileId,operationId:options.operationId},
      signal:options.signal,fetcher:options.fetcher,now:()=>clock});
    proofTokens.push(proof);return proof;
  };
  const newSigner=()=>{
    const transport=createTreasureServerTransport({account,authority,connectionToken,ownerToken:()=>ownerToken,
      ...(authority==='player-proof'?{playerProof}:{}),fetcher,signal:controller.signal,isCurrent:()=>true,now:()=>clock,
      read:async()=>structuredClone(journal),commit:async(before,after)=>{
        assert.equal(JSON.stringify(journal),JSON.stringify(before),'journal compare-and-swap uses the exact encrypted-record predecessor');
        advanceTreasureServerJournal(before,after);journal=structuredClone(after);
      }});
    return createTreasureJournalSigner({read:async()=>structuredClone(journal),commit:async(before,after)=>{
      assert.equal(JSON.stringify(journal),JSON.stringify(before),'journal signer preserves compare-and-swap ancestry');
      advanceTreasureServerJournal(before,after);journal=structuredClone(after);
    },transport,isCurrent:()=>true,now:()=>clock});
  };
  const signer=newSigner(),rootResult=await signer.root(encode(pair.arkTx)),signedRoot=Transaction.fromPSBT(base64.decode(rootResult));
  for(let index=0;index<signedRoot.inputsLength;index++)verifyTapscriptSignatures(signedRoot,index,[gameKey]);
  assert.equal(metrics.claims.length,1);assert.equal(metrics.completions,1);
  assert.deepEqual([...metrics.claims[0].inputs].sort(),[...sourceOutpoints,...rootOutpoints].sort(),'ROOT reservation binds both original sources and canonical CP outpoints');
  const rootRequest=journal.requests.find(request=>request.purpose==='root')!;
  assert.equal(rootRequest.phase,'completed');assert.equal(rootRequest.connectionToken,connectionToken);
  const rootBody=JSON.parse(rootRequest.bodyJson!) as Record<string,any>,planKey=authority==='owner'?'ownerPlan':'paymentPlan';
  const rootPlanToken=rootBody[planKey] as string,planExpires=tokenPayload(rootPlanToken).expires,connectionExpires=tokenPayload(connectionToken).expires;
  assert.ok(planExpires<=clock+600000&&planExpires>clock);assert.ok(connectionExpires>clock);

  const checkpoint0Original=await operator.sign(pair.checkpoints[0],[0]),checkpoint0Bytes=encode(checkpoint0Original);
  const checkpoint0Result=await signer.checkpoint(checkpoint0Bytes,0),signedCheckpoint0=Transaction.fromPSBT(base64.decode(checkpoint0Result));
  verifyTapscriptSignatures(signedCheckpoint0,0,[gameKey,operatorKey]);
  assert.equal(metrics.checkpointClaims.length,1);assert.equal(metrics.completions,2);
  const checkpoint1Original=await operator.sign(pair.checkpoints[1],[0]),checkpoint1Bytes=encode(checkpoint1Original);
  const advanceTo=clock+600001;assert.ok(advanceTo>planExpires&&advanceTo>connectionExpires);
  clock=advanceTo;
  assert.notEqual(new Date(startedAtMs).toISOString().slice(0,10),new Date(clock).toISOString().slice(0,10),
    'the original operation and late checkpoint cross UTC midnight');
  const connectionBody=tokenPayload(connectionToken);assert.ok(clock>connectionBody.expires,'original Game connection is expired');
  assert.ok(clock>planExpires,'original plan is expired');
  loseNextCheckpointAck=true;
  await assert.rejects(signer.checkpoint(checkpoint1Bytes,1),/Original Treasure signing journal could not be reconciled/);
  assert.equal(loseNextCheckpointAck,false);assert.ok(lostCheckpointResponse);
  const pending=journal.requests.find(request=>request.purpose==='checkpoint'&&request.checkpointIndex===1)!;
  assert.equal(pending.phase,'sign-unknown','lost HTTP acknowledgement is durably quarantined');
  assert.equal(metrics.checkpointClaims.length,2);assert.equal(metrics.completions,3);
  assert.equal(metrics.checkpointClaims[1].parent.transactionId,pair.arkTx.id);
  assert.equal(metrics.claims[0].day,new Date(startedAtMs).toISOString().slice(0,10),'ROOT retains its original daily-cap bucket');
  assert.equal(metrics.checkpointClaims[1].checkpoint.day,new Date(clock).toISOString().slice(0,10),
    'the late checkpoint is separately accounted in its current daily-cap bucket');
  assert.deepEqual([...metrics.checkpointClaims[1].parent.inputs].sort(),[...sourceOutpoints,...rootOutpoints].sort());
  assert.deepEqual([...metrics.checkpointClaims[1].checkpoint.inputs].sort(),
    [...new Set([...sourceOutpoints,...rootOutpoints,sourceOutpoints[1]])].sort(),
    'late CP claim is idempotently bound to both ROOT sources, all ROOT outputs, and its own source');
  assert.deepEqual(metrics.checkpointClaims.map(claim=>`${claim.checkpointOutpoint.txid}:${claim.checkpointOutpoint.index}`).sort(),
    [`${pair.checkpoints[0].id}:0`,`${pair.checkpoints[1].id}:0`].sort(),'durable families bind both exact CP outputs under the same ROOT');
  const pendingBody=JSON.parse(pending.bodyJson!) as Record<string,any>;
  assert.equal(pendingBody[planKey],rootPlanToken,'late CP retains its original plan');
  assert.equal(pendingBody.connectionToken,connectionToken,'late CP retains its original connection');
  assert.equal(pendingBody.treasureRootReceipt,JSON.parse(rootRequest.responseJson!).treasureRootReceipt);
  if(authority==='player-proof'){
    assert.equal(proofTokens.length,3,'root and both checkpoint actions receive original Player proofs');
    assert.equal(proofTokens[2].playerPublicKey,playerPublicKey);
    assert.ok(proofTokens[2].expires>=clock+540000,'late CP receives a fresh Player proof');
    assert.notEqual(proofTokens[2].token,proofTokens[0].token);
    const completion=calls.filter(call=>call.path.endsWith('treasure/checkpoint/complete')).at(-1)!;
    assert.equal(completion.body.connectionToken,connectionToken);assert.equal(completion.body.playerToken,proofTokens[2].token);
  }else assert.equal(proofTokens.length,0,'owner authority does not acquire a public Player proof');

  const beforeRecovery={reads:metrics.reads.length,claims:metrics.claims.length,checkpointClaims:metrics.checkpointClaims.length,
    completions:metrics.completions,quotas:metrics.quotas,calls:calls.length};
  const restartedSigner=newSigner();assert.equal(await restartedSigner.recoverOutstanding(),true,'a fresh client instance reconstructs the saved result');
  assert.equal(metrics.reads.length,beforeRecovery.reads+1,'recovery performs one original completed-result read');
  assert.equal(metrics.claims.length,beforeRecovery.claims);assert.equal(metrics.checkpointClaims.length,beforeRecovery.checkpointClaims);
  assert.equal(metrics.completions,beforeRecovery.completions,'recovery cannot produce another Game signature');
  assert.equal(metrics.quotas,beforeRecovery.quotas,'read-only result recovery does not claim or reauthorize signing');
  assert.deepEqual(calls.slice(beforeRecovery.calls).map(call=>call.path),['treasure/recover'],'recovery issues only the read-only original-result route');
  const recoveredBytes=await restartedSigner.completed('checkpoint',1);assert.equal(typeof recoveredBytes,'string');
  const recoveredCheckpoint=Transaction.fromPSBT(base64.decode(recoveredBytes!));
  verifyTapscriptSignatures(recoveredCheckpoint,0,[gameKey,operatorKey]);
  assertTreasureSignatureRetention(checkpoint1Bytes,recoveredBytes!,recoveredCheckpoint.inputsLength,recoveredCheckpoint.outputsLength);
  const savedCheckpoint=decodeSigningValue(JSON.parse(journal.requests.find(request=>request.purpose==='checkpoint'&&request.checkpointIndex===1)!.responseJson!).result);
  assert.ok(savedCheckpoint&&typeof savedCheckpoint.toPSBT==='function');
  assert.deepEqual(Buffer.from(savedCheckpoint.toPSBT()),Buffer.from(recoveredCheckpoint.toPSBT()));
  const completedRoot=journal.requests.find(request=>request.purpose==='root')!,completedCheckpoint0=journal.requests.find(request=>request.purpose==='checkpoint'&&request.checkpointIndex===0)!;
  assert.equal(completedRoot.connectionToken,connectionToken);assert.equal(completedCheckpoint0.connectionToken,connectionToken);
  assert.equal(journal.requests.find(request=>request.purpose==='checkpoint'&&request.checkpointIndex===1)!.phase,'completed');
});
