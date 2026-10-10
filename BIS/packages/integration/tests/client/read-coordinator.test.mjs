import assert from 'node:assert/strict';
import test from 'node:test';
import {createReadCoordinator} from '../../src/client/state-layer-core/read-coordinator.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const key={dataType:'balance',profileId:'a:profile',network:'signet',generation:1};

test('pending is installed before invocation; foreground and Refresh join the same owner',async()=>{
 const c=createReadCoordinator(),d=deferred();let calls=0;
 const load=()=>{calls++;return d.promise;};
 const a=c.read(key,load),b=c.read(key,load,{foreground:true}),refresh=c.read(key,load,{force:true});
 assert.equal(a,b);assert.equal(a,refresh);assert.equal(c.hasForeground(),true);
 await tick();assert.equal(calls,1);d.resolve(0);assert.equal((await a).value,0);assert.equal(c.hasForeground(),false);
 assert.equal((await c.read(key,load)).value,0);assert.equal(calls,1);
 const next=c.read(key,load,{force:true});await next;assert.equal(calls,2);c.dispose();
});
test('invalidation aborts and late completion cannot remove or cache its replacement',async()=>{
 const c=createReadCoordinator(),old=deferred(),next=deferred();let signal;
 const a=c.read(key,s=>{signal=s;return old.promise;});const rejected=assert.rejects(a);
 await tick();c.invalidate('balance');assert.equal(signal.aborted,true);
 const b=c.read(key,()=>next.promise);old.resolve(100);await rejected;await tick();
 assert.equal(c.isPending(key),true);assert.equal(c.peek(key),undefined);
 next.resolve(200);await b;assert.equal(c.peek(key).value,200);c.dispose();
});
test('one two-attempt budget survives a foreground join during attempt two',async()=>{
 const c=createReadCoordinator(),d=deferred();let calls=0;
 const load=async()=>{calls++;if(calls===1)throw Error('retry');return d.promise;};
 const a=c.read(key,load);const rejected=assert.rejects(a);await tick();assert.equal(calls,2);
 const b=c.read(key,load,{foreground:true,force:true});assert.equal(a,b);d.reject(Error('final'));await rejected;
 assert.equal(calls,2);assert.equal(c.peek(key),undefined);assert.equal(c.isPending(key),false);c.dispose();
});
test('promotion retains the second attempt deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const c=createReadCoordinator();let calls=0;
 const a=c.read(key,async()=>{calls++;return new Promise(()=>{});},{timeout:100});const rejected=assert.rejects(a);
 await tick();t.mock.timers.tick(100);await tick();assert.equal(calls,2);
 t.mock.timers.tick(70);assert.equal(c.read(key,async()=>0,{foreground:true}),a);
 t.mock.timers.tick(30);await rejected;assert.equal(calls,2);c.dispose();
});
test('TTL, independent dependencies, lifecycle and normalized exact query coverage',async()=>{
 let now=1000;const c=createReadCoordinator({now:()=>now,ttlMs:100});let calls=0;
 const contract={...key,dataType:'contracts',query:{includeResolved:true,includeOtherNetworks:true}};
 await c.read(contract,async()=>{calls++;return [];});
 now=1050;await c.read({...contract,query:{includeOtherNetworks:true,includeResolved:true}},async()=>{calls++;return [1];});assert.equal(calls,1);
 assert.equal(c.peek({...contract,query:{}}),undefined);
 const addresses={...key,dataType:'addresses'};await c.read(addresses,async()=>({address:'public'}));
 c.invalidate('balance');assert.ok(c.peek(addresses));
 assert.equal(c.peek({...addresses,generation:2}),undefined);assert.equal(c.peek({...addresses,network:'mutinynet'}),undefined);
 now=1100;assert.equal(c.peek(contract),undefined);assert.ok(c.peek(addresses));c.dispose();
});
test('projection preserves source timestamps and complete empty results; incomplete/failure never cache',async()=>{
 let now=1000;const c=createReadCoordinator({now:()=>now,ttlMs:100});
 await c.read(key,async()=>({rows:[],fetchedAt:950}),{timestamp:value=>value.fetchedAt});
 now=1049;assert.equal(c.peek(key).fetchedAt,950);now=1050;assert.equal(c.peek(key),undefined);
 await assert.rejects(c.read(key,async()=>[],{complete:()=>false}));assert.equal(c.peek(key),undefined);
 await c.read(key,async()=>[]);assert.deepEqual(c.peek(key).value,[]);c.invalidate();assert.equal(c.peek(key),undefined);c.dispose();
});
test('Details composition carries the revision vector and oldest timestamp, never a partial pair',async()=>{
 let now=1000;const c=createReadCoordinator({now:()=>now,ttlMs:100});const address={...key,dataType:'addresses'};
 await c.read(key,async()=>1);assert.equal(c.compose([key,address]),undefined);now=1050;await c.read(address,async()=>2);
 const pair=c.compose([key,address]);assert.equal(pair.fetchedAt,1000);assert.equal(pair.dependencies.length,2);
 assert.equal(c.compose([key,{...address,network:'mutinynet'}]),undefined);
 now=1100;assert.equal(c.compose([key,address]),undefined);assert.ok(c.peek(address));c.invalidate('balance');assert.ok(c.peek(address));c.dispose();
});
