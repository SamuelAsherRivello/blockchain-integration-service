// Explicit live Admin acceptance. Uses the normal controls, real BIS adapters and protected owned profile.
// No financial projections, provider responses or contract outcomes are injected into the browser.
import {ArkAddress,RestIndexerProvider,Transaction,VtxoScript} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {Vault} from './test-wallets/vault.ts';
import {Operations} from './test-wallets/operations.ts';
import {OwnedBrowser} from './test-wallets/owned-browser.ts';
import {verifyTreasureSpendReceipt} from './test-wallets/treasure-receipt.ts';
import {randomBytes,createHash} from 'node:crypto';
import {endOriginalTreasureSession,exerciseTreasureIdentityRace} from './treasure-acceptance-browser.ts';
import {validateAcceptanceSelection,assertOriginalRun,observeAcceptance,verifyInsufficientEvidence,validateAlternateProfile,assertAcceptanceBudget,observeGameReadiness} from './treasure-acceptance-policy.ts';
import {loadBalance} from '../packages/integration/src/client/wallet-layer-arkade/balance.ts';
import {assetManifest,verifyTreasureAssetFunding} from './test-wallets/treasure-asset-evidence.ts';
import {observeTreasureClaimFeedback} from './treasure-feedback-observation.ts';
import {publicAcceptanceFailure,publicAcceptanceUiError,publicAcceptanceBrowserFailure} from './treasure-acceptance-diagnostics.ts';
import {assertProtectedScenarioSlot,validateOtherNetworkFixture} from './treasure-acceptance-policy.ts';
import {needsAcceptanceReadDiagnostics,acceptanceReadRequest,acceptanceReadFailure,readOnlyAcceptanceRequestAllowed} from './treasure-acceptance-policy.ts';
import {prepareLegacyBundle,enterProtectedHarness,legacyBundlePath,verifyFundedAcceptanceMode} from './treasure-protected-harness.ts';
import {inspectOtherNetworkFixture,preflightProtectedNetworkWallets,exerciseProtectedNetworkReplacement,initializeLegacyAcceptance,startLegacyAcceptance,stopLegacyAcceptance,
  actOnOriginalAcceptance,stopOriginalAcceptance,restoreAcceptanceNetworkPreference} from './treasure-protected-browser.ts';
for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
const [mode,scenario,runId]=process.argv.slice(2);
const network=process.argv[5]??'mutinynet';
const pairLabel=process.argv[6]??(network==='signet'?'treasure-signet-pair':'market-remint-pair');
const operator='https://'+network+'.arkade.sh';
const modes={'browser':'browser-policy-v1','cosigner':'arkade-covenant-v2'};
let owner,inspectRecords,originalRun,feedbackObservation,otherFixture,legacyBundle,stage='arguments',restoreNetworkPreferenceOnClose=false;
const uiErrors=[];
const readNetwork=[];
let cspConnectionBlocked=false;
function readRequest(request){
  return {...acceptanceReadRequest(request,network),stage};
}
const vault=new Vault(),ledger=new Operations(vault);
const transaction=vault.transaction.bind(vault);
vault.transaction=async(...args)=>{
  const [use,...options]=args;
  for(let attempt=0;;attempt++)try{return await transaction(async state=>{
    const existing=new Set((state.operations??[]).map(row=>row.intent.id));
    const result=await use(state);
    for(const row of state.operations??[])if(!existing.has(row.intent.id))
      assertAcceptanceBudget(state.operations,row.intent);
    return result;
  },...options);}
  catch(error){if(error.code!=='vault-locked'||attempt>=20)throw error;await new Promise(resolve=>setTimeout(resolve,250));}
};
const requestFetch=globalThis.fetch;
globalThis.fetch=(input,init={})=>requestFetch(input,{...init,signal:AbortSignal.any([
  ...(init.signal?[init.signal]:[]),AbortSignal.timeout(15000)])});
const emit=value=>process.stdout.write(JSON.stringify({runId,stage,...value})+'\n');
try{
  if(![5,6,7].includes(process.argv.length)||!/^[a-z][a-z0-9-]{0,39}$/.test(pairLabel))throw Error('invalid-arguments');
  validateAcceptanceSelection(mode,scenario,runId,network);
  assertProtectedScenarioSlot(scenario,runId,process.env.BIS_TREASURE_FINANCIAL_SLOT);
  stage='authorization';
  await vault.transaction(state=>{
    originalRun=state.treasureAdminRuns?.[runId];
    assertOriginalRun(originalRun,modes[mode],scenario,network);
    if(originalRun?.pairLabel&&originalRun.pairLabel!==pairLabel)throw Error('original-admin-run-requires-reconciliation');
    const pair=state.pairs.find(p=>p.label===pairLabel);
    if(pair?.network!==network)throw Error('unexpected-test-network');
    const rows=[pair.player,pair.game].map(label=>state.accounts.find(a=>a.label===label));
    if(rows.some(a=>!a?.grant?.active||!a.grant.networks.includes(pair.network)||a.reportedPending?.[pair.network]))throw Error('test-grant-unavailable');
    if((state.operations??[]).some(op=>op.intent.network===pair.network&&rows.some(a=>
      [op.intent.profileId,op.intent.target?.profileId].includes(a.profileId))&&!['settled','failed','cancelled'].includes(op.state)&&
      !(['recover','peer'].includes(scenario)&&op.intent.id.startsWith(runId+'-'))))throw Error('test-identity-reserved');
  });
  stage='owned-browser';
  owner=new OwnedBrowser(vault,{pair:pairLabel,origin:originalRun?.origin??'http://127.0.0.1:5174',app:'admin',stableSource:true,
    recoveryProfile:scenario==='peer'?undefined:originalRun?.recoveryProfile,encryptedRecoveryDownloads:scenario==='portable',onPublicFailure:details=>emit({browserFailure:publicAcceptanceBrowserFailure(details)})});
  await owner.start();
  if(needsAcceptanceReadDiagnostics(scenario)){
    owner.page.on('response',response=>{if(readNetwork.length<200&&response.request().resourceType()!=='script'&&response.request().resourceType()!=='stylesheet')readNetwork.push({...readRequest(response.request()),status:response.status()});});
    owner.page.on('requestfailed',request=>{if(readNetwork.length<200)readNetwork.push({...readRequest(request),failed:true,failureFlags:acceptanceReadFailure(request.failure()?.errorText)});});
    owner.page.on('console',message=>{if(message.text().includes('connect-src')&&message.text().includes('Content Security Policy'))cspConnectionBlocked=true;});
  }
  if(scenario==='readiness')await owner.context.route('**/*',async route=>{
    if(readOnlyAcceptanceRequestAllowed(route.request()))return route.continue();
    if(readNetwork.length<200)readNetwork.push({...readRequest(route.request()),guardBlocked:true});
    await route.abort('blockedbyclient');
  });
  owner.page.on('pageerror',error=>{if(uiErrors.length<20)uiErrors.push(publicAcceptanceUiError(error.message,error.name));});
  owner.page.on('console',message=>{if(message.type()==='error'&&uiErrors.length<20)uiErrors.push(publicAcceptanceUiError(message.text()));});
  stage='admin-menu';
  await owner.accountMenu();
  stage='close-account';
  await owner.page.locator('.bis-card').last().getByRole('button',{name:'Back',exact:true}).click();
  await owner.page.locator('.bis-card').last().waitFor({state:'hidden'});
  stage='select-validation';
  const select=owner.page.getByLabel('Signing / validation solution',{exact:true});
  if(!['recover','peer'].includes(scenario)){
    await select.selectOption(modes[mode]);
    if(await select.inputValue()!==modes[mode])throw Error('selection-mismatch');
  }
  const {player,game,pair}=owner.registration;
  if(['network-replacement','legacy-rollback'].includes(scenario)){
    // Reserve headroom for funding AND original payout before either spend.
    await vault.transaction(state=>assertAcceptanceBudget(state.operations??[],{id:runId+'-lifecycle-budget',network,amountSats:2000,feeSats:0}));
    if(scenario==='network-replacement'){
      stage='other-network-precondition';
      const otherNetwork=network==='signet'?'mutinynet':'signet';
      const candidates=await vault.transaction(state=>state.pairs.filter(p=>p.network===otherNetwork).flatMap(p=>{
        const accounts=[p.player,p.game].map(label=>state.accounts.find(a=>a.label===label));
        if(accounts.some(a=>!a?.grant?.active||!a.grant.networks.includes(otherNetwork)||a.reportedPending?.[otherNetwork]||
          (state.operations??[]).some(op=>op.intent.network===otherNetwork&&[op.intent.profileId,op.intent.target?.profileId].includes(a.profileId)&&!['settled','failed','cancelled'].includes(op.state))))return [];
        return [{network:otherNetwork,playerId:accounts[0].profileId,gameId:accounts[1].profileId}];
      }));
      for(const candidate of candidates){
        const eligibility=await owner.page.evaluate(inspectOtherNetworkFixture,candidate);
        try{validateOtherNetworkFixture({originalNetwork:network,otherNetwork,registered:true,...eligibility});otherFixture=candidate;break;}catch{}
      }
      if(!otherFixture)throw Error('network-fixture-unavailable');
    }else{
      stage='legacy-artifact-precondition';legacyBundle=await prepareLegacyBundle();
    }
  }
  let alternatePlayerId;
  if(scenario==='identity-race'){
    stage='identity-precondition';
    // This precondition runs before creating a case or preparing funding.
    // Missing protected profile setup cannot become a fake identity-switch pass.
    const savedProfiles=await owner.page.evaluate(async network=>{
      const {createAccountStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/account-storage.ts');
      return (await createAccountStorage(network).listProfiles()).profiles;
    },network);
    const registered=await vault.transaction(state=>state.accounts.filter(a=>a.grant?.active&&a.grant.networks.includes(network)&&!a.reportedPending?.[network]&&
      !(state.operations??[]).some(op=>op.intent.network===network&&[op.intent.profileId,op.intent.target?.profileId].includes(a.profileId)&&!['settled','failed','cancelled'].includes(op.state)))
      .map(a=>a.profileId));
    alternatePlayerId=savedProfiles.find(id=>id!==player.profileId&&id!==game.profileId&&registered.includes(id));
    validateAlternateProfile({playerId:player.profileId,gameId:game.profileId,alternatePlayerId,registered:registered.includes(alternatePlayerId),savedProfiles});
  }
  async function rows(){
    const records=await owner.page.evaluate(async({network,playerId,gameId})=>{
      const {createContractStorage}=await import('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts');
      const {inspectContractDocument}=await import('/BIS/packages/integration/src/client/state-layer-core/lto-service.ts');
      const document=await createContractStorage(undefined,network).load();
      return inspectContractDocument(document,playerId,{purpose:'treasureLTO',gameId,includeResolved:true},network).contracts.map(c=>({
        ...c,failure:document.ledger.contracts.find(record=>record.id===c.id)?.operation.failure,
        submission:document.ledger.contracts.find(record=>record.id===c.id)?.operation.submission,
        fundingInputs:document.ledger.contracts.find(record=>record.id===c.id)?.operation.kind==='fund'?document.recovery[c.id].spend?.inputs:undefined,
        contractTree:document.recovery[c.id].contractScript,
      }));
    },{network:pair.network,playerId:player.profileId,gameId:game.profileId});
    return records.map(({contractTree,...c})=>({...c,contractPkScript:hex.encode(VtxoScript.decode(hex.decode(contractTree)).pkScript)}));
  }
  inspectRecords=rows;
  stage='read-contracts';const prior=await rows();
  if(!['recover','peer'].includes(scenario)&&prior.some(c=>!['claimed','refunded','failed'].includes(c.financial)))throw Error('existing-contract-needs-recovery');
  emit({network:pair.network,mode:modes[mode],ready:true});
  if(scenario==='probe')emit({readinessControls:await owner.page.locator('.story-card').filter({hasText:'A.G.3. Board Game Wallet'}).getByRole('button',{name:'Details',exact:true}).evaluateAll(buttons=>buttons.map(button=>({disabled:button.disabled,visible:!!button.getClientRects().length}))),
    serverConfigurationErrorDisplayed:await owner.page.getByText('Server configuration error',{exact:true}).count()>0});
  if(!['recover','peer','probe'].includes(scenario)){
    stage='request-game-readiness';
    // Initial wallet reads have the same two bounded 30-second attempts as
    // an explicit refresh. A default 20-second click timeout ends too early
    // while the legitimate loading state still disables this control.
    await owner.page.locator('.story-card').filter({hasText:'A.G.3. Board Game Wallet'}).getByRole('button',{name:'Details',exact:true}).click({timeout:75000});
    stage='observe-game-readiness';
    const readiness=await observeGameReadiness(()=>owner.page.evaluate(async()=>{
      const {gameReadinessFromConsole}=await import('/BIS/scripts/treasure-acceptance-policy.ts');
      const text=document.querySelector('textarea[aria-label="Console output"]')?.value??'';
      return gameReadinessFromConsole(text);
    // Production may make two bounded 30-second read attempts. Do not end
    // observation after 30 seconds while its original Details read is active.
    }),75000);
    emit({gameReadiness:readiness});
    if(readiness!=='ready')throw Error('game-readiness-unavailable');
  }
  if(['recover','peer'].includes(scenario)){
    stage='original-reconciliation';
    const candidates=prior.filter(c=>!originalRun.priorIds.includes(c.id)&&c.validationMode===originalRun.mode&&c.scope.playerId===player.profileId&&c.scope.gameId===game.profileId);
    const contract=prior.find(c=>c.id===originalRun.contractId)??(!originalRun.contractId&&candidates.length===1?candidates[0]:undefined);
    if(!contract||contract.validationMode!==originalRun.mode||contract.scope.playerId!==player.profileId||contract.scope.gameId!==game.profileId)throw Error('original-contract-mismatch');
    if(!originalRun.contractId){
      const indexer=new RestIndexerProvider(operator);
      const wire=await indexer.getVirtualTxs([contract.fundingTransactionId]);
      if(!wire.txs.some(encoded=>{const tx=/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));
        return tx.id===contract.fundingTransactionId&&tx.getOutput(0).amount===1000n&&hex.encode(tx.getOutput(0).script)===contract.contractPkScript;}))throw Error('original-wire-unverified');
      const reconciled=await ledger.reconcile(runId+'-fund',async op=>({id:op.intent.id,fingerprint:op.fingerprint,providerId:contract.fundingTransactionId,outcome:'settled',verified:true}));
      if(reconciled.state!=='settled')throw Error('original-receipt-unresolved');
      await vault.transaction(state=>{Object.assign(state.treasureAdminRuns[runId],{contractId:contract.id,expiresAt:contract.expiresAt});});
    }
    stage='original-account-menu';await owner.accountMenu();
    stage='original-contract-list';await owner.navigate('Contracts');
    stage='original-report';
    await owner.page.locator('.bis-collection[aria-busy="false"]').waitFor();
    const text=await owner.page.locator('.bis-collection input[readonly]:visible').last().inputValue();
    // The existing single-line report input normalizes line breaks. Locate the
    // exact public identifier without assuming textarea newline preservation.
    const position=text.indexOf('Contract ID: '+contract.id);
    if(position<0)throw Error('original-contract-not-listed');
    const index=(text.slice(0,position).match(/Contract ID: /g)??[]).length;
    stage='original-contract-detail';await owner.page.locator('.bis-collection-list .bis-collection-item:visible').nth(index).click();
    await owner.page.getByRole('heading',{name:'Contract Details',exact:true}).waitFor();
    const selectedReport=await owner.page.getByLabel('Contract',{exact:true}).inputValue();
    if(!selectedReport.includes('Contract ID: '+contract.id))throw Error('original-contract-mismatch');
    stage='original-refresh';
    await owner.page.getByRole('button',{name:'Refresh Contract Details',exact:true}).click();
    const deadline=Date.now()+60000;let current;
    while(Date.now()<deadline){
      current=(await rows()).find(c=>c.id===contract.id);
      if(current&&['claimed','refunded'].includes(current.financial))break;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(!current||!['claimed','refunded'].includes(current.financial)||!current.transactionId)throw Error('original-receipt-unresolved');
    const kind=current.financial==='claimed'?'claim':'refund',txid=current.transactionId;
    const script=hex.encode(ArkAddress.decode(owner.expected[kind==='claim'?'player':'game'].arkadeAddress).pkScript);
    const indexer=new RestIndexerProvider(operator);
    const wire=await indexer.getVirtualTxs([txid]);
    if(!wire.txs.some(encoded=>{const tx=/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));
      return tx.id===txid&&tx.getOutput(0).amount===1000n&&hex.encode(tx.getOutput(0).script)===script;}))throw Error('original-wire-unverified');
    const {vtxos}=await indexer.getVtxos({outpoints:[{txid,vout:0}]});
    if(!vtxos.some(c=>c.txid===txid&&c.vout===0&&c.value===1000&&c.script===script&&!c.assets?.length))throw Error('original-indexed-receipt-unverified');
    const chain=await verifyTreasureSpendReceipt(indexer,{fundingTxid:contract.fundingTransactionId,contractScript:contract.contractPkScript,spendTxid:txid,destinationScript:script});
    if(!(await ledger.list()).some(op=>op.intent.id===runId+'-'+kind)){
      const account=kind==='claim'?player:game;
      await ledger.prepare({id:runId+'-'+kind,account:account.label,profileId:account.profileId,generation:account.generation,
        network:pair.network,kind,recipient:'treasure:'+runId,amountSats:1000,feeSats:0,sourceOrigin:owner.registration.application.origin});
      // Observe an already completed original operation, never resubmit it.
      await ledger.submit(runId+'-'+kind,async()=>({providerId:txid}));
    }
    const reconciled=await ledger.reconcile(runId+'-'+kind,async op=>({id:op.intent.id,fingerprint:op.fingerprint,providerId:txid,outcome:'settled',verified:true}));
    if(reconciled.state!=='settled')throw Error('original-receipt-unresolved');
    const receipt={kind,contractId:current.id,txid,vout:0,value:1000,script,chain};
    await vault.transaction(state=>{const run=state.treasureAdminRuns[runId];(run.receipts??=[]).push(receipt);run.completedAt=Date.now();});
    emit({verified:true,originalOnly:true,receipt});
  }else if(['probe','readiness'].includes(scenario)){
    if(scenario==='readiness')emit({verifiedReadiness:true,financialActions:0,readNetwork,cspConnectionBlocked});
  }else{
    if(scenario==='network-replacement'){
      stage='network-readiness-precondition';const restoreAdmin=await enterProtectedHarness(owner.page);
      let forbiddenPosts=0;
      const providerUrl=url=>['signet.arkade.sh','mutinynet.arkade.sh','emulator.mutinynet.arkade.sh'].includes(url.hostname);
      const guard=async route=>{
        const request=route.request();
        if(request.method()==='POST'&&!new URL(request.url()).pathname.startsWith('/v1/indexer/')){forbiddenPosts++;await route.abort('blockedbyclient');}else await route.continue();
      };
      await owner.context.route(providerUrl,guard);restoreNetworkPreferenceOnClose=true;
      const eligibility=await observeAcceptance(owner.page.evaluate(preflightProtectedNetworkWallets,{network,playerId:player.profileId,gameId:game.profileId,
        otherNetwork:otherFixture.network,otherPlayerId:otherFixture.playerId,otherGameId:otherFixture.gameId}));
      if(forbiddenPosts)throw Error('wrong-network-financial-attempt');
      await owner.context.unroute(providerUrl,guard);restoreNetworkPreferenceOnClose=false;
      await restoreAdmin();
      await owner.page.getByLabel('Signing / validation solution',{exact:true}).selectOption(modes[mode]);
      emit({networkFixtureEligibility:eligibility});
    }
    if(scenario==='legacy-rollback'){
      stage='legacy-readiness-precondition';await enterProtectedHarness(owner.page,legacyBundle);
      await owner.page.evaluate(initializeLegacyAcceptance,{entryUrl:legacyBundlePath,network,playerId:player.profileId,gameId:game.profileId});
    }
    let emptyPlayer;
    if(scenario==='empty-duplicate-claim'){
      stage='empty-player-precondition';
      const balance=await loadBalance({...player,network},AbortSignal.timeout(30000));
      if(balance.totalSats!==0||balance.arkadeSats!==0||balance.bitcoinSats!==0)throw Error('player-not-empty');
      emptyPlayer={profileId:player.profileId,network,observedAt:Date.now(),totalSats:0,arkadeSats:0,bitcoinSats:0};
      emit({emptyPlayer});
    }
    let assetInputs;
    if(scenario==='asset-claim'){
      stage='asset-input-precondition';
      const gameScript=hex.encode(ArkAddress.decode(owner.expected.game.arkadeAddress).pkScript);
      const {vtxos}=await new RestIndexerProvider(operator).getVtxos({scripts:[gameScript],spendableOnly:true});
      if(!vtxos.length||vtxos.some(c=>!c.assets?.length||c.script!==gameScript||c.isSpent||c.spentBy||c.isSwept||c.isUnrolled))throw Error('asset-carrier-only-precondition');
      assetInputs=vtxos.map(c=>({txid:c.txid,vout:c.vout,value:c.value,assets:c.assets.map(a=>({assetId:a.assetId,amount:String(a.amount)}))}));
      const assets=assetManifest(assetInputs);
      if(!assets.length||assetInputs.reduce((sum,c)=>sum+c.value,0)<1330)throw Error('asset-carrier-only-precondition');
      emit({assetInputPrecondition:{sources:assetInputs,assets}});
    }
    await vault.transaction(state=>{
      state.treasureAdminRuns??={};state.treasureAdminRuns[runId]={mode:modes[mode],scenario,network:pair.network,
        pairLabel,...(legacyBundle?{legacyProvenance:legacyBundle.provenance}:{}),...(otherFixture?{otherNetworkFixture:otherFixture}:{}),
        ...(emptyPlayer?{emptyPlayer}:{}),...(assetInputs?{assetInputs}:{}),origin:owner.registration.application.origin,player:player.profileId,game:game.profileId,priorIds:prior.map(c=>c.id),createdAt:Date.now()};
    });
    const intent=(kind,account)=>({id:runId+'-'+kind,account:account.label,profileId:account.profileId,
      generation:account.generation,network:pair.network,kind:kind==='fund'?'arkade-send':kind,
      recipient:'treasure:'+runId,amountSats:1000,feeSats:0,sourceOrigin:owner.registration.application.origin});
    const bound=async()=>{
      const candidates=(await rows()).filter(c=>!prior.some(old=>old.id===c.id));
      if(candidates.length>1)throw Error('ambiguous-contract');
      const c=candidates[0];
      if(c&&(c.amountSats!==1000||c.validationMode!==modes[mode]||c.scope.playerId!==player.profileId||c.scope.gameId!==game.profileId))throw Error('binding-mismatch');
      return c;
    };
    async function waitFor(read,ready,ms=70000){
      if(ms>120000)throw Error('observation-limit-exceeded');
      const deadline=Date.now()+ms;
      while(Date.now()<deadline){const value=await read();if(ready(value))return value;await new Promise(r=>setTimeout(r,1000));}
      throw Error('original-operation-observation-timeout');
    }
    const indexer=new RestIndexerProvider(operator);
    async function verify(txid,script){
      const response=await indexer.getVirtualTxs([txid]);
      const tx=response.txs.map(encoded=>/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded))).find(tx=>tx.id===txid);
      if(!tx||tx.getOutput(0).amount!==1000n||hex.encode(tx.getOutput(0).script)!==script)throw Error('wire-receipt-unverified');
      const {vtxos}=await indexer.getVtxos({outpoints:[{txid,vout:0}]});
      if(!vtxos.some(c=>c.txid===txid&&c.vout===0&&c.script===script&&c.value===1000&&!c.assets?.length))throw Error('indexed-receipt-unverified');
    }
    async function settle(kind,contract,txid,script){
      await verify(txid,script);
      const chain=kind==='fund'?undefined:await verifyTreasureSpendReceipt(indexer,{fundingTxid:contract.fundingTransactionId,contractScript:contract.contractPkScript,spendTxid:txid,destinationScript:script});
      await ledger.reconcile(runId+'-'+kind,async op=>({id:op.intent.id,fingerprint:op.fingerprint,providerId:txid,outcome:'settled',verified:true}));
      const receipt={kind,contractId:contract.id,txid,vout:0,value:1000,script,...(chain?{chain}:{})};
      await vault.transaction(state=>{const run=state.treasureAdminRuns[runId];run.contractId=contract.id;run.expiresAt=contract.expiresAt;(run.receipts??=[]).push(receipt);});
      emit({receipt,financial:contract.financial});
    }
    if(scenario==='insufficient'){
      stage='insufficient-precondition';
      const balance=await loadBalance({...game,network},AbortSignal.timeout(30000));
      if(balance.totalSats!==0||balance.arkadeSats!==0||balance.bitcoinSats!==0)throw Error('game-not-empty');
      let attemptedSubmissions=0;
      // Safety backstop only. Any attempted financial call fails the test.
      // It cannot be counted as the application's insufficient-funds rejection.
      await owner.context.route(url=>[operator,'https://emulator.mutinynet.arkade.sh'].includes(url.origin)&&/^\/v1\/tx(?:\/|$)/.test(url.pathname),async route=>{
        if(route.request().method()==='POST'){attemptedSubmissions++;await route.abort('blockedbyclient');}
        else await route.continue();
      });
      await ledger.prepare(intent('fund',game));
      await owner.page.getByRole('button',{name:'Start LTO',exact:true}).click();
      const rejected=await waitFor(bound,c=>c?.submission==='not-submitted');
      verifyInsufficientEvidence(rejected,attemptedSubmissions);
      const cancelled=await ledger.cancelPrepared(runId+'-fund');
      if(cancelled.state!=='cancelled')throw Error('test-reservation-unresolved');
      const evidence={contractId:rejected.id,financial:rejected.financial,submission:rejected.submission,
        failure:rejected.failure,attemptedSubmissions,availableGameSats:0,transactionCreated:false};
      await vault.transaction(state=>{Object.assign(state.treasureAdminRuns[runId],{contractId:rejected.id,insufficientFunds:evidence});});
      emit({insufficientFunds:evidence});
    }else{
    stage='fund';await ledger.prepare(intent('fund',game));
    const sent=await ledger.submit(runId+'-fund',async()=>{
      if(scenario==='legacy-rollback'){
        const now=Date.now();
        await observeAcceptance(owner.page.evaluate(startLegacyAcceptance,{sessionId:runId,startedAt:now,expiresAt:(Math.floor(now/1000)+90)*1000}));
      }else await owner.page.getByRole('button',{name:'Start LTO',exact:true}).click();
      const c=await waitFor(bound,c=>!!c?.fundingTransactionId);
      return {providerId:c.fundingTransactionId};
    });
    if(!sent.providerId)throw Error('funding-acknowledgement-unknown');
    const funded=await waitFor(bound,c=>c?.financial==='funded');
    if(scenario==='asset-claim'){
      const inputs=funded.fundingInputs?.map(input=>assetInputs.find(c=>c.txid===input.txid&&c.vout===input.vout&&c.value===input.value));
      if(!inputs?.length||inputs.some(c=>!c))throw Error('asset-input-binding-unproven');
      const proof=await verifyTreasureAssetFunding(indexer,{fundingTxid:sent.providerId,contractScript:funded.contractPkScript,
        gameScript:hex.encode(ArkAddress.decode(owner.expected.game.arkadeAddress).pkScript),inputs});
      await vault.transaction(state=>{state.treasureAdminRuns[runId].assetFunding=proof;});emit({assetFunding:proof});
    }
    await settle('fund',funded,sent.providerId,funded.contractPkScript);
    stage=scenario==='legacy-rollback'?'verify-original-legacy':'verify-funded-mode';
    const privateLegacyOriginal=await verifyFundedAcceptanceMode({scenario,page:owner.page,select,provenance:legacyBundle?.provenance,
      original:{network,playerId:player.profileId,gameId:game.profileId,contractId:funded.id,sessionId:funded.sessionId,expiresAt:funded.expiresAt,
        fundingTxid:funded.fundingTransactionId,contractPkScript:funded.contractPkScript}});
    if(privateLegacyOriginal)await vault.transaction(state=>{state.treasureAdminRuns[runId].legacyOriginal=privateLegacyOriginal;});
    if(scenario==='portable'){
      stage='portable-export';
      await owner.accountMenu();await owner.navigate('Contracts');
      await owner.page.getByRole('button',{name:'Portable recovery',exact:true}).click();
      const password=randomBytes(32).toString('base64');
      await owner.page.getByLabel('Recovery password',{exact:true}).fill(password);
      const downloaded=owner.page.waitForEvent('download');
      await owner.page.getByRole('button',{name:'Export encrypted recovery',exact:true}).click();
      const download=await downloaded,stream=await download.createReadStream();
      if(!stream)throw Error('portable-download-unavailable');
      const chunks=[];for await(const chunk of stream)chunks.push(chunk);
      const file=Buffer.concat(chunks).toString('utf8');
      if(JSON.parse(file).format!=='bis-contract-recovery'||file.includes(password))throw Error('portable-envelope-invalid');
      await vault.transaction(state=>{state.treasureAdminRuns[runId].portable={file,password,exportedAt:Date.now()};});
      await download.delete();
      // Close the original client before restoring another protected profile.
      await owner.close();
      stage='portable-new-profile';
      owner=new OwnedBrowser(vault,{pair:pairLabel,origin:'http://127.0.0.1:5174',app:'admin',stableSource:true,
        recoveryProfile:runId,onPublicFailure:details=>emit({browserFailure:publicAcceptanceBrowserFailure(details)})});
      await owner.start();
      if((await rows()).length)throw Error('portable-target-was-not-empty');
      await owner.accountMenu();await owner.navigate('Contracts');
      await owner.page.getByRole('button',{name:'Portable recovery',exact:true}).click();
      await owner.page.getByLabel('Recovery password',{exact:true}).fill(password);
      await owner.page.getByLabel('Recovery file',{exact:true}).setInputFiles({name:'encrypted-recovery.json',mimeType:'application/json',buffer:Buffer.from(file)});
      stage='portable-import';
      await owner.page.getByRole('button',{name:'Import encrypted recovery',exact:true}).click();
      await owner.page.getByText('Recovery imported without submitting a transaction.',{exact:false}).waitFor();
      const imported=await waitFor(bound,c=>!!c?.recoveryRequired,10000);
      if(imported.id!==funded.id||imported.expiresAt!==funded.expiresAt||imported.canClaim||imported.canRefund||imported.canReject)
        throw Error('portable-binding-mismatch');
      await vault.transaction(state=>{const run=state.treasureAdminRuns[runId];run.recoveryProfile=runId;run.portable.importedAt=Date.now();});
      await owner.page.locator('.bis-collection-list .bis-collection-item:visible').first().click();
      await owner.page.getByRole('heading',{name:'Contract Details',exact:true}).waitFor();
      emit({portableImported:true,originalContractId:funded.id,spendingDisabled:true});
      while(Date.now()<funded.expiresAt)await new Promise(r=>setTimeout(r,1000));
    }
    const lostAck={dropped:0,submissions:0,finalizations:0,originalHash:undefined as string|undefined,changed:false};
    if(scenario==='lost-claim-ack'){
      // Forward the real request exactly once. Lose only a successful real
      // response, never synthesize funding, admission or payment evidence.
      await owner.context.route(operator+'/v1/tx/**',async route=>{
        const request=route.request(),path=new URL(request.url()).pathname;
        if(request.method()!=='POST')return route.continue();
        if(path==='/v1/tx/submit'){
          lostAck.submissions++;
          if(lostAck.submissions>1)return route.abort('blockedbyclient');
          return route.continue();
        }
        if(path!=='/v1/tx/finalize')return route.continue();
        lostAck.finalizations++;
        const fingerprint=createHash('sha256').update(request.postDataBuffer()??Buffer.alloc(0)).digest('hex');
        lostAck.originalHash??=fingerprint;
        if(lostAck.originalHash!==fingerprint){lostAck.changed=true;return route.abort('blockedbyclient');}
        const response=await route.fetch({maxRetries:0,timeout:30000});
        if(response.ok()&&!lostAck.dropped){lostAck.dropped++;return route.abort('connectionreset');}
        await route.fulfill({response});
      });
    }
    if(['claim','feedback-claim','asset-claim','duplicate-claim','empty-duplicate-claim','lost-claim-ack'].includes(scenario)){
      stage='claim';await ledger.prepare(intent('claim',player));
      const sent=await ledger.submit(runId+'-claim',async()=>{
        if(['duplicate-claim','empty-duplicate-claim'].includes(scenario)){
          // One browser event loop, no mocked financial result. Both events hit
          // the normal controller and its duplicate-action guard.
          await owner.page.getByRole('button',{name:'Claim LTO',exact:true}).evaluate(button=>{button.click();button.click();});
        }else if(scenario==='feedback-claim'){
          const claim=owner.page.getByRole('button',{name:'Claim LTO',exact:true});
          await claim.scrollIntoViewIfNeeded();
          const observing=owner.page.evaluate(observeTreasureClaimFeedback).then(value=>value,()=>({observed:false,targetMet:false,measurementFailed:true}));
          await owner.page.waitForFunction(()=>document.querySelector('[data-bis-feedback-observing="true"]')!==null,undefined,{timeout:1500});
          // Playwright delivers the ordinary trusted input. The observer itself
          // never invokes, cancels or retries the handler.
          await claim.click();
          feedbackObservation={...await observing,sampleCount:1,p95Qualified:false};
          await vault.transaction(state=>{state.treasureAdminRuns[runId].feedbackObservation=feedbackObservation;});
          emit({feedbackObservation});
        }else await owner.page.getByRole('button',{name:'Claim LTO',exact:true}).click();
        const c=await waitFor(bound,c=>c?.operationKind==='claim'&&!!c.transactionId);
        return {providerId:c.transactionId};
      });
      if(!sent.providerId)throw Error('claim-acknowledgement-unknown');
      const claimed=await waitFor(bound,c=>c?.financial==='claimed');
      await settle('claim',claimed,sent.providerId,hex.encode(ArkAddress.decode(owner.expected.player.arkadeAddress).pkScript));
      if(['duplicate-claim','empty-duplicate-claim'].includes(scenario))emit({duplicateClaimEvents:2,verifiedPayouts:1,...(emptyPlayer?{emptyPlayer}:{} )});
      if(scenario==='lost-claim-ack'){
        const loss={successfulAcknowledgementsDropped:lostAck.dropped,claimSubmissions:lostAck.submissions,
          finalizationCalls:lostAck.finalizations,originalRequestPreserved:!lostAck.changed};
        await vault.transaction(state=>{state.treasureAdminRuns[runId].acknowledgementLoss=loss;});
        emit({acknowledgementLoss:loss});
        if(lostAck.dropped!==1||lostAck.submissions!==1||lostAck.changed)throw Error('lost-ack-precondition-unproven');
      }
    }else if(['network-replacement','legacy-rollback'].includes(scenario)){
      const binding={network,playerId:player.profileId,gameId:game.profileId,contractId:funded.id,sessionId:funded.sessionId,expiresAt:funded.expiresAt};
      if(scenario==='legacy-rollback'){
        stage='preserve-original-legacy';
        if(!privateLegacyOriginal)throw Error('legacy-original-unverified');
      }else{
        stage='network-replacement';await enterProtectedHarness(owner.page);
        let forbiddenPosts=0;
        const wrongScopeRoute=async route=>{
          const request=route.request(),url=new URL(request.url());
          // Indexer subscriptions are observational POSTs, not spends. All
          // other provider POSTs are forbidden during the wrong-network phase.
          if(request.method()==='POST'&&!url.pathname.startsWith('/v1/indexer/')){forbiddenPosts++;await route.abort('blockedbyclient');}else await route.continue();
        };
        const providerUrl=url=>['signet.arkade.sh','mutinynet.arkade.sh','emulator.mutinynet.arkade.sh'].includes(url.hostname);
        await owner.context.route(providerUrl,wrongScopeRoute);
        let assertions;
        restoreNetworkPreferenceOnClose=true;
        assertions=await observeAcceptance(owner.page.evaluate(exerciseProtectedNetworkReplacement,{...binding,otherNetwork:otherFixture.network,
          otherPlayerId:otherFixture.playerId,otherGameId:otherFixture.gameId,fundingTxid:funded.fundingTransactionId}));
        if(forbiddenPosts!==0)throw Error('wrong-network-financial-attempt');
        // Remove the backstop only after the original helper finishes. A timeout
        // leaves it installed until browser closure, never while work is alive.
        await owner.context.unroute(providerUrl,wrongScopeRoute);
        restoreNetworkPreferenceOnClose=false;
        await vault.transaction(state=>{state.treasureAdminRuns[runId].networkReplacement={...assertions,financialPosts:0};});emit({assertions,financialPosts:0});
      }
      const kind=scenario==='legacy-rollback'?'refund':'claim',account=kind==='refund'?game:player;
      stage=scenario==='legacy-rollback'?'current-original-legacy-refund':'restored-original-claim';
      await ledger.prepare(intent(kind,account));
      const result=await ledger.submit(runId+'-'+kind,async()=>{
        const action=await owner.page.evaluate(actOnOriginalAcceptance,{...binding,kind:kind==='refund'?'legacy-refund':'claim'});
        if(!['pending','confirmed'].includes(action.status))throw Error('original-action-unavailable');
        const c=await waitFor(bound,c=>c?.operationKind===kind&&!!c.transactionId);
        return {providerId:c.transactionId};
      });
      if(!result.providerId)throw Error('original-acknowledgement-unknown');
      const resolved=await waitFor(bound,c=>c?.financial===(kind==='claim'?'claimed':'refunded'));
      await settle(kind,resolved,result.providerId,hex.encode(ArkAddress.decode(owner.expected[kind==='claim'?'player':'game'].arkadeAddress).pkScript));
      await owner.page.evaluate(stopOriginalAcceptance);
    }else if(scenario==='identity-race'){
      stage='identity-race';await ledger.prepare(intent('claim',player));
      const sent=await ledger.submit(runId+'-claim',async()=>{
        const assertions=await observeAcceptance(owner.page.evaluate(exerciseTreasureIdentityRace,{network:pair.network,playerId:player.profileId,
          alternatePlayerId,gameId:game.profileId,contractId:funded.id,sessionId:funded.sessionId,expiresAt:funded.expiresAt}));
        await vault.transaction(state=>{state.treasureAdminRuns[runId].identityRace=assertions;});emit({assertions});
        const result=await waitFor(bound,c=>['claimed','refunded'].includes(c?.financial)&&!!c.transactionId);
        return {providerId:result.transactionId};
      });
      if(!sent.providerId)throw Error('race-acknowledgement-unknown');
      const result=await bound();
      if(!result||!['claimed','refunded'].includes(result.financial)||result.transactionId!==sent.providerId)throw Error('race-receipt-unresolved');
      const winner=result.financial==='claimed'?'claim':'refund';
      const chain=await verifyTreasureSpendReceipt(indexer,{fundingTxid:funded.fundingTransactionId,contractScript:funded.contractPkScript,
        spendTxid:sent.providerId,destinationScript:hex.encode(ArkAddress.decode(owner.expected[winner==='claim'?'player':'game'].arkadeAddress).pkScript)});
      // The claim is failed if the competing refund won. That is an observed
      // outpoint conflict, not a fabricated successful claim or another payout.
      await ledger.reconcile(runId+'-claim',async op=>({id:op.intent.id,fingerprint:op.fingerprint,providerId:sent.providerId,
        outcome:winner==='claim'?'settled':'failed',verified:true}));
      const receipt={kind:'competing-original-actions',winner,contractId:funded.id,txid:sent.providerId,chain};
      await vault.transaction(state=>{state.treasureAdminRuns[runId].receipts.push(receipt);});emit({receipt});
    }else if(scenario==='session-rollback'){
      stage='session-rollback';await ledger.prepare(intent('refund',game));
      const sent=await ledger.submit(runId+'-refund',async()=>{
        // Closing an ordinary Account window must not end the funded session.
        await owner.accountMenu();
        await owner.page.locator('.bis-card').last().getByRole('button',{name:'Back',exact:true}).click();
        const stillActive=await bound();
        if(stillActive?.financial!=='funded'||!stillActive.canClaim)throw Error('window-close-ended-session');
        const assertions=await observeAcceptance(owner.page.evaluate(endOriginalTreasureSession,{network:pair.network,playerId:player.profileId,
          gameId:game.profileId,contractId:funded.id,sessionId:funded.sessionId,expiresAt:funded.expiresAt}));
        await vault.transaction(state=>{state.treasureAdminRuns[runId].assertions={...assertions,windowClosePreservedSession:true};});
        emit({assertions});
        const c=await waitFor(bound,c=>c?.operationKind==='refund'&&!!c.transactionId);
        return {providerId:c.transactionId};
      });
      if(!sent.providerId)throw Error('refund-acknowledgement-unknown');
      const refunded=await waitFor(bound,c=>c?.financial==='refunded');
      await settle('refund',refunded,sent.providerId,hex.encode(ArkAddress.decode(owner.expected.game.arkadeAddress).pkScript));
    }else if(scenario==='reject'){
      stage='reject';
      await owner.accountMenu();
      await owner.navigate('Contracts');
      await owner.page.locator('.bis-collection[aria-busy="false"]').waitFor();
      const text=await owner.page.locator('.bis-collection input[readonly]:visible').last().inputValue();
      const position=text.indexOf('Contract ID: '+funded.id);
      if(position<0)throw Error('original-contract-not-listed');
      const index=(text.slice(0,position).match(/Contract ID: /g)??[]).length;
      await owner.page.locator('.bis-collection-list .bis-collection-item:visible').nth(index).click();
      await owner.page.getByRole('heading',{name:'Contract Details',exact:true}).waitFor();
      if(!(await owner.page.getByLabel('Contract',{exact:true}).inputValue()).includes('Contract ID: '+funded.id))throw Error('original-contract-mismatch');
      await ledger.prepare(intent('refund',game));
      const sent=await ledger.submit(runId+'-refund',async()=>{
        await owner.page.getByRole('button',{name:'Reject',exact:true}).click();
        const c=await waitFor(bound,c=>c?.operationKind==='refund'&&!!c.transactionId);
        return {providerId:c.transactionId};
      });
      if(!sent.providerId)throw Error('refund-acknowledgement-unknown');
      const refunded=await waitFor(bound,c=>c?.financial==='refunded');
      await settle('refund',refunded,sent.providerId,hex.encode(ArkAddress.decode(owner.expected.game.arkadeAddress).pkScript));
    }else{
      stage='expiry';await ledger.prepare(intent('refund',game));
      const sent=await ledger.submit(runId+'-refund',async()=>{
        if(scenario==='portable')await owner.page.getByRole('button',{name:'Refresh Contract Details',exact:true}).click();
        const c=await waitFor(bound,c=>c?.operationKind==='refund'&&!!c.transactionId,120000);
        return {providerId:c.transactionId};
      });
      if(!sent.providerId)throw Error('refund-acknowledgement-unknown');
      const refunded=await waitFor(bound,c=>c?.financial==='refunded');
      await settle('refund',refunded,sent.providerId,hex.encode(ArkAddress.decode(owner.expected.game.arkadeAddress).pkScript));
    }
    }
    const acceptancePassed=scenario!=='feedback-claim'||feedbackObservation?.targetMet===true&&feedbackObservation?.trusted===true;
    await vault.transaction(state=>{Object.assign(state.treasureAdminRuns[runId],{completedAt:Date.now(),acceptancePassed});});
    stage='complete';emit({verified:acceptancePassed,mode:modes[mode],...(scenario==='feedback-claim'?{financialVerified:true,feedbackObservation}: {})});
    if(!acceptancePassed)process.exitCode=1;
  }
}catch(error){
  if(needsAcceptanceReadDiagnostics(scenario)&&owner?.page)emit({readNetwork,cspConnectionBlocked});
  if(owner?.page&&['observe-game-readiness','request-game-readiness'].includes(stage))try{
    emit({readinessObservation:await owner.page.evaluate(async()=>{
      const {gameReadinessFromConsole}=await import('/BIS/scripts/treasure-acceptance-policy.ts');
      const text=document.querySelector('textarea[aria-label="Console output"]')?.value??'';
      return {latestWalletStatus:gameReadinessFromConsole(text)??'absent',
        containsWalletStatus:text.includes('A.G.3 Wallet Status'),containsBoardingStatus:text.includes('A.G.3 Boarding Status'),
        containsReadUnavailable:text.includes('provider-read')||text.includes('wallet-read'),
        detailsControls:[...document.querySelectorAll('.story-card')].filter(card=>card.textContent?.includes('A.G.3. Board Game Wallet')).flatMap(card=>[...card.querySelectorAll('button')].filter(button=>button.textContent==='Details').map(button=>({disabled:button.disabled}))),
      };
    })});
  }catch{}
  if(uiErrors.length)emit({uiErrors});
  if(owner?.page){try{emit({ui:await owner.page.evaluate(()=>({
    headings:[...document.querySelectorAll('.bis-card h2')].map(el=>el.textContent).filter(text=>['Account','Accounts Details','Contracts','Contract Details','Game Wallet','Developer'].includes(text)),
    controls:Object.fromEntries(['Accounts Details','Contracts','Refresh Contracts','Refresh Contract Details'].map(name=>[name,[...document.querySelectorAll('button')].filter(b=>b.textContent===name||b.getAttribute('aria-label')===name).map(b=>({disabled:b.disabled,visible:!!b.getClientRects().length}))])),
  }))});}catch{}}
  if(inspectRecords){
    try{emit({contracts:(await inspectRecords()).map(({id,financial,operationKind,operationId,transactionId,fundingTransactionId,validationMode,failure})=>
      ({id,financial,operationKind,operationId,transactionId,fundingTransactionId,validationMode,failure}))});}catch{}
  }
  emit(publicAcceptanceFailure(error));
  process.exitCode=1;
}finally{
  if(restoreNetworkPreferenceOnClose&&owner?.page)await owner.page.evaluate(restoreAcceptanceNetworkPreference,network).catch(()=>{});
  if(owner?.page&&['network-replacement','legacy-rollback'].includes(scenario)){
    await owner.page.evaluate(stopLegacyAcceptance).catch(()=>{});await owner.page.evaluate(stopOriginalAcceptance).catch(()=>{});
  }
  await owner?.close().catch(()=>{});
}
