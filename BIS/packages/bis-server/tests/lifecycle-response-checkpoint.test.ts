import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkpointLifecycleResponse,lifecycleGuardError,createLifecycleRouteTracker} from '../scripts/funded-workflow-lifecycle.ts';

function fixture(save?:(use:(run:any)=>void)=>Promise<void>){
 const run:any={},records:any[]=[],ctx:any={a:{authorizationMode:'player-proof'},counts:{sign:0,sessionSign:0},retainResponse:async(record:any)=>{records.push(structuredClone(record));return {file:'fixture.dpapi.json',sha256:'a'.repeat(64)};},save:save??(async use=>{use(run);})};return {ctx,run,records};
}
const request={id:'original-sign',operationId:'original-operation',method:'sign'};

test('cleanup drains already dispatched responses before closing private storage and blocks new routes',async()=>{
 const routes=createLifecycleRouteTracker(),events:string[]=[];let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const original=routes.run({},async()=>{await gate;events.push('original-response-retained');});
 const cleanup=routes.drain().then(()=>{events.push('private-storage-closed');});
 await routes.run({abort:async()=>{events.push('new-route-blocked');}},async()=>{throw Error('Unexpected new dispatch');});
 assert.deepEqual(events,['new-route-blocked']);release();await original;await cleanup;
 assert.deepEqual(events,['new-route-blocked','original-response-retained','private-storage-closed']);
});

test('an original financial response is durable before browser fulfillment and its metadata checkpoint',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),run:any={},events:string[]=[];
 const {ctx,records}=fixture(async use=>{events.push('persist-start');await gate;use(run);events.push('persisted');});
 const response={status:200,text:' { "result": "fixture-signed-material" }\n'};
 const delivery=checkpointLifecycleResponse(ctx,'sign',request,response).then(()=>{events.push('fulfilled');});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(events,['persist-start']);assert.equal(ctx.counts.sign,0);
 release();await delivery;assert.deepEqual(events,['persist-start','persisted','fulfilled']);
 assert.equal(records[0].text,response.text);assert.equal(run.serverResponses[0].text,undefined);assert.equal(run.serverResponses[0].sha256,createHash('sha256').update(response.text).digest('hex'));
 assert.deepEqual(run.successfulServerSigns,[request]);assert.equal(ctx.counts.sign,1);
});

test('malformed HTTP200 signing envelopes retain their exact body without counting a signature',async()=>{
 for(const text of ['not-json','null','[]','{"error":"fixture"}']){
  const {ctx,run,records}=fixture();await assert.rejects(checkpointLifecycleResponse(ctx,'sign',request,{status:200,text}),/exact protected response retained/);
  assert.equal(records[0].text,text);assert.equal(run.serverResponses[0].text,undefined);assert.equal(run.successfulServerSigns,undefined);assert.equal(ctx.counts.sign,0);
 }
});

test('plan metadata and exact response commit together, while an invalid plan is retained for diagnosis',async()=>{
 const {ctx,run,records}=fixture(),info={sessionPublicKey:'02'+'a'.repeat(64),settlementPlan:'fixture-protected-authority'};
 await checkpointLifecycleResponse(ctx,'settlement/plan',{request},{status:200,text:JSON.stringify(info)});
 assert.equal(ctx.planToken,info.settlementPlan);assert.equal(run.planToken,info.settlementPlan);assert.equal(run.serverResponses.length,1);
 await assert.rejects(checkpointLifecycleResponse(ctx,'settlement/plan',{request},{status:200,text:'null'}));
 assert.equal(records[1].text,'null');assert.equal(run.planToken,info.settlementPlan);
});

test('a refused protected response checkpoint never fulfills or reports a successful signature',async()=>{
 const {ctx,records}=fixture(async()=>{throw Object.assign(Error('fixture-private-message'),{code:'EPERM'});});let delivered=false;
 await assert.rejects(checkpointLifecycleResponse(ctx,'sign',request,{status:200,text:JSON.stringify({result:'fixture'})}).then(()=>{delivered=true;}));
 assert.equal(delivered,false);assert.equal(ctx.counts.sign,0);assert.equal(records.length,1);
});

test('a refused encrypted artifact blocks metadata and browser delivery',async()=>{
 const {ctx,run}=fixture();ctx.retainResponse=async()=>{throw Object.assign(Error('fixture disk full'),{code:'ENOSPC'});};let delivered=false;
 await assert.rejects(checkpointLifecycleResponse(ctx,'sign',request,{status:200,text:'{"result":"fixture"}'}).then(()=>{delivered=true;}));
 assert.equal(delivered,false);assert.equal(ctx.counts.sign,0);assert.deepEqual(run,{});
});

test('guard diagnostics retain an allowlisted error code and bounded hash without plaintext or custom properties',()=>{
 const error=Object.assign(Error('fixture-private-token'),{code:'EEXIST',token:'fixture-secret',cause:Error('fixture-recovery')});
 const safe=lifecycleGuardError(error);assert.equal(safe.code,'EEXIST');assert.match(safe.messageHash!,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(safe).includes('fixture'),false);
 assert.deepEqual(lifecycleGuardError({get name(){throw Error('fixture');}}),{name:'Error'});
});
