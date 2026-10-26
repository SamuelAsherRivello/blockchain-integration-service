// Wallet-free read-error fixture. No wallet, funding, signing or reward exists.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AdminGameWalletView} from '../../src/client/admin-layer/GameWalletPanel';
const observation={reads:0,reports:0};
Object.assign(window,{__treasureReadiness:observation});
const state={status:'ready',profileId:'read-only-fixture',selectionVersion:1,playerConnected:true};
const controller:any={getState:()=>state,subscribe:()=>()=>{},checkLiveBoardingState:async()=>{observation.reads++;throw Error('Fixture read unavailable');}};
function Host(){
  const [reports,setReports]=useState(0);
  return <><p role="status">Read reports: {reports}</p><AdminGameWalletView controller={controller} mode="board" onOpenDeveloper={()=>{}}
    onDetails={()=>{observation.reports++;setReports(value=>value+1);}}/></>;
}
createRoot(document.getElementById('host')!).render(<Host/>);
