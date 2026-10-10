export type WarmJob = Readonly<{ run(): Promise<unknown>; eligible?(): boolean }>;
/** Finite, single-slot scheduler. No TTL timer; foreground reads bypass this queue. */
export function createBackgroundCache(options: { jobs: readonly WarmJob[]; paused(): boolean; schedule?: (run: () => void) => () => void }) {
  const schedule=options.schedule ?? (run => {
    let frame:number|undefined, idle:number|undefined, timer:ReturnType<typeof setTimeout>|undefined;
    const later=()=>{
      if (typeof requestIdleCallback==='function') idle=requestIdleCallback(run,{timeout:1000});
      else { timer=setTimeout(run,0); (timer as unknown as {unref?:()=>void}).unref?.(); }
    };
    if(typeof requestAnimationFrame==='function')frame=requestAnimationFrame(later);else later();
    return ()=>{if(frame!==undefined)cancelAnimationFrame(frame);if(idle!==undefined)cancelIdleCallback(idle);clearTimeout(timer);};
  });
  let cancelled=false, running=false, cancelScheduled:(()=>void)|undefined;
  const done=new Set<WarmJob>();
  function wake() {
    if (cancelled || running || cancelScheduled || options.paused()) return;
    const job=options.jobs.find(job=>!done.has(job) && (job.eligible?.() ?? true));
    if (!job) return;
    cancelScheduled=schedule(()=>{
      cancelScheduled=undefined;
      if (cancelled || options.paused()) return;
      done.add(job); running=true;
      void Promise.resolve().then(()=>{if(!cancelled)return job.run();}).catch(()=>{/* Optional warm failures never publish UI errors. */}).finally(()=>{running=false;wake();});
    });
  }
  return {wake,dispose(){cancelled=true;cancelScheduled?.();cancelScheduled=undefined;}};
}
