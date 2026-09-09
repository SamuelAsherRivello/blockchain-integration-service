import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('Assets, Contracts and Transactions render the same titled collection, copy field, scroll list and one Back', async () => {
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
    const {AccountAssets}=await server.ssrLoadModule('/BIS/packages/integration/src/ui/AccountAssets.tsx');
    const {AccountActivity}=await server.ssrLoadModule('/BIS/packages/integration/src/ui/AccountActivity.tsx');
    const {AccountContracts}=await server.ssrLoadModule('/BIS/packages/integration/src/ui/AccountContracts.tsx');
    const noop=()=>{};
    const fixtures=[
      [AccountAssets,{assets:{status:'ready',assets:[]},onDetailChange:noop,onBack:noop,onBurn:noop,onRefresh:noop,onBusyChange:noop,onToast:noop},'Assets'],
      [AccountActivity,{activity:{status:'ready',transactions:[]},onDetailChange:noop},'Transactions'],
      [AccountContracts,{context:{},onDetailChange:noop},'Contracts'],
    ];
    for(const [component,props,title] of fixtures) {
      const html=renderToStaticMarkup(createElement(component,props));
      assert.match(html,/bis-card-collection/);
      assert.match(html,new RegExp(`>${title}</h2>`));
      assert.match(html,new RegExp(`aria-label="Copy ${title}"`));
      assert.match(html,/bis-collection-scroll bis-collection-list/);
      assert.equal((html.match(/>Back<\/button>/g)??[]).length,1);
      assert.equal((html.match(/role="dialog"/g)??[]).length,1);
    }
  } finally {await server.close();}
});
