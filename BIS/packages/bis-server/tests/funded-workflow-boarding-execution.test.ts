import test from 'node:test';
import assert from 'node:assert/strict';
import {boardingStrategy} from '../scripts/funded-workflow-boarding.ts';
import type {LifecycleContext} from '../scripts/funded-workflow-lifecycle.ts';

const commitment='a'.repeat(64);
function fixture(snapshots:{record:{commitmentTxid?:string;status?:string;phase?:string;intentId?:string};workerActive:boolean}[],options:{submitError?:boolean;deadlineMs?:number;readNeverSettles?:boolean}={}){
 let submissions=0,reads=0,state='prepared';
 const ctx={a:{runId:'boarding-case-01',gameProfileId:'b'.repeat(64),network:'signet'},plan:{quote:{fingerprint:'c'.repeat(64)},outpoints:['d'.repeat(64)+':0']},deadline:Date.now()+(options.deadlineMs??2000),owner:{registration:{game:{label:'game'}},page:{evaluate:async(_fn:unknown,input:any)=>{
  if(input.quote){submissions++;if(options.submitError)throw Error('Original SDK preparation stopped.');return {status:'pending',intentId:'original'};}
  const snapshot=snapshots[Math.min(reads++,snapshots.length-1)];
  if(options.readNeverSettles)return new Promise(()=>{});
  return snapshot;
 }}},operation:async(_kind:unknown,_game:unknown,_id:unknown,_recipient:unknown,send:()=>Promise<string>)=>{
  // The real Operations.submit retains callback failures as unknown.
  state='submitting';try{const providerId=await send();state='pending';return {state,providerId};}catch{state='unknown';return {state};}
 }} as unknown as LifecycleContext;
 return {ctx,get submissions(){return submissions;},get reads(){return reads;},get state(){return state;}};
}

test('inactive prepared worker stops execution while the native sender remains unknown',async()=>{
 const f=fixture([{record:{status:'not-submitted',phase:'prepared'},workerActive:false}]);
 await assert.rejects(boardingStrategy.execute(f.ctx),/boarding.*unresolved/i);
 assert.equal(f.state,'unknown');assert.equal(f.submissions,1);assert.equal(f.reads,1);
});

test('registration acknowledgement waits for the same SDK worker commitment',async()=>{
 const f=fixture([{record:{status:'pending',phase:'registered',intentId:'original-intent'},workerActive:true},{record:{status:'pending',phase:'registered',intentId:'original-intent',commitmentTxid:commitment},workerActive:false}]);
 await boardingStrategy.execute(f.ctx);
 assert.equal(f.state,'pending');assert.equal(f.submissions,1);assert.equal(f.reads,2);
});

test('preparation exception propagates after retaining the native unknown disposition',async()=>{
 const f=fixture([{record:{},workerActive:false}],{submitError:true});
 await assert.rejects(boardingStrategy.execute(f.ctx),/boarding.*unresolved/i);
 assert.equal(f.state,'unknown');assert.equal(f.submissions,1);assert.equal(f.reads,0);
});

test('an active worker without a commitment exhausts its original deadline without resubmitting',async()=>{
 const f=fixture([{record:{status:'pending'},workerActive:true}],{deadlineMs:20});
 await assert.rejects(boardingStrategy.execute(f.ctx),/boarding.*unresolved/i);
 assert.equal(f.state,'unknown');assert.equal(f.submissions,1);
});

test('an inactive registered worker without a commitment retains an ambiguous native unknown',async()=>{
 const f=fixture([{record:{status:'pending',phase:'registered',intentId:'original-intent'},workerActive:false}]);
 await assert.rejects(boardingStrategy.execute(f.ctx),/boarding.*unresolved/i);
 assert.equal(f.state,'unknown');assert.equal(f.submissions,1);assert.equal(f.reads,1);
});

test('an invalid commitment is not accepted when the original worker has stopped',async()=>{
 const f=fixture([{record:{status:'pending',phase:'registered',intentId:'original-intent',commitmentTxid:'invalid'},workerActive:false}]);
 await assert.rejects(boardingStrategy.execute(f.ctx),/boarding.*unresolved/i);
 assert.equal(f.state,'unknown');assert.equal(f.submissions,1);assert.equal(f.reads,1);
});

test('a stalled original journal read is bounded by the original deadline and cannot resubmit',async()=>{
 const f=fixture([{record:{status:'pending'},workerActive:true}],{deadlineMs:20,readNeverSettles:true}),deadline=f.ctx.deadline;
 await assert.rejects(boardingStrategy.execute(f.ctx),/boarding.*unresolved/i);
 assert.equal(f.state,'unknown');assert.equal(f.submissions,1);assert.equal(f.reads,1);assert.equal(f.ctx.deadline,deadline);
});
