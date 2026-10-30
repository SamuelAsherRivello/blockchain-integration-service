import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('Admin renders reward-source consent and honest guarantees for both network selectors',async t=>{
  t.mock.method(globalThis,'fetch',async()=>assert.fail('Disclosure rendering must not contact a provider'));
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:{ignored:['**/output/**']}},appType:'custom'});
  try{
    const {TreasureOfferPanel}=await server.ssrLoadModule('/BIS/packages/integration-admin/src/client/admin-layer/TreasureLtoPanel.tsx');
    for(const network of ['signet','mutinynet']){
      const html=renderToStaticMarkup(createElement(TreasureOfferPanel,{context:{getState:()=>({network})},onLog:()=>{}}));
      assert.match(html,/locks 1,000 sats from your selected Game Wallet/);
      assert.match(html,network==='mutinynet'?/Both wallets are controlled in this browser/:/Game Wallet signing runs on BIS Server/);
      assert.match(html,/not a protected publisher-funded reward treasury/);
      assert.equal((html.match(/<option /g)??[]).length,1);
      assert.match(html,/can be bypassed by a modified client/);
      assert.match(html,/value="browser-policy-v1" selected=""/);
      assert.match(html,/Arkade co-signer validation is unavailable in this release/);
    }
  }finally{await server.close();}
});
