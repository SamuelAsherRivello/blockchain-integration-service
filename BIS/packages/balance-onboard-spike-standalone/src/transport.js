import {deadlineError} from './coordinator.js';
const marker=Symbol.for('standalone.spike.transport');
export const PROVIDER_ORIGINS=['https://signet.arkade.sh','https://mempool.signet.arkade.sh'];
export function installTransport({target=globalThis,origins=PROVIDER_ORIGINS,ms=30000,clock=globalThis,now=()=>Date.now(),storage,onMetric=()=>{}}={}){
 if(target[marker])return target[marker];
 const native=target.fetch.bind(target),allowed=new Set(origins),cooldowns=new Map();let store=storage;
 function setStorage(value){store=value;try{for(const [origin,at] of Object.entries(JSON.parse(store?.getItem('standalone-provider-cooldowns')??'{}')))if(allowed.has(origin)&&Number.isFinite(at))cooldowns.set(origin,Math.max(at,cooldowns.get(origin)??0));}catch{}}
 setStorage(storage);
 const report=metric=>{try{onMetric(metric);}catch{}};
 const wrapped=async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,target.location?.href);
  if(!allowed.has(url.origin)||/\/events(?:\/|$)|\/geteventstream|\/gettransactionsstream/i.test(url.pathname))return native(input,init);
  const started=now(),method=String(init?.method??input?.method??'GET').toUpperCase(),mutation=method!=='GET'&&method!=='HEAD';
  const retryAfterAt=cooldowns.get(url.origin)??0;
  if(started<retryAfterAt)throw Object.assign(new Error('Provider cooldown active.'),{name:'ProviderUnavailableError',status:429,retryAfterAt});
  const controller=new AbortController(),signal=init?.signal??input?.signal;let expired=false;
  const abort=()=>controller.abort(signal.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=clock.setTimeout(()=>{expired=true;controller.abort(deadlineError('RequestTimeoutError'));},ms);
  try{
   const response=await native(input,{...init,signal:controller.signal});
   // Keep the deadline active until nonstream provider bodies are consumed.
   const bytes=await response.arrayBuffer();
   if(response.status===429||response.status>=500){
    const raw=response.headers.get('retry-after'),seconds=raw===null?NaN:Number(raw),date=Date.parse(raw??'');
    const floor=Number.isFinite(seconds)&&seconds>=0?now()+seconds*1000:Number.isFinite(date)?date:now()+5000;
    cooldowns.set(url.origin,Math.max(cooldowns.get(url.origin)??0,floor));
    try{store?.setItem('standalone-provider-cooldowns',JSON.stringify(Object.fromEntries(cooldowns)));}catch{}
    throw Object.assign(new Error('Provider temporarily unavailable.'),{name:'ProviderUnavailableError',status:response.status,retryAfterAt:floor,mutation});
   }
   report({kind:'request',provider:url.origin===PROVIDER_ORIGINS[0]?'arkade':'explorer',mutation,durationMs:now()-started,status:response.status});
   return new Response([101,204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(error){report({kind:'request',mutation,durationMs:now()-started,failed:true});if(expired)throw Object.assign(deadlineError('RequestTimeoutError'),{mutation});throw error;}
  finally{clock.clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 };
 target.fetch=wrapped;
 const installed={setStorage,uninstall(){if(target.fetch===wrapped)target.fetch=native;delete target[marker];}};
 target[marker]=installed;return installed;
}
