import {loadTimings,duration} from './timing.js';
const descriptions=[
 'Create/Recreate click → boarding address ready. Restoring an existing account is not a new sample.',
 'Faucet opened → deposit first detected. Includes user time and faucet queue time; the app cannot observe the faucet form.',
 'Deposit first detected → funding confirmed and eligible. Measures observation time, not an inferred broadcast time.',
 'Confirmed funding ready → your Onboard 50% click. Includes time away from the app.',
 'Onboarding submitted → commitment observed. Uncertain transfers keep timing until a commitment is verified.',
 'Commitment observed → usable Arkade funds verified.'
];
let panels=[],originalEstimates=[];
export function setupTimingViews(){
panels=[...document.querySelectorAll('.panel')];
originalEstimates=panels.map(panel=>panel.querySelector('.estimate').textContent);
panels.forEach((panel,index)=>{
 const view=document.createElement('div');view.className='step-timing';
 view.innerHTML='<p class="timing-current"></p><p class="timing-average"></p><details><summary>Calculation &amp; measurement</summary><p class="timing-calculation"></p><small></small></details>';
 view.querySelector('small').textContent=descriptions[index];panel.querySelector('.timing-slot').append(view);
});
}
export function renderTimings(run,now=Date.now()){
 let data;
 try{data=loadTimings(localStorage);}catch{
  panels.forEach(panel=>{panel.querySelector('.timing-average').textContent='Timing history unavailable in local storage.';panel.querySelector('.timing-calculation').textContent='';panel.querySelector('.timing-current').textContent='';});return;
 }
 panels.forEach((panel,index)=>{
  const step=index+1,stats=data.averages?.[step],sample=data.runs[run]?.[step];
  panel.querySelector('.estimate').textContent=stats?.count?`~${duration(stats.averageMs)} observed average`:originalEstimates[index];
  panel.querySelector('.timing-average').textContent=stats?.count?`Previous transactions averaged ${duration(stats.averageMs)} · ${stats.count} completed sample${stats.count===1?'':'s'}.`:'Previous transactions averaged: no completed samples yet.';
  panel.querySelector('.timing-calculation').textContent=stats?.count?`${(stats.totalMs/1000).toFixed(1)}s total ÷ ${stats.count} sample${stats.count===1?'':'s'} = ${(stats.averageMs/1000).toFixed(1)}s average`:'Average = total completed duration ÷ completed samples. Waiting for the first measurement.';
  panel.querySelector('.timing-current').textContent=!sample?'This run: no start recorded.':sample.finishedAt!==undefined?`This run completed in ${duration(sample.durationMs)}.`:`This run: ${duration(now-sample.startedAt)} elapsed · in progress, excluded from average.`;
 });
}
