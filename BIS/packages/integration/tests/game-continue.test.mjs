import test from 'node:test';
import assert from 'node:assert/strict';
import {createBisContinue,getContinuePriceSats} from '../src/core/game-continue.ts';
import {BoardingBlockedError} from '../src/core/boarding-record.ts';

test('B1 reports an unresolved transfer after confirming no payment was submitted', async () => {
 const message='A transfer is unresolved. Open Account Transfer and check its status before clearing this account or using these funds.';
 const controller=createBisContinue({
  getState:()=>({hasProfile:true,phase:'active',profileId:'p'}),subscribe:()=>()=>{},showToast(){},
  requestContinue:async()=>{throw new BoardingBlockedError(message);},getContinueStatus:async()=>[],
 },{context:'blocked-transfer',onSuccess(){assert.fail('Blocked payment must not succeed');}});
 await controller.pay();assert.equal(controller.getState().status,'failed');
 assert.equal(controller.getState().message,message);controller.dispose();
});

function fixture() {
 let state={hasProfile:true,phase:'active',profileId:'p'}, submitted=[],toasts=[],success=[],records=[],result='pending',release;
 const listeners=new Set();
 const receipt=(request,status)=>({...request,status,profileId:'p',mechanism:'sink-payment',feeSats:0});
 const context={getState:()=>state,subscribe:l=>{listeners.add(l);return()=>listeners.delete(l);},showToast:m=>toasts.push(m),
  requestContinue:async r=>{submitted.push(r);if(result==='wait')await new Promise(resolve=>release=resolve);if(result==='throw')throw Error('offline');return receipt(r,result==='wait'?'succeeded':result);},
  getContinueStatus:async()=>{if(records==='throw')throw Error('offline');return records;}};
 const controller=createBisContinue(context,{context:'session/death',onSuccess:r=>success.push(r)});
 return {controller,submitted,toasts,success,listeners,receipt,setResult:v=>result=v,setRecords:v=>records=v,release:()=>release(),replace:value=>{state=value;for(const l of listeners)l();}};
}
test('BIS owns price; logged out can never submit',async()=>{
 const f=fixture();assert.equal(getContinuePriceSats(),1000);assert.equal(f.controller.getState().sats,1000);
 f.replace({hasProfile:false,phase:'idle'});assert.equal(f.controller.getState().canPay,false);await f.controller.pay();assert.equal(f.submitted.length,0);f.controller.dispose();
});
test('duplicate clicks submit once, uncertainty stays pending, exact success delivers once',async()=>{
 const f=fixture();const first=f.controller.pay();assert.equal(f.controller.getState().status,'pending');await f.controller.pay();await first;
 assert.equal(f.submitted.length,1);f.setRecords('throw');await f.controller.check();assert.equal(f.controller.getState().status,'pending');
 f.setRecords([f.receipt(f.submitted[0],'succeeded')]);await f.controller.check();await f.controller.check();await f.controller.pay();
 assert.deepEqual(f.toasts,['You sent 1000 sats (Confirmed)']);assert.equal(f.success.length,1);assert.equal(f.submitted.length,1);f.controller.dispose();
});
test('definitive failure enables an explicit new attempt with a new identity',async()=>{
 const f=fixture();f.setResult('failed');await f.controller.pay();assert.equal(f.controller.getState().canPay,true);assert.equal(f.toasts.length,0);
 f.setResult('succeeded');await f.controller.pay();assert.notEqual(f.submitted[0].operationId,f.submitted[1].operationId);assert.equal(f.success.length,1);f.controller.dispose();
});
test('thrown submission cannot imply failure when its status is unreadable',async()=>{
 const f=fixture();f.setResult('throw');f.setRecords('throw');await f.controller.pay();assert.equal(f.controller.getState().status,'pending');f.controller.dispose();
 const g=fixture();g.setResult('throw');await g.controller.pay();assert.equal(g.controller.getState().status,'failed');g.controller.dispose();
});
test('wrong result never grants continuation; disposal drops late success',async()=>{
 const f=fixture();await f.controller.pay();f.setRecords([f.receipt({...f.submitted[0],context:'other'},'succeeded')]);await f.controller.check();assert.equal(f.success.length,0);assert.equal(f.controller.getState().status,'pending');f.controller.dispose();
 const g=fixture();g.setResult('wait');const pending=g.controller.pay();g.controller.dispose();g.release();await pending;assert.equal(g.success.length,0);assert.equal(g.toasts.length,0);assert.equal(g.listeners.size,0);
});
test('a different account cannot receive the original payment gameplay effect',async()=>{
 const f=fixture();f.setResult('wait');const pending=f.controller.pay();f.replace({hasProfile:true,phase:'active',profileId:'other'});f.release();await pending;
 assert.equal(f.success.length,0);assert.match(f.controller.getState().message,/original account/);f.controller.dispose();
});

test('a verified failed payment uses the concise failed status',async()=>{
 const f=fixture();await f.controller.pay();
 const message='Insufficient eligible spendable funds for this 1,000-sat payment. No payment was submitted.';
 f.setRecords([{...f.receipt(f.submitted[0],'failed'),message}]);
 await f.controller.check();
 assert.equal(f.controller.getState().message,'You could not send 1000 sats (Failed)');
 assert.equal(f.controller.getState().canPay,true);
 assert.equal(f.success.length,0);f.controller.dispose();
});
