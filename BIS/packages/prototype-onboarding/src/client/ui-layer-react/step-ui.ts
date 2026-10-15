/** Shared Step UI: header followed by five consistently labeled content rows. */
export function StepUI({step,owner,title,estimate,input,actions,status,output,id=''}){
 status+='<p class="step-recovery" role="status" aria-live="polite"></p><button class="step-recheck" hidden>Recheck saved state</button>';
 const row=(label,content)=>`<div class="step-ui-row" data-section="${label.toLowerCase()}"><h3 class="section-label">${label}</h3><div class="section-content">${content}</div></div>`;
 const initialState=step===1?'pending':'unstarted';
 const initialLabel=initialState==='pending'?'Pending':'Unstarted';
 return `<details class="panel step-ui step-${initialState}" ${id?`id="${id}"`:''} data-step="${step}"><summary class="step-ui-header"><div class="step"><span class="step-caret" aria-hidden="true">›</span><span class="step-number">STEP ${step}</span><h2>${title}</h2><span class="owner ${owner==='USER'?'user':''}">${owner}</span><span class="step-completion">${initialLabel}</span></div></summary><div class="step-ui-body">${row('Input',input)}${row('Actions',actions)}${row('Status',status)}${row('Output',output)}</div></details>`;
}

export function stepCompletion({accountReady,depositSeen,fundingConfirmed,phase,commitment}){
 const submitted=['submitting','registered','uncertain','boarded','committed','success'].includes(phase);
 return [!!accountReady,!!depositSeen||submitted,!!fundingConfirmed||submitted,submitted,!!commitment||phase==='success',phase==='success'];
}
export function stepStates(progress){
 const complete=stepCompletion(progress);
 const pendingIndex=complete.findIndex(isComplete=>!isComplete);
 return complete.map((_,index)=>pendingIndex===-1||index<pendingIndex?'complete':index===pendingIndex?'pending':'unstarted');
}
export function renderStepCompletion(progress){
 const states=stepStates(progress);
 document.querySelectorAll('.step-ui').forEach((panel,index)=>{
  const state=states[index];
  const needsAttention=index===4&&progress.phase==='uncertain';
  const previousState=panel.dataset.renderedState;
  panel.classList.toggle('step-complete',state==='complete');
  panel.classList.toggle('step-pending',state==='pending');
  panel.classList.toggle('step-unstarted',state==='unstarted');
  panel.classList.toggle('step-error',index===4&&progress.phase==='uncertain');
  panel.querySelector('.step-completion').textContent=state==='complete'?'Complete':state==='pending'?'Pending':'Unstarted';
  if(previousState===undefined||(state==='pending'&&previousState!==state)||needsAttention) panel.open=state==='pending'||needsAttention;
  panel.dataset.renderedState=state;
 });
}
export function setupStepDisclosure(storage){
 for(const panel of document.querySelectorAll('.step-ui')){
  panel.querySelector('.step-number').textContent=`Step ${panel.dataset.step}`;
  panel.open=false;
 }
}
