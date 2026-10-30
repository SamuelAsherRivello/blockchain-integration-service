// Deterministic presentation fixture only. No SDK wallets or provider calls.
import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {TreasureOfferPanel} from '../../src/client/admin-layer/TreasureLtoPanel';
let request:any,release:()=>void=()=>{};
const network=new URL(location.href).searchParams.get('network')==='mutinynet'?'mutinynet':'signet';
const fixture={block:false,claims:0,requests:[] as any[],logs:[] as any[],toasts:[] as string[],release:()=>release()};
const context={getState:()=>({phase:'active',profileId:'player',network}),showToast:(message:string)=>fixture.toasts.push(message)};
const gameWallet={getState:()=>({status:'ready',profileId:'game',network,selectionVersion:1}),subscribe:()=>()=>{}};
const offers={start:async(value:any)=>{request=value;fixture.requests.push(value);return {status:'pending'};},endSession:async()=>{},subscribe:()=>()=>{},
  checkContractsAsync:async()=>{
    if(fixture.block)await new Promise<void>(resolve=>{release=()=>{fixture.block=false;resolve();};});
    return {status:'ready',contracts:request?[{id:'fixture-only',type:'lto',purpose:request.purpose,sessionId:request.sessionId,
      hostReference:request.hostReference,expiresAt:request.expiresAt,scope:{playerId:'player',gameId:'game',network},
      financial:'funded',eligibility:'within-window',canClaim:true,validationMode:'browser-policy-v1'}]:[]};
  },claim:async()=>{fixture.claims++;return {status:'pending'};}};
Object.assign(window,{__treasureUiFixture:fixture});
createRoot(document.getElementById('root')!).render(createElement(TreasureOfferPanel,{context:context as any,gameWallet:gameWallet as any,offers:offers as any,onLog:(value:any)=>fixture.logs.push(value)}));
