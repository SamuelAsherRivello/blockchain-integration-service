import {createContext,getControls} from '../../integration/src/core/context';
import type {BisTransaction} from '../../integration/src/core/activity';
import {createBisUi} from '@bis/integration';
import '@bis/integration/style.css';

// Isolated component fixture; never imported by production and never reads real wallets.
Object.defineProperty(window,'localStorage',{configurable:true,value:{length:0,key:()=>null,getItem:()=>null}});
let publish:(rows:readonly BisTransaction[])=>void=()=>{},rows:readonly BisTransaction[]=[],hold=false;
const reads: (()=>void)[]=[];
const amounts=()=>({availableSats:rows.length?3000:2000,totalSats:rows.length?3000:2000,bitcoinSats:0,arkadeSats:rows.length?3000:2000});
const observer=async(_account:unknown,signal:AbortSignal,callback:typeof publish)=>{publish=callback;callback(rows);await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));};
const account={profileId:'fixture',phrase:'not-a-wallet'};
const context=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,async()=>hold?new Promise(resolve=>reads.push(()=>resolve(amounts()))):amounts(),undefined,undefined,observer,undefined,undefined,undefined,undefined,undefined,{},observer);
const ui=createBisUi(context);ui.mount(document.getElementById('preview')!);
await context.ready();context.openAccountDialog();context.openAccountDetails();
document.getElementById('pending')!.onclick=()=>{hold=true;rows=[{id:'test-receipt',identifier:'ark:test-receipt',amountSats:1000,direction:'Incoming',status:'Pending offchain'}];publish(rows);};
document.getElementById('verify')!.onclick=()=>{rows=rows.map(row=>({...row,receiptVerified:true}));publish(rows);};
document.getElementById('release')!.onclick=()=>{hold=false;reads.splice(0).forEach(release=>release());};
document.getElementById('duplicate')!.onclick=()=>publish(rows);
for (const messageType of ['info','warning','error','success'] as const) {
 const button=document.createElement('button');button.textContent=`Preview ${messageType}`;
 button.onclick=()=>{getControls(context).toasts.clear();context.showToast({info:'Payment is processing…',warning:'Log in to pay to continue.',error:'Payment could not be submitted. Check your account and funds, then try again.',success:'Transferred 1000 sats from Bitcoin to Arkade'}[messageType],{messageType,durationMs:60000});};
 document.body.insertBefore(button,document.getElementById('preview'));
}
const artwork=document.createElement('button');artwork.textContent='Preview artwork at half scale';
artwork.onclick=()=>{const host=document.getElementById('preview')!;host.style.width='360px';host.style.height='640px';host.style.transform='scale(.5)';host.style.transformOrigin='top left';getControls(context).toasts.clear();context.showToast('Level 1 trophy collected!',{messageType:'success',imageUrl:'/tests/toast-artwork.svg',durationMs:60000});};
document.body.insertBefore(artwork,document.getElementById('preview'));
