import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ArkAddress,Wallet,networks} from '@arkade-os/sdk';
import {bech32m} from '@scure/base';
import {captureSdkSettlementFailures,safeSettlementFailure,type ClientSettlementFailure} from '../scripts/funded-workflow-client-diagnostics.ts';

test('actual pinned SDK settle preserves its original pre-sign error and captures only safe evidence',async()=>{
 const secret='PRIVATE_SENTINEL',error=new TypeError(secret),captures:ClientSettlementFailure[]=[];
 const point=Uint8Array.from(Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex')),address=new ArkAddress(point,point,'tark').encode(),bitcoin=bech32m.encode('tb',[1,...bech32m.toWords(point)]);
 let sessionReads=0,submissions=0;
 const wallet:any={network:networks.signet,getAddress:async()=>address,logUngatedInputs:async()=>{},recipientAddressContext:()=>({hrp:'tark',signerSet:{active:Buffer.from(point).toString('hex'),deprecated:[]}}),identity:{signerSession:()=>({getPublicKey:async()=>{sessionReads++;throw error;}})},_withTxLock:(work:()=>unknown)=>work(),_settleImpl:(Wallet.prototype as any)._settleImpl,settle:Wallet.prototype.settle,arkProvider:{registerIntent:async()=>{submissions++;throw Error('Unexpected provider mutation');}}};
 const owner={sign:async(_role:string,_account:unknown,signal:AbortSignal,use:(wallet:any,active:AbortSignal)=>Promise<unknown>)=>use(wallet,signal)},originalSign=owner.sign;
 const originalSettle=wallet.settle,restore=captureSdkSettlementFailures(owner,{profileId:'assigned',network:'signet'},failure=>captures.push(failure));
 try{
  await assert.rejects(owner.sign('game',{profileId:'assigned',network:'signet'},new AbortController().signal,w=>w.settle({inputs:[{txid:'a'.repeat(64),vout:1,value:10000,status:{confirmed:true}}],outputs:[{address,amount:1000n},{address:bitcoin,amount:9000n}]})),value=>value===error);
  assert.equal(sessionReads,1);assert.equal(submissions,0);assert.equal(captures.length,1);
  assert.equal(captures[0].name,'TypeError');assert.equal(captures[0].messageSha256,createHash('sha256').update(secret).digest('hex'));assert.ok(!JSON.stringify(captures).includes(secret));
  assert.equal(wallet.settle,originalSettle);
 }finally{restore();}
 assert.equal(owner.sign,originalSign);
});

test('unrelated role bypasses capture and a failing diagnostic callback cannot replace a sender error',async()=>{
 const error=Error('PRIVATE_SENTINEL'),wallet={settle:async()=>{throw error;}},owner={sign:async(_role:string,_account:unknown,signal:AbortSignal,use:(resource:typeof wallet,signal:AbortSignal)=>Promise<unknown>)=>use(wallet,signal)};
 let captures=0;const restore=captureSdkSettlementFailures(owner,{profileId:'assigned',network:'signet'},()=>{captures++;throw Error('Collector failed');});
 try{
  for(const [role,profileId,expected] of [['player','assigned',0],['game','other',0],['game','assigned',1]] as const){await assert.rejects(owner.sign(role,{profileId,network:'signet'},new AbortController().signal,w=>w.settle()),value=>value===error);assert.equal(captures,expected);}
 }finally{restore();}
});

test('diagnostic evidence bounds text and extracts only source paths without URL credentials or queries',async()=>{
 const error={name:'PRIVATE_NAME',message:'x'.repeat(20000),stack:'PRIVATE_MESSAGE\n at https://user:PRIVATE_PASSWORD@example.test/BIS/packages/integration/src/client/example.ts:12:3?token=PRIVATE_TOKEN\n at D:/private/PRIVATE_FILE:1:2\n at unrelated PRIVATE_SENTINEL'};
 const safe=await safeSettlementFailure(error);assert.equal(safe.name,'other');assert.equal(safe.messageTruncated,true);assert.deepEqual(safe.sourceFrames,['/BIS/packages/integration/src/client/example.ts:12:3']);assert.ok(!JSON.stringify(safe).includes('PRIVATE_'));
});
