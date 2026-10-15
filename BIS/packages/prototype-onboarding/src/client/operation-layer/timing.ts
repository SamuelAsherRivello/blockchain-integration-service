export const TIMING_KEY='standalone-arkade-step-timings-v1';
export const emptyTimings=()=>({version:1,runs:{},averages:{}});
export function totalTiming(data){
 const completed=Object.values(data.runs).map(steps=>({start:steps[1]?.startedAt,end:steps[6]?.finishedAt})).filter(s=>Number.isSafeInteger(s.start)&&Number.isSafeInteger(s.end)&&s.start>=0&&s.end>=s.start).sort((a,b)=>b.end-a.end);
 const lastMs=completed.length?completed[0].end-completed[0].start:null;
 if(completed.length){const average=completed.reduce((total,s)=>total+s.end-s.start,0)/completed.length;return {minMs:average,maxMs:average,lastMs,observed:true};}
 const defaults=[[10000,10000],[60000,300000],[600000,3600000],[10000,10000],[600000,3600000],[5000,15000]];
 const ranges=defaults.map((range,index)=>{const stats=data.averages?.[index+1];return stats?.count&&Number.isFinite(stats.averageMs)&&stats.averageMs>=0?[stats.averageMs,stats.averageMs]:range;});
 return {minMs:ranges.reduce((sum,r)=>sum+r[0],0),maxMs:ranges.reduce((sum,r)=>sum+r[1],0),lastMs,observed:false};
}
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
export async function recordTiming(run,step,action,at=Date.now(),storage=localStorage,locks=navigator.locks){
 try{
  await locks.request('standalone-step-timings',()=>{
   const before=loadTimings(storage),after=updateTiming(before,run,step,action,at);
   if(JSON.stringify(before)!==JSON.stringify(after))storage.setItem(TIMING_KEY,JSON.stringify(after));
  });
  return true;
 }catch{return false;} // Timing diagnostics must never interrupt a wallet operation.
}
