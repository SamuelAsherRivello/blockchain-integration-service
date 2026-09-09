export const TIMING_KEY='standalone-arkade-step-timings-v1';
export const emptyTimings=()=>({version:1,runs:{},averages:{}});
export function updateTiming(data,run,step,action,at){
 if(!run||!Number.isInteger(step)||step<1||step>6||!Number.isSafeInteger(at)||at<0)return data;
 const result=structuredClone(data), steps=result.runs[run]??={};
 if(action==='start'&&!steps[step])steps[step]={startedAt:at};
 const sample=steps[step];
 if(action==='finish'&&sample&&sample.finishedAt===undefined&&at>=sample.startedAt){sample.finishedAt=at;sample.durationMs=at-sample.startedAt;}
 result.averages={};
 for(let index=1;index<=6;index++){
  const durations=Object.values(result.runs).map(r=>r[index]).filter(s=>s&&Number.isSafeInteger(s.durationMs)&&s.durationMs>=0&&s.finishedAt-s.startedAt===s.durationMs).map(s=>s.durationMs);
  const totalMs=durations.reduce((a,b)=>a+b,0),count=durations.length;
  result.averages[index]={count,totalMs,averageMs:count?totalMs/count:null};
 }
 return result;
}
export function duration(ms){
 if(ms<10000)return `${(Math.max(0,ms)/1000).toFixed(1)}s`;
 const seconds=Math.round(Math.max(0,ms)/1000);
 if(seconds<60)return `${seconds}s`;
 if(seconds<3600)return `${Math.floor(seconds/60)}m ${seconds%60}s`;
 return `${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m`;
}
export function loadTimings(storage){
 const raw=storage.getItem(TIMING_KEY);if(!raw)return emptyTimings();
 const value=JSON.parse(raw);
 if(value.version!==1||!value.runs||typeof value.runs!=='object'||Array.isArray(value.runs))throw Error('Timing history is unavailable.');
 return value;
}
export async function recordTiming(run,step,action,at=Date.now()){
 try{
  await navigator.locks.request('standalone-step-timings',()=>{
   const before=loadTimings(localStorage),after=updateTiming(before,run,step,action,at);
   if(JSON.stringify(before)!==JSON.stringify(after))localStorage.setItem(TIMING_KEY,JSON.stringify(after));
  });
  return true;
 }catch{return false;} // Timing diagnostics must never interrupt a wallet operation.
}
