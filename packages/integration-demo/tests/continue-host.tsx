import {createRoot} from 'react-dom/client';
import {App} from '../src/App';
import {createContext} from '../../integration/src/core/context';
import {continueResult,writeContinuation,type ContinueRecord} from '../../integration/src/core/continuation';
import '../src/style.css';
// Test-only page: isolated memory storage and injected adapter; no wallet or network operations.
const memory=new Map<string,string>();
Object.defineProperty(window,'localStorage',{configurable:true,value:{get length(){return memory.size;},key:(i:number)=>[...memory.keys()][i]??null,getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)}});
const choice=()=> (document.getElementById('outcome') as HTMLSelectElement).value;
let submissions=0;
const account={profileId:'fixture-player',phrase:'fixture-only'};
function result(record:ContinueRecord) {
 const status=choice()==='failed'?'failed':choice()==='succeeded'?'succeeded':'pending';
 const saved:ContinueRecord={...record,status,...(status==='failed'?{}:{send:{version:1,id:'fixture-send',profileId:account.profileId,status,transactionId:'a'.repeat(64),quote:{id:'q',profileId:account.profileId,recipient:'tark1fixture',amountSats:1000,feeSats:0,totalSats:1000,maxSats:2000,expiresAt:Date.now()+60000,fingerprint:'b'.repeat(64)},inputs:[{txid:'c'.repeat(64),vout:0}],recipientScript:'5120'+'d'.repeat(64)}})};
 writeContinuation(saved);return continueResult(saved);
}
function factory(){return createContext({load:async()=>({account:choice()==='no-account'?null:account,generation:0}),save:async()=>{throw Error('Fixture disallows saving');},reset:async()=>{throw Error('Fixture disallows reset');},subscribe:()=>()=>{}},undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,{submit:async(_a,r)=>{submissions++;document.getElementById('calls')!.textContent=`Submissions: ${submissions}`;return result(r);},reconcile:async(_a,r)=>r.status==='pending'?result(r):continueResult(r)});}
createRoot(document.getElementById('root')!).render(<App contextFactory={factory}/>);
