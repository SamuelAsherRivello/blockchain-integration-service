export type BatchEvent = {type:string;id:string;intentIdHashes?:string[]};
/** Filter failures before SDK handling; heartbeats/replayed stages cannot extend a stall. */
export function onboardingStream<T extends BatchEvent>(open:(signal:AbortSignal)=>AsyncIterableIterator<T>, signal:AbortSignal, intentHash:()=>string|undefined, progressMs:number, absoluteMs:number, onProgress:(event:T)=>void) {
  const controller=new AbortController();let progressTimer:ReturnType<typeof setTimeout>|undefined,absoluteTimer:ReturnType<typeof setTimeout>|undefined,expired=false;
  const abort=()=>controller.abort();const expire=()=>{expired=true;controller.abort();};
  let selected:string|undefined;const seen=new Set<string>();
  const arm=()=>{clearTimeout(progressTimer);progressTimer=setTimeout(expire,progressMs);};
  const select=(e:T)=>{
    const hash=intentHash();
    if(e.type==='batch_started'&&hash&&e.intentIdHashes?.includes(hash)&&(!selected||selected===e.id))selected=e.id;
    if(e.id!==selected)return;
    const key=`${e.id}:${e.type}`;
    if(!seen.has(key)){seen.add(key);arm();onProgress(e);}
  };
  return (async function*(){
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    arm();absoluteTimer=setTimeout(expire,absoluteMs);const source=open(controller.signal);
    try{while(!controller.signal.aborted){const next=await source.next();if(expired)throw Error('Onboarding progress deadline exceeded.');if(next.done)return;const e=next.value;select(e);
      if(e.type==='batch_failed'&&e.id!==selected||selected&&e.id!==selected)continue;
      yield e;select(e); // SDK can prime the stream before registration resolves.
    }if(expired)throw Error('Onboarding progress deadline exceeded.');signal.throwIfAborted();}
    finally{clearTimeout(progressTimer);clearTimeout(absoluteTimer);signal.removeEventListener('abort',abort);controller.abort();await source.return?.();}
  })();
}
