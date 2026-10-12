import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetViewLifecycle} from '../../src/client/state-layer-core/asset-view-lifecycle.ts';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(account,load) {
  let state={profileId:'player',network:'mutinynet',assets:{status:'idle'}},calls=[];
  const lifecycle=createAssetViewLifecycle({getState:()=>state,getIdentity:()=>({version:1,profileId:'player'}),isDisposed:()=>false,isVisible:()=>true,readSnapshot:async()=>({assets:[]}),setAssets:()=>{},loadAccount:load??(async()=>({account})),observeAssets:async account=>{calls.push(account.network);}});
  return {lifecycle,calls,setNetwork:network=>{state={...state,network};}};
}
test('legacy asset watcher uses the selected network, never the adapter default',async()=>{
  const f=fixture({profileId:'player',phrase:'test'});f.lifecycle.startWatch();await tick();
  assert.deepEqual(f.calls,['mutinynet']);f.lifecycle.reset();
});
test('asset watcher rejects explicit mismatch and a selection changed while storage loads',async()=>{
  const mismatch=fixture({profileId:'player',phrase:'test',network:'signet'});
  mismatch.lifecycle.startWatch();await tick();assert.deepEqual(mismatch.calls,[]);
  let resolve;const changed=fixture(null,()=>new Promise(r=>{resolve=r;}));
  changed.lifecycle.startWatch();changed.setNetwork('signet');resolve({account:{profileId:'player',phrase:'test'}});await tick();
  assert.deepEqual(changed.calls,[]);mismatch.lifecycle.reset();changed.lifecycle.reset();
});
