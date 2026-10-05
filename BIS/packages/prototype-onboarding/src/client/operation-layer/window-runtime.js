import {claimWindowState} from './window-state.js';
import {requestLock} from './coordinator.js';

export let windowState,stateStorage,stateLocks,databaseName;
let initializing;
export async function initializeWindow(){
 if(windowState)return windowState;if(initializing)return initializing;
 initializing=(async()=>{
  if(!navigator.locks||!globalThis.indexedDB||!crypto.subtle)throw Object.assign(new Error('This browser needs Web Locks, IndexedDB and Web Crypto.'),{name:'CapabilityError'});
  const scope=await claimWindowState({session:sessionStorage,local:localStorage,locks:{request:(...args)=>requestLock(navigator.locks,...args)},
   requestedId:new URL(window.location.href).searchParams.get('window')??undefined,randomUUID:()=>crypto.randomUUID(),
   onPageHide:release=>window.addEventListener('pagehide',release,{once:true})});
  windowState=scope;stateStorage=scope.storage;databaseName=scope.databaseName;
  stateLocks={request:(name,...args)=>requestLock(navigator.locks,scope.lockName(name),...args)};
  updateWindowUrl();window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});return scope;
 })().finally(()=>{initializing=undefined;});return initializing;
}

export function updateWindowUrl(address){
 if(!windowState)return;
 const url=new URL(window.location.href);
 url.searchParams.set('window',windowState.id);
 if(address)url.searchParams.set('btcAddress',address);
 window.history.replaceState(null,'',url);
}
// URL addresses are display metadata, never wallet credentials or signing input.
