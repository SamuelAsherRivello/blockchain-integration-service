import type {createLocalGameWallet,BisGameWalletState} from './game-wallet.ts';
import {createGameWalletStorage} from './game-wallet-storage.ts';
import {walletReservations} from './wallet-reservations.ts';
import {withWalletMutation} from './boarding-record.ts';
export type HostedWalletOptions={serviceUrl:string;migrateSavedWallet?:boolean;playerProfileId():string|undefined};
export type GameWalletController=ReturnType<typeof createLocalGameWallet>;
type Snapshot={state:BisGameWalletState;paymentBalance?:number;paymentReason?:string;pendingPayment?:boolean};
const transports=new WeakMap<object,{url:string;update(snapshot:Snapshot):void}>();
export const hostedWalletTransport=(wallet:object)=>transports.get(wallet);

export function serviceUrl(value:string) {
 const url=new URL(value,globalThis.location?.href);url.pathname=url.pathname.replace(/\/$/,'');
 if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('A secure wallet service URL is required.');
 return url.href.replace(/\/$/,'');
}
export function createHostedGameWallet(options:HostedWalletOptions):GameWalletController {
 const url=serviceUrl(options.serviceUrl),listeners=new Set<()=>void>();
 const migrationKey=`bis-hosted-game-wallet-v1:${url}`;
 let snapshot:Snapshot={state:{status:'loading'}},disposed=false,migrationChecked=false,refreshing:Promise<void>|undefined;
 const update=(next:Snapshot)=>{if(disposed)return;snapshot=next;listeners.forEach(fn=>fn());};
 async function refresh(){if(disposed)return;if(refreshing)return refreshing;return refreshing=(async()=>{
  try{const response=await fetch(`${url}/v1/wallet`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();update(await response.json());
   if(options.migrateSavedWallet&&!migrationChecked&&snapshot.state.status!=='loading') {
    migrationChecked=true;
    if(snapshot.state.profileId)localStorage.setItem(migrationKey,'configured');
    else if(snapshot.state.status==='empty'&&localStorage.getItem(migrationKey)===null) {
     const saved=createGameWalletStorage();
     try {const account=await saved.load();if(account)await withWalletMutation(async()=>{if(walletReservations(account.profileId).length)throw Error('Resolve the previous wallet operations before migration.');if(!await admin('importWallet',account.phrase))throw Error('Import unavailable.');localStorage.setItem(migrationKey,'configured');await saved.logout();},account.profileId);}
     catch{update({...snapshot,state:{...snapshot.state,message:'Saved game wallet could not be moved to the service. Resolve any existing wallet operations, then retry Admin import.'}});}finally{saved.dispose();}
    }
   }
  }
  catch{update({state:{status:'unavailable',message:'Game wallet service unavailable.'}});}finally{refreshing=undefined;}
 })();}
 async function admin(method:string,...args:unknown[]) {
  const response=await fetch(`${url}/admin/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args}),signal:AbortSignal.timeout(75000)});
  if(!response.ok)throw Error('Game wallet operation unavailable. Use the private Admin connection.');
  const data=await response.json();update(data.wallet);return data.result;
 }
 const reason=()=>!options.playerProfileId()?'Awaiting Player':!snapshot.state.profileId?'Awaiting Game Wallet':snapshot.state.profileId===options.playerProfileId()?'Select A Different Wallet':snapshot.state.status!=='ready'?'Wallet Unavailable':snapshot.pendingPayment?'Awaiting Confirmation':(snapshot.paymentBalance??0)<1000?'Awaiting Balance':undefined;
 const wallet={
  getState:()=>snapshot.state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},refresh,
  async importWallet(phrase:string){try{return await admin('importWallet',phrase);}catch{update({...snapshot,state:{...snapshot.state,message:'Game wallet import failed. Check the private Admin connection and recovery phrase.'}});return false;}},
  async logout(){try{await admin('logout');localStorage.setItem(migrationKey,'deselected');}catch{update({...snapshot,state:{...snapshot.state,message:'Game wallet logout unavailable while recovery is pending.'}});}},
  getPlayerPaymentBalance:()=>snapshot.paymentBalance,getPlayerPaymentBlockReason:reason,canPayPlayer:()=>reason()===undefined,hasPendingPlayerPayment:()=>snapshot.pendingPayment??false,
  getMintAvailability:()=>admin('getMintAvailability'),getPendingAssetMint:()=>admin('getPendingAssetMint'),mintAsset:(request:unknown)=>admin('mintAsset',request),
  payPlayer:(recipient:unknown,current?:()=>boolean)=>{if(current&&!current())return Promise.reject(Error('The player changed.'));return admin('payPlayer',recipient);},
  checkPlayerPayment:()=>admin('checkPlayerPayment'),quoteBoarding:()=>admin('quoteBoarding'),board:(quote:unknown)=>admin('board',quote),checkBoarding:()=>admin('checkBoarding'),checkLiveBoardingState:()=>admin('checkLiveBoardingState'),checkLiveBoardingWait:()=>admin('checkLiveBoardingWait'),
  dispose(){disposed=true;clearInterval(timer);listeners.clear();transports.delete(wallet);},
 } satisfies GameWalletController;
 const timer=setInterval(()=>{void refresh();},10000);transports.set(wallet,{url,update});void refresh();return wallet;
}
