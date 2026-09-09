import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('settlement failure retains its cause and callback failures are guarded',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/captureError\('settlement',error\)/);
 assert.match(source,/captureError\('settlement event persistence'/);
 assert.match(source,/unhandledrejection/);
});
import {guarded,errorSummary} from '../src/callback-errors.js';
test('guard observes synchronous and asynchronous callback errors',async()=>{
 const seen=[];
 await guarded(()=>{throw new TypeError('Failed to fetch');},e=>seen.push(e))();
 await guarded(async()=>{throw new ReferenceError('event is not defined');},e=>seen.push(e))();
 assert.equal(seen.length,2);
 assert.match(errorSummary(seen[1]),/event is not defined/);
 assert.doesNotMatch(errorSummary(new Error('private payload '+ 'a'.repeat(64))),/private payload|aaaa/);
});
test('operator rejection code remains diagnosable without leaking payloads',()=>{
 const error=Object.assign(new Error('invalid boarding input '+ 'a'.repeat(64)),{name:'INVALID_ARGUMENT',code:3});
 assert.match(errorSummary(error),/INVALID_ARGUMENT.*3/);
 assert.match(errorSummary(error),/invalid boarding input/);
 assert.doesNotMatch(errorSummary(error),/aaaa/);
});
test('SDK network wrappers remain diagnosable without exposing URLs or causes',()=>{
 const error=Object.assign(new Error('Network request failed: POST https://example.test/private-token'),{name:'FetchError'});
 assert.match(errorSummary(error),/Network request failed/);
 assert.doesNotMatch(errorSummary(error),/https|private-token/);
});
test('plain SDK registration errors retain only structured code and safe categories',()=>{
 const error=new Error('Failed to register intent: '+JSON.stringify({code:3,message:'invalid boarding input '+ 'a'.repeat(64)}));
 assert.match(errorSummary(error),/REGISTRATION_REJECTED.*3.*invalid boarding input/);
 assert.doesNotMatch(errorSummary(error),/aaaa/);
});
