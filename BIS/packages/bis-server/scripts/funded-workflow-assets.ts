import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {MnemonicIdentity,ReadonlySingleKey,ReadonlyWallet,InMemoryWalletRepository,InMemoryContractRepository,RestArkProvider,RestIndexerProvider,Transaction} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {decodeSigningValue,SIGNER_PROTOCOL} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {readPaymentContext} from '../src/server/payment-context.ts';
import {assertCanonicalSigningTransaction} from '../src/server/offchain-policy.ts';
import {createProtectedBrowserJournalReader} from './protected-browser-journal.ts';
import {validatePaymentAssignment,assertExecutionAuthority,assertReviewedSource,assertProtectedSessionSources,assertAtomicPaymentBudget,remoteRequest,ServerPaymentBrowser,boundedPoll,boundedResult,acceptanceProxyHeaders,type PaymentAssignment,type PaymentMode} from './funded-workflow-live.ts';
import {assetHash,assetBudgetSats,assetRequest,prepareAssetSdkPlan,validateAssetPlan,decodeAssetTransaction,inspectAssetSubmission,inspectAssetFinalization,observeAssetReceipt,type AssetStep,type AssetPlan,type AssetAuthorization} from './funded-workflow-asset-plan.ts';
const legacy=(path:string)=>import(new URL(path,import.meta.url).href);
const {Vault,repositoryRoot}=await legacy('../../../scripts/test-wallets/vault.ts');
const {Operations}=await legacy('../../../scripts/test-wallets/operations.ts');
const {verifiedInventory}=await legacy('../../../scripts/test-wallets/inventory.ts');
const {findTestActor,actorSource,assertAssignedServerActor}=await legacy('../../../scripts/test-wallets/server-actors.ts');
const {windowsProtectorSession}=await legacy('../../../scripts/test-wallets/protector-session.ts');
export type AssetAssignment=PaymentAssignment&Readonly<{step:AssetStep;lineageId:string;authorizationMode:AssetAuthorization;predecessorRunId?:string;assetId?:string}>;
const same=(a:readonly string[],b:readonly string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
export function validateAssetAssignment(value:any):AssetAssignment{
  const {step,lineageId,authorizationMode='owner',predecessorRunId,assetId,...base}=value??{};
  validatePaymentAssignment(base);
  if(!['mint','delivery','burn'].includes(step)||!['owner','player-proof'].includes(authorizationMode)||authorizationMode==='player-proof'&&step==='burn'||
    !/^[a-z][a-z0-9-]{7,23}$/.test(lineageId??'')||base.amountSats!==1000||
    step==='mint'&&(predecessorRunId!==undefined||assetId!==undefined)||
    step!=='mint'&&(!/^[a-z][a-z0-9-]{7,23}$/.test(predecessorRunId??'')||predecessorRunId===base.runId||!/^[a-f0-9]{68}$/.test(assetId??'')))throw Error('Owner lineage assignment unavailable.');
  for(const path of ['BIS/packages/bis-server/scripts/funded-workflow-assets.ts','BIS/packages/bis-server/scripts/funded-workflow-asset-plan.ts'])if(!/^[a-f0-9]{64}$/.test(base.sourceHashes[path]??''))throw Error('Reviewed asset executable sources required.');
  return Object.freeze({...base,step,lineageId,authorizationMode,...(predecessorRunId?{predecessorRunId,assetId}:{})});
}
export function assertAssetAuthority(a:AssetAssignment,mode:PaymentMode,requestedRun:string,env:NodeJS.ProcessEnv,runtime=process.versions.node){
  assertExecutionAuthority(a,mode,requestedRun,env,runtime);
  if(a.authorizationMode==='owner'&&!env.BIS_ACCEPTANCE_OWNER_TOKEN)throw Error('Owner authorization required for the two-unit lineage.');
  if(a.authorizationMode==='player-proof'&&env.BIS_ACCEPTANCE_OWNER_TOKEN)throw Error('Public Player-proof acceptance refuses an owner token.');
}
export function assetScope(a:AssetAssignment){const {approvedFingerprint:_f,approvedOutpoints:_o,...scope}=a;return assetHash({...scope,sourceHashes:Object.fromEntries(Object.entries(scope.sourceHashes).sort(([a],[b])=>a.localeCompare(b)))});}
export function assertAssetPredecessor(a:AssetAssignment,runs:Record<string,any>){
  if(a.step==='mint'){
    if(Object.entries(runs).some(([id,row])=>id!==a.runId&&row.assignment?.lineageId===a.lineageId))throw Error('The original asset lineage already exists.');return;
  }
  const prior=runs[a.predecessorRunId!];
  if(!prior||prior.phase!=='settled'||prior.receipt?.verified!==true||prior.receipt.authorizationMode!==a.authorizationMode||prior.receipt.assetId!==a.assetId||prior.assignment.step!==(a.step==='delivery'?'mint':'delivery')||
    ['lineageId','pair','network','playerProfileId','gameProfileId','endpoint','serverPublicKey'].some(key=>prior.assignment[key]!==a[key as keyof AssetAssignment]))throw Error('Exact settled asset lineage predecessor required.');
}
export function assertAssetConnectionRequest(body:any,a:AssetAssignment){
  if(body?.network!==a.network||body.gameId!=='stealth-and-steel'||Object.keys(body).some(key=>!['network','gameId','profileId','requirement'].includes(key)))throw Error('Pinned connection required.');
  if(body.profileId!==undefined){if(body.profileId!==a.gameProfileId||body.requirement!==undefined)throw Error('Pinned connection required.');return;}
  if(body.requirement===undefined)return;
  const requirement=body.requirement;
  const expected=a.step==='mint'?{purpose:'mint'}:{purpose:'asset',asset:{assetId:a.assetId,quantity:'1',...(a.step==='burn'?{exact:true}:{})}};
  // Initial readiness can request plain sats. No response may replace identity.
  if(!isDeepStrictEqual(requirement,expected)&&!isDeepStrictEqual(requirement,{arkadeSats:1000}))throw Error('Step-bound wallet requirement changed.');
}
export function assertAssetConnectionResponse(response:{status:number;text:string},a:AssetAssignment){
  const row=JSON.parse(response.text);
  if(response.status!==200||row.protocol!==SIGNER_PROTOCOL||row.gameId!=='stealth-and-steel'||row.runtime!=='vercel'||row.profileId!==a.gameProfileId||
    row.publicKey!==a.serverPublicKey||row.network!==a.network||row.slot!==a.candidateId.split(':')[1]||!Array.isArray(row.capabilities)||!row.capabilities.includes('sign')||
    typeof row.token!=='string'||!row.token||row.token.length>4096)throw Error('Reviewed actual server identity changed.');
}
export function assertAssetPreflight(headers:Record<string,string>,path:string,a:AssetAssignment){
  const allowed=a.authorizationMode==='owner'?['connect','owner/plan','owner/authorize','sign']:['connect','player/challenge','player/authenticate','payment/plan','payment/authorize','sign'];
  const requested=(headers['access-control-request-headers']??'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  if(!allowed.includes(path)||headers.origin!=='http://127.0.0.1:5174'||headers['access-control-request-method']!=='POST'||
    requested.some(value=>!['content-type','authorization','x-bis-signing-grant'].includes(value)))throw Error('Unassigned CORS preflight refused.');
}
export function assertAssetRequestEnvelope(body:any,a:AssetAssignment){
  const raw=body?.request??body;
  if(raw?.network!==a.network||raw.profileId!==a.gameProfileId||raw.method!=='sign'||!/^[a-z0-9-]{1,100}$/i.test(raw.id??'')||!/^[a-z0-9-]{1,100}$/i.test(raw.operationId??''))throw Error('Assigned server asset signing scope changed.');
  const decoded=decodeSigningValue(raw.args),value=decoded?.[0];if(typeof value?.toPSBT!=='function')throw Error('Actual SDK signing plan unavailable.');
  return {raw,tx:Transaction.fromPSBT(value.toPSBT())};
}
export function publicAssetPlan(plan:AssetPlan){return {authorizationMode:plan.authorizationMode,step:plan.step,operationId:plan.operationId,assetId:plan.assetId,transactionId:plan.transactionId,
  fingerprint:plan.fingerprint,outpoints:plan.outpoints,carrierSats:plan.carrierSats,exposureSats:plan.exposureSats,feeSats:plan.feeSats,budgetSats:assetBudgetSats(plan),maximumCaseSats:1000,outputs:plan.outputs};}

export function assertAssetOperationBudget(records:readonly any[],intent:any,a:AssetAssignment,plan:AssetPlan|undefined,clientExposure:number,expectedOperationId:string,now=Date.now()){
  const cost=assetBudgetSats(plan,a.amountSats);
  if(!plan||plan.fingerprint!==a.approvedFingerprint||!same(plan.outpoints,a.approvedOutpoints??[])||plan.step!==a.step||plan.authorizationMode!==a.authorizationMode||
    plan.operationId!==a.runId+'-'+a.step||intent.id!==expectedOperationId||records.filter(row=>row.intent?.id===intent.id).length!==1||
    intent.profileId!==a.gameProfileId||intent.network!==a.network||intent.amountSats!==cost||intent.feeSats!==0||intent.kind!==(a.step==='delivery'?'arkade-send':a.step)||
    (a.step==='delivery'?intent.target?.profileId!==a.playerProfileId:intent.target!==undefined))throw Error('Unassigned asset operation or unverified exact cost refused.');
  assertAtomicPaymentBudget(records,intent,clientExposure,now,{allowZeroExposure:cost===0});
}

async function preparePublicAssetPlan(a:AssetAssignment,owner:any,operationId:string){
  const signal=AbortSignal.timeout(30000),endpoint=`https://${a.network}.arkade.sh`,ark=new RestArkProvider(endpoint),indexer=new RestIndexerProvider(endpoint);
  const getInfo=ark.getInfo.bind(ark);ark.getInfo=async()=>{const info=await getInfo();if(info.network!==a.network)throw Error('Assigned provider network changed.');return info;};
  const info=await boundedResult(ark.getInfo(),10000);
  if(!/^\s*\+?0+(?:\.0*)?\s*$/.test(info.fees?.txFeeRate??''))throw Error('Reviewed zero-fee network required.');
  let wallet:ReadonlyWallet|undefined;
  try{
    const opening=ReadonlyWallet.create({identity:ReadonlySingleKey.fromPublicKey(hex.decode(a.serverPublicKey)),arkProvider:ark,indexerProvider:indexer,
      storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}});
    // Dispose even if acquisition completes after the caller's bounded wait.
    opening.then(value=>{if(signal.aborted)void value.dispose().catch(()=>{});}).catch(()=>{});
    wallet=await boundedResult(opening,Math.max(1,30000));
    if(await boundedResult(wallet.getAddress(),10000)!==owner.expected.game.arkadeAddress)throw Error('Reviewed public Game address changed.');
    const coins=await boundedResult(wallet.getSpendableVtxos({withRecoverable:false,withUnrolled:false}),10000);
    if(!coins.length)throw Error('No verified spendable inputs for unsigned planning.');
    const playerPublicKey=hex.encode(await MnemonicIdentity.fromMnemonic(owner.registration.player.phrase,{isMainnet:false}).compressedPublicKey());
    const context=await readPaymentContext({network:a.network,gamePublicKey:a.serverPublicKey,playerPublicKey,outpoints:coins.map(coin=>({txid:coin.txid,vout:coin.vout})),maximumExposureSats:1000,allowAssets:true,signal},
      {info:async()=>info,coins:points=>indexer.getVtxos({outpoints:points,spendableOnly:true})});
    return await prepareAssetSdkPlan(context,{step:a.step,operationId,assetId:a.assetId,carrierSats:Number(wallet.dustAmount),gamePublicKey:a.serverPublicKey.slice(2),authorizationMode:a.authorizationMode},hex.decode(info.signerPubkey.slice(-64)),info.vtxoMinAmount,coins);
  }finally{await wallet?.dispose();}
}

/** Actual public controller operations; preparation stops at their first real
 * unsigned owner plan, before authorization/signing or provider submission.
 */
export async function callBrowserAsset(page:any,input:{step:AssetStep;operationId:string;assetId?:string;playerId:string;gameId:string;network:string;authorizationMode:AssetAuthorization}){
  return page.evaluate(async (input:any)=>{
    const s=(globalThis as any).__serverAcceptance,game=s.game.getState(),player=s.context.getState();
    if(game.source!=='server'||game.profileId!==input.gameId||game.network!==input.network||player.profileId!==input.playerId||player.network!==input.network)throw Error('Original server asset source changed.');
    if(input.step==='mint')return s.game.mintAsset({operationId:input.operationId,name:`BIS acceptance ${input.operationId}`,ticker:'BIST',amount:input.authorizationMode==='owner'?'2':'1',decimals:0});
    if(input.step==='delivery'){
      const recipient=await s.context.getPaymentRecipient();if(recipient.profileId!==input.playerId)throw Error('Assigned Player recipient changed.');
      return s.game.deliverAsset({operationId:input.operationId,assetId:input.assetId,quantity:'1',recipient:recipient.address});
    }
    if(input.authorizationMode!=='owner')throw Error('No Game burn remains after public NFT delivery.');
    return s.game.burnAsset({operationId:input.operationId,assetId:input.assetId,quantity:'1'});
  },input);
}

/** Reconcile through existing public methods only. Financial routes stay shut.
 * A locally unresolved burn is reported honestly because no public burn status
 * recovery method exists; a fresh network receipt cannot silently erase it.
 */
export async function checkBrowserAssetReceipt(page:any,input:{step:AssetStep;operationId:string;assetId:string;transactionId:string;profileId:string;network:string;expectedRequest:any}){
  return page.evaluate(async (input:any)=>{
    const s=(globalThis as any).__serverAcceptance,load=(path:string)=>import(/* @vite-ignore */path),root='/BIS/packages/integration/src/client/state-layer-core/';
    const module=await load(root+(input.step==='mint'?'assets.ts':input.step==='burn'?'burning.ts':'asset-delivery.ts'));
    const read=()=>input.step==='mint'?module.readAssetRecords(input.profileId,input.network):input.step==='burn'?module.readBurnRecords(input.profileId,input.network):module.readAssetDeliveryRecords(input.profileId,input.network);
    const original=read().filter((row:any)=>(row.id??row.request.operationId)===input.operationId);
    if(original.length!==1||JSON.stringify(original[0].request)!==JSON.stringify(input.expectedRequest))throw Error('Original browser asset journal changed.');
    if(original[0].status!=='succeeded'){
      if(input.step==='mint')await s.game.mintAsset(input.expectedRequest);
      else if(input.step==='delivery')await s.game.checkAssetDelivery(input.operationId);
    }
    const rows=read().filter((row:any)=>(row.id??row.request.operationId)===input.operationId);
    if(rows.length!==1||rows[0].status!=='succeeded'||rows[0].transactionId!==input.transactionId||JSON.stringify(rows[0].request)!==JSON.stringify(input.expectedRequest)||
      input.step==='mint'&&rows[0].asset?.assetId!==input.assetId)throw Error('Financial receipt exists but the original browser asset journal remains unresolved.');
    return {operationId:input.operationId,status:'succeeded',transactionId:rows[0].transactionId};
  },input);
}

export async function runAssetAcceptance(assignment:AssetAssignment,mode:PaymentMode,env:NodeJS.ProcessEnv=process.env){
  const a=validateAssetAssignment(assignment);assertAssetAuthority(a,mode,a.runId,env);await assertReviewedSource(a);
  assertProtectedSessionSources(a);
  const protector=windowsProtectorSession(),vault=new Vault({protector}),ledger=new Operations(vault),scope=assetScope(a),operationId=a.runId+'-'+a.step,sourceOperationId=a.runId+'-asset';
  let owner:any,stage='registered-owner-lineage',financial=false,deadline=0,plan:AssetPlan|undefined,privatePrevious:any,initialConnection:any,clientExposure=0;
  let serverRequests=0,signRequests=0,providerRequests=0,primaryPlans=0,proofOperationId:string|undefined,signingOperationId:string|undefined;
  const planPath=a.authorizationMode==='owner'?'owner/plan':'payment/plan',authorizePath=a.authorizationMode==='owner'?'owner/authorize':'payment/authorize';
  const browserEndpoint=a.authorizationMode==='player-proof'?a.endpoint:undefined;
  const serverOrigin=browserEndpoint?new URL(browserEndpoint).origin:'http://127.0.0.1:5174';
  const cors={'Access-Control-Allow-Origin':'http://127.0.0.1:5174','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-BIS-Signing-Grant'};
  const transaction=vault.transaction.bind(vault);
  vault.transaction=async(use:any,options?:any)=>transaction(async(state:any)=>{
    const ids=new Set((state.operations??[]).map((row:any)=>row.intent.id)),result=await use(state);
    for(const row of state.operations??[])if(!ids.has(row.intent.id)){
      assertAssetOperationBudget(state.operations??[],row.intent,a,plan,clientExposure,sourceOperationId);
    }
    return result;
  },options);
  const stillFinancial=()=>financial&&Date.now()<deadline;
  try{
    await vault.transaction(async(state:any)=>{
      await verifiedInventory(state);const pair=state.pairs.find((row:any)=>row.label===a.pair&&row.network===a.network);
      const player=state.accounts.find((row:any)=>row.label===pair?.player),game=findTestActor(state,pair?.game);
      if(player?.profileId!==a.playerProfileId||game?.profileId!==a.gameProfileId||[player,game].some(row=>!row.grant?.active||!row.grant.networks.includes(a.network)||row.reportedPending?.[a.network]))throw Error('Registered granted owner pair unavailable.');
      assertAssignedServerActor(game,a);
      const runs=state.serverAssetRuns??{};assertAssetPredecessor(a,runs);privatePrevious=runs[a.runId];
      if(privatePrevious&&privatePrevious.scope!==scope||mode==='prepare'&&privatePrevious||mode==='run'&&privatePrevious?.phase!=='prepared'||
        mode==='reconcile'&&(!privatePrevious?.originalSubmit||privatePrevious.originalReconciliations||!['unresolved','execution-started'].includes(privatePrevious.phase)))throw Error('Original asset case requires reconciliation.');
      if((state.operations??[]).some((row:any)=>row.intent.network===a.network&&[row.intent.profileId,row.intent.target?.profileId].some(id=>[a.playerProfileId,a.gameProfileId].includes(id))&&!['settled','failed','cancelled'].includes(row.state)&&!(mode==='reconcile'&&row.intent.id===sourceOperationId)))throw Error('Original wallet work remains unresolved.');
      if(mode==='reconcile')privatePrevious.originalReconciliations=1;
    });
    stage='reviewed-deployed-owner';
    initialConnection=await remoteRequest(a.endpoint,'connect',{network:a.network,gameId:'stealth-and-steel',profileId:a.gameProfileId},
      {'Content-Type':'application/json',...(a.authorizationMode==='owner'?{Authorization:`Bearer ${env.BIS_ACCEPTANCE_OWNER_TOKEN}`}:{})},env);serverRequests++;
    const checkConnect=(response:any)=>assertAssetConnectionResponse(response,a);
    checkConnect(initialConnection);
    const proxy=async(route:any)=>{
      const request=route.request(),url=new URL(request.url());
      try{
        if(url.origin===serverOrigin&&url.pathname.startsWith('/api/bis/')){
          if(request.method()==='OPTIONS'){assertAssetPreflight(request.headers(),url.pathname.slice('/api/bis/'.length),a);return route.fulfill({status:204,headers:cors});}
          if(request.method()!=='POST'||(request.postDataBuffer()?.length??0)>1024*1024)throw Error('Unexpected server route.');
          const path=url.pathname.slice('/api/bis/'.length),body=request.postDataJSON();
          if(path==='connect'){
            assertAssetConnectionRequest(body,a);
          }else if(['player/challenge','player/authenticate'].includes(path)){
            if(a.authorizationMode!=='player-proof'||mode!=='run'||!stillFinancial()||body.network!==a.network||body.gameId!=='stealth-and-steel'||body.profileId!==a.gameProfileId||typeof body.operationId!=='string')throw Error('Public proof scope changed.');
            if(proofOperationId&&proofOperationId!==body.operationId)throw Error('Original public proof operation changed.');proofOperationId=body.operationId;
            if(path==='player/challenge'){
              const key=hex.encode(await MnemonicIdentity.fromMnemonic(owner.registration.player.phrase,{isMainnet:false}).compressedPublicKey());
              if(body.playerPublicKey!==key)throw Error('Assigned Player proof key changed.');
            }
            await vault.transaction((state:any)=>{const run=state.serverAssetRuns[a.runId];run.originalProofRequests??=[];run.originalProofRequests.push({path,body});});
          }else if(path===planPath){
            if(mode==='reconcile'||mode==='run'&&!stillFinancial()||++primaryPlans!==1)throw Error('Original owner plan already exists.');
            const {raw,tx}=assertAssetRequestEnvelope(body,a);signingOperationId=raw.operationId;
            if(a.authorizationMode==='player-proof'&&signingOperationId!==proofOperationId)throw Error('Unsigned plan changed its authenticated operation.');
            if(!Array.isArray(body.outpoints)||!body.outpoints.length)throw Error('Actual original inputs unavailable.');
            const network=`https://${a.network}.arkade.sh`,ark=new RestArkProvider(network),indexer=new RestIndexerProvider(network),info=await boundedResult(ark.getInfo(),10000);
            const playerPublicKey=hex.encode(await MnemonicIdentity.fromMnemonic(owner.registration.player.phrase,{isMainnet:false}).compressedPublicKey());
            const context=await readPaymentContext({network:a.network,gamePublicKey:a.serverPublicKey,playerPublicKey,outpoints:body.outpoints,maximumExposureSats:1000,allowAssets:true,signal:AbortSignal.timeout(10000)},
              {info:async()=>info,coins:points=>indexer.getVtxos({outpoints:points,spendableOnly:true})});
            if(!/^\s*\+?0+(?:\.0*)?\s*$/.test(info.fees?.txFeeRate??''))throw Error('Reviewed zero-fee network required.');
            const fresh=validateAssetPlan(tx,context,{step:a.step,operationId,assetId:a.assetId,carrierSats:Number(info.dust),gamePublicKey:a.serverPublicKey.slice(2),authorizationMode:a.authorizationMode});
            if(mode==='run'&&(fresh.fingerprint!==a.approvedFingerprint||!same(fresh.outpoints,a.approvedOutpoints!)||fresh.fingerprint!==privatePrevious.plan.fingerprint))throw Error('Fresh original asset plan differs from approval.');
            plan=fresh;
            if(mode==='prepare')return route.abort('blockedbyclient');
            if(!stillFinancial())throw Error('Original observation deadline exhausted.');
            await vault.transaction((state:any)=>{state.serverAssetRuns[a.runId].originalPlan=body;});
          }else if(path===authorizePath||path==='sign'){
            if(mode!=='run'||!stillFinancial()||!plan)throw Error('Owner signing disabled.');
            const {raw,tx}=assertAssetRequestEnvelope(body,a),expected=[plan.unsignedArkTx,...plan.unsignedCheckpoints].map(decodeAssetTransaction).find(candidate=>candidate.id===tx.id);
            if(!expected||raw.operationId!==signingOperationId)throw Error('Unassigned asset signing transaction.');assertCanonicalSigningTransaction(tx,expected);
            if(path==='sign')await vault.transaction((state:any)=>{const run=state.serverAssetRuns[a.runId];run.originalSigningRequests??=[];
              if(run.originalSigningRequests.some((row:any)=>row.body.id===raw.id||row.transactionId===tx.id)||run.originalSigningRequests.length>plan!.unsignedCheckpoints.length)throw Error('Original signing request repeated.');
              run.originalSigningRequests.push({body,transactionId:tx.id,grant:request.headers()['x-bis-signing-grant']});
            });
          }else throw Error('Unsupported owner-only asset route.');
          if(path!=='connect'&&!stillFinancial())throw Error('Owner signing deadline exhausted.');
          const cached=path==='connect'&&initialConnection&&body.requirement===undefined;
          const headers=acceptanceProxyHeaders(request.headers());
          const response=cached?initialConnection:await remoteRequest(a.endpoint,path,body,headers,env);if(cached)initialConnection=undefined;else serverRequests++;
          if(path==='connect')checkConnect(response);if(path==='sign'&&response.status===200)signRequests++;
          return route.fulfill({status:response.status,contentType:'application/json',headers:cors,body:response.text});
        }
        if(['GET','HEAD','OPTIONS'].includes(request.method())||url.origin===`https://${a.network}.arkade.sh`&&url.pathname.startsWith('/v1/indexer/'))return route.continue();
        if(!stillFinancial()||url.origin!==`https://${a.network}.arkade.sh`||!['/v1/tx/submit','/v1/tx/finalize'].includes(url.pathname)||!plan)throw Error('Unassigned asset provider mutation refused.');
        const body=request.postDataJSON();
        if(url.pathname==='/v1/tx/submit'){
          inspectAssetSubmission(body,plan);
          const original=await owner.page.evaluate(async (input:any)=>{
            const load=(path:string)=>import(/* @vite-ignore */path),root='/BIS/packages/integration/src/client/state-layer-core/';
            const module=await load(root+(input.step==='mint'?'assets.ts':input.step==='burn'?'burning.ts':'asset-delivery.ts'));
            const rows=input.step==='mint'?module.readAssetRecords(input.profileId,input.network):input.step==='burn'?module.readBurnRecords(input.profileId,input.network):module.readAssetDeliveryRecords(input.profileId,input.network);
            const matches=rows.filter((row:any)=>(row.id??row.request.operationId)===input.operationId);
            if(matches.length!==1||matches[0].status!=='pending'||JSON.stringify(matches[0].request)!==JSON.stringify(input.expected))throw Error('Durable original browser asset intent unavailable.');
            return {operationId:input.operationId,status:matches[0].status,inputs:matches[0].inputs};
          },{step:a.step,profileId:a.gameProfileId,network:a.network,operationId,expected:assetRequest(a.step,operationId,a.assetId,owner.expected.player.arkadeAddress,a.authorizationMode)});
          await vault.transaction((state:any)=>{const run=state.serverAssetRuns[a.runId];if(run.originalSubmit)throw Error('Original asset submission already exists.');run.browserIntent=original;run.originalSubmit=body;run.plan=plan;});
        }else await vault.transaction((state:any)=>{
          const run=state.serverAssetRuns[a.runId];if(!run.originalSubmit||run.originalFinalize)throw Error('Original asset finalization changed.');inspectAssetFinalization(body,plan!);run.originalFinalize=body;
        });
        if(!stillFinancial())throw Error('Original provider observation expired.');providerRequests++;return route.continue();
      }catch{return route.abort('blockedbyclient').catch(()=>{});}
    };
    stage='original-owned-server-profile';
    owner=new ServerPaymentBrowser(vault,{pair:a.pair,origin:'http://127.0.0.1:5174',app:'admin',stableSource:true,recoveryProfile:(mode==='prepare'?'asset-prep-':'asset-')+a.runId});
    owner.acceptance={assignment:a,proxy,ownerToken:env.BIS_ACCEPTANCE_OWNER_TOKEN,...(browserEndpoint?{browserEndpoint}:{})};await owner.start();await owner.inspect();
    const client=createProtectedBrowserJournalReader({page:owner.page,vault,runId:a.runId,slot:env.BIS_SERVER_ACCEPTANCE_SLOT,profileId:a.gameProfileId,network:a.network,...(actorSource(owner.registration.game)?{serverSource:actorSource(owner.registration.game)}:{})});
    if(mode!=='reconcile'){
      const snapshot=await client.readNetworkSnapshot(a.gameProfileId,a.network,Date.now(),[]);
      if(snapshot.reservations.length||snapshot.unknownOperations.length)throw Error('Original browser asset source unresolved.');
      clientExposure=snapshot.rolling24hSpentSats+snapshot.knownReservedSats;
      if(mode==='run'){
        stage='durable-original-owner-operation';plan=privatePrevious.plan;
        if(plan!.fingerprint!==a.approvedFingerprint||!same(plan!.outpoints,a.approvedOutpoints!))throw Error('Original prepared asset approval changed.');
        const budgetSats=assetBudgetSats(plan,a.amountSats);
        await assertReviewedSource(a);await vault.transaction((state:any)=>{const run=state.serverAssetRuns[a.runId];if(run.phase!=='prepared')throw Error('Original asset already attempted.');run.phase='execution-started';});
        const game=owner.registration.game,player=owner.registration.player;
        await ledger.prepare({id:sourceOperationId,account:game.label,profileId:a.gameProfileId,generation:game.generation,network:a.network,kind:a.step==='delivery'?'arkade-send':a.step,
          ...(actorSource(game)?{serverSource:actorSource(game)}:{}),
          recipient:a.step==='delivery'?owner.expected.player.arkadeAddress:`asset:${plan!.assetId}`,amountSats:budgetSats,feeSats:0,sourceOrigin:'http://127.0.0.1:5174',
          ...(a.step==='delivery'?{target:{account:player.label,profileId:player.profileId,generation:player.generation}}:{})});
        financial=true;deadline=Date.now()+120000;
      }
      stage=mode==='prepare'?'unsigned-sdk-preparation':'original-owner-asset';
      const call=()=>boundedResult(callBrowserAsset(owner.page,{step:a.step,operationId,assetId:a.assetId,playerId:a.playerProfileId,gameId:a.gameProfileId,network:a.network,authorizationMode:a.authorizationMode}),mode==='prepare'?45000:Math.max(1,deadline-Date.now()));
      if(mode==='prepare'){
        if(a.authorizationMode==='player-proof')plan=await preparePublicAssetPlan(a,owner,operationId);else await call();
        if(!plan||primaryPlans!==(a.authorizationMode==='owner'?1:0)||signRequests||providerRequests||proofOperationId)throw Error('Actual unsigned SDK plan unavailable.');
        await vault.transaction((state:any)=>{state.serverAssetRuns??={};if(state.serverAssetRuns[a.runId])throw Error('Original preparation already exists.');state.serverAssetRuns[a.runId]={scope,assignment:a,phase:'prepared',plan,authorizationMode:a.authorizationMode,preparationOnlyProfile:true};});
        return {verifiedPreparation:true,authorizationMode:a.authorizationMode,source:'server',financialActions:0,signingActions:0,plan:publicAssetPlan(plan),serverRequests,
          transport:'controlled owned browser and authenticated HTTPS proxy; deployed Pages CSP/CORS remains unverified',unsupported:['manual-parity','boarding','standard-lto',...(a.authorizationMode==='owner'?['public-player-proof-parity']:['public-burn'])]};
      }
      await ledger.submit(sourceOperationId,async()=>{await call();const original=(await vault.read({initialize:false})).serverAssetRuns[a.runId];if(!original.originalSubmit)throw Error('Original submission acknowledgement unavailable.');return {providerId:original.plan.transactionId};});
      financial=false;
    }
    stage='original-asset-reconciliation';
    const saved=(await vault.read({initialize:false})).serverAssetRuns[a.runId];
    if(saved?.scope!==scope||!saved.originalSubmit)throw Error('No original asset submission to reconcile.');plan=saved.plan;
    if(mode==='reconcile')deadline=Date.now()+120000;
    let receipt:any;const indexer=new RestIndexerProvider(`https://${a.network}.arkade.sh`);
    await boundedPoll(async()=>{try{receipt=await observeAssetReceipt(indexer,plan!);return true;}catch{return false;}},Math.max(1,deadline-Date.now()));
    const browserJournal=await boundedResult(checkBrowserAssetReceipt(owner.page,{step:a.step,operationId,assetId:plan!.assetId,transactionId:plan!.transactionId,profileId:a.gameProfileId,network:a.network,
      expectedRequest:assetRequest(a.step,operationId,a.assetId,owner.expected.player.arkadeAddress,a.authorizationMode)}),Math.max(1,deadline-Date.now()));
    const settled=await ledger.reconcile(sourceOperationId,async(row:any)=>({id:row.intent.id,fingerprint:row.fingerprint,providerId:plan!.transactionId,outcome:'settled',verified:true,feeSats:0}));
    if(settled.state!=='settled'||mode==='run'&&signRequests<1)throw Error('Actual owner server asset acceptance incomplete.');
    await vault.transaction((state:any)=>Object.assign(state.serverAssetRuns[a.runId],{phase:'settled',receipt,browserJournal,completedAt:new Date().toISOString()}));
    return {verifiedAsset:true,authorizationMode:a.authorizationMode,source:'server',lineageId:a.lineageId,receipt,serverRequests,signRequests,providerRequests,
      transport:'controlled owned browser and authenticated HTTPS proxy; deployed Pages CSP/CORS remains unverified',unsupported:['manual-parity','boarding','standard-lto',...(a.authorizationMode==='owner'?['public-player-proof-parity']:['public-burn'])]};
  }catch{
    financial=false;if(mode!=='prepare')await vault.transaction((state:any)=>{const run=state.serverAssetRuns?.[a.runId];if(run?.phase==='execution-started')run.phase='unresolved';}).catch(()=>{});
    throw Error(`Owner asset acceptance stopped at ${stage}; preserve original private journals.`);
  }finally{
    financial=false;try{await owner?.page?.evaluate(()=>{const s=(globalThis as any).__serverAcceptance;s?.game?.dispose();s?.ui?.unmount();s?.context?.dispose();delete (globalThis as any).__serverAcceptance;}).catch(()=>{});await owner?.close().catch(()=>{});}finally{await protector.close();}
  }
}
if(import.meta.main){
  for(const method of ['log','info','warn','error','debug','trace','dir'] as const)console[method]=()=>{};
  try{
    if(!/^24\./.test(process.versions.node)||!process.env.BIS_SERVER_ACCEPTANCE_SLOT||process.argv.length!==5)throw Error('Exact acceptance slot required.');
    const [mode,path,run]=process.argv.slice(2),a=validateAssetAssignment(JSON.parse(await readFile(resolve(path),'utf8')));assertAssetAuthority(a,mode as PaymentMode,run,process.env);
    const result=await runAssetAcceptance(a,mode as PaymentMode),directory=resolve(repositoryRoot,'output/reports/bis-server/milestone-1');await mkdir(directory,{recursive:true});
    await writeFile(resolve(directory,`asset-${a.runId}-${mode}.json`),JSON.stringify(result,null,2)+'\n');process.stdout.write(JSON.stringify({runId:a.runId,mode,...result})+'\n');
  }catch{process.stdout.write(JSON.stringify({ok:false,reason:'guarded-asset-acceptance-incomplete',qualification:'No success inferred. Preserve the original protected operation.'})+'\n');process.exitCode=1;}
}
