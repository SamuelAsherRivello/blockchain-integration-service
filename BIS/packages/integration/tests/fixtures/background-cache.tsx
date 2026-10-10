import {createContext} from '../../src/client/state-layer-core/context';
import {createBisUi} from '../../src/client/ui-layer-react/client';

// Isolated, deferred presentation adapters. Never connected to funded storage.
let cleanup=()=>{};
function setup() {
  cleanup();
  const idle=new Map<number,IdleRequestCallback>();let id=0;
  window.requestIdleCallback=callback=>{idle.set(++id,callback);return id;};
  window.cancelIdleCallback=value=>{idle.delete(value);};
  let balances=0,addresses=0;
  let finishBalance!:(value:Awaited<ReturnType<NonNullable<Parameters<typeof createContext>[4]>>>)=>void;
  let finishAddresses!:(value:{arkadeAddress:string;bitcoinAddress:string})=>void;
  const account={profileId:'background-fixture',phrase:'isolated-placeholder'};
  const context=createContext({load:async()=>({account,generation:1}),subscribe:()=>()=>{},save:async()=>{},reset:async()=>{}},undefined,async()=>account.profileId,undefined,
    async()=>{balances++;return new Promise(resolve=>{finishBalance=resolve;});},undefined,
    async()=>{addresses++;return new Promise(resolve=>{finishAddresses=resolve;});});
  const ui=createBisUi(context);ui.mount(document.getElementById('host')!);
  cleanup=()=>{ui.unmount();context.dispose();};
  return {
    context,ready:context.readyAsync(),counts:()=>({balances,addresses}),
    warm(){const entry=idle.entries().next().value;if(entry){idle.delete(entry[0]);entry[1]({didTimeout:false,timeRemaining:()=>50});}},
    balance(){finishBalance({availableSats:100,totalSats:120,bitcoinSats:20,arkadeSats:100});},
    addresses(){finishAddresses({arkadeAddress:'tark1-fixture',bitcoinAddress:'tb1p-fixture'});},
  };
}
Object.assign(window,{cacheFixture:setup(),resetCacheFixture:()=>Object.assign(window,{cacheFixture:setup()})});
