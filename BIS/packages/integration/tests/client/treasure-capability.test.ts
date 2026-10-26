import test from 'node:test';
import assert from 'node:assert/strict';
import {TREASURE_EMULATOR,treasureCoSignerAvailable} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';

test('treasure preflight performs only a bounded uncached read against the pinned service',async()=>{
  let reads=0;
  const send:typeof fetch=async(input,init)=>{
    reads++;
    assert.equal(input,`${TREASURE_EMULATOR.url}/v1/info`);
    assert.equal(init?.method,undefined);
    assert.equal(init?.cache,'no-store');
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(init.signal.aborted,false);
    return Response.json({signerPubkey:TREASURE_EMULATOR.key});
  };
  assert.equal(await treasureCoSignerAvailable(send),true);
  assert.equal(reads,1);
});

test('unavailable, malformed or mismatched co-signer preflight never qualifies the stronger mode',async()=>{
  for(const response of [new Response('',{status:503}),Response.json(null),Response.json({signerPubkey:'02'+'00'.repeat(32)}),new Response('not json')]){
    assert.equal(await treasureCoSignerAvailable(async()=>response),false);
  }
  assert.equal(await treasureCoSignerAvailable(async()=>{throw Error('offline');}),false);
});

test('unresponsive preflight expires rather than blocking automatic selection indefinitely',async()=>{
  const keepAlive=setInterval(()=>{},100);
  try{
    assert.equal(await treasureCoSignerAvailable(async(_input,init)=>new Promise((_resolve,reject)=>{
      init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason),{once:true});
    })),false);
  }finally{clearInterval(keepAlive);}
});
