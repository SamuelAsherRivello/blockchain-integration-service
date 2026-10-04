import {nextRetry,retryDue} from './recovery.js';

export const deadlineError=(name='ObservationTimeoutError')=>Object.assign(new Error('The operation exceeded its deadline.'),{name});
export const staleError=()=>Object.assign(new Error('A newer workflow owns this result.'),{name:'StaleOperationError'});
export function withDeadline(work,{ms=45000,clock=globalThis,onLate=()=>{},name='ObservationTimeoutError'}={}){
 let timedOut=false,timeout;
 const actual=Promise.resolve().then(work);
 const deadline=new Promise((_,reject)=>{timeout=clock.setTimeout(()=>{timedOut=true;reject(deadlineError(name));},ms);});
 actual.then(value=>{if(timedOut)Promise.resolve(onLate(value)).catch(()=>{});},()=>{});
 return Promise.race([actual,deadline]).finally(()=>clock.clearTimeout(timeout));
}
// A timed-out promise is retained until it actually settles: no replacement pile-up.
export class WorkCoordinator {
 constructor({clock=globalThis,now=()=>Date.now(),random=Math.random,storage,onChange=()=>{}}={}){
  this.clock=clock;this.now=now;this.random=random;this.storage=storage;this.onChange=onChange;this.slots=new Map();this.failures={};
  try{const data=JSON.parse(storage?.getItem('standalone-recovery-v2')??'{}');if(data&&typeof data==='object'&&!Array.isArray(data))this.failures=data;}catch{}
 }
 persist(){try{this.storage?.setItem('standalone-recovery-v2',JSON.stringify(this.failures));}catch{/* Active retry floors remain in memory; never authorize signing from optional state. */}try{this.onChange();}catch{}}
 fail(key,error,options={}){const record=nextRetry(this.failures[key],error,{now:this.now(),random:this.random,...options});if(record.category!=='stale'){this.failures[key]=record;this.persist();}return record;}
 success(key){if(this.failures[key]){delete this.failures[key];this.persist();}}
 due(key){return retryDue(this.failures[key],this.now());}
 recheck(key){const record=this.failures[key];if(record){record.paused=false;record.attempts=0;record.nextAt=Math.max(this.now(),record.retryAfterAt??0);this.persist();}}
 read(key,work,{ms=45000,onLate}={}){
  const existing=this.slots.get(key);
  if(existing)return existing.exposed;
  const slot={};this.slots.set(key,slot);
  const actual=Promise.resolve().then(work);
  const release=()=>{if(this.slots.get(key)===slot)this.slots.delete(key);};
  slot.exposed=new Promise((resolve,reject)=>{
   let expired=false;
   const timeout=this.clock.setTimeout(()=>{expired=true;reject(deadlineError());},ms);
   actual.then(async value=>{
    this.clock.clearTimeout(timeout);
    if(expired){
     // A hung or failed disposal keeps the slot quarantined. It cannot silently
     // grant permission for a second wallet or duplicate subscription.
     try{await onLate?.(value);release();}catch{}
    }else{release();resolve(value);}
   },error=>{this.clock.clearTimeout(timeout);release();reject(error);});
  });
  return slot.exposed;
 }
}
export function requestLock(locks,name,options,callback,{clock=globalThis,ms=10000}={}){
 if(typeof options==='function'){callback=options;options={};}
 if(options?.ifAvailable)return locks.request(name,options,callback);
 const controller=new AbortController();let acquired=false;
 const timeout=clock.setTimeout(()=>{if(!acquired)controller.abort(deadlineError('LockTimeoutError'));},ms);
 const abort=()=>controller.abort(options?.signal?.reason);
 if(options?.signal?.aborted)abort();else options?.signal?.addEventListener('abort',abort,{once:true});
 return locks.request(name,{...options,signal:controller.signal},lock=>{acquired=true;clock.clearTimeout(timeout);return callback(lock);}).finally(()=>{clock.clearTimeout(timeout);options?.signal?.removeEventListener('abort',abort);});
}
