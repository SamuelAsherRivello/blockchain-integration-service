import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MintAssetDialog} from '../src/admin/MintAssetDialog';
import {prepareMintDestination, type MintDestination, type MintWallet} from '../src/admin/mint-destination';
import type {BisMintAssetRequest, BisMintAssetResult} from '@bis/integration';
import '../src/style.css';
import '@bis/integration/style.css';

// Isolated UI fixture. No real accounts, signing, storage or network operations.
const params=new URLSearchParams(location.search);
const calls: unknown[]=[];
const logs: unknown[]=[];
const listeners=new Set<()=>void>();
let release: (()=>void)|undefined;
let playerId='fixture-player',gameId='fixture-game';
const recovered=(destination:MintDestination):BisMintAssetRequest=>({operationId:`pending-${destination}`,name:`Pending ${destination}`,ticker:'PEND',amount:'1',decimals:0});
function wallet(destination:MintDestination):MintWallet|undefined {
  if(params.get('missing')===destination || params.get('missing')==='both')return;
  const profileId=()=>destination==='player'?playerId:gameId;
  return {
    getState:()=>({profileId:profileId()}),
    subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    getPendingAssetMint:async()=> {
      if(params.get('lookup')==='error')throw Error('Pending mint lookup failed.');
      if(params.get('lookup')==='held' && destination==='game')await new Promise<void>(resolve=>{release=resolve;});
      return {status:'success',profileId:profileId(),request:params.has('recovery')?recovered(destination):null};
    },
    mintAsset:async request=> {
      if(params.get('funds')==='insufficient')return {status:'error',code:'insufficient-funds',message:'Insufficient eligible funds.'};
      calls.push({destination,profileId:profileId(),request});
      if(params.has('held'))await new Promise<void>(resolve=>{release=resolve;});
      if(params.has('unknown'))return {status:'error',code:'outcome-unknown',message:'Mint outcome unknown. Check mint status.'};
      return {status:'minted',profileId:profileId(),operationId:request.operationId,asset:{assetId:'fixture-only',quantity:request.amount,name:request.name,ticker:request.ticker,decimals:request.decimals}} as BisMintAssetResult;
    },
  };
}
const player=wallet('player'),game=wallet('game');
const prepare=(destination:MintDestination)=>prepareMintDestination(destination,destination==='player'?player:game,()=>true,result=>logs.push(result));
Object.assign(window,{mintFixture:{calls,logs,release:()=>release?.(),replace:()=>{playerId='replacement-player';gameId='replacement-game';listeners.forEach(l=>l());}}});
function Host(){const [open,setOpen]=useState(false);return <main><h1>Isolated mint destination verification</h1><button onClick={()=>setOpen(true)}>Open Mint Asset</button>{open&&<MintAssetDialog prepare={prepare} onClose={()=>setOpen(false)}/>}</main>;}
createRoot(document.getElementById('root')!).render(<Host/>);
