import {initializeWindow,stateStorage} from './window-runtime.js';
import {installTransport} from './transport.js';
import {errorSummary} from './callback-errors.js';
import './style.css';
const root=document.getElementById('app');let running=false,loaded=false;
function show(message){
 if(loaded)return;root.replaceChildren();const title=document.createElement('h1');title.textContent='Spike #1 · Connecting';
 const status=document.createElement('p');status.setAttribute('role','alert');status.textContent=message;
 const retry=document.createElement('button');retry.textContent='Retry connection';retry.onclick=()=>void boot();root.append(title,status,retry);
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
