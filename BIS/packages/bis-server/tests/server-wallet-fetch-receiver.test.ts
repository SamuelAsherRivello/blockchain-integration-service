import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SingleKey,Transaction} from '@arkade-os/sdk';
import {configureBisServer,probeGameSigner,remoteSigningIdentity,type ServerSigningOperation} from '../../integration/src/client/wallet-layer-arkade/server-wallet.ts';

// Deterministic transport regression only. No live service, registered wallet,
// signature or provider submission is used. The real client encodes its plan.
const key=SingleKey.fromHex('1'.padStart(64,'0')),publicKey=Buffer.from(await key.compressedPublicKey()).toString('hex'),profileId=createHash('sha256').update(Buffer.from(publicKey,'hex')).digest('hex');
for(const transportKind of ['default','explicit-native','arrow'] as const)test(`${transportKind} fetch keeps its browser receiver after the connection is stored`,async t=>{
 configureBisServer({});t.after(()=>configureBisServer({}));
 const paths:string[]=[],stop=Error('Stopped before settlement-plan dispatch');
 t.mock.method(globalThis,'fetch',async function(this:unknown,input:RequestInfo|URL){
  // Browser Window.fetch accepts a direct call or the Window receiver. Calling
  // it as connection.fetcher(...) is rejected before it can send any request.
  if(this!==undefined&&this!==globalThis)throw TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
  const path=new URL(input instanceof Request?input.url:String(input)).pathname;paths.push(path);
  if(path==='/api/bis/connect')return Response.json({protocol:1,runtime:'vercel',network:'signet',gameId:'stealth-and-steel',profileId,publicKey,token:'fixture-connection',capabilities:['sign','signMessage','signerSession']});
  if(path==='/api/bis/settlement/plan')throw stop;
  throw Error('Unexpected transport request');
 });
 const fetcher=transportKind==='default'?undefined:transportKind==='explicit-native'?fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,init);
 const probe=await probeGameSigner('signet',{endpoint:'https://fetch-receiver.test/api/bis/',profileId,...(fetcher?{fetcher}:{})});
 assert.equal(probe.status,'connected');if(probe.status!=='connected')throw Error('Fixture connection unavailable');
 const proof=new Transaction();proof.addInput({txid:'a'.repeat(64),index:1});proof.addOutput({amount:1000n,script:Uint8Array.from([0x51,0x20,...new Uint8Array(32).fill(1)])});
 const operation:ServerSigningOperation={id:'fixture-operation',signal:new AbortController().signal,playerProof:async()=>({token:'fixture-player-authority',expires:Date.now()+600000,playerPublicKey:publicKey}),settlement:{active:{outpoints:[{txid:'a'.repeat(64),vout:1}],registerProof:proof}}};
 await assert.rejects(remoteSigningIdentity(probe.account,()=>operation).signerSession().getPublicKey(),error=>error===stop);
 assert.deepEqual(paths,['/api/bis/connect','/api/bis/settlement/plan']);
});
