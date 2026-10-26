// Explicit V4 qualification only. Importing this file performs no I/O.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {Wallet,MnemonicIdentity,RestArkProvider,RestIndexerProvider,RestEmulatorProvider,Transaction,ArkAddress,
  InMemoryWalletRepository,InMemoryContractRepository,signAndSubmitOffchainTx,assertValidServerUnrollScript,
  defaultCheckpointExitDelayPolicy,getNetwork,canSpendOffchain,type ArkInfo} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {buildAuthorizedTreasureScript} from '../packages/integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts';
import {prepareAuthorizedTreasureTransaction,attachAuthorizedTreasurePlayerProof,completeAuthorizedTreasureTransaction} from '../packages/integration/src/client/wallet-layer-arkade/treasure-authorized-transaction.ts';
import {createStagedTreasureState,transitionStagedTreasureState,validateStagedTreasureBinding,type StagedTreasureState,type StagedTreasureEvent,type StagedTreasureBinding} from '../packages/integration/src/client/wallet-layer-arkade/treasure-staged-state.ts';
import {inspectTreasureDirectPolicy} from '../packages/integration/src/client/wallet-layer-arkade/treasure-direct-policy.ts';
import {TREASURE_EMULATOR} from '../packages/integration/src/client/wallet-layer-arkade/treasure-capability.ts';
import {testNetwork} from '../packages/integration/src/client/state-layer-core/test-network.ts';
import {assertAcceptanceBudget} from './treasure-acceptance-policy.ts';

type Case='b1'|'b2';
export type V4QualificationOptions=Readonly<{scenario:Case;runId:string;pair:string;reconcile:boolean;controlRun?:string}>;
type Account={label:string;profileId:string;generation:number;phrase:string;grant?:{active:boolean;networks:string[]};reportedPending?:Record<string,unknown>};
type Operation={intent:{id:string;network:string;profileId:string;generation:number;target?:{profileId:string};amountSats:number;feeSats:number|null};state:string;createdAt:string;fingerprint:string;providerId?:string};
type Run={artifactVersion:4;network:'mutinynet';scenario:Case;pair:string;game:string;player:string;sourceSha256:string;startedAtMs:number;deadlineMs:number;
  phase:string;requests:{kind:string;atMs:number;payload:unknown}[];terms:Parameters<typeof buildAuthorizedTreasureScript>[0];
  fundingTxid?:string;fundingWire?:string;fundingVerifiedAtMs?:number;binding?:StagedTreasureBinding;stage?:StagedTreasureState;
  proofRequestedAtMs?:number;proofGeneratedAtMs?:number;emulatorReceivedAtMs?:number;operatorAcceptedAtMs?:number;checkpointSignedAtMs?:number;
  checkpointSignRequestedAtMs?:number;spendTxid?:string;receipt?:unknown;outcome?:string;reconciliationAtMs?:number;controlRun?:string};
type State={accounts:Account[];pairs:{label:string;network:string;player:string;game:string}[];operations?:Operation[];treasureV4QualificationRuns?:Record<string,Run>;
  treasureAdminRuns?:Record<string,unknown>;treasureProofRuns?:Record<string,unknown>};
type PrivateVault={transaction<T>(use:(state:State)=>T|Promise<T>):Promise<T>};
type OperationLedger={prepare(intent:unknown):Promise<Operation>;submit(id:string,send:()=>Promise<{providerId:string}>):Promise<Operation>;
  reconcile(id:string,read:(record:Operation)=>Promise<unknown>):Promise<Operation>};
const invalid=()=>Error('V4 qualification stopped. Preserve the original protected run and reconcile without replay.');
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT()),decode=(value:string)=>Transaction.fromPSBT(base64.decode(value));
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const terminal=new Set(['settled','failed','cancelled']);
const sourcePaths=['BIS/scripts/treasure-v4-qualification.ts','BIS/scripts/treasure-acceptance-policy.ts','BIS/scripts/test-wallets/operations.ts',
  'BIS/scripts/test-wallets/vault.ts','BIS/scripts/test-wallets/inventory.ts','BIS/scripts/test-wallets/treasure-receipt.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-authorized-script.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-authorized-transaction.ts',
  'BIS/packages/integration/src/client/wallet-layer-arkade/treasure-staged-state.ts','package-lock.json','node_modules/@arkade-os/sdk/package.json'];
export const v4QualificationSourceValue=(value:number)=>Number.isSafeInteger(value)&&(value===1000||value>=1330&&value<=5000);
export const v4QualificationPrerequisite=(scenario:Case,reconcile:boolean)=>scenario==='b1'&&!reconcile?'upstream-v0.0.9-redacts-vm-rejection':undefined;

export function parseV4QualificationOptions(args:readonly string[]):V4QualificationOptions{
  const [scenario,runId,pair,...flags]=args;
  if(!['b1','b2'].includes(scenario)||!/^[a-z][a-z0-9-]{0,23}$/.test(runId??'')||!/^[a-zA-Z0-9-]{1,80}$/.test(pair??''))throw invalid();
  let reconcile=false,controlRun:string|undefined;
  for(let i=0;i<flags.length;i++){
    if(flags[i]==='--reconcile'&&!reconcile)reconcile=true;
    else if(flags[i]==='--control'&&!controlRun&&/^[a-z][a-z0-9-]{0,23}$/.test(flags[i+1]??''))controlRun=flags[++i];
    else throw invalid();
  }
  if(scenario==='b1'&&!reconcile&&!controlRun||scenario==='b2'&&controlRun)throw invalid();
  return {scenario:scenario as Case,runId,pair,reconcile,controlRun};
}
export function assertV4QualificationLease(options:V4QualificationOptions,env:Record<string,string|undefined>,sourceSha256:string){
  if(env.BIS_TREASURE_V4_FINANCIAL_SLOT!==options.runId||env.BIS_TREASURE_V4_EXECUTION_SLOT!==options.runId||
    !/^[a-f0-9]{64}$/.test(sourceSha256)||env.BIS_TREASURE_V4_APPROVED_SOURCE!==sourceSha256)throw invalid();
}
export function assertB2Admission(deadlineMs:number,emulatorReceivedAtMs:number,operatorAcceptedAtMs:number){
  if(![deadlineMs,emulatorReceivedAtMs,operatorAcceptedAtMs].every(Number.isSafeInteger)||
    emulatorReceivedAtMs>=deadlineMs||operatorAcceptedAtMs>=deadlineMs||operatorAcceptedAtMs<emulatorReceivedAtMs)throw invalid();
}
export function assertB2CheckpointTiming(deadlineMs:number,operatorAcceptedAtMs:number,checkpointSignRequestedAtMs:number,checkpointSignedAtMs:number){
  if(![deadlineMs,operatorAcceptedAtMs,checkpointSignRequestedAtMs,checkpointSignedAtMs].every(Number.isSafeInteger)||
    operatorAcceptedAtMs>=deadlineMs||checkpointSignRequestedAtMs<=deadlineMs||checkpointSignedAtMs<checkpointSignRequestedAtMs)throw invalid();
}
/** Cached v0.0.9 handler exposes grpc3 parser failures and REDACTS service/VM
 * errors to grpc13/internal error. It exposes no timing-rule diagnostic code. */
export function classifyV4DeadlineResponse(status:number,body:string):'parser-rejection'|'upstream-redacted-rejection'|'unattributed-response'{
  if(body.length>1_048_576)return 'unattributed-response';
  try{
    const value:unknown=JSON.parse(body);
    if(!value||typeof value!=='object'||Array.isArray(value))return 'unattributed-response';
    const record=value as Record<string,unknown>;
    if(status===500&&record.code===13&&record.message==='internal error')return 'upstream-redacted-rejection';
    if(status===400&&record.code===3&&['missing ark tx','missing checkpoint txs','invalid ark tx','invalid checkpoint tx'].includes(String(record.message)))return 'parser-rejection';
  }catch{}
  return 'unattributed-response';
}
export function assertV4QualificationFundingCoin(coin:Record<string,unknown>,point:{txid:string;vout:number},script:string,deadlineMs:number,now:number){
  if(coin.txid!==point.txid||coin.vout!==point.vout||coin.script!==script||coin.value!==1000||coin.isSpent!==false||coin.isSwept!==false||
    coin.isUnrolled!==false||coin.isPreconfirmed!==false||coin.spentBy!==''||coin.expiresAtHeight!==undefined||
    !(coin.expiresAt instanceof Date)||!Number.isFinite(coin.expiresAt.getTime())||coin.expiresAt.getTime()<=Math.max(now,deadlineMs)||
    coin.assets!==undefined&&(!Array.isArray(coin.assets)||coin.assets.length!==0))throw invalid();
}
export function assertV4PartialPacket(binding:StagedTreasureBinding){
  validateStagedTreasureBinding(binding);
  const leaf=buildAuthorizedTreasureScript(binding.terms).script.functionByName('claim');
  if(binding.artifactVersion!==4||binding.branch!=='claim'||binding.terms.emulator!==TREASURE_EMULATOR.key.slice(-64)||
    !leaf||leaf.signerKeys.length!==3||hex.encode(leaf.signerKeys[0])!==binding.terms.operator||hex.encode(leaf.signerKeys[2])!==binding.terms.player||
    [binding.original.arkTx,...binding.original.checkpoints].some(value=>(decode(value).getInput(0).tapScriptSig?.length??0)!==0))throw invalid();
}
let qualificationRunning=false;
/** Dedicated process only. Diagnostics suppression also covers direct imports,
 * not merely the CLI. Concurrent executions in one process are refused. */
export async function runV4Qualification(options:V4QualificationOptions,env:Record<string,string|undefined>=process.env){
  if(qualificationRunning)throw invalid();qualificationRunning=true;
  const names=['log','info','warn','error','debug','trace','dir'] as const,saved=names.map(name=>console[name]);
  names.forEach(name=>{console[name]=()=>{};});
  try{return await executeV4Qualification(options,env);}
  finally{names.forEach((name,i)=>{console[name]=saved[i];});qualificationRunning=false;}
}
export function qualificationEligibility(state:State,options:V4QualificationOptions,now:number){
  const pair=state.pairs.find(p=>p.label===options.pair&&p.network==='mutinynet');if(!pair)throw invalid();
  const game=state.accounts.find(a=>a.label===pair.game),player=state.accounts.find(a=>a.label===pair.player);
  if(!game||!player||game.profileId===player.profileId||[game,player].some(a=>!a.grant?.active||!a.grant.networks.includes('mutinynet')||a.reportedPending?.mutinynet))throw invalid();
  const run=state.treasureV4QualificationRuns?.[options.runId];
  if(options.reconcile){
    if(!run||run.artifactVersion!==4||run.scenario!==options.scenario||run.pair!==options.pair||run.game!==game.profileId||run.player!==player.profileId||run.reconciliationAtMs)throw invalid();
  }else{
    if(run||state.treasureAdminRuns?.[options.runId]||state.treasureProofRuns?.[options.runId]||(state.operations??[]).some(op=>op.intent.id.startsWith(options.runId+'-')))throw invalid();
    if((state.operations??[]).some(op=>op.intent.network==='mutinynet'&&!terminal.has(op.state)&&
      [op.intent.profileId,op.intent.target?.profileId].some(p=>p===game.profileId||p===player.profileId)))throw invalid();
    if(Object.values(state.treasureV4QualificationRuns??{}).some(r=>r.outcome!=='verified-b2-payout'&&
      [r.game,r.player].some(p=>p===game.profileId||p===player.profileId)))throw invalid();
    // Reserve enough rolling-day headroom for both funding and the proof spend.
    assertAcceptanceBudget(state.operations??[],{id:options.runId+'-headroom',network:'mutinynet',amountSats:2000,feeSats:0},now);
    if(options.scenario==='b1'){
      const control=state.treasureV4QualificationRuns?.[options.controlRun??''];
      if(!control||control.artifactVersion!==4||control.network!=='mutinynet'||control.outcome!=='verified-b2-payout'||!control.receipt||
        !control.emulatorReceivedAtMs||!control.operatorAcceptedAtMs||!control.checkpointSignedAtMs)throw invalid();
      assertB2Admission(control.deadlineMs,control.emulatorReceivedAtMs,control.operatorAcceptedAtMs);
      assertB2CheckpointTiming(control.deadlineMs,control.operatorAcceptedAtMs,control.checkpointSignRequestedAtMs!,control.checkpointSignedAtMs);
    }
  }
  return {game,player,run};
}

async function executeV4Qualification(options:V4QualificationOptions,env:Record<string,string|undefined>){
  options=parseV4QualificationOptions([options.scenario,options.runId,options.pair,...(options.reconcile?['--reconcile']:[]),...(options.controlRun?['--control',options.controlRun]:[])]);
  // No environment flag overrides missing rule attribution. Reopen this new
  // negative probe only after reviewed authoritative upstream evidence exists.
  const unmet=v4QualificationPrerequisite(options.scenario,options.reconcile);
  if(unmet)return {runId:options.runId,scenario:options.scenario,outcome:'blocked-before-funding',reason:unmet,
    financialActions:0,credentialReads:0,upstreamCommit:'7b830f6d7bd3998e1790f3d3e7737f34f40588f1'};
  // Lease checks precede dynamic Vault import, construction and credential reads.
  if(env.BIS_TREASURE_V4_FINANCIAL_SLOT!==options.runId||env.BIS_TREASURE_V4_EXECUTION_SLOT!==options.runId)throw invalid();
  const root=new URL('../../',import.meta.url),sources=await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(new URL(path,root)))})));
  const sourceSha256=hash(JSON.stringify(sources));assertV4QualificationLease(options,env,sourceSha256);
  const [{Vault},{Operations},{verifiedInventory},{verifyTreasureSpendReceipt}]=await Promise.all([
    import('./test-wallets/vault.ts'),import('./test-wallets/operations.ts'),import('./test-wallets/inventory.ts'),import('./test-wallets/treasure-receipt.ts')]);
  const vault=new Vault() as unknown as PrivateVault,ledger=new Operations(vault) as unknown as OperationLedger;
  let run:Run|undefined,stage='authorization',activeOperation:string|undefined;
  const expiresAt=Date.now()+120000,signal=AbortSignal.timeout(120000),originalFetch=globalThis.fetch;
  const remaining=()=>{const ms=Math.floor(expiresAt-Date.now());if(ms<=0||signal.aborted)throw invalid();return ms;};
  const check=()=>{remaining();assertV4QualificationLease(options,env,sourceSha256);};
  const save=async(change:(value:Run)=>void)=>vault.transaction(state=>{
    const saved=state.treasureV4QualificationRuns?.[options.runId];if(!saved)throw invalid();change(saved);run=structuredClone(saved);
  });
  const privateEvent=async(kind:string,payload:unknown)=>save(value=>{value.requests.push({kind,atMs:Date.now(),payload});});
  const call=async<T>(kind:string,payload:unknown,start:()=>Promise<T>)=>{
    check();await privateEvent(kind+'-request',{operationId:activeOperation,payload});check();
    try{const response=await start();await privateEvent(kind+'-response',response);return response;}
    catch(error){await privateEvent(kind+'-unknown',{message:error instanceof Error?error.message:'unavailable'});throw invalid();}
  };
  globalThis.fetch=(input,init={})=>originalFetch(input,{...init,signal:AbortSignal.any([signal,...(init.signal?[init.signal]:[]),AbortSignal.timeout(Math.min(30000,remaining()))])});
  let gameWallet:Awaited<ReturnType<typeof Wallet.create>>|undefined;
  try{
    const selected=await vault.transaction(async state=>{await verifiedInventory(state);return structuredClone(qualificationEligibility(state,options,Date.now()));});
    const ark=new RestArkProvider(testNetwork('mutinynet').operator),indexer=new RestIndexerProvider(testNetwork('mutinynet').operator),emulator=new RestEmulatorProvider(TREASURE_EMULATOR.url);
    const wire=async(txid:string)=>{
      const response=await indexer.getVirtualTxs([txid]);if(response.page||response.txs.length!==1)throw invalid();
      const encoded=response.txs[0],tx=/^(?:[a-f0-9]{2})+$/.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):decode(encoded);
      if(tx.id!==txid)throw invalid();return tx;
    };
    const fundingVerified=async(value:Run)=>{
      if(!value.fundingTxid)throw invalid();const tx=await wire(value.fundingTxid),script=hex.encode(buildAuthorizedTreasureScript(value.terms).script.pkScript);
      const {vtxos,page}=await indexer.getVtxos({outpoints:[{txid:tx.id,vout:0}]});
      if(page||tx.getOutput(0).amount!==1000n||hex.encode(tx.getOutput(0).script!)!==script||vtxos.length!==1||
        vtxos[0].value!==1000||vtxos[0].script!==script||vtxos[0].assets?.length)throw invalid();return {tx,coin:vtxos[0],script};
    };
    const settle=async(id:string,txid:string)=>ledger.reconcile(id,async op=>({id:op.intent.id,fingerprint:op.fingerprint,providerId:txid,outcome:'settled',verified:true}));
    const payout=async(value:Run)=>{
      if(!value.binding||!value.fundingTxid||!value.spendTxid)throw invalid();
      return verifyTreasureSpendReceipt(indexer,{fundingTxid:value.fundingTxid,contractScript:hex.encode(buildAuthorizedTreasureScript(value.terms).script.pkScript),
        spendTxid:value.spendTxid,destinationScript:'5120'+value.terms.playerDestination});
    };
    if(options.reconcile){
      run=selected.run!;await save(value=>{if(value.reconciliationAtMs)throw invalid();value.reconciliationAtMs=Date.now();});
      if(run.spendTxid&&run.scenario==='b2'){
        const receipt=await payout(run);await settle(options.runId+'-claim',run.spendTxid);
        let qualified=false;
        try{
          assertB2Admission(run.deadlineMs,run.emulatorReceivedAtMs!,run.operatorAcceptedAtMs!);
          assertB2CheckpointTiming(run.deadlineMs,run.operatorAcceptedAtMs!,run.checkpointSignRequestedAtMs!,run.checkpointSignedAtMs!);qualified=true;
        }catch{}
        await save(value=>{value.receipt=receipt;value.outcome=qualified?'verified-b2-payout':'payout-observed-qualification-incomplete';});
      }else if(run.fundingTxid){await fundingVerified(run);await settle(options.runId+'-fund',run.fundingTxid);}
      return {runId:options.runId,scenario:options.scenario,outcome:run.outcome??'original-still-unresolved',reconciliationOnly:true,sourceSha256};
    }
    const [info,emulatorInfo]=await Promise.all([ark.getInfo(),emulator.getInfo()]);
    const inspectInfo=(value:ArkInfo)=>{
      inspectTreasureDirectPolicy('mutinynet',value);
      if(!/^(?:0[23])?[a-f0-9]{64}$/.test(value.forfeitPubkey))throw invalid();
      return assertValidServerUnrollScript(value.checkpointTapscript,{...defaultCheckpointExitDelayPolicy(getNetwork('mutinynet')),advertisedForfeitPubkey:hex.decode(value.forfeitPubkey.slice(-64))});
    };
    const checkpoint=inspectInfo(info);if(emulatorInfo.signerPubkey!==TREASURE_EMULATOR.key)throw invalid();
    if(options.scenario==='b1')await vault.transaction(state=>{
      const control=state.treasureV4QualificationRuns?.[options.controlRun!];
      if(!control||control.sourceSha256!==sourceSha256||control.terms.operator!==info.signerPubkey.slice(-64)||
        control.terms.emulator!==TREASURE_EMULATOR.key.slice(-64)||control.binding?.checkpointTapscript!==info.checkpointTapscript)throw invalid();
    });
    const freshPolicy=async()=>{
      const current=await ark.getInfo();inspectInfo(current);
      if(inspectTreasureDirectPolicy('mutinynet',current).fingerprint!==inspectTreasureDirectPolicy('mutinynet',info).fingerprint||current.checkpointTapscript!==info.checkpointTapscript||
        current.forfeitPubkey!==info.forfeitPubkey||(await emulator.getInfo()).signerPubkey!==TREASURE_EMULATOR.key)throw invalid();
    };
    const game=MnemonicIdentity.fromMnemonic(selected.game.phrase,{isMainnet:false}),player=MnemonicIdentity.fromMnemonic(selected.player.phrase,{isMainnet:false});
    gameWallet=await Wallet.create({identity:game,arkProvider:ark,indexerProvider:indexer,walletMode:'static',settlementConfig:false,
      storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}});
    const gameAddress=ArkAddress.decode(await gameWallet.getAddress());
    const coins=(await gameWallet.getSpendableVtxos()).filter(c=>!c.assets?.length&&v4QualificationSourceValue(c.value)&&canSpendOffchain(c,{timestamp:new Date()}));
    if(!coins.length)throw invalid();const coin=coins.sort((a,b)=>a.value-b.value||a.txid.localeCompare(b.txid)||a.vout-b.vout)[0];
    // Probe exact canonical target support WITHOUT a Vault transaction. Refuse
    // before funding if the counterparty-safe ledger extension is absent.
    const probeReached=Symbol('canonical-target-supported'),probe=new Operations({transaction:async()=>{throw probeReached;}});
    try{await probe.prepare({id:options.runId+'-claim',account:selected.player.label,profileId:selected.player.profileId,generation:selected.player.generation,
      network:'mutinynet',kind:'claim',recipient:'treasure-v4:'+options.runId,amountSats:1000,feeSats:0,sourceOrigin:null,
      target:{account:selected.game.label,profileId:selected.game.profileId,generation:selected.game.generation}});throw invalid();}
    catch(error){if(error!==probeReached)throw invalid();}
    const {DefaultVtxo}=await import('@arkade-os/sdk');
    const terms={network:'mutinynet' as const,offerSessionId:options.runId,hostReference:'C094-V4:'+options.runId,startedAtMs:Date.now(),
      player:hex.encode(await player.xOnlyPublicKey()),game:hex.encode(await game.xOnlyPublicKey()),operator:info.signerPubkey.slice(-64),emulator:TREASURE_EMULATOR.key.slice(-64),
      gameDestination:hex.encode(gameAddress.vtxoTaprootKey),playerDestination:'',exitDelay:Number(info.unilateralExitDelay)};
    terms.playerDestination=hex.encode(new DefaultVtxo.Script({pubKey:hex.decode(terms.player),serverPubKey:hex.decode(terms.operator),
      csvTimelock:{type:'seconds',value:BigInt(terms.exitDelay)}}).pkScript.slice(2));
    const built=buildAuthorizedTreasureScript(terms);
    const sourceWire=await wire(coin.txid),sourceOutput=sourceWire.getOutput(coin.vout);
    if(sourceOutput.amount!==BigInt(coin.value)||hex.encode(sourceOutput.script!)!==hex.encode(gameAddress.pkScript))throw invalid();
    run=await vault.transaction(async state=>{
      await verifiedInventory(state);qualificationEligibility(state,options,Date.now());state.treasureV4QualificationRuns??={};
      state.treasureV4QualificationRuns[options.runId]={artifactVersion:4,network:'mutinynet',scenario:options.scenario,pair:options.pair,game:selected.game.profileId,player:selected.player.profileId,
        sourceSha256,startedAtMs:terms.startedAtMs,deadlineMs:built.deadlineSeconds*1000,phase:'prepared',requests:[{kind:'selected-funding-source',atMs:Date.now(),
          payload:{txid:coin.txid,vout:coin.vout,value:coin.value,script:hex.encode(gameAddress.pkScript),wire:hex.encode(sourceWire.toBytes(false,false))}}],terms,controlRun:options.controlRun};
      return structuredClone(state.treasureV4QualificationRuns[options.runId]);
    });
    for(const method of ['submitTx','finalizeTx'] as const){
      const original=ark[method].bind(ark) as (...args:unknown[])=>Promise<unknown>;
      Object.assign(ark,{[method]:async(...args:unknown[])=>{
        if(method==='submitTx'&&activeOperation===options.runId+'-fund')await save(value=>{
          const tx=decode(args[0] as string),cps=args[1] as string[];
          if(!Array.isArray(cps)||cps.length!==1)throw invalid();const cp=decode(cps[0]),input=cp.getInput(0);
          const hasChange=coin.value!==1000,anchor=tx.getOutput(hasChange?2:1);
          if(cp.inputsLength!==1||hex.encode(input.txid!)!==coin.txid||input.index!==coin.vout||input.witnessUtxo?.amount!==BigInt(coin.value)||
            hex.encode(input.witnessUtxo.script)!==hex.encode(gameAddress.pkScript)||tx.outputsLength!==(hasChange?3:2)||tx.getOutput(0).amount!==1000n||
            hex.encode(tx.getOutput(0).script!)!==hex.encode(built.script.pkScript)||hasChange&&(tx.getOutput(1).amount!==BigInt(coin.value)-1000n||
            hex.encode(tx.getOutput(1).script!)!==hex.encode(gameAddress.pkScript))||anchor.amount!==0n||hex.encode(anchor.script!)!=='51024e73')throw invalid();
          const txid=tx.id;if(value.fundingTxid&&value.fundingTxid!==txid)throw invalid();value.fundingTxid=txid;
        });
        return call('operator-'+method,args,()=>original(...args));
      }});
    }
    const prepareOperation=async(kind:'fund'|'claim',account:Account)=>{
      activeOperation=options.runId+'-'+kind;
      await vault.transaction(async state=>{
        await verifiedInventory(state);
        const registered=state.accounts.find(a=>a.label===account.label);
        if(!registered||registered.profileId!==account.profileId||registered.generation!==account.generation||!registered.grant?.active||
          !registered.grant.networks.includes('mutinynet')||registered.reportedPending?.mutinynet)throw invalid();
        for(const participant of [selected.game,selected.player]){
          const fresh=state.accounts.find(a=>a.label===participant.label);
          if(!fresh||fresh.profileId!==participant.profileId||fresh.generation!==participant.generation||!fresh.grant?.active||
            !fresh.grant.networks.includes('mutinynet')||fresh.reportedPending?.mutinynet)throw invalid();
        }
        if((state.operations??[]).some(op=>op.intent.network==='mutinynet'&&!terminal.has(op.state)&&
          ![options.runId+'-fund',options.runId+'-claim'].includes(op.intent.id)&&
          [op.intent.profileId,op.intent.target?.profileId].some(id=>id===selected.game.profileId||id===selected.player.profileId)))throw invalid();
        assertAcceptanceBudget(state.operations??[],{id:activeOperation!,network:'mutinynet',amountSats:1000,feeSats:0},Date.now());
      });
      const prepared=await ledger.prepare({id:activeOperation,account:account.label,profileId:account.profileId,generation:account.generation,network:'mutinynet',
        kind:kind==='fund'?'arkade-send':'claim',recipient:'treasure-v4:'+options.runId,amountSats:1000,feeSats:0,sourceOrigin:null,
        ...(kind==='claim'?{target:{account:selected.game.label,profileId:selected.game.profileId,generation:selected.game.generation}}:{})});
      if(prepared.state!=='prepared')throw invalid();return activeOperation;
    };
    stage='fund';const fundId=await prepareOperation('fund',selected.game);
    const funded=await ledger.submit(fundId,async()=>{
      check();await freshPolicy();if(Date.now()>=run!.deadlineMs)throw invalid();
      const txid=await signAndSubmitOffchainTx({identity:game,provider:ark,inputs:[{...coin,tapLeafScript:coin.forfeitTapLeafScript}],
        outputs:[{script:built.script.pkScript,amount:1000n},...(coin.value===1000?[]:[{script:gameAddress.pkScript,amount:BigInt(coin.value)-1000n}])],serverUnrollScript:checkpoint});
      await save(value=>{value.fundingTxid=txid;});return {providerId:txid};
    });
    if(!funded.providerId)throw invalid();const funding=await fundingVerified(run!);
    if(!canSpendOffchain(funding.coin,{timestamp:new Date()})||funding.coin.isSpent||funding.coin.isSwept||funding.coin.isUnrolled)throw invalid();
    assertV4QualificationFundingCoin(funding.coin as unknown as Record<string,unknown>,{txid:funding.tx.id,vout:0},funding.script,run!.deadlineMs,Date.now());
    await settle(fundId,funding.tx.id);await save(value=>{value.fundingWire=hex.encode(funding.tx.toBytes(false,false));value.fundingVerifiedAtMs=Date.now();value.phase='funded';});
    const input={contractId:options.runId,operationId:options.runId+'-claim',branch:'claim' as const,terms,
      funding:{txid:funding.tx.id,vout:0,value:1000 as const},previousTransaction:run!.fundingWire!,checkpointTapscript:info.checkpointTapscript};
    const waitAfterDeadline=async()=>{while(Date.now()<=run!.deadlineMs){check();await new Promise(r=>setTimeout(r,Math.min(1000,Math.max(1,run!.deadlineMs-Date.now()+1))));}check();};
    if(options.scenario==='b1')await waitAfterDeadline();
    let template=prepareAuthorizedTreasureTransaction(input);await privateEvent('actor-proof-template',template);
    await save(value=>{value.proofRequestedAtMs=Date.now();});
    const proof=await player.signMessage(hex.decode(template.digest),'schnorr');
    template=attachAuthorizedTreasurePlayerProof(template,hex.encode(proof));const binding=completeAuthorizedTreasureTransaction(template);
    assertV4PartialPacket(binding);
    await save(value=>{value.binding=binding;value.proofGeneratedAtMs=Date.now();value.spendTxid=decode(binding.original.arkTx).id;});
    stage=options.scenario;const claimId=await prepareOperation('claim',selected.player);
    if(options.scenario==='b1'){
      if(run!.proofRequestedAtMs!<=run!.deadlineMs||run!.proofGeneratedAtMs!<=run!.deadlineMs)throw invalid();
      await freshPolicy();const fresh=await fundingVerified(run!);if(!canSpendOffchain(fresh.coin,{timestamp:new Date()}))throw invalid();
      assertV4QualificationFundingCoin(fresh.coin as unknown as Record<string,unknown>,binding.funding,fresh.script,run!.deadlineMs,Date.now());
      let classification:ReturnType<typeof classifyV4DeadlineResponse>='unattributed-response';
      await ledger.submit(claimId,async()=>{
        const payload={arkTx:binding.original.arkTx,checkpointTxs:[...binding.original.checkpoints]};
        await privateEvent('negative-emulator-request',payload);check();
        const response=await fetch(TREASURE_EMULATOR.url+'/v1/tx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',cache:'no-store'});
        const body=await response.text();if(body.length>1_048_576)throw invalid();
        await privateEvent('negative-emulator-response',{status:response.status,body});classification=classifyV4DeadlineResponse(response.status,body);
        // No negative response is financial settlement or release authority.
        throw invalid();
      });
      await save(value=>{value.outcome=classification==='upstream-redacted-rejection'?'blocked-upstream-redacted-rejection':'blocked-unattributed-rejection';});
      return {runId:options.runId,scenario:'b1',outcome:run!.outcome,financialReservation:'retained',sourceSha256};
    }
    let state=createStagedTreasureState(binding,Date.now());
    const advance=async(event:StagedTreasureEvent)=>{const next=transitionStagedTreasureState(state,event,binding);await save(value=>{value.stage=next;});state=next;};
    await save(value=>{value.stage=state;});
    const claimed=await ledger.submit(claimId,async()=>{
      check();await freshPolicy();if(Date.now()>=run!.deadlineMs)throw invalid();
      const fresh=await fundingVerified(run!);assertV4QualificationFundingCoin(fresh.coin as unknown as Record<string,unknown>,binding.funding,fresh.script,run!.deadlineMs,Date.now());
      await advance({type:'emulator-request',atMs:Date.now()});
      const emulated=await call('emulator-submitTx',binding.original,()=>emulator.submitTx(binding.original.arkTx,[...binding.original.checkpoints]));
      await advance({type:'emulator-response',atMs:Date.now(),response:emulated});await save(value=>{value.emulatorReceivedAtMs=Date.now();});
      await privateEvent('player-root-sign-intent',{arkTx:state.emulator!.signedArkTx});
      const signed=await player.sign(decode(state.emulator!.signedArkTx),[0]);await advance({type:'actor-root',atMs:Date.now(),arkTx:encode(signed)});
      if(Date.now()>=run!.deadlineMs)throw invalid();await advance({type:'submit',atMs:Date.now()});
      if(Date.now()>=run!.deadlineMs)throw invalid();const accepted=await ark.submitTx(state.submitRequest!.signedArkTx,[...state.submitRequest!.checkpointTxs]);
      const acceptedAt=Date.now();await advance({type:'operator-response',atMs:acceptedAt,response:accepted});
      await save(value=>{value.operatorAcceptedAtMs=acceptedAt;});assertB2Admission(run!.deadlineMs,run!.emulatorReceivedAtMs!,acceptedAt);
      await waitAfterDeadline();await save(value=>{value.checkpointSignRequestedAtMs=Date.now();});
      await privateEvent('player-checkpoint-sign-intent',{checkpoints:state.operator!.signedCheckpointTxs});
      const checkpoints=await Promise.all(state.operator!.signedCheckpointTxs.map(async cp=>encode(await player.sign(decode(cp),[0]))));
      const signedAt=Date.now();assertB2CheckpointTiming(run!.deadlineMs,acceptedAt,run!.checkpointSignRequestedAtMs!,signedAt);
      await advance({type:'actor-checkpoints',atMs:signedAt,checkpoints});await save(value=>{value.checkpointSignedAtMs=signedAt;});
      await advance({type:'finalize',atMs:Date.now()});await ark.finalizeTx(state.finalizeRequest!.arkTxid,[...state.finalizeRequest!.finalCheckpointTxs]);
      return {providerId:run!.spendTxid!};
    });
    if(!claimed.providerId)throw invalid();const receipt=await payout(run!);await settle(claimId,claimed.providerId);
    await save(value=>{value.receipt=receipt;value.outcome='verified-b2-payout';value.phase='complete';});
    return {runId:options.runId,scenario:'b2',outcome:run!.outcome,receipt,sourceSha256};
  }catch{
    if(run)try{await save(value=>{
      if(value.binding&&value.stage&&['emulator-pending','submit-pending','finalize-pending'].includes(value.stage.phase))
        value.stage=transitionStagedTreasureState(value.stage,{type:'unknown',atMs:Date.now()},value.binding);
      value.phase='stopped-'+stage;value.outcome??='original-unresolved';
    });}catch{}
    return {runId:options.runId,scenario:options.scenario,outcome:'stopped-original-unresolved',stage,reservations:'retained',sourceSha256};
  }finally{
    try{await gameWallet?.dispose();}catch{if(run)try{await privateEvent('wallet-dispose-unavailable',{});}catch{}}
    finally{globalThis.fetch=originalFetch;}
  }
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  // SDK diagnostics may contain signed recovery payloads. Only the explicit
  // sanitized result below may leave this dedicated process.
  for(const name of ['log','info','warn','error','debug','trace','dir'] as const)console[name]=()=>{};
  try{
    const result=await runV4Qualification(parseV4QualificationOptions(process.argv.slice(2)));
    process.stdout.write(JSON.stringify({...result,productionQualified:false})+'\n');
    if(result.outcome!=='verified-b2-payout')process.exitCode=2;
  }catch{process.stdout.write(JSON.stringify({outcome:'runner-unavailable-preserve-original',financialOutcome:'not-inferred',productionQualified:false})+'\n');process.exitCode=1;}
}
