import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {developmentConfig} from '../../../../scripts/dev-config.ts';
import {identify} from '../../../integration/src/client/wallet-layer-arkade/account.ts';
import {MnemonicIdentity,ReadonlyWallet,InMemoryWalletRepository,InMemoryContractRepository} from '@arkade-os/sdk';
import {operatorInfo,publicPhrases,seedWalletLabels} from './wallet-label-fixture.ts';

const output=new URL('../../../../../output/reports/marketplace-wallet-labels/',import.meta.url);
async function setup(t){
  await mkdir(output,{recursive:true});
  let base=process.env.BIS_WALLET_LABEL_BASE_URL;
  if(!base){
    const config=developmentConfig({port:0});config.cacheDir=await mkdtemp(new URL('vite-',output));config.server.hmr=false;
    const server=await createServer(config);await server.listen();t.after(()=>server.close());base=server.resolvedUrls.local[0].replace(/\/$/,'');
  }
  const browser=await chromium.launch({headless:true,...(process.env.BIS_PLAYWRIGHT_CHANNEL?{channel:process.env.BIS_PLAYWRIGHT_CHANNEL}:{})});t.after(()=>browser.close());
  if(!process.env.BIS_WALLET_LABEL_BASE_URL){
    // Compile the test-owned Vite graph before measurement, just as the shared
    // running preview is compiled. The measured context below has a cold browser
    // cache and has never initialized a wallet or loaded application modules.
    const warm=await browser.newContext();await warm.route(/^https:\/\//,route=>route.abort());
    const page=await warm.newPage();await page.goto(`${base}/marketplace/`,{waitUntil:'networkidle'});await warm.close();
  }
  const context=await browser.newContext();t.after(()=>context.close());
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const accounts=Object.fromEntries(await Promise.all(publicPhrases.map(async(phrase,index)=>[index?'game':'player',{phrase,profileId:await identify(phrase),network:'signet'}])));
  const info={...operatorInfo};for(const key of ['unilateralExitDelay','boardingExitDelay','sessionDuration','dust','vtxoMinAmount','vtxoMaxAmount','utxoMinAmount','utxoMaxAmount'])info[key]=BigInt(info[key]);
  const expected=await Promise.all(publicPhrases.map(async phrase=>{
    const wallet=await ReadonlyWallet.create({identity:MnemonicIdentity.fromMnemonic(phrase,{isMainnet:false}),arkProvider:{serverUrl:'https://fixture.invalid',getInfo:async()=>info},storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}});
    try{return await wallet.getAddress();}finally{await wallet.dispose();}
  }));
  let mode='normal',configReads=0,ownershipReads=0,mutations=0;
  await context.route(/https:\/\/(?:signet|mutinynet)\.arkade\.sh\//,async route=>{
    const request=route.request();if(request.method()!=='GET'){mutations++;await route.abort();return;}
    if(new URL(request.url()).pathname==='/v1/info'){
      configReads++;await new Promise(resolve=>setTimeout(resolve,mode==='slow'?1500:250));
      if(mode==='offline'){await route.fulfill({status:503,body:'fixture offline'});return;}
      await route.fulfill({contentType:'application/json',body:JSON.stringify({...operatorInfo,network:mode==='mismatch'?'mutinynet':'signet'})});return;
    }
    ownershipReads++;await new Promise(resolve=>setTimeout(resolve,5000));
    await route.fulfill({contentType:'application/json',body:JSON.stringify({vtxos:[],contracts:[],txs:[],nextCursor:''})}).catch(()=>{});
  });
  await context.route(/https:\/\/mempool\./,async route=>{
    ownershipReads++;await new Promise(resolve=>setTimeout(resolve,5000));await route.fulfill({contentType:'application/json',body:'[]'}).catch(()=>{});
  });
  await seedWalletLabels(page,base,accounts);
  return {page,context,base,expected,errors,accounts,setMode:value=>{mode=value;},counts:()=>({configReads,ownershipReads,mutations})};
}

test('cold Marketplace and reload show both real SDK addresses within 1.5 seconds while ownership reads wait',{timeout:60000},async t=>{
  const f=await setup(t),results=[];
  // Retain sanitized evidence even when a timing assertion fails.
  t.after(()=>writeFile(new URL('cold-label-timing.tson',output),JSON.stringify({results,counts:f.counts(),errors:f.errors,configurationDelayMs:250,ownershipDelayMs:5000,catalogDelayMs:2000},null,2)));
  await f.context.addInitScript(expected=>{
    window.walletLabelTimes={};
    const observer=new MutationObserver(()=>{
      for(const [index,role] of ['player','game'].entries()){const element=document.querySelector(`[data-testid="${role}-wallet-label"]`);if(element&&window.walletLabelTimes.firstLabelElement===undefined)window.walletLabelTimes.firstLabelElement=performance.now();if(element?.title===expected[index]&&window.walletLabelTimes[role]===undefined)window.walletLabelTimes[role]=performance.now();}
    });observer.observe(document,{childList:true,subtree:true,attributes:true});
  },f.expected);
  // Deliberately hold catalog too: connected address labels must not wait for it.
  await f.page.route('**/marketplace/catalog.json',async route=>{await new Promise(r=>setTimeout(r,2000));await route.continue().catch(()=>{});});
  for(const pass of ['cold','reload']){
    if(pass==='cold')await f.page.goto(`${f.base}/marketplace/`,{waitUntil:'domcontentloaded'});else await f.page.reload({waitUntil:'domcontentloaded'});
    await f.page.waitForFunction(()=>window.walletLabelTimes.player!==undefined&&window.walletLabelTimes.game!==undefined);
    const times=await f.page.evaluate(()=>window.walletLabelTimes);
    const phases=await f.page.evaluate(()=>({domContentLoadedMs:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd,paints:performance.getEntriesByType('paint').map(entry=>({name:entry.name,startMs:entry.startTime})),configuration:performance.getEntriesByType('resource').filter(entry=>entry.name.endsWith('/v1/info')).map(entry=>({startMs:entry.startTime,durationMs:entry.duration,endMs:entry.responseEnd}))}));results.push({pass,...times,phases});
    assert.equal(await f.page.getByTestId('player-wallet-label').getAttribute('title'),f.expected[0]);
    assert.equal(await f.page.getByTestId('game-wallet-label').getAttribute('title'),f.expected[1]);
    assert.ok(times.player<1500,`${pass} Player label: ${times.player}ms`);assert.ok(times.game<1500,`${pass} Game label: ${times.game}ms`);
    assert.ok(f.counts().ownershipReads>0,'ownership initialization has begun but is delayed');
  }
  assert.equal(f.counts().mutations,0);assert.deepEqual(f.errors,[]);
});

test('Player-only restoration never reuses the catalog Game Wallet address',{timeout:60000},async t=>{
  const f=await setup(t);
  // Keep the Player Wallet record exactly as a user who logs in with Player
  // only, after previously having used both local wallets.
  await f.page.goto(`${f.base}/__wallet_label_seed__`);
  await f.page.evaluate(async()=>await new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase('bis-game-wallet-signet-v1');
    request.onsuccess=resolve;request.onerror=()=>reject(request.error);
  }));
  await f.page.goto(`${f.base}/marketplace/`,{waitUntil:'domcontentloaded'});
  await f.page.waitForFunction(expected=>document.querySelector('[data-testid="player-wallet-label"]')?.getAttribute('title')===expected,f.expected[0]);
  await f.page.waitForFunction(()=>document.querySelector('[data-testid="game-wallet-label"]')?.textContent==='Not connected');
  assert.equal(await f.page.getByTestId('game-wallet-label').getAttribute('title'),null);
  assert.notEqual(await f.page.getByTestId('game-wallet-label').getAttribute('title'),f.expected[1]);
  assert.equal(f.counts().mutations,0);assert.deepEqual(f.errors,[]);
});

test('slow, unavailable, mismatched and logged-out address labels remain truthful',{timeout:90000},async t=>{
  const f=await setup(t);
  f.setMode('slow');await f.page.goto(`${f.base}/marketplace/`,{waitUntil:'domcontentloaded'});
  await f.page.getByTestId('player-wallet-label').waitFor();assert.equal(await f.page.getByTestId('player-wallet-label').innerText(),'Loading ...');
  await f.page.waitForFunction(()=>document.querySelector('[data-testid="player-wallet-label"]')?.title.startsWith('tark1'));
  for(const mode of ['offline','mismatch']){
    f.setMode(mode);await f.page.reload({waitUntil:'domcontentloaded'});
    await f.page.waitForFunction(()=>document.querySelector('[data-testid="player-wallet-label"]')?.textContent==='Unavailable');
    await f.page.waitForFunction(()=>document.querySelector('[data-testid="game-wallet-label"]')?.textContent==='Unavailable');
    assert.equal(await f.page.getByTestId('player-wallet-label').getAttribute('title'),null);
    assert.equal(await f.page.getByTestId('game-wallet-label').getAttribute('title'),null);
  }
  f.setMode('normal');
  await f.page.goto(`${f.base}/__wallet_label_seed__`);
  await f.page.evaluate(async()=>{for(const name of ['bis-account-signet-v1','bis-game-wallet-signet-v1'])await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=resolve;r.onerror=()=>reject(r.error);});});
  await f.page.goto(`${f.base}/marketplace/`,{waitUntil:'domcontentloaded'});
  await f.page.waitForFunction(()=>document.querySelector('[data-testid="player-wallet-label"]')?.textContent==='Not connected');
  assert.notEqual(await f.page.getByTestId('game-wallet-label').getAttribute('title'),f.expected[1]);
  assert.equal(f.counts().mutations,0);assert.deepEqual(f.errors,[]);
});


