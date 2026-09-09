import test from 'node:test';import assert from 'node:assert/strict';
import {onboardingStream} from '../src/core/onboarding-stream.ts';
test('unrelated failures and other batch tree traffic never reach the SDK',async()=>{
 let cleaned=false;const rows=[{id:'old',type:'batch_failed'},{id:'mine',type:'batch_started',intentIdHashes:['hash']},{id:'other',type:'tree_tx'},{id:'other',type:'batch_failed'},{id:'mine',type:'batch_failed'}],seen=[];
 const stream=onboardingStream(async function*(){try{yield* rows;}finally{cleaned=true;}},new AbortController().signal,()=> 'hash',1000,2000,()=>{});
 for await(const e of stream)seen.push(e);assert.deepEqual(seen,[rows[1],rows[4]]);assert.ok(cleaned);
});
test('registration after stream priming still selects the batch and deduplicates progress',async()=>{
 let hash,progress=0;const row={id:'mine',type:'batch_started',intentIdHashes:['hash']};
 const stream=onboardingStream(async function*(){yield row;yield row;yield {id:'mine',type:'batch_finalization'};},new AbortController().signal,()=>hash,1000,2000,()=>progress++);
 await stream.next();hash='hash';await stream.next();await stream.next();await stream.next();assert.equal(progress,2);
});
test('unrelated traffic cannot postpone a stall and timeout aborts the actual source before cleanup',async()=>{
 let aborted=false,cleaned=false;const stream=onboardingStream(signal=>({async next(){await new Promise(r=>{const timer=setTimeout(r,5);signal.addEventListener('abort',()=>{clearTimeout(timer);aborted=true;r();},{once:true});});return signal.aborted?{done:true}:{value:{id:'other',type:'batch_failed'},done:false};},async return(){assert.ok(signal.aborted);cleaned=true;return {done:true};},[Symbol.asyncIterator](){return this;}}),new AbortController().signal,()=> 'hash',25,100,()=>{});
 await assert.rejects(stream.next(),/deadline/);assert.ok(aborted&&cleaned);
});
test('repeated matching selection cannot renew the watchdog indefinitely',async()=>{
 const row={id:'mine',type:'batch_started',intentIdHashes:['hash']};let progress=0;
 const stream=onboardingStream(async function*(signal){while(!signal.aborted){await new Promise(r=>setTimeout(r,5));yield row;}},new AbortController().signal,()=> 'hash',25,150,()=>progress++);
 await assert.rejects(async()=>{for await(const _ of stream){}},/deadline/);assert.equal(progress,1);
});
