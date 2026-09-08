import {createRoot} from 'react-dom/client';
import {createBisUi,createBisGameWallet} from '@bis/integration';
import {createContext} from '../../integration/src/core/context';
import type {BisTransaction} from '../../integration/src/core/activity';
import {GameWalletPanel} from '../src/admin/GameWalletPanel';
import '@bis/integration/style.css';
import '../src/style.css';
// Test-only account and SDK doubles. No mnemonic, signing wallet or network calls.
let account: {profileId:string;phrase:string}|null=null, changed=()=>{}, publish: (rows:readonly BisTransaction[])=>void=()=>{}, submissions=0;
let complete=()=>{};
const observer=async(_a:unknown,signal:AbortSignal,p:(rows:readonly BisTransaction[])=>void)=>{publish=p;p([]);await new Promise<void>(r=>signal.addEventListener('abort',()=>r(),{once:true}));};
const context=createContext({load:async()=>({account,generation:0}),save:async()=>{},reset:async()=>{},subscribe:l=>{changed=l;return()=>{};}},undefined,async()=>account!.profileId,undefined,async()=>({availableSats:2000,totalSats:2000,bitcoinSats:0,arkadeSats:2000}),undefined,async()=>({arkadeAddress:'tark1fixture',bitcoinAddress:'tb1fixture'}),async()=>{},undefined,undefined,undefined,undefined,undefined,{},observer);
const scenario = new URLSearchParams(location.search).get('boarding') ?? 'ready';
const low = new URLSearchParams(location.search).has('low');
const game={profileId:'ABCDfixture56789',phrase:'fixture-only'};
const walletFactory:typeof createBisGameWallet=(options)=>{ const wallet=createBisGameWallet(options,{
 storage:{load:async()=>game,select:async()=>{},logout:async()=>{},subscribe:()=>()=>{},dispose(){}},restore:async()=>game,
 addresses:async()=>({arkadeAddress:'tark1gamefixture',bitcoinAddress:'tb1gamefixture'}),balance:async()=>({availableSats:low ? 0 : 2000,totalSats:2000,bitcoinSats:0,arkadeSats:2000}),
},undefined,{pay:async()=>{
 submissions++;document.getElementById('result')!.textContent=`Submissions: ${submissions}`;
 await new Promise<void>(resolve=>{complete=resolve;});
 publish([{id:'fixture-payment',identifier:'ark:fixture-payment',direction:'Incoming',amountSats:1000,status:'Settled offchain'}]);
 return {status:'succeeded',amountSats:1000};
},check:async()=>({status:'idle'})});
return {...wallet,checkLiveBoardingState:async()=> scenario as 'ready'|'waiting'|'boarded'|'unknown'};
};
const root=createRoot(document.getElementById('admin')!);
const playerProfileId=()=>context.getState().profileId;
const render=()=>root.render(<GameWalletPanel walletFactory={walletFactory} playerProfileId={playerProfileId} playerContext={context} playerActive={context.getState().phase==='active'} onDetails={()=>{}}/>);
context.subscribe(render);render();const ui=createBisUi(context);ui.mount(document.getElementById('runtime')!);
document.getElementById('login')!.onclick=()=>{account={profileId:'fixture-player',phrase:'fixture-only'};changed();};
document.getElementById('logout')!.onclick=()=>{account=null;changed();};
document.getElementById('complete')!.onclick=()=>complete();
document.getElementById('account')!.onclick=()=>context.openAccountDialog();
const incoming=(status:BisTransaction['status'])=>publish([{id:'incoming',identifier:'ark:incoming',direction:'Incoming',amountSats:2345,status}]);
document.getElementById('pending')!.onclick=()=>incoming('Pending offchain');
document.getElementById('confirmed')!.onclick=()=>incoming('Settled offchain');
