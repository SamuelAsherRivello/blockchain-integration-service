import test from 'node:test';
import assert from 'node:assert/strict';
import {installTransport} from '../src/transport.js';
import {fakeClock} from './helpers.mjs';
test('transport aborts headers and body, never replays mutations, and preserves caller abort',async()=>{
 for(const body of [false,true]){
  const clock=fakeClock();let calls=0;
  const target={fetch:async(_input,init)=>{calls++;const stalled=()=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));return body?{arrayBuffer:stalled}:stalled();}};
  installTransport({target,clock,now:clock.now,ms:10000});
  const failed=assert.rejects(target.fetch('https://signet.arkade.sh/v1/register',{method:'POST'}),{name:'RequestTimeoutError'});
  await new Promise(setImmediate);await clock.advance(10000);await failed;assert.equal(calls,1);assert.equal(clock.jobs.size,0);
 }
 const controller=new AbortController();let observed;
 const target={fetch:async(_input,init)=>{observed=init.signal;return new Response('{}');}};
 const transport=installTransport({target});controller.abort();await target.fetch(new Request('https://signet.arkade.sh/v1/info',{signal:controller.signal}));assert.equal(observed.aborted,true);transport.uninstall();
});
test('transport passes other origins and streams untouched, installs once, and retains cooldown',async()=>{
 const clock=fakeClock(),saved=new Map();let calls=0;
 const response=new Response('{}',{status:429,headers:{'Retry-After':'120'}});
 const target={fetch:async()=>{calls++;return response;}};
 const storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const transport=installTransport({target,clock,now:clock.now,storage});
 assert.equal(installTransport({target}),transport);
 assert.equal(await target.fetch('https://other.test/'),response);
 assert.equal(await target.fetch('https://signet.arkade.sh/v1/events'),response);
 await assert.rejects(target.fetch('https://signet.arkade.sh/v1/info'),{status:429});
 await assert.rejects(target.fetch('https://signet.arkade.sh/v1/info'),{status:429});assert.equal(calls,3);
 transport.uninstall();installTransport({target,clock,now:clock.now,storage});
 await assert.rejects(target.fetch('https://signet.arkade.sh/v1/info'),{status:429});assert.equal(calls,3);
});
