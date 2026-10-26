// Protected test setup only. This ordinary wallet transfer is NOT a contract.
import {ArkAddress,RestIndexerProvider} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {Vault} from './test-wallets/vault.ts';
import {Operations} from './test-wallets/operations.ts';
import {OwnedBrowser} from './test-wallets/owned-browser.ts';
import {assetManifest} from './test-wallets/treasure-asset-evidence.ts';
import {observeAcceptance} from './treasure-acceptance-policy.ts';
for(const method of ['log','info','warn','error','debug','trace','dir'])console[method]=()=>{};
const requestFetch=globalThis.fetch;
globalThis.fetch=(input,init={})=>requestFetch(input,{...init,signal:AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(15000)])});
const [runId,network]=process.argv.slice(2),vault=new Vault(),ledger=new Operations(vault);
let owner,stage='arguments';
const emit=value=>process.stdout.write(JSON.stringify({runId,stage,...value})+'\n');
try{
  if(process.argv.length!==4||!/^[a-z][a-z0-9-]{0,27}$/.test(runId??'')||!['signet','mutinynet'].includes(network))throw Error('invalid-setup-selection');
  const pairLabel=network==='signet'?'treasure-signet-pair':'market-remint-pair';
  await vault.transaction(state=>{
    if(state.treasureSetupRuns?.[runId]||state.operations?.some(op=>op.intent.id===runId))throw Error('original-setup-requires-reconciliation');
    const pair=state.pairs.find(p=>p.label===pairLabel);
    if(!pair||pair.network!==network)throw Error('setup-pair-unavailable');
    const accounts=[pair.game,pair.player].map(label=>state.accounts.find(a=>a.label===label));
    if(accounts.some(a=>!a?.grant?.active||!a.grant.networks.includes(network)||a.reportedPending?.[network])||
      state.operations?.some(op=>op.intent.network===network&&accounts.some(a=>[op.intent.profileId,op.intent.target?.profileId].includes(a.profileId))&&!['settled','failed','cancelled'].includes(op.state)))throw Error('setup-wallet-reserved');
  });
  stage='protected-browser';owner=new OwnedBrowser(vault,{pair:pairLabel,origin:'http://127.0.0.1:5174',app:'admin',stableSource:true});await owner.start();
  const {player,game}=owner.registration,indexer=new RestIndexerProvider('https://'+network+'.arkade.sh');
  const gameScript=hex.encode(ArkAddress.decode(owner.expected.game.arkadeAddress).pkScript),playerScript=hex.encode(ArkAddress.decode(owner.expected.player.arkadeAddress).pkScript);
  stage='live-input-manifest';
  const {vtxos}=await indexer.getVtxos({scripts:[gameScript],spendableOnly:true});
  if(!vtxos.length||vtxos.some(c=>c.script!==gameScript||c.isSpent||c.spentBy||c.isSwept||c.isUnrolled))throw Error('setup-inputs-unverified');
  const assets=assetManifest(vtxos),total=vtxos.reduce((sum,c)=>sum+c.value,0);
  const existingCarrierSats=vtxos.filter(c=>c.assets?.length).reduce((sum,c)=>sum+c.value,0);
  // Consolidate enough real sats into retained asset change for the missing
  // contract cases. Never transfer assets to the Player as a reward substitute.
  const carrierSats=Math.max(network==='mutinynet'?3330:1330,existingCarrierSats),amountSats=total-carrierSats;
  if(!assets.length||!Number.isSafeInteger(amountSats)||!Number.isSafeInteger(total)||vtxos.some(c=>!Number.isSafeInteger(c.value)||c.value<=0)||amountSats<330)throw Error('setup-carrier-precondition');
  const sources=vtxos.map(c=>({txid:c.txid,vout:c.vout,value:c.value,assets:(c.assets??[]).map(a=>({assetId:a.assetId,amount:String(a.amount)}))}));
  await vault.transaction(state=>{state.treasureSetupRuns??={};state.treasureSetupRuns[runId]={network,player:player.profileId,game:game.profileId,
    kind:'ordinary-asset-preserving-wallet-transfer',amountSats,sources,assets,createdAt:Date.now()};});
  await ledger.prepare({id:runId,account:game.label,profileId:game.profileId,generation:game.generation,network,kind:'arkade-send',
    recipient:owner.expected.player.arkadeAddress,amountSats,feeSats:0,sourceOrigin:owner.registration.application.origin,
    target:{account:player.label,profileId:player.profileId,generation:player.generation}});
  stage='ordinary-setup-transfer';
  const submitted=await ledger.submit(runId,async()=>{
    const result=await observeAcceptance(owner.page.evaluate(async input=>{
      const {createBisContext,createBisGameWallet}=await import('/BIS/packages/integration/src/index.ts');
      const context=createBisContext();let game;
      try{
        await context.readyAsync();
        if(context.getState().profileId!==input.playerId||context.getState().network!==input.network||context.getState().phase!=='active')throw Error('setup-player-binding');
        game=createBisGameWallet({playerProfileId:()=>context.getState().profileId,playerNetwork:()=>context.getState().network,
          playerSubscribe:context.subscribe,playerSessionKey:()=>JSON.stringify([context.getState().profileId,context.getState().network])});
        await game.refresh();if(game.getState().profileId!==input.gameId||game.getState().source==='server')throw Error('setup-game-binding');
        const recipient=await context.getPaymentRecipient();if(recipient.profileId!==input.playerId||recipient.address!==input.address)throw Error('setup-recipient-binding');
        const result=await game.payPlayer(recipient,input.amountSats);
        return {status:result.status,transactionId:result.transactionId};
      }finally{game?.dispose();context.dispose();}
    },{network,playerId:player.profileId,gameId:game.profileId,address:owner.expected.player.arkadeAddress,amountSats}));
    if(!/^[a-f0-9]{64}$/.test(result.transactionId??''))throw Error('setup-acknowledgement-unknown');
    return {providerId:result.transactionId};
  });
  if(!submitted.providerId)throw Error('setup-outcome-unknown');
  stage='exact-setup-receipt';
  const {vtxos:observed}=await indexer.getVtxos({outpoints:[...sources.map(({txid,vout})=>({txid,vout})),{txid:submitted.providerId,vout:0},{txid:submitted.providerId,vout:1}]});
  const sourceRows=sources.map(input=>observed.find(c=>c.txid===input.txid&&c.vout===input.vout));
  const payout=observed.find(c=>c.txid===submitted.providerId&&c.vout===0),change=observed.find(c=>c.txid===submitted.providerId&&c.vout===1);
  if(sourceRows.some((c,i)=>!c?.isSpent||!c.spentBy||c.arkTxId!==submitted.providerId||c.value!==sources[i].value)||
    JSON.stringify(assetManifest(sourceRows))!==JSON.stringify(assets)||!payout||payout.script!==playerScript||payout.value!==amountSats||payout.assets?.length||
    !change||change.script!==gameScript||change.value!==total-amountSats||JSON.stringify(assetManifest([change]))!==JSON.stringify(assets))throw Error('setup-receipt-unverified');
  const reconciled=await ledger.reconcile(runId,async op=>({id:runId,fingerprint:op.fingerprint,providerId:submitted.providerId,outcome:'settled',verified:true}));
  if(reconciled.state!=='settled')throw Error('setup-reservation-unresolved');
  const receipt={kind:'ordinary-wallet-transfer-not-a-contract',txid:submitted.providerId,amountSats,gameChangeSats:change.value,retainedAssets:assets};
  await vault.transaction(state=>{Object.assign(state.treasureSetupRuns[runId],{receipt,completedAt:Date.now()});});emit({verified:true,receipt});
}catch(error){emit({verified:false,reason:['invalid-setup-selection','original-setup-requires-reconciliation','setup-wallet-reserved','setup-carrier-precondition','setup-outcome-unknown','setup-receipt-unverified'].includes(error?.message)?error.message:'protected-asset-setup-incomplete'});process.exitCode=1;}
finally{await owner?.close().catch(()=>{});}
