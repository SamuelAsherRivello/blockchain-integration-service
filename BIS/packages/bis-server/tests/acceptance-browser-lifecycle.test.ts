import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,open,stat,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {launchAcceptanceContext,ServerPaymentBrowser} from '../scripts/funded-workflow-live.ts';

async function directory(t:any){
 const base=resolve('output/fixtures/acceptance-browser-lifecycle');await mkdir(base,{recursive:true});const root=await mkdtemp(join(base,'owned-'));
 assert.ok(root.startsWith(base+'\\')||root.startsWith(base+'/'));const cleanup:Array<()=>Promise<unknown>>=[()=>rm(root,{recursive:true,force:true})];
 t.after(async()=>{for(const close of cleanup.reverse())await close();});return {root,cleanup};
}

test('failed browser closure preserves ownership and cannot report closed; concurrent retry closes once',async t=>{
 const {root,cleanup}=await directory(t),lockPath=join(root,'profile.lock'),lock=await open(lockPath,'wx'),events:string[]=[];cleanup.push(()=>lock.close());
 const owner:any={closed:false,lock,lockPath,registration:{original:true},expected:{original:true},context:{close:async()=>{throw Error('fixture close refusal');}}};
 await assert.rejects(ServerPaymentBrowser.prototype.close.call(owner));assert.equal(owner.closed,false);assert.ok((await stat(lockPath)).isFile());assert.equal(owner.lock,lock);assert.deepEqual(owner.registration,{original:true});
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});owner.context.close=async()=>{events.push('close');await gate;};
 const first=ServerPaymentBrowser.prototype.close.call(owner),second=ServerPaymentBrowser.prototype.close.call(owner);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(owner.closed,false);assert.ok((await stat(lockPath)).isFile());
 release();await Promise.all([first,second]);assert.deepEqual(events,['close']);assert.equal(owner.closed,true);assert.equal(owner.lock,undefined);assert.equal(owner.registration,undefined);
 await assert.rejects(stat(lockPath),(error:any)=>error.code==='ENOENT');await ServerPaymentBrowser.prototype.close.call(owner);assert.deepEqual(events,['close']);
});

test('acceptance launch blocks a real service worker from bypassing its request interceptor',{timeout:30000},async t=>{
 const {root,cleanup}=await directory(t),server=createServer((request,response)=>{
  if(request.url==='/worker.js'){response.setHeader('Content-Type','text/javascript');response.end("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(clients.claim()));self.addEventListener('fetch',e=>{if(new URL(e.request.url).pathname==='/probe')e.respondWith(new Response('worker-bypass'));});");}
  else{response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Unfunded local worker fixture</title>');}
 });
 await new Promise<void>(ready=>server.listen(0,'127.0.0.1',ready));cleanup.push(()=>new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done())));
 const address=server.address();if(!address||typeof address==='string')throw Error('Fixture address unavailable');
 const context=await launchAcceptanceContext({launchPersistentContext:(path:string,options:any)=>chromium.launchPersistentContext(path,{...options,channel:'msedge'})},join(root,'browser'));
 cleanup.push(()=>context.close());let intercepted=0;await context.route('**/probe',async(route:any)=>{intercepted++;await route.fulfill({status:200,body:'routed'});});
 const page=context.pages()[0]??await context.newPage();await page.goto('http://127.0.0.1:'+address.port);
 const observed=await page.evaluate(async()=>{
  const registration=navigator.serviceWorker.register('/worker.js').then(()=>navigator.serviceWorker.ready).catch(()=>undefined);
  await Promise.race([registration,new Promise(resolve=>setTimeout(resolve,2000))]);
  if(!navigator.serviceWorker.controller)await Promise.race([new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,1000))]);
  return {controlled:!!navigator.serviceWorker.controller,probe:await(await fetch('/probe')).text()};
 });
 assert.deepEqual(observed,{controlled:false,probe:'routed'});assert.equal(intercepted,1);assert.equal(context.serviceWorkers().length,0);
});

test('acceptance refuses a real persisted worker before browser launch and preserves its stored state',{timeout:30000},async t=>{
 const {root,cleanup}=await directory(t),profile=join(root,'persisted-browser'),server=createServer((request,response)=>{
  response.setHeader('Content-Type',request.url==='/worker.js'?'text/javascript':'text/html');
  response.end(request.url==='/worker.js'?"self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(clients.claim()));self.addEventListener('fetch',e=>{if(new URL(e.request.url).pathname==='/probe')e.respondWith(new Response('worker-bypass'));});":'<!doctype html><title>Persisted worker fixture</title>');
 });
 await new Promise<void>(ready=>server.listen(0,'127.0.0.1',ready));cleanup.push(()=>new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done())));
 const address=server.address();if(!address||typeof address==='string')throw Error('Fixture address unavailable');
 const prime=await chromium.launchPersistentContext(profile,{headless:true,channel:'msedge',serviceWorkers:'allow'});cleanup.push(()=>prime.close());
 const page=prime.pages()[0]??await prime.newPage();await page.goto('http://127.0.0.1:'+address.port);
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/worker.js');await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 assert.equal(await page.evaluate(async()=>await(await fetch('/probe')).text()),'worker-bypass');await prime.close();
 const workerRoot=join(profile,'Default','Service Worker');
 async function inventory(path:string):Promise<unknown[]>{const rows:unknown[]=[];for(const entry of await readdir(path,{withFileTypes:true})){const child=join(path,entry.name);rows.push(entry.isDirectory()?{name:entry.name,children:await inventory(child)}:{name:entry.name,sha256:createHash('sha256').update(await readFile(child)).digest('hex')});}return rows;}
 const before=await inventory(workerRoot);let launches=0;
 await assert.rejects(launchAcceptanceContext({launchPersistentContext:async()=>{launches++;throw Error('Unexpected browser launch');}},profile),/Stored Service Worker state/);
 assert.equal(launches,0);assert.deepEqual(await inventory(workerRoot),before);
});

test('a clean persistent profile can be reused without clearing its browser data',{timeout:30000},async t=>{
 const {root,cleanup}=await directory(t),profile=join(root,'clean-browser'),type={launchPersistentContext:(path:string,options:any)=>chromium.launchPersistentContext(path,{...options,channel:'msedge'})};
 const first=await launchAcceptanceContext(type,profile);cleanup.push(()=>first.close());await first.close();
 const second=await launchAcceptanceContext(type,profile);cleanup.push(()=>second.close());assert.equal(second.serviceWorkers().length,0);
});
