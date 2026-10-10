import {createRoot} from 'react-dom/client';
import {createLocalGameWallet} from '../../../integration/src/client/state-layer-core/game-wallet';
import {AdminGameWalletView} from '../../src/client/admin-layer/GameWalletPanel';
const reads:Array<(value:any)=>void>=[];
const wallet=createLocalGameWallet({playerProfileId:()=> 'player',playerNetwork:()=> 'signet'},{
 storage:{load:()=>new Promise(resolve=>reads.push(resolve)),subscribe:()=>()=>{},dispose(){},select:async()=>{},logout:async()=>{},reset:async()=>{}},
 restore:async()=>({profileId:'game',phrase:'fixture-only'}),addresses:async()=>({arkadeAddress:'tark1fixture',bitcoinAddress:'tb1fixture'}),balance:async()=>({availableSats:2000,totalSats:2000,arkadeSats:2000,bitcoinSats:0}),watch:undefined,
},undefined,undefined,()=>{});
createRoot(document.getElementById('host')!).render(<AdminGameWalletView controller={wallet} mode="account" onOpenDeveloper={()=>{}} onDetails={report=>{document.getElementById('details')!.textContent=JSON.stringify(report);}}/>);
document.getElementById('run')!.onclick=async()=>{
 const result=document.getElementById('result')!;
 try{const fresh=wallet.refresh();reads[1]!({profileId:'game',phrase:'fixture-only',network:'signet'});await fresh;
  const ready=wallet.getState();reads[0]!({profileId:'player',phrase:'fixture-only',network:'signet'});await new Promise(resolve=>setTimeout(resolve,0));
  if(wallet.getState()!==ready)throw Error('Old conflict overwrote ready wallet');
  result.textContent='PASS: ready Game Wallet survives obsolete role conflict; 2000 sats remain current.';
 }catch(error){result.textContent=`FAIL: ${error instanceof Error?error.message:'refresh'}`;}
};
