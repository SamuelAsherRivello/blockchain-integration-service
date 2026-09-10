import {initializeWindow,stateStorage} from './window-runtime.js';
import {installTransport} from './transport.js';
import {errorSummary} from './callback-errors.js';
import './style.css';
import './admin-polish.css';
const root=document.getElementById('app');let running=false,loaded=false;
function show(message){
 if(loaded)return;root.classList.remove('spike-app');root.classList.add('spike-boot');root.replaceChildren();
 const header=document.createElement('header');header.className='spike-header';header.innerHTML='<div class="spike-identity"><span class="spike-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><div><h1>Balance Onboard</h1><p>Standalone Signet Spike</p></div></div><span class="spike-network">Signet only</span>';
 const panel=document.createElement('section');panel.className='boot-panel';const title=document.createElement('h2');title.textContent='Connecting to this window';
 const status=document.createElement('p');status.setAttribute('role','alert');status.textContent=message;
 const retry=document.createElement('button');retry.textContent='Retry connection';retry.onclick=()=>void boot();panel.append(title,status,retry);root.append(header,panel);
}
const bootstrapError=event=>{if(!loaded)show(`Startup interrupted. ${errorSummary(event.reason??event.error)} Saved account data is retained.`);};
window.addEventListener('error',bootstrapError,true);window.addEventListener('unhandledrejection',bootstrapError);
async function boot(){
 if(running||loaded)return;running=true;show('Opening this window’s saved account…');
 try{const transport=installTransport();await initializeWindow();transport.setStorage(stateStorage);await import('./main.js');loaded=true;}
 catch(error){show(`${error?.name==='CapabilityError'?'Required browser capabilities unavailable.':'Could not initialize this window.'} ${errorSummary(error)} Retry after restoring browser storage or connectivity.`);}
 finally{running=false;}
}
void boot();
