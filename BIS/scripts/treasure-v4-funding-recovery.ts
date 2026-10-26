// One-run recovery for the exact stranded V4 B2 funding output. This file is
// never imported by the app and never resumes or changes the original B2 claim.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {MnemonicIdentity,RestArkProvider,RestIndexerProvider,RestEmulatorProvider,Transaction,
  assertValidServerUnrollScript,defaultCheckpointExitDelayPolicy,
  getNetwork,canSpendOffchain,type ArkInfo} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {buildAuthorizedTreasureScript,treasureAuthorizationActors} from '../packages/integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {prepareAuthorizedTreasureTransaction,completeAuthorizedTreasureTransaction} from '../packages/integration/src/client/wallet-layer-arkade/treasure-authorized-transaction.ts';
import {createStagedTreasureState,transitionStagedTreasureState,type StagedTreasureBinding,type StagedTreasureState,
  validateStagedTreasureBinding,validateStagedTreasureState,type StagedTreasureEvent} from '../packages/integration/src/client/wallet-layer-arkade/treasure-staged-state.ts';
import {inspectTreasureDirectPolicy} from '../packages/integration/src/client/wallet-layer-arkade/treasure-direct-policy.ts';
import {TREASURE_EMULATOR} from '../packages/integration/src/client/wallet-layer-arkade/treasure-capability.ts';
import {testNetwork} from '../packages/integration/src/client/state-layer-core/test-network.ts';
import {assertAcceptanceBudget} from './treasure-acceptance-policy.ts';
import {assertV4RefundRecoveryAdmission,type RefundRecoveryOperation,type RefundRecoveryRun} from './treasure-v4-refund-recovery-policy.ts';

type Account={label:string;profileId:string;generation:number;phrase:string;grant?:{active:boolean;networks:string[]};reportedPending?:Record<string,unknown>};
type Operation={intent:{id:string;network:string;profileId:string;generation:number;target?:{profileId:string};kind:string;amountSats:number;feeSats:number|null};
  state:string;createdAt:string;updatedAt:string;fingerprint:string;providerId?:string};
type RecoveryJournal={sourceSha256:string;binding?:StagedTreasureBinding;stage?:StagedTreasureState;
  signings:{kind:'root'|'checkpoint';bindingCommitment:string;request:string;status:'pending'|'unknown'|'completed';result?:string|string[]}[];
  preparedAtMs:number;receipt?:unknown};
type Run={artifactVersion:4;network:'mutinynet';scenario:'b2';pair:string;game:string;player:string;sourceSha256:string;deadlineMs:number;
  phase:string;outcome?:string;terms:Parameters<typeof buildAuthorizedTreasureScript>[0];fundingTxid?:string;fundingWire?:string;
  binding?:StagedTreasureBinding;stage?:StagedTreasureState;spendTxid?:string;receipt?:unknown;reconciliationAtMs?:number;
  requests?:{kind:string;atMs:number;payload:unknown}[];refundRecovery?:RecoveryJournal};
type VaultState={accounts:Account[];pairs:{label:string;network:string;player:string;game:string}[];operations:Operation[];
  treasureV4QualificationRuns:Record<string,Run>};
type PrivateVault={transaction<T>(use:(state:VaultState)=>T|Promise<T>):Promise<T>};
type Ledger={prepare(intent:unknown):Promise<Operation>;submit(id:string,send:()=>Promise<{providerId:string}>):Promise<Operation>;
  reconcile(id:string,read:(record:Operation)=>Promise<unknown>):Promise<Operation>;list():Promise<Operation[]>};
type Options={runId:string;reconcile:boolean};
const TARGET_RUN='treasure-b2-261026-1125';
const SOURCES=['BIS/scripts/treasure-v4-funding-recovery.ts','BIS/scripts/treasure-v4-refund-recovery-policy.ts',
  'BIS/scripts/treasure-v4-qualification.ts','BIS/scripts/treasure-acceptance-policy.ts','BIS/scripts/test-wallets/operations.ts',
  'BIS/scripts/test-wallets/vault.ts','BIS/scripts/test-wallets/inventory.ts','BIS/scripts/test-wallets/treasure-receipt.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-authorized-transaction.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-staged-state.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-staged-submit.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-direct-policy.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-capability.ts',
  'BIS/packages/integration/src/client/state-layer-core/test-network.ts','package-lock.json','node_modules/@arkade-os/sdk/package.json'];
const invalid=()=>Error('Original V4 funding remains reserved; recovery did not complete.');
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT());
const decode=(value:string)=>Transaction.fromPSBT(base64.decode(value));
const terminal=new Set(['settled','failed','cancelled']);
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(key=>[key,(v as Record<string,unknown>)[key]])):v);

export function parseV4FundingRecoveryOptions(args:readonly string[]):Options{
  const [runId,...flags]=args;let reconcile=false;
  if(runId!==TARGET_RUN||flags.length>1||flags.length===1&&flags[0]!=='--reconcile')throw invalid();
  reconcile=flags[0]==='--reconcile';return {runId,reconcile};
}

async function recoverySourceDigest(){
  const root=new URL('../../',import.meta.url),entries=await Promise.all(SOURCES.map(async path=>({path,sha256:hash(await readFile(new URL(path,root)))})));
  return hash(JSON.stringify(entries));
}

function selectedState(state:VaultState,runId:string,now:number,reconcile=false){
  const run=state.treasureV4QualificationRuns?.[runId],pair=state.pairs.find(item=>item.label==='treasure-empty-game-mutinynet'&&item.network==='mutinynet');
  if(!run||!pair||pair.game!==state.accounts.find(a=>a.label===pair.game)?.label||pair.player!==state.accounts.find(a=>a.label===pair.player)?.label)throw invalid();
  const game=state.accounts.find(a=>a.label===pair.game),player=state.accounts.find(a=>a.label===pair.player);
  if(!game||!player||game.profileId===player.profileId||run.game!==game.profileId||run.player!==player.profileId||
    [game,player].some(a=>!a.grant?.active||!a.grant.networks.includes('mutinynet')||a.reportedPending?.mutinynet))throw invalid();
  const operations=state.operations??[],fundingOperation=operations.find(op=>op.intent.id===`${runId}-fund`),refundOperation=operations.find(op=>op.intent.id===`${runId}-refund`);
  const conflicting=operations.some(op=>op.intent.network==='mutinynet'&&!terminal.has(op.state)&&
    ![`${runId}-fund`,`${runId}-refund`].includes(op.intent.id)&&
    [op.intent.profileId,op.intent.target?.profileId].some(id=>id===game.profileId||id===player.profileId));
  const resumeAfterAcceptedSubmit=!reconcile&&['operator-signed','actor-checkpoints-signed'].includes(run.refundRecovery?.stage?.phase??'')&&
    refundOperation?.state==='pending';
  const admission=assertV4RefundRecoveryAdmission({runId,now,run:run as unknown as RefundRecoveryRun,
    fundingOperation:fundingOperation as unknown as RefundRecoveryOperation|undefined,
    refundOperation:(reconcile||resumeAfterAcceptedSubmit?undefined:refundOperation) as unknown as RefundRecoveryOperation|undefined,
    gameProfileId:game.profileId,hasConflictingOperation:conflicting});
  if(reconcile){
    if(!refundOperation||!['submitting','pending','unknown','settled'].includes(refundOperation.state)||
      refundOperation.intent.id!==`${runId}-refund`||refundOperation.intent.kind!=='refund'||refundOperation.intent.amountSats!==1000||
      refundOperation.intent.feeSats!==0)throw invalid();
  }else if(refundOperation){
    const phase=run.refundRecovery?.stage?.phase,prepared=refundOperation.state==='prepared';
    const continuingAcceptedSpend=['operator-signed','actor-checkpoints-signed'].includes(phase??'')&&refundOperation.state==='pending'&&
      typeof refundOperation.providerId==='string'&&/^[a-f0-9]{64}$/.test(refundOperation.providerId);
    if((!prepared&&!continuingAcceptedSpend)||refundOperation.intent.id!==`${runId}-refund`||refundOperation.intent.kind!=='refund'||
      refundOperation.intent.amountSats!==1000||refundOperation.intent.feeSats!==0)throw invalid();
  }
  return {run:structuredClone(run),game:structuredClone(game),player:structuredClone(player),refundOperation:refundOperation?structuredClone(refundOperation):undefined,
    fundingOperation:structuredClone(fundingOperation!),admission};
}

function inspectInfo(info:ArkInfo,terms:Run['terms']){
  const policy=inspectTreasureDirectPolicy('mutinynet',info);
  if(info.network!=='mutinynet'||info.signerPubkey.slice(-64)!==terms.operator||terms.emulator!==TREASURE_EMULATOR.key.slice(-64)||
    !/^(?:0[23])?[a-f0-9]{64}$/.test(info.forfeitPubkey))throw invalid();
  assertValidServerUnrollScript(info.checkpointTapscript,{...defaultCheckpointExitDelayPolicy(getNetwork('mutinynet')),
    advertisedForfeitPubkey:hex.decode(info.forfeitPubkey.slice(-64))});
  return policy;
}

let active=false;
export async function runV4FundingRecovery(options:Options){
  if(active)throw invalid();active=true;
  const methods=['log','info','warn','error','debug','trace','dir'] as const,saved=methods.map(method=>console[method]);
  methods.forEach(method=>{console[method]=()=>{};});
  let stage='authorization';
  const originalFetch=globalThis.fetch,expiresAt=Date.now()+120_000,signal=AbortSignal.timeout(120_000);
  const remaining=()=>{const value=Math.floor(expiresAt-Date.now());if(value<=0||signal.aborted)throw invalid();return value;};
  let vault:PrivateVault,run:Run|undefined,sourceSha256='';
  const check=async()=>{remaining();if(await recoverySourceDigest()!==sourceSha256)throw invalid();};
  const save=async(change:(run:Run,state:VaultState)=>void)=>vault.transaction(async state=>{
    const current=state.treasureV4QualificationRuns?.[options.runId];if(!current)throw invalid();change(current,state);run=structuredClone(current);
  });
  try{
    if(options.runId!==TARGET_RUN||!options.reconcile&&options.runId!==TARGET_RUN)throw invalid();
    globalThis.fetch=(input,init={})=>originalFetch(input,{...init,signal:AbortSignal.any([
      ...(init.signal?[init.signal]:[]),signal,AbortSignal.timeout(Math.min(30_000,remaining())),
    ])});
    sourceSha256=await recoverySourceDigest();
    const [{Vault},{Operations},{verifiedInventory},{verifyTreasureSpendReceipt}]=await Promise.all([
      import('./test-wallets/vault.ts'),import('./test-wallets/operations.ts'),import('./test-wallets/inventory.ts'),import('./test-wallets/treasure-receipt.ts')]);
    vault=new Vault() as unknown as PrivateVault;const ledger=new Operations(vault as never) as unknown as Ledger;
    const selected=await vault.transaction(async state=>{await verifiedInventory(state as never);return selectedState(state,options.runId,Date.now(),options.reconcile);});
    run=selected.run;
    const recovery=run.refundRecovery;
    if(options.reconcile){
      stage='reconcile';
      if(!recovery||recovery.sourceSha256!==sourceSha256||!recovery.binding||!recovery.stage||recovery.stage.phase==='prepared')throw invalid();
      validateStagedTreasureBinding(recovery.binding);validateStagedTreasureState(recovery.stage,recovery.binding);
      if(recovery.binding.branch!=='refund'||recovery.binding.contractId!==options.runId||recovery.binding.operationId!==`${options.runId}-refund`||
        recovery.binding.funding.txid!==run.fundingTxid||stable(recovery.binding.terms)!==stable(run.terms))throw invalid();
      const indexer=new RestIndexerProvider(testNetwork('mutinynet').operator),script=hex.encode(buildAuthorizedTreasureScript(run.terms).script.pkScript);
      const spendTxid=decode(recovery.binding.original.arkTx).id;
      let receipt:unknown;
      try{receipt=await verifyTreasureSpendReceipt(indexer,{fundingTxid:run.fundingTxid!,contractScript:script,spendTxid,
        destinationScript:'5120'+run.terms.gameDestination});}catch{
        return {ok:true,runId:options.runId,outcome:'refund-receipt-not-yet-verified',operationState:selected.refundOperation?.state??'missing',
          submissionReplayed:false,productionQualified:false};
      }
      const record=await ledger.reconcile(`${options.runId}-refund`,async operation=>({id:operation.intent.id,fingerprint:operation.fingerprint,
        providerId:spendTxid,outcome:'settled',verified:true}));
      await save(current=>{current.refundRecovery!.receipt=receipt;current.outcome='refund-recovered-qualification-incomplete';current.phase='refund-recovered';});
      return {ok:true,runId:options.runId,outcome:'refund-recovered-qualification-incomplete',operationState:record.state,
        receiptVerified:true,submissionReplayed:false,productionQualified:false};
    }
    if(recovery&&recovery.sourceSha256!==sourceSha256)throw invalid();
    if(recovery&&(!recovery.binding||!recovery.stage||!['prepared','emulator-signed','actor-root-signed','operator-signed','actor-checkpoints-signed'].includes(recovery.stage.phase)))
      throw invalid();
    if(recovery?.stage?.phase==='actor-root-signed'&&selected.refundOperation?.state!=='prepared')throw invalid();
    if(selected.refundOperation&&selected.refundOperation.state!=='prepared'&&
      !(['operator-signed','actor-checkpoints-signed'].includes(recovery?.stage?.phase??'')&&selected.refundOperation.state==='pending'))throw invalid();
    assertAcceptanceBudget((await ledger.list()).map(op=>op as never),{id:`${options.runId}-refund`,network:'mutinynet',amountSats:1000,feeSats:0},Date.now());
    const ark=new RestArkProvider(testNetwork('mutinynet').operator),indexer=new RestIndexerProvider(testNetwork('mutinynet').operator),emulator=new RestEmulatorProvider(TREASURE_EMULATOR.url);
    stage='network-preflight';const [info,emulatorInfo]=await Promise.all([ark.getInfo(),emulator.getInfo()]);
    const policy=inspectInfo(info,run.terms);if(emulatorInfo.signerPubkey!==TREASURE_EMULATOR.key)throw invalid();
    const currentPolicy=async()=>{
      const fresh=await ark.getInfo(),freshPolicy=inspectInfo(fresh,run!.terms);
      if(freshPolicy.fingerprint!==policy.fingerprint||fresh.checkpointTapscript!==info.checkpointTapscript||
        fresh.forfeitPubkey!==info.forfeitPubkey||(await emulator.getInfo()).signerPubkey!==TREASURE_EMULATOR.key)throw invalid();
    };
    const verifyFunding=async()=>{
      await check();
      const [wire,coins]=await Promise.all([indexer.getVirtualTxs([run!.fundingTxid!]),indexer.getVtxos({outpoints:[{txid:run!.fundingTxid!,vout:0}]})]);
      if(wire.page||coins.page||wire.txs.length!==1||coins.vtxos.length!==1)throw invalid();
      const encoded=wire.txs[0],previous=/^(?:[a-f0-9]{2})+$/.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));
      const terms=run!.terms,contract=buildAuthorizedTreasureScript(terms),coin=coins.vtxos[0],flags=coin as unknown as Record<string,unknown>;
      const script=hex.encode(contract.script.pkScript);
      if(previous.id!==run!.fundingTxid||previous.getOutput(0).amount!==1000n||hex.encode(previous.getOutput(0).script!)!==script||
        coin.txid!==run!.fundingTxid||coin.vout!==0||coin.value!==1000||coin.script!==script||flags.isSpent!==false||flags.spentBy||
        flags.isSwept!==false||flags.isUnrolled!==false||flags.isPreconfirmed||flags.expiresAtHeight!==undefined||
        !(flags.expiresAt instanceof Date)||!Number.isFinite(flags.expiresAt.getTime())||flags.expiresAt.getTime()<=Date.now()||
        !canSpendOffchain(coin,{timestamp:new Date()})||coin.assets!==undefined&&coin.assets.length!==0)throw invalid();
      return {previous,coin,script};
    };
    await currentPolicy();const funding=await verifyFunding();
    const gameIdentity=MnemonicIdentity.fromMnemonic(selected.game.phrase,{isMainnet:false});
    let binding:StagedTreasureBinding,initial:StagedTreasureState;
    if(recovery?.binding&&recovery.stage){binding=recovery.binding;initial=recovery.stage;}
    else{
      stage='actor-authorization';
      const input={contractId:options.runId,operationId:`${options.runId}-refund`,branch:'refund' as const,terms:run.terms,
        funding:{txid:run.fundingTxid!,vout:0,value:1000 as const},previousTransaction:hex.encode(funding.previous.toBytes(false,false)),
        checkpointTapscript:info.checkpointTapscript};
      const template=prepareAuthorizedTreasureTransaction(input);
      if(stable(treasureAuthorizationActors('refund'))!==stable(['game']))throw invalid();
      await save(current=>{current.refundRecovery??={sourceSha256,signings:[],preparedAtMs:Date.now()};
        if(current.refundRecovery.sourceSha256!==sourceSha256||current.refundRecovery.binding)throw invalid();
        current.requests??=[];current.requests.push({kind:'refund-actor-proof-template',atMs:Date.now(),payload:template});});
      const proof=await gameIdentity.signMessage(hex.decode(template.digest),'schnorr');
      binding=completeAuthorizedTreasureTransaction(template,hex.encode(proof));
      initial=createStagedTreasureState(binding,Date.now());
      await save(current=>{const record=current.refundRecovery;
        if(!record||record.sourceSha256!==sourceSha256||record.binding)throw invalid();record.binding=binding;record.stage=initial;
        current.requests!.push({kind:'refund-actor-proof-completed',atMs:Date.now(),payload:{bindingCommitment:initial.bindingCommitment}});});
    }
    if(binding.branch!=='refund'||binding.contractId!==options.runId||binding.operationId!==`${options.runId}-refund`||
      binding.funding.txid!==run.fundingTxid||binding.funding.vout!==0||binding.funding.value!==1000||
      binding.checkpointTapscript!==info.checkpointTapscript||stable(binding.terms)!==stable(run.terms))throw invalid();
    await currentPolicy();await verifyFunding();
    assertAcceptanceBudget((await ledger.list()).map(op=>op as never),{id:`${options.runId}-refund`,network:'mutinynet',amountSats:1000,feeSats:0},Date.now());
    const existing=selected.refundOperation??await ledger.prepare({id:`${options.runId}-refund`,account:selected.game.label,
      profileId:selected.game.profileId,generation:selected.game.generation,network:'mutinynet',kind:'refund',
      recipient:`treasure-v4:${options.runId}`,amountSats:1000,feeSats:0,sourceOrigin:null});
    if(existing.state!=='prepared')throw invalid();
    const recoveryRecord=run.refundRecovery!;
    let staged=recoveryRecord.stage??initial;
    const advance=async(event:StagedTreasureEvent)=>{
      await check();const next=transitionStagedTreasureState(staged,event,binding);
      await save(current=>{const record=current.refundRecovery;if(!record||record.sourceSha256!==sourceSha256||stable(record.binding)!==stable(binding))throw invalid();record.stage=next;});
      staged=next;return next;
    };
    const signOnce=async(kind:'root'|'checkpoint',request:string,sign:()=>Promise<string|string[]>,
      resultEvent:(result:string|string[])=>StagedTreasureEvent)=>{
      const commitment=staged.bindingCommitment;
      const claim=await vault.transaction(state=>{
        const record=state.treasureV4QualificationRuns[options.runId].refundRecovery;
        if(!record||record.sourceSha256!==sourceSha256||stable(record.binding)!==stable(binding))throw invalid();
        const prior=record.signings.find(item=>item.kind===kind&&item.bindingCommitment===commitment);
        if(prior){if(prior.request!==request||prior.status==='unknown'||prior.status==='completed'&&prior.result===undefined)throw invalid();
          if(prior.status==='completed')return structuredClone(prior.result!);}
        else record.signings.push({kind,bindingCommitment:commitment,request,status:'pending'});
        return undefined;
      });
      let result=claim;
      if(result===undefined){
        try{await check();result=await sign();}
        catch{
          await vault.transaction(state=>{const record=state.treasureV4QualificationRuns[options.runId].refundRecovery,
            prior=record?.signings.find(item=>item.kind===kind&&item.bindingCommitment===commitment);
            if(prior&&prior.request===request&&prior.status==='pending')prior.status='unknown';});throw invalid();
        }
        const event=resultEvent(result),next=transitionStagedTreasureState(staged,event,binding);
        await save(current=>{const record=current.refundRecovery,prior=record?.signings.find(item=>item.kind===kind&&item.bindingCommitment===commitment);
          if(!record||!prior||prior.request!==request||prior.status!=='pending')throw invalid();prior.status='completed';prior.result=structuredClone(result!);record.stage=next;});
        staged=next;return;
      }
      // A completed exact local signature may be adopted after a storage retry.
      const event=resultEvent(result),next=transitionStagedTreasureState(staged,event,binding);
      await save(current=>{const record=current.refundRecovery;if(!record||stable(record.stage)!==stable(staged))throw invalid();record.stage=next;});
      staged=next;
    };
    const stageUnknown=async()=>{
      if(['emulator-pending','submit-pending','finalize-pending'].includes(staged.phase))
        await advance({type:'unknown',atMs:Date.now()});
    };
    const spendTxid=decode(binding.original.arkTx).id;
    let submitted=selected.refundOperation??existing;
    if(staged.phase==='prepared'){
      await advance({type:'emulator-request',atMs:Date.now()});stage='emulator-submit';
      try{
        await check();await currentPolicy();
        const response=await emulator.submitTx(staged.emulatorRequest!.arkTx,[...staged.emulatorRequest!.checkpoints]);
        await advance({type:'emulator-response',atMs:Date.now(),response});
      }catch{await stageUnknown();throw invalid();}
    }
    if(staged.phase==='emulator-signed'){
      await currentPolicy();stage='game-root-signing';
      await signOnce('root',staged.emulator!.signedArkTx,()=>gameIdentity.sign(decode(staged.emulator!.signedArkTx),[0]).then(encode),
        result=>({type:'actor-root',atMs:Date.now(),arkTx:result as string}));
    }
    if(staged.phase==='actor-root-signed'){
      if(submitted.state!=='prepared')throw invalid();
      await currentPolicy();await verifyFunding();await advance({type:'submit',atMs:Date.now()});stage='operator-submit';
      let response:Awaited<ReturnType<typeof ark.submitTx>>|undefined;
      submitted=await ledger.submit(`${options.runId}-refund`,async()=>{
        await check();response=await ark.submitTx(staged.submitRequest!.signedArkTx,[...staged.submitRequest!.checkpointTxs]);
        return {providerId:spendTxid};
      });
      if(submitted.state!=='pending'||submitted.providerId!==spendTxid||!response){await stageUnknown();throw invalid();}
      await advance({type:'operator-response',atMs:Date.now(),response});
    }
    if(staged.phase==='operator-signed'){
      if(submitted.state!=='pending'||submitted.providerId!==spendTxid)throw invalid();
      stage='game-checkpoint-signing';const request=JSON.stringify(staged.operator!.signedCheckpointTxs);
      await signOnce('checkpoint',request,()=>Promise.all(staged.operator!.signedCheckpointTxs.map(value=>gameIdentity.sign(decode(value),[0]).then(encode))),
        result=>({type:'actor-checkpoints',atMs:Date.now(),checkpoints:result as string[]}));
    }
    if(staged.phase==='actor-checkpoints-signed'){
      if(submitted.state!=='pending'||submitted.providerId!==spendTxid)throw invalid();
      await advance({type:'finalize',atMs:Date.now()});stage='operator-finalize';
      try{
        await check();await ark.finalizeTx(staged.finalizeRequest!.arkTxid,[...staged.finalizeRequest!.finalCheckpointTxs]);
      }catch{await stageUnknown();throw invalid();}
    }
    let receipt:unknown;
    if(['pending','unknown','submitting'].includes(submitted.state)){
      for(let attempt=0;attempt<12&&!receipt;attempt++){
        await check();
        try{receipt=await verifyTreasureSpendReceipt(indexer,{fundingTxid:run.fundingTxid!,contractScript:funding.script,
          spendTxid,destinationScript:'5120'+run.terms.gameDestination});}catch{}
        if(!receipt&&attempt<11)await new Promise(resolve=>setTimeout(resolve,500));
      }
    }
    if(receipt){
      const settled=await ledger.reconcile(`${options.runId}-refund`,async record=>({id:record.intent.id,fingerprint:record.fingerprint,
        providerId:spendTxid,outcome:'settled',verified:true}));
      await save(current=>{current.refundRecovery!.receipt=receipt;current.outcome='refund-recovered-qualification-incomplete';current.phase='refund-recovered';});
      return {ok:true,runId:options.runId,outcome:'refund-recovered-qualification-incomplete',operationState:settled.state,
        receiptVerified:true,submissionReplayed:false,productionQualified:false};
    }
    const stageState=await vault.transaction(state=>state.treasureV4QualificationRuns[options.runId].refundRecovery?.stage);
    return {ok:true,runId:options.runId,outcome:'refund-submission-unconfirmed',operationState:submitted.state,
      stage:stageState?.phase??'unavailable',submissionReplayed:false,productionQualified:false};
  }catch{
    return {ok:false,runId:options.runId,stage,reason:'original-funding-reservation-retained',productionQualified:false};
  }finally{
    globalThis.fetch=originalFetch;methods.forEach((method,index)=>{console[method]=saved[index];});active=false;
  }
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  try{
    const result=await runV4FundingRecovery(parseV4FundingRecoveryOptions(process.argv.slice(2)));
    process.stdout.write(JSON.stringify(result)+'\n');if(!result.ok)process.exitCode=1;
  }catch{process.stdout.write(JSON.stringify({ok:false,reason:'exact-v4-refund-recovery-unavailable',productionQualified:false})+'\n');process.exitCode=1;}
}
