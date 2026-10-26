// Deterministic console test only. No account, signing, funded offer or payment.
import {createRoot} from 'react-dom/client';
import {App} from '../../src/client/ui-layer-react/App';
import {createContext} from '../../../integration/src/client/state-layer-core/context';
const unavailable=async()=>{throw Error('Financial/account actions are outside this fixture');};
const contextFactory=()=>createContext({load:async()=>({generation:0,account:null}),save:unavailable,reset:async()=>{},subscribe:()=>()=>{}},
  unavailable,async()=> 'unused',unavailable,unavailable,unavailable,unavailable,async()=>{});
const observation={refreshes:0,failBoarding:()=>{}};Object.assign(window,{__treasureConsole:observation});
const state={status:'ready',selectionVersion:1,profileId:'read-only-fixture',playerConnected:true,network:'signet',balance:{availableSats:0,availableArkadeSats:0,availableBitcoinSats:0,totalSats:0,arkadeSats:0,bitcoinSats:0}};
const controller:any={getState:()=>state,subscribe:()=>()=>{},dispose:()=>{},
  refresh:async()=>{observation.refreshes++;},
  checkLiveBoardingState:()=>new Promise((_resolve,reject)=>{observation.failBoarding=()=>reject(Error('Fixture boarding read unavailable'));}),
  getOperationAvailability:()=>({status:'unavailable'}),getPlayerPaymentBlockReason:()=> 'No active Player Wallet',getPlayerPaymentBalance:()=>0};
createRoot(document.getElementById('root')!).render(<App contextFactory={contextFactory as any} gameWalletFactory={(()=>controller) as any}/>);
