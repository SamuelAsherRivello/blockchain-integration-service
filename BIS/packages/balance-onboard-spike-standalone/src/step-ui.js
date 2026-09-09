/** Shared Step UI: header followed by five consistently labeled content rows. */
export function StepUI({step,owner,title,estimate,input,actions,status,output,id=''}){
 status+='<p class="step-recovery" role="status" aria-live="polite"></p><button class="step-recheck" hidden>Recheck saved state</button>';
 const row=(label,content)=>`<div class="step-ui-row" data-section="${label.toLowerCase()}"><h3 class="section-label">${label}</h3><div class="section-content">${content}</div></div>`;
 return `<details open class="panel step-ui" ${id?`id="${id}"`:''} data-step="${step}"><summary class="step-ui-header"><div class="step"><span class="step-caret" aria-hidden="true">›</span><span class="step-number">STEP ${step}</span><h2>${title}</h2><span class="owner ${owner==='USER'?'user':''}">${owner}</span><span class="step-completion">Pending</span><span class="estimate">${estimate}</span></div></summary><div class="step-ui-body">${row('Input',input)}${row('Actions',actions)}${row('Status',status)}${row('Output',output)}${row('Timing','<div class="timing-slot"></div>')}</div></details>`;
}

export function stepCompletion({accountReady,depositSeen,fundingConfirmed,phase,commitment}){
 const submitted=['submitting','registered','uncertain','boarded','committed','success'].includes(phase);
 return [!!accountReady,!!depositSeen||submitted,!!fundingConfirmed||submitted,submitted,!!commitment||phase==='success',phase==='success'];
}
export function renderStepCompletion(progress){
 const complete=stepCompletion(progress);
 document.querySelectorAll('.step-ui').forEach((panel,index)=>{
  panel.classList.toggle('step-complete',complete[index]);
  panel.classList.toggle('step-error',index===4&&progress.phase==='uncertain');
  panel.querySelector('.step-completion').textContent=complete[index]?'Complete':'Pending';
 });
}
export function setupStepDisclosure(storage){
 const key='standalone-step-ui-collapsed-v1';
 for(const panel of document.querySelectorAll('.step-ui')){
  const storageKey=`${key}:${panel.dataset.step}`;
  try{panel.open=storage.getItem(storageKey)!=='true';}catch{/* Keep steps open if storage is unavailable. */}
  panel.addEventListener('toggle',()=>{
   try{storage.setItem(storageKey,String(!panel.open));}catch{/* Disclosure remains usable without persistence. */}
  });
 }
}
