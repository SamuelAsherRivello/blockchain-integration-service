import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {SingleKey,DefaultVtxo} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {developmentConfig} from './dev-config.ts';
import {contentSecurityPolicy} from './content-security-policy.ts';
import {prepareLegacyBundle,readLegacyFixtureSource,enterProtectedHarness,verifyFundedAcceptanceMode} from './treasure-protected-harness.ts';
import {buildLtoScript} from '../packages/integration/src/client/wallet-layer-arkade/lto-script.ts';
import {emptyContractLedger,startLto,finishContractOperation} from '../packages/integration/src/client/state-layer-core/contracts.ts';

test('legacy checks survive a controlled selector-to-blank document transition without relabeling stored recovery',async t=>{
  // Deterministic unfunded data, not an original network contract or receipt.
  // Compare actual compiled output with the verified old compiler. The explicit
  // Sandbox option changes source text but must preserve ordinary role bytes.
  const legacy=await prepareLegacyBundle();
  const [playerKey,gameKey,operatorKey]=await Promise.all([1,2,3].map(async n=>await SingleKey.fromHex(n.toString(16).padStart(64,'0')).xOnlyPublicKey()));
  const secret=new Uint8Array(32).fill(18),secretHash=new Uint8Array(await crypto.subtle.digest('SHA-256',secret));
  const built=buildLtoScript({playerKey,gameKey,operatorKey,secretHash,exitDelay:512n});
  const defaults={serverPubKey:operatorKey,csvTimelock:{type:'seconds' as const,value:512n}};
  const now=Date.now(),request={id:'legacy-fixture',sessionId:'original-session',operationId:'original-fund',purpose:'treasureLTO',hostReference:'wallet-free-fixture',
    amountSats:1000,startedAt:now,expiresAt:now+90000,scope:{network:'signet',operator:'https://signet.arkade.sh',playerId:'fixture-player',gameId:'fixture-game',exclusivityKey:'treasure'}};
  const ledger=startLto(emptyContractLedger(),request,now).ledger;
  const record=finishContractOperation(ledger.contracts[0],{operationId:request.operationId,kind:'fund',outcome:'confirmed'});
  const recovery={playerKey:hex.encode(playerKey),gameKey:hex.encode(gameKey),operatorKey:hex.encode(operatorKey),secretHex:hex.encode(secret),exitDelay:'512',
    playerScript:hex.encode(new DefaultVtxo.Script({...defaults,pubKey:playerKey}).encode()),gameScript:hex.encode(new DefaultVtxo.Script({...defaults,pubKey:gameKey}).encode()),
    contractScript:hex.encode(built.script.encode()),fundingOutput:{txid:'ab'.repeat(32),vout:0,value:1000}};
  const data={version:1,revision:0,ledger:{...ledger,contracts:[record]},recovery:{[record.id]:recovery}};
  const original={network:'signet',contractId:record.id,playerId:record.scope.playerId,gameId:record.scope.gameId,sessionId:record.sessionId,
    expiresAt:record.expiresAt,fundingTxid:recovery.fundingOutput.txid,contractPkScript:hex.encode(built.script.pkScript)};
  const config=developmentConfig({port:0});config.cacheDir='output/vite-cache/treasure-legacy-transition';config.server.hmr=false;
  const server=await createServer(config);let browser;
  try{
    const legacySource=legacy.provenance.extraction+'/src/client/wallet-layer-arkade/lto-script.ts';
    assert.equal(await readFile(legacySource,'utf8'),await readLegacyFixtureSource('src/client/wallet-layer-arkade/lto-script.ts'));
    const {buildLtoScript:buildOriginal}=await server.ssrLoadModule('/'+legacySource.replaceAll('\\','/'));
    const originalCompiled=buildOriginal({playerKey,gameKey,operatorKey,secretHash,exitDelay:512n});
    for(const prototypeSameWallet of [undefined,false,true]){
      const candidate=buildLtoScript({playerKey,gameKey,operatorKey,secretHash,exitDelay:512n,prototypeSameWallet});
      for(const leaf of ['claim','refund'])assert.deepEqual(candidate[leaf],originalCompiled[leaf]);
      assert.deepEqual(candidate.script.encode(),originalCompiled.script.encode());
      assert.deepEqual(candidate.script.pkScript,originalCompiled.script.pkScript);
    }
    await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(1500);page.setDefaultNavigationTimeout(30000);
    const base=server.resolvedUrls!.local[0],url=new URL('/admin/',base).href;
    await page.route(url,route=>route.fulfill({status:200,contentType:'text/html',
      headers:{'Content-Security-Policy':contentSecurityPolicy({development:true}),'Cache-Control':'no-store'},
      body:'<!doctype html><html><head><title>Controlled legacy selector fixture</title></head><body data-fixture="legacy-selector"><select aria-label="Signing / validation solution" disabled><option>browser-policy-v1</option></select></body></html>'}));
    let financialRequests=0;
    await page.route('https://**',route=>{financialRequests++;return route.abort();});
    await page.goto(url,{waitUntil:'domcontentloaded'});
    assert.equal(page.url(),url);assert.equal(await page.title(),'Controlled legacy selector fixture');
    const setControlledDisabled=async disabled=>{
      const state=await page.evaluate(disabled=>{
        const select=document.querySelector('select[aria-label="Signing / validation solution"]');
        if(document.body.dataset.fixture!=='legacy-selector'||!(select instanceof HTMLSelectElement))throw Error('controlled-document-replaced');
        select.disabled=disabled;
        return {disabled:select.disabled,fixture:document.body.dataset.fixture,ready:document.readyState!=='loading'};
      },disabled);
      assert.deepEqual(state,{disabled,fixture:'legacy-selector',ready:true});assert.equal(page.url(),url);
    };
    const selection=page.getByLabel('Signing / validation solution',{exact:true});
    await setControlledDisabled(true);
    await verifyFundedAcceptanceMode({scenario:'claim',page,select:selection,original});
    await setControlledDisabled(false);
    await assert.rejects(verifyFundedAcceptanceMode({scenario:'claim',page,select:selection,original}),/active-mode-was-editable/);
    await setControlledDisabled(true);
    const restore=await enterProtectedHarness(page,undefined,new URL(base).origin);
    assert.equal(await selection.count(),0,'the former Admin control really disappears on navigation');
    const seeded=await page.evaluate(async data=>{
      const {createContractStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts');
      const {inspectContractDocument}=await import('/BIS/packages/integration/src/client/state-layer-core/lto-service.ts');
      const document=await createContractStorage(undefined,'signet').save(data);
      const player=inspectContractDocument(document,'fixture-player',{},'signet').contracts[0];
      const game=inspectContractDocument(document,'fixture-game',{},'signet').contracts[0];
      return {document,playerMode:player.validationMode,claimable:player.canClaim,refundable:game.canRefund};
    },data);
    assert.equal(seeded.document.ledger.contracts[0].validationMode,undefined);
    assert.equal(Object.hasOwn(seeded.document.ledger.contracts[0],'validationMode'),false);
    assert.equal(seeded.playerMode,'browser-policy-v1','public fallback does not mutate the old record');
    assert.equal(seeded.claimable,true);assert.equal(seeded.refundable,true);
    const captured=await verifyFundedAcceptanceMode({scenario:'legacy-rollback',page,select:selection,original,provenance:legacy.provenance});
    assert.deepEqual(captured,seeded.document,'private original bytes/terms remain unchanged');
    await assert.rejects(verifyFundedAcceptanceMode({scenario:'legacy-rollback',page,select:selection,
      original:{...original,contractPkScript:'5120'+'ff'.repeat(32)},provenance:legacy.provenance}),/legacy-original-script-unverified/);
    await assert.rejects(verifyFundedAcceptanceMode({scenario:'legacy-rollback',page,select:selection,
      original:{...original,expiresAt:original.expiresAt+1000},provenance:legacy.provenance}),/legacy-original-unverified/);
    for(const patch of [{fundingTxid:'cd'.repeat(32)},{gameId:'another-game'}])
      await assert.rejects(verifyFundedAcceptanceMode({scenario:'legacy-rollback',page,select:selection,
        original:{...original,...patch},provenance:legacy.provenance}),/legacy-original-unverified/);
    const unchanged=await page.evaluate(async()=>{
      const {createContractStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts');
      return createContractStorage(undefined,'signet').load();
    });
    assert.deepEqual(unchanged,seeded.document,'binding denials never rewrite the original journal');
    assert.equal(financialRequests,0);
    await restore();assert.equal(await selection.count(),1,'owned Admin document can be restored');
    t.diagnostic('Deterministic DOM/storage/compiled legacy binding coverage only; no wallet, provider response, funded output or spend proof.');
  }finally{await browser?.close();await server.close();}
});
