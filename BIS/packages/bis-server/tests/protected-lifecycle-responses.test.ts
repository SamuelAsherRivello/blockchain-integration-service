import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createProtectedLifecycleResponseStore} from '../scripts/protected-lifecycle-responses.ts';
import {checkpointLifecycleResponse} from '../scripts/funded-workflow-lifecycle.ts';

async function fixture(t:any){
 const root=await mkdtemp(join(tmpdir(),'bis-response-fixture-'));assert.ok(isAbsolute(root)&&root.startsWith(join(tmpdir(),'bis-response-fixture-')));
 t.after(()=>rm(root,{recursive:true,force:true}));const sizes:number[]=[];
 // Public synthetic bytes only. XOR tests storage boundaries; real deployment
 // uses the existing Windows DPAPI protector and ACL checks.
 const protector={protect:async(bytes:Buffer)=>{sizes.push(bytes.length);return Buffer.from(bytes.map(value=>value^0xa5));},unprotect:async(bytes:Buffer)=>Buffer.from(bytes.map(value=>value^0xa5)),check:async()=>{},secure:async()=>{}};
 return {root,sizes,protector,store:createProtectedLifecycleResponseStore({root,protector,runId:'fixture-responses-01'})};
}

test('an exact response larger than the main Vault limit remains readable from separate encrypted chunks',async t=>{
 const {root,sizes,store}=await fixture(t),record={status:500,text:'fixture-private-error-'.repeat(200000)};
 assert.ok(Buffer.byteLength(record.text)>3*1024*1024);const reference=await store.retain(record);
 assert.deepEqual(await store.read(reference),record);assert.ok(sizes.length>1&&sizes.every(size=>size<=1024*1024));
 const disk=await readFile(join(root,'lifecycle-responses','fixture-responses-01',reference.file),'utf8');assert.equal(disk.includes('fixture-private-error-'),false);
});

test('accumulated exact responses do not accumulate their bodies in the bounded main Vault',async t=>{
 const {store}=await fixture(t),run:any={},ctx:any={a:{authorizationMode:'player-proof'},counts:{sign:0,sessionSign:0},retainResponse:store.retain,save:async(use:any)=>use(run)};
 const text=JSON.stringify({error:'fixture-error-'.repeat(7000)});
 for(let index=0;index<40;index++)await checkpointLifecycleResponse(ctx,'sign',{id:'request-'+index,operationId:'fixture-operation',method:'sign'},{status:500,text});
 assert.ok(text.length*40>3*1024*1024);assert.ok(Buffer.byteLength(JSON.stringify(run))<40000);
 assert.equal((await store.read(run.serverResponses[39].protectedResponse)).text,text);assert.equal(JSON.stringify(run).includes('fixture-error-'),false);
});

test('a failed metadata commit leaves its original encrypted response discoverable and unchanged',async t=>{
 const {root,store}=await fixture(t),references:any[]=[],ctx:any={a:{authorizationMode:'player-proof'},counts:{sign:0,sessionSign:0},retainResponse:async(record:any)=>{const ref=await store.retain(record);references.push(ref);return ref;},save:async()=>{throw Error('fixture capacity refusal');}};
 await assert.rejects(checkpointLifecycleResponse(ctx,'sign',{id:'original',method:'sign'},{status:200,text:'{"result":"fixture"}'}));
 assert.equal(ctx.counts.sign,0);assert.equal(references.length,1);assert.equal((await store.read(references[0])).text,'{"result":"fixture"}');
 assert.deepEqual(await readdir(join(root,'lifecycle-responses','fixture-responses-01')),[references[0].file]);
});

test('parallel first responses prepare one private directory, retain both files and reject hash substitution',async t=>{
 const {store}=await fixture(t),refs=await Promise.all([store.retain({id:'first'}),store.retain({id:'second'})]);
 assert.deepEqual(await Promise.all(refs.map(ref=>store.read(ref))),[{id:'first'},{id:'second'}]);
 await assert.rejects(store.read({...refs[0],sha256:'0'.repeat(64)}),/hash changed/);
});
