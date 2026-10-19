import {createCheckoutSession} from '../../src/client/marketplace-layer/checkout-session';
import {advanceLocalMarketplaceCheckout,beginLocalMarketplaceCheckout,confirmLocalMarketplaceCheckoutLeg,readLocalMarketplaceCheckout,readLocalMarketplaceCheckouts} from '../../../integration/src/client/state-layer-core/marketplace-checkout';
const memory=new Map<string,string>();
Object.defineProperty(window,'localStorage',{value:{get length(){return memory.size;},key:(i:number)=>[...memory.keys()][i],getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)}});
const listeners=new Set<()=>void>();const subscribe=(l:()=>void)=>{listeners.add(l);return()=>{listeners.delete(l);};};
let gameId='game-A',version=0,release:(()=>void)|undefined,submissions=0;
const pause=()=>new Promise<void>(resolve=>{release=resolve;document.getElementById('result')!.textContent='Read paused';});
const at=()=> (document.getElementById('pause') as HTMLSelectElement).value;
const player:any={getState:()=>({profileId:'player',phase:'active',network:'signet'}),subscribe,getSendSpendable:async()=>{if(at()==='balance')await pause();return 2000;},getPaymentRecipient:async()=>{if(at()==='recipient')await pause();return {profileId:'player',address:'tark1playerdestination'};}};
const game:any={getState:()=>({profileId:gameId,selectionVersion:version,network:'signet',addresses:{arkadeAddress:'tark1gamedestination'}}),subscribe,getPlayerPaymentBalance:()=>2000};
const session=createCheckoutSession(player,game,{begin:beginLocalMarketplaceCheckout,confirm:confirmLocalMarketplaceCheckoutLeg,read:readLocalMarketplaceCheckout});
document.getElementById('replace')!.onclick=()=>{gameId='game-B';version++;for(const l of listeners)l();};
document.getElementById('release')!.onclick=()=>release?.();
document.getElementById('buy')!.onclick=async()=>{
 const scope=session.capture();
 try{const record=await session.prepare({direction:'buy',assetId:'a'.repeat(68),quantity:'1',priceSats:1000},scope);
  await advanceLocalMarketplaceCheckout(record,{isCurrent:()=>session.current(scope),pay:async()=>{submissions++;throw Error('Unexpected signer invocation');},deliver:async()=>{submissions++;throw Error('Unexpected signer invocation');}});
  document.getElementById('result')!.textContent='FAIL: obsolete checkout advanced';
 }catch(error){document.getElementById('result')!.textContent=error instanceof Error&&error.message.includes('session changed')?'PASS: stale checkout rejected before signing.':`FAIL: ${String(error)}`;}
 document.getElementById('calls')!.textContent=`Submissions: ${submissions}; journals: ${readLocalMarketplaceCheckouts().length}`;
};
