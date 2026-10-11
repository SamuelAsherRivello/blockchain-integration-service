import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {browserEnvironment} from './test-wallets/browser-public.mjs';

// Synthetic read-only dependencies drive the actual Marketplace, BIS context,
// shared inventory cache and production collection UI. No wallet/provider login.
function fixture(mode){return `
export * from '/BIS/packages/integration/src/index.ts?cacheOriginal=true';
import {createContext} from '/BIS/packages/integration/src/client/state-layer-core/context.ts';
import {createPublicAssetInventory} from '/BIS/packages/integration/src/client/state-layer-core/public-asset-inventory.ts';
import {bisMarketplaceItems,marketplaceItemMetadata} from '/BIS/packages/integration/src/client/state-layer-core/equipment.ts';
const mode=${JSON.stringify(mode)};
const calls={player:0,game:0};const releases={};
const gates=Object.fromEntries(['player','game'].map(role=>[role,new Promise(resolve=>releases[role]=resolve)]));
const make=(definition,id)=>({...definition,assetId:id.repeat(64),quantity:'1',metadata:{bisSchemaVersion:'1',...marketplaceItemMetadata(definition)}});
const playerAssets=[make(bisMarketplaceItems[0],'a'),make(bisMarketplaceItems[3],'b')];
const gameAssets=[make(bisMarketplaceItems[6],'c')];
const account={profileId:'synthetic-player',phrase:'synthetic-non-wallet-input',network:'mutinynet'};
const amounts={availableSats:0,totalSats:0,bitcoinSats:0,arkadeSats:0,bitcoinAvailableSats:0,arkadeAvailableSats:0};
const addresses={arkadeAddress:'synthetic-player-address',bitcoinAddress:'synthetic-bitcoin-address'};
const context=createContext({load:async()=>({account,generation:1}),subscribe:()=>()=>{}},
 undefined,async()=>account.profileId,undefined,async()=>amounts,undefined,async()=>addresses,undefined,undefined,
 {list:async()=>{calls.player++;if(mode!=='account-cache')await gates.player;return playerAssets;},mint:async()=>{throw Error('No fixture mutations');}},
 undefined,undefined,undefined,{getNetwork:()=>account.network});
await context.readyAsync();
if(mode==='account-cache'){
 context.openAccountDialog();context.openAccountAssets();
 await context.prepareAssetInventory();await new Promise(resolve=>setTimeout(resolve,0));
 context.closeAccount();
 await new Promise(resolve=>setTimeout(resolve,300));
 context.closeAccount();
 await new Promise(resolve=>setTimeout(resolve,300));
 context.closeAccount();
 if(context.getState().view==='account')throw Error('Fixture Account dialog failed to close');
}
const gameState={status:'ready',profileId:'synthetic-game',network:'mutinynet',selectionVersion:1,
 addresses:{arkadeAddress:'synthetic-game-address',bitcoinAddress:'synthetic-game-bitcoin'},balance:amounts};
const game={getState:()=>gameState,subscribe:()=>()=>{},refresh:async()=>{},dispose(){},logout:async()=>{},
 getAvailability:async()=>({available:false,reason:'insufficient-funds'}),getMintAvailability:async()=>({canMint:false}),
 getPendingAssetDelivery:async()=>({status:'success',profileId:gameState.profileId,operation:null})};
export const createBisContext=()=>context;
export const createBisGameWallet=()=>game;
export const preparePublicAssetInventory=createPublicAssetInventory(async()=>{calls.game++;await gates.game;return gameAssets;});
window.marketplaceCacheFixture={calls,release:role=>releases[role](),context,
 snapshot:()=>({calls:{...calls},assetsStatus:context.getState().assets.status})};
`;}
const directory='output/reports/codify-view-loading-and-cache';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,env:browserEnvironment()});
const results=[];
try {
 for(const mode of ['game-first','player-first','account-cache']) {
  const context=await browser.newContext({viewport:{width:1280,height:1000}});const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/BIS/packages/integration/src/index.ts*',async route=>{
   if(new URL(route.request().url()).searchParams.has('cacheOriginal'))return route.continue();
   const original=await route.fetch();const source=await original.text();
   let body=fixture(mode);
   // Vite adds HMR timestamps to established modules. Use exactly the same
   // context instance as the real UI's WeakMap, not a second untimestamped URL.
   for(const file of ['context.ts','public-asset-inventory.ts','equipment.ts']) {
    const line=source.split('\n').find(line=>line.includes('from ')&&line.includes('/'+file));
    const path=line?.match(/from ["']([^"']+)["']/)?.[1];
    assert.ok(path,'Missing real BIS module '+file);
    body=body.replaceAll('/BIS/packages/integration/src/client/state-layer-core/'+file,path);
   }
   return route.fulfill({contentType:'text/javascript',body});
  });
  try {
   await page.goto(process.argv[2]??'http://127.0.0.1:5174/marketplace/');
   await page.waitForFunction(()=>window.marketplaceCacheFixture?.calls.game===1&&window.marketplaceCacheFixture?.calls.player===1,{timeout:45000});
   const choose=role=>page.getByRole('group',{name:'Owner',exact:true}).getByRole('button',{name:role,exact:true}).click();
   const pending=page.locator('.bis-pending-backdrop:not([data-closing])');
   if(mode==='player-first') {
    await page.evaluate(()=>window.marketplaceCacheFixture.release('player'));
    await page.waitForTimeout(200);assert.ok(await pending.count()>0,'Selected Game remains covered while Player finishes');
    assert.equal(await page.locator('.asset-card').count(),0);
   }
   await page.evaluate(()=>window.marketplaceCacheFixture.release('game'));
   await page.waitForFunction(()=>document.querySelectorAll('.asset-card').length===1);
   await pending.waitFor({state:'hidden'});
   assert.match((await page.locator('.asset-card-title strong').allTextContents()).join(','),/Shield I/);
   await choose('Player Wallet');
   if(mode==='game-first') {
    await pending.waitFor({state:'visible'});
    assert.equal(await page.locator('.asset-card').count(),0,'Pending Player cannot reveal Game or false empty cards');
    await page.evaluate(()=>window.marketplaceCacheFixture.release('player'));
   }
   await page.waitForFunction(()=>document.querySelectorAll('.asset-card').length===2);
   await pending.waitFor({state:'hidden'});
   assert.deepEqual((await page.locator('.asset-card-title strong').allTextContents()).sort(),['Dagger I','Shoes I']);
   for(let i=0;i<3;i++){await choose('Game Wallet');await choose('Player Wallet');}
   const snapshot=await page.evaluate(()=>window.marketplaceCacheFixture.snapshot());
   assert.deepEqual(snapshot.calls,{player:1,game:1});assert.deepEqual(errors,[]);
   await page.screenshot({path:directory+'/'+mode+'.png',fullPage:true});
   results.push({mode,synthetic:true,actualMarketplace:true,actualBisContextAndCache:true,calls:snapshot.calls,playerCards:2,pageErrors:errors});
  }catch(error){console.error(JSON.stringify({mode,errors}));throw error;}
  finally{await context.close();}
 }
 await writeFile(directory+'/synthetic-browser.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
