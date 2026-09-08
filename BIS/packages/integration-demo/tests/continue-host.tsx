import { createBisGameWallet } from '../../integration/src/core/game-wallet';
import { ArkAddress } from '@arkade-os/sdk';
import {createRoot} from 'react-dom/client';
import {App} from '../src/App';
import {createContext} from '../../integration/src/core/context';
import {continueResult,writeContinuation,type ContinueRecord} from '../../integration/src/core/continuation';
import '../src/style.css';
// Test-only page: isolated memory storage and injected adapter; no wallet or network operations.
const memory=new Map<string,string>();
Object.defineProperty(window,'localStorage',{configurable:true,value:{get length(){return memory.size;},key:(i:number)=>[...memory.keys()][i]??null,getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}});
if(new URLSearchParams(location.search).has('guest')) (document.getElementById('outcome') as HTMLSelectElement).value='no-account';
const choice=()=> (document.getElementById('outcome') as HTMLSelectElement).value;
const point=Uint8Array.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'.match(/../g)!, h=>parseInt(h,16));
const recipient=new ArkAddress(point,point,'tark').encode();
let submissions=0;
const account={profileId:'fixture-player',phrase:'fixture-only'};
function result(record:ContinueRecord) {
 const status=choice()==='failed'?'failed':choice()==='succeeded'?'succeeded':'pending';
 const saved:ContinueRecord={...record,status,...(status==='failed'?{}:{send:{version:1,id:'fixture-send',profileId:account.profileId,status,transactionId:'a'.repeat(64),quote:{id:'q',profileId:account.profileId,recipient,amountSats:1000,feeSats:0,totalSats:1000,maxSats:2000,expiresAt:Date.now()+60000,fingerprint:'b'.repeat(64)},inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)}})};
 if(status==='failed') saved.message='Insufficient eligible spendable funds for this 1,000-sat payment. No payment was submitted.';
 writeContinuation(saved);return continueResult(saved);
}
const importScenario=new URLSearchParams(location.search).has('wallet-import');
function factory(options: {continueRecipient?: string} = {}){return createContext({load:async()=>({account:choice()==='no-account'?null:account,generation:0}),save:async()=>{throw Error('Fixture disallows saving');},reset:async()=>{throw Error('Fixture disallows reset');},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,{submit:async(_a,r)=>{submissions++;document.getElementById('calls')!.textContent=`Submissions: ${submissions}`;return result(r);},reconcile:async(_a,r)=>r.status==='pending'?result(r):continueResult(r)},importScenario ? options : {continueRecipient:recipient});}
const gameWalletFactory: typeof createBisGameWallet = options => createBisGameWallet(options, {
 storage: {
  load:async()=>sessionStorage.getItem('fixture-game-wallet') ? {profileId:'fixture-game',phrase:'fixture-only'} : null,
  select:async()=>{sessionStorage.setItem('fixture-game-wallet','selected');},
  logout:async()=>{sessionStorage.removeItem('fixture-game-wallet');},subscribe:()=>()=>{},dispose() {},
 },
 restore:async()=>({profileId:'fixture-game',phrase:'fixture-only'}),
 addresses:async()=>({arkadeAddress:recipient,bitcoinAddress:'tb1fixture'}),
 balance:async()=>({availableSats:1000,totalSats:1000,arkadeSats:1000,bitcoinSats:0}),watch:undefined,
});
createRoot(document.getElementById('root')!).render(<App contextFactory={factory} gameWalletFactory={gameWalletFactory}/>);
