import {createRoot} from 'react-dom/client';
import {App} from '../src/App';
import {createContext} from '../../integration/src/core/context';
import type {BisAsset, BisMintAssetRequest} from '@bis/integration';
import '../src/style.css';

// Isolated provider boundary: no identity creation, storage or network wallet operations.
const params=new URLSearchParams(location.search),mode=params.get('mode')??'success';
let pending:BisMintAssetRequest|null=null,calls=0,holdings:BisAsset[]=mode==='owned'?[{assetId:'fixture-old',name:'Achievement: Level 1',ticker:'LVL1',decimals:0,quantity:'1',iconUrl:'/assets/achievements/v1/level-1-trophy.png'}]:[];
const fixture={calls:()=>calls,holdings:()=>holdings};Object.assign(window,{completionFixture:fixture});
function factory(){
  const context=createContext({load:async()=>({generation:0,account:mode==='guest'?null:{profileId:'fixture-profile',phrase:'fixture-invalid-not-recovery-material'}}),save:async()=>{throw Error('disabled');},reset:async()=>{throw Error('disabled');},subscribe:()=>()=>{}},async()=>{throw Error('disabled');},async()=> 'fixture-profile',async()=>{throw Error('disabled');},async()=>{throw Error('disabled');},async()=>{});
  context.listAssets=async()=>({status:'success',profileId:'fixture-profile',assets:holdings});
  context.getPendingAssetMint=async()=>({status:'success',profileId:'fixture-profile',request:pending});
  context.mintAsset=async request=>{
    calls++;pending=request;await new Promise(resolve=>setTimeout(resolve,600));
    if(mode==='uncertain'&&calls===1)return {status:'error',code:'outcome-unknown',message:'Fixture uncertain'};
    if(mode==='error'){pending=null;return {status:'error',code:'insufficient-funds',message:'Insufficient spendable funds.'};}
    const asset={assetId:`fixture-${calls}`,name:request.name,ticker:request.ticker,decimals:request.decimals,quantity:'1',iconUrl:`/assets/achievements/v2/level-${request.ticker.slice(3)}-trophy.png`};
    holdings=[...holdings,asset];pending=null;return {status:'minted',operationId:request.operationId,profileId:'fixture-profile',asset};
  };
  return context;
}
createRoot(document.getElementById('root')!).render(<App contextFactory={factory}/>);
