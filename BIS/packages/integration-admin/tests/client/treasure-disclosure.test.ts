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
      assert.match(html,/Both wallets are locally controlled/);
      assert.match(html,/not a protected publisher-funded reward treasury/);
      assert.equal((html.match(/<option /g)??[]).length,network==='signet'?1:2);
      assert.match(html,network==='signet'?/can be bypassed by a modified client/:/not fully qualified/);
    }
  }finally{await server.close();}
});
