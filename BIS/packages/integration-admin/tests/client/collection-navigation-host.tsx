import { createContext } from '../../../integration/src/client/state-layer-core/context';
import { createBisUi } from '@bis/integration';
import '@bis/integration/style.css';

// Exercise the full account screen: a standalone AccountAssetsView does not
// reproduce the parent transition remount that used to discard selection.
const account = {phrase:'isolated-placeholder',profileId:'collection-navigation-fixture',network:'mutinynet' as const};
const context = createContext({load:async()=>({account,generation:0}),save:async()=>{throw Error('unexpected storage write');},reset:async()=>{},subscribe:()=>()=>{}},
  undefined,async()=>account.profileId,undefined,undefined,undefined,undefined,undefined,undefined,{
    list:async()=>[
      {assetId:'a'.repeat(68),quantity:'1',name:'First fixture asset',ticker:'FIRST',decimals:0},
      {assetId:'b'.repeat(68),quantity:'2',name:'Second fixture asset',ticker:'SECOND',decimals:0},
    ],
    mint:async()=>{throw Error('unexpected mint');},
  },undefined,undefined,undefined,{getNetwork:()=>account.network});
const ui = createBisUi(context);
ui.mount(document.getElementById('host')!);
await context.readyAsync();
context.openAccountDialog();
context.openAccountAssets();
window.addEventListener('pagehide',()=>{ui.unmount();context.dispose();});
