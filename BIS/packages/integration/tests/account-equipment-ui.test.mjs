import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {bisMarketplaceItems,marketplaceItemMetadata} from '../src/core/equipment.ts';

test('Account Assets uses the chain icon and offers loadout controls only for recognized equipment',async()=>{
  const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
  try{
    const {AccountAssets}=await server.ssrLoadModule('/BIS/packages/integration/src/ui/AccountAssets.tsx');
    const item=bisMarketplaceItems[0],chain={assetId:'a'.repeat(64)+'0000',quantity:'1',iconUrl:'https://chain.example/runtime-shoes.png',metadata:{bisSchemaVersion:'1',...marketplaceItemMetadata(item)}};
    const generic={assetId:'b'.repeat(64)+'0000',quantity:'1',name:'Generic'};
    const props={assets:{status:'ready',assets:[chain,generic]},equipment:{select(){},clear(){}},equipmentState:{status:'ready',profileId:'p',ownedItems:[{...item,assetId:chain.assetId,quantity:'1',iconUrl:chain.iconUrl}],effective:{}},onDetailChange(){},onBack(){},onBurn(){},onRefresh(){},onBusyChange(){},onToast(){}};
    const html=renderToStaticMarkup(createElement(AccountAssets,props));
    assert.match(html,/https:\/\/chain\.example\/runtime-shoes\.png/);assert.doesNotMatch(html,/assets\/marketplace\/v1\/shoes-1/);
    assert.equal((html.match(/>Burn</g)??[]).length,0);
    assert.equal((html.match(/Select Shoes/g)??[]).length,0);
    assert.match(html,/Generic/);
  }finally{await server.close();}
});
