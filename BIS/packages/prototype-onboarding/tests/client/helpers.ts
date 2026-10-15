export function queuedLocks(){
 const held=new Map(),queues=new Map();
 const pump=name=>{
  if(held.has(name))return;
  const queue=queues.get(name),job=queue?.shift();
  if(!job)return;
  job.signal?.removeEventListener('abort',job.abort);
  held.set(name,job);
  Promise.resolve().then(()=>job.callback({name})).then(job.resolve,job.reject).finally(()=>{held.delete(name);pump(name);});
 };
 return {held,request(name,options,callback){
  if(typeof options==='function'){callback=options;options={};}
  if(options.signal?.aborted)return Promise.reject(options.signal.reason);
  if(options.ifAvailable&&(held.has(name)||queues.get(name)?.length))return Promise.resolve(callback(null));
  return new Promise((resolve,reject)=>{
   const queue=queues.get(name)??[];queues.set(name,queue);
   const job={callback,resolve,reject,signal:options.signal};
   job.abort=()=>{const index=queue.indexOf(job);if(index>=0){queue.splice(index,1);reject(options.signal.reason);}};
   options.signal?.addEventListener('abort',job.abort,{once:true});queue.push(job);pump(name);
  });
 }};
}
export function fakeClock(start=1000){
 let now=start,next=0;const jobs=new Map();
 return {now:()=>now,random:()=>0,jobs,setTimeout(fn,ms){const id=++next;jobs.set(id,{fn,at:now+ms,ms});return id;},clearTimeout(id){jobs.delete(id);},
  async advance(ms){now+=ms;for(const [id,job] of [...jobs])if(job.at<=now){jobs.delete(id);job.fn();}await new Promise(setImmediate);}};
}
export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
