import test from 'node:test';
import assert from 'node:assert/strict';
import {claimWindowState} from '../src/window-state.js';

function storage(initial=[]){const values=new Map(initial);return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};}
function environment(){
 const local=storage(),held=new Set(),queues=new Map();let nextId=0;
 const locks={request:async(name,options,callback)=>{
  if(typeof options==='function'){callback=options;options={};}
  if(options.ifAvailable&&held.has(name))return callback(null);
  const previous=queues.get(name)??Promise.resolve();let done;
  const completion=new Promise(resolve=>{done=resolve;});queues.set(name,completion);
  await previous;held.add(name);
  try{return await callback({name});}finally{held.delete(name);done();if(queues.get(name)===completion)queues.delete(name);}
 }};
 const create=(session=storage(),requestedId)=>claimWindowState({session,local,locks,requestedId,randomUUID:()=>`window-${++nextId}`,onPageHide(){}});
 return {local,held,create};
}

test('many windows isolate databases, settings, timing and operation locks',async()=>{
 const env=environment(),windows=[];
 for(let i=0;i<8;i++)windows.push(await env.create());
 assert.equal(new Set(windows.map(w=>w.databaseName)).size,8);
 assert.equal(new Set(windows.map(w=>w.lockName('standalone-settlement'))).size,8);
 windows[0].storage.setItem('standalone-transfer-percent','25');
 windows[0].storage.setItem('standalone-arkade-step-timings-v1','history');
 for(const scope of windows.slice(1)){assert.equal(scope.storage.getItem('standalone-transfer-percent'),null);assert.equal(scope.storage.getItem('standalone-arkade-step-timings-v1'),null);}
 windows.forEach(w=>w.release());
});

test('duplicate tabs get new state while reloads and reopened URLs retain their own state',async()=>{
 const env=environment(),session=storage();
 const first=await env.create(session);first.storage.setItem('setting','original');
 const duplicate=await env.create(storage(session.values),first.id);
 assert.notEqual(duplicate.id,first.id);assert.equal(duplicate.storage.getItem('setting'),null);
 first.release();await new Promise(setImmediate);
 const reloaded=await env.create(session);
 assert.equal(reloaded.id,first.id);assert.equal(reloaded.storage.getItem('setting'),'original');
 reloaded.release();await new Promise(setImmediate);
 const reopened=await env.create(storage(),first.id);
 assert.equal(reopened.databaseName,first.databaseName);assert.equal(reopened.storage.getItem('setting'),'original');
 duplicate.release();reopened.release();
});

test('only the first window retains legacy state and no data is removed',async()=>{
 const env=environment();env.local.setItem('standalone-transfer-percent','70');
 const first=await env.create(),second=await env.create();
 assert.equal(first.databaseName,'standalone-arkade-boarding-v1');
 assert.equal(first.storage.getItem('standalone-transfer-percent'),'70');
 assert.equal(second.storage.getItem('standalone-transfer-percent'),null);
 first.storage.setItem('standalone-transfer-percent','50');
 assert.equal(env.local.getItem('standalone-transfer-percent'),'70');
 assert.equal(first.storage.ownsKey(second.lockName('setting')),false);
 first.release();second.release();
});
