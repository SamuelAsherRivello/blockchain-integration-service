import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeferredProofJournal,lifecycleRequestMetadata} from '../scripts/funded-workflow-lifecycle.ts';

test('early refusal metadata preserves the request boundary without URL credentials or query data',()=>{
 const value=lifecycleRequestMetadata('https://private-user:private-password@signet.arkade.sh/v1/batch/registerIntent?token=private-token#private-fragment','POST');
 assert.deepEqual(value,{origin:'https://signet.arkade.sh',path:'/v1/batch/registerIntent',method:'POST'});
 assert.equal(JSON.stringify(value).includes('private-'),false);
 assert.equal(lifecycleRequestMetadata('https://signet.arkade.sh/'+'a'.repeat(600),'UNEXPECTED').path.length,512);
 assert.equal(lifecycleRequestMetadata('https://signet.arkade.sh/','UNEXPECTED').method,'unknown');
});

test('nonfinancial proof responses avoid disk waits but financial dispatch waits for the complete durable log',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),calls:any[]=[],events:string[]=[];
 const journal=createDeferredProofJournal(async rows=>{events.push('persist-start');calls.push(rows);await gate;events.push('persist-complete');});
 const challenge={operationId:'original',playerPublicKey:'public'};
 await journal.record('player/challenge',challenge);challenge.playerPublicKey='changed-after-capture';
 await journal.record('player/authenticate',{operationId:'original',signature:'protected-proof'});
 assert.equal(calls.length,0);
 const dispatch=journal.record('settlement/plan',{request:{operationId:'original'}}).then(()=>events.push('financial-dispatch'));
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,['persist-start']);
 assert.deepEqual(calls[0].map(row=>row.path),['player/challenge','player/authenticate','settlement/plan']);
 assert.equal(calls[0][0].body.playerPublicKey,'public');release();await dispatch;
 assert.deepEqual(events,['persist-start','persist-complete','financial-dispatch']);
});

test('a prefinancial stop flushes proof-only evidence before final disposition',async()=>{
 const saved:any[]=[];const journal=createDeferredProofJournal(async rows=>{saved.push(...rows);});
 await journal.record('player/challenge',{operationId:'original'});await journal.record('player/authenticate',{operationId:'original'});
 await journal.flush();assert.deepEqual(saved.map(row=>row.path),['player/challenge','player/authenticate']);
 await journal.flush();assert.equal(saved.length,2);
});

test('failed persistence blocks financial dispatch and every later financial request',async()=>{
 let sent=0;const journal=createDeferredProofJournal(async()=>{throw Error('Fixture storage refusal.');});
 await journal.record('player/challenge',{});await journal.record('player/authenticate',{});
 await assert.rejects(journal.record('settlement/plan',{}).then(()=>{sent++;}));
 await assert.rejects(journal.record('sign',{}).then(()=>{sent++;}));await assert.rejects(journal.flush());assert.equal(sent,0);
});

test('proof buffering is bounded and does not defer provider or signing records',async()=>{
 const calls:string[][]=[];const journal=createDeferredProofJournal(async rows=>{calls.push(rows.map(row=>row.path));});
 for(let index=0;index<4;index++){await journal.record('player/challenge',{});await journal.record('player/authenticate',{});}
 await assert.rejects(journal.record('player/authenticate',{}),/limit/);
 await journal.record('sign',{});await journal.record('/v1/batch/registerIntent',{});
 assert.deepEqual(calls,[[...Array.from({length:4},()=>['player/challenge','player/authenticate']).flat(),'sign'],['/v1/batch/registerIntent']]);
});

test('parallel SDK register and delete ownership proofs retain both auth pairs before dispatch',async()=>{
 const saved:any[]=[];const journal=createDeferredProofJournal(async rows=>{saved.push(...rows);});
 await Promise.all(['register','delete'].map(async proof=>{await journal.record('player/challenge',{proof});await journal.record('player/authenticate',{proof});}));
 await journal.record('settlement/authorize',{});
 assert.equal(saved.length,5);assert.equal(saved.filter(row=>row.path==='player/authenticate').length,2);assert.equal(saved[4].path,'settlement/authorize');
});
