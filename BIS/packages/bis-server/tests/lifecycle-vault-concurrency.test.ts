import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifecycleTransactionGuard,type LifecycleAssignment} from '../scripts/funded-workflow-lifecycle.ts';

const assignment={runId:'journal-race-01',network:'signet',gameProfileId:'a'.repeat(64),playerProfileId:'b'.repeat(64),amountSats:1000,feeSats:0} as LifecycleAssignment;
function fixture(){
 let locked=false,state:any={operations:[],requests:[],responses:[]},exposure=0;
 const transaction=async(use:(state:any)=>Promise<any>)=>{
  if(locked)throw Error('fixture-vault-locked');locked=true;
  try{const next=structuredClone(state),result=await use(next);state=next;return result;}finally{locked=false;}
 };
 return {guarded:createLifecycleTransactionGuard(transaction,assignment,{operationKinds:['btc-send']},()=>exposure),get state(){return state;},exposure:(value:number)=>{exposure=value;}};
}

test('parallel request persistence and an HTTP200 response checkpoint do not race the same Vault lock',async()=>{
 const f=fixture();let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>{enter=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 const pendingRequest=f.guarded(async(state:any)=>{enter();await gate;state.requests.push('second-original-sign');});await entered;
 const originalHttp200Checkpoint=f.guarded((state:any)=>{state.responses.push({requestId:'first-original-sign',status:200});});
 release();await Promise.all([pendingRequest,originalHttp200Checkpoint]);
 assert.deepEqual(f.state.requests,['second-original-sign']);assert.deepEqual(f.state.responses,[{requestId:'first-original-sign',status:200}]);
});

test('a failed original write does not prevent retaining its later unknown disposition',async()=>{
 const f=fixture();await assert.rejects(f.guarded(()=>{throw Error('fixture write refusal');}));
 await f.guarded((state:any)=>{state.disposition='unknown';});assert.equal(f.state.disposition,'unknown');
});

test('queued operation admission still reads current exposure and rejects excess before committing',async()=>{
 const f=fixture();let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>{enter=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 const prior=f.guarded(async()=>{enter();await gate;});await entered;
 const next=f.guarded((state:any)=>{state.operations.push({intent:{id:assignment.runId+'-board',kind:'btc-send',profileId:assignment.gameProfileId,network:'signet',amountSats:1000,feeSats:0},state:'prepared',createdAt:new Date().toISOString()});});
 const outcome=assert.rejects(next,/ceiling/);f.exposure(9500);release();await prior;await outcome;assert.deepEqual(f.state.operations,[]);
});
