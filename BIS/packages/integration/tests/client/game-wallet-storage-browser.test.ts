import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';
import {stripTypeScriptTypes} from 'node:module';

test('real encrypted Game identities survive logout without selection, while explicit reset deletes them',{timeout:30000},async()=>{
 const base=resolve('output/fixtures/game-wallet-retention');await mkdir(base,{recursive:true});const root=await mkdtemp(join(base,'owned-'));
 assert.ok(root.startsWith(base+'\\')||root.startsWith(base+'/'));
 const server=createServer((_request,response)=>{response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Public storage fixture</title>');});let context;
 try{
  await new Promise<void>(ready=>server.listen(0,'127.0.0.1',ready));const address=server.address();if(!address||typeof address==='string')throw Error('Fixture unavailable');
  context=await chromium.launchPersistentContext(join(root,'browser'),{headless:true,channel:'msedge',serviceWorkers:'block'});
  const page=context.pages()[0]??await context.newPage();await page.goto('http://127.0.0.1:'+address.port);
  const source=await readFile(new URL('../../src/client/state-layer-core/game-wallet-storage.ts',import.meta.url),'utf8');
  const code=stripTypeScriptTypes(source);
  const result=await page.evaluate(async code=>{
   const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),module=await import(url);URL.revokeObjectURL(url);
   const storage=module.createGameWalletStorage('mutinynet');
   async function inspect(){return new Promise<any>((done,reject)=>{const opening=indexedDB.open('bis-game-wallet-mutinynet-v1');opening.onerror=reject;opening.onsuccess=()=>{const db=opening.result,tx=db.transaction('wallets','readonly'),store=tx.objectStore('wallets'),keys=store.getAllKeys(),a=store.get('identity:fixture-a'),b=store.get('identity:fixture-b');tx.oncomplete=()=>{db.close();done({keys:keys.result,a:a.result,b:b.result});};tx.onerror=reject;};});}
   localStorage.setItem('public-player-fixture','unchanged');
   await storage.select({profileId:'fixture-a',phrase:'public synthetic A',network:'mutinynet'});await storage.select({profileId:'fixture-b',phrase:'public synthetic B',network:'mutinynet'});
   const before=await inspect();await storage.logout();const after=await inspect(),reopened=module.createGameWalletStorage('mutinynet'),loaded=await reopened.load();
   const bytes=(value:any)=>value?Array.from(new Uint8Array(value.encrypted)):undefined;
   const result={beforeIdentities:before.keys.filter((key:string)=>key.startsWith('identity:')).length,afterIdentities:after.keys.filter((key:string)=>key.startsWith('identity:')).length,selectionRemoved:!after.keys.includes('selected'),aUnchanged:JSON.stringify(bytes(before.a))===JSON.stringify(bytes(after.a)),bUnchanged:JSON.stringify(bytes(before.b))===JSON.stringify(bytes(after.b)),keysNonExtractable:after.a?.key.extractable===false&&after.b?.key.extractable===false,noAutomaticLogin:loaded===null,playerUnchanged:localStorage.getItem('public-player-fixture')==='unchanged',resetRecords:-1};
   await storage.reset();result.resetRecords=(await inspect()).keys.length;storage.dispose();reopened.dispose();return result;
  },code);
  assert.deepEqual(result,{beforeIdentities:2,afterIdentities:2,selectionRemoved:true,aUnchanged:true,bUnchanged:true,keysNonExtractable:true,noAutomaticLogin:true,playerUnchanged:true,resetRecords:0});
 }finally{await context?.close();await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));await rm(root,{recursive:true,force:true});}
});
