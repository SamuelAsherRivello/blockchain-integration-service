export const scope={profileId:'onboarding-player',network:'signet',operator:'https://signet.arkade.sh'};
export const coin={txid:'a'.repeat(64),vout:0,value:12001};
export const script='5120'+'b'.repeat(64);
export const receipt={txid:'c'.repeat(64),vout:0,value:12001};
export const finalReceipt={txid:'d'.repeat(64),vout:0,value:6000};
export function draft(){return {version:1,id:'parent-1',...scope,revision:1,createdAt:100,status:'pending',allocationPercent:50,independent:[],
  plan:{inputs:[coin],totalSats:12001,targetSats:6000,returnSats:6001,bitcoinScript:script,arkadeScript:script},
  boarding:{phase:'prepared',attemptId:'board-1',inputs:[coin],outputs:[{script,value:12001,network:'arkade'}]},
  returning:{phase:'unprepared',inputs:[],outputs:[{script,value:6001,network:'bitcoin'},{script,value:6000,network:'arkade'}]}};}
export function facts(){return {address:'tb1-fixture',transactions:[],independent:[],snapshot:{...scope,complete:true,unresolvedOnboarding:false,bitcoinScript:script,arkadeScript:script,boarding:[{...coin,confirmed:true,expired:false,reserved:false}],spendable:[],policy:{zeroFees:true,arkadeMinimum:330,bitcoinMinimum:330,arkadeMaximum:0,bitcoinMaximum:0}}};}
export function storage(){const data=new Map();const db={data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:db});return db;}
export const flush=async()=>{for(let n=0;n<60;n++)await Promise.resolve();};
export function queuedLock(){let tail=Promise.resolve(),held=false;return async work=>{const before=tail;let release;tail=new Promise(r=>release=r);await before;try{if(held)throw Error('nested lock');held=true;return await work();}finally{held=false;release();}};}
