import {ArkAddress} from '@arkade-os/sdk';
import {createRoot} from 'react-dom/client';
import {BisView} from '../../integration/src/ui/client';
import {createContext} from '../../integration/src/core/context';
import type {BisTransaction} from '../../integration/src/core/activity';
import type {BisAsset} from '../../integration/src/core/assets';
// Test-only dependency injection; no saved account or SDK wallet is opened.
const memory=new Map<string,string>();
Object.defineProperty(window,'localStorage',{configurable:true,value:{get length(){return memory.size;},key:(i:number)=>[...memory.keys()][i]??null,getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}});
const account={profileId:'subscription-fixture',phrase:'fixture-only'};
let sats=2000,starts=0,active=0,rows:readonly BisTransaction[]=[],holdings:BisAsset[]=[],publish:(r:readonly BisTransaction[])=>void=()=>{};
const counts=()=>{document.getElementById('sources')!.textContent=` Sources started: ${starts}; active: ${active}`;};
const observer=async(_a:unknown,signal:AbortSignal,p:(r:readonly BisTransaction[])=>void)=>{starts++;active++;counts();publish=p;if(starts===1)p(rows);else setTimeout(()=>{if(!signal.aborted)p(rows);},1200);await new Promise<void>(r=>signal.addEventListener('abort',()=>{active--;counts();r();},{once:true}));};
const context=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,async()=>{await new Promise(r=>setTimeout(r,250));return {availableSats:sats,totalSats:sats,bitcoinSats:0,arkadeSats:sats};},undefined,undefined,observer,undefined,{list:async()=>holdings,mint:async()=>{throw Error('Fixture cannot mint');}},undefined,undefined,{submit:async(_a,r)=>{sats=1000;return {...r.request,profileId:account.profileId,status:'succeeded' as const,mechanism:'game-wallet-payment' as const,feeSats:0 as const};},reconcile:async()=>{throw Error('Fixture has no pending payments');}},{continueRecipient:new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode()},observer);
context.subscribe(()=>{const s=context.getState();document.getElementById('state')!.textContent=JSON.stringify({balance:s.balance,assets:s.assets,activity:s.activity},null,2);});
createRoot(document.getElementById('runtime')!).render(<BisView context={context}/>);
await context.ready();context.openAccountDialog();context.openAccountDetails();
document.getElementById('outgoing')!.onclick=()=>{sats=1000;rows=[{id:'outgoing-fixture',identifier:'ark:fixture',amountSats:1000,direction:'Outgoing',status:'Settled offchain'}];publish(rows);};
document.getElementById('assets')!.onclick=()=>{holdings=[{assetId:'a'.repeat(68),quantity:'3',name:'Fixture trophy'}];publish(rows);};
document.getElementById('balance')!.onclick=()=>context.openAccountDetails();
document.getElementById('activity')!.onclick=()=>context.openAccountActivity();
document.getElementById('holdings')!.onclick=()=>context.openAccountAssets();
window.addEventListener('pagehide',()=>context.dispose(),{once:true});

let paymentCycles=0,tracking=false,previousLoading=false;
context.subscribe(()=>{if(!tracking)return;const loading=['idle','loading'].includes(context.getState().balance.status);if(loading&&!previousLoading)paymentCycles++;previousLoading=loading;document.getElementById('cycles')!.textContent=` Payment loading cycles: ${paymentCycles}`;});
document.getElementById('pay')!.onclick=async()=>{paymentCycles=0;previousLoading=false;tracking=true;await context.requestContinue({operationId:crypto.randomUUID(),sats:1000,context:'fixture-continue'});};
