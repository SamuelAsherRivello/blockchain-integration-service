import {RestArkProvider,RestIndexerProvider,RestEmulatorProvider,Transaction,canSpendOffchain,assertValidServerUnrollScript,defaultCheckpointExitDelayPolicy,getNetwork,type ArkProvider,type IndexerProvider,type EmulatorProvider} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {testNetwork} from '../state-layer-core/test-network.ts';
import {TREASURE_EMULATOR} from './treasure-capability.ts';
import {inspectTreasureDirectPolicy} from './treasure-direct-policy.ts';
import {buildAuthorizedTreasureScript,treasureAuthorizationActors} from './treasure-authorized-script.ts';
import {validateStagedTreasureBinding,validateStagedTreasureState,transitionStagedTreasureState,
  type StagedTreasureBinding,type StagedTreasureState,type StagedTreasureEvent} from './treasure-staged-state.ts';

export type TreasureStagedSigningIntent=Readonly<{
  artifactVersion:4;kind:'root'|'checkpoint';contractId:string;operationId:string;bindingCommitment:string;
  actors:readonly ('player'|'game')[];arkTx:string;checkpoints:readonly string[];
}>;
export type TreasureStagedSigningResult=Readonly<{arkTx:string}>|Readonly<{checkpoints:readonly string[]}>;
export type TreasureStagedSigningClaim=Readonly<{status:'granted'|'pending'}>|Readonly<{status:'completed';result:TreasureStagedSigningResult}>;
export type TreasureStagedSubmitControls=Readonly<{
  load(binding:StagedTreasureBinding):Promise<unknown>;
  persist(state:StagedTreasureState,binding:StagedTreasureBinding):Promise<void>;
  /** Local durable CAS only. Never send a signing request from this hook. */
  claimSigning(intent:TreasureStagedSigningIntent,binding:StagedTreasureBinding):Promise<TreasureStagedSigningClaim>;
  completeSigning(intent:TreasureStagedSigningIntent,result:TreasureStagedSigningResult,binding:StagedTreasureBinding):Promise<void>;
  markSigningUnknown(intent:TreasureStagedSigningIntent,binding:StagedTreasureBinding):Promise<void>;
  /** Typed exact-transaction authority, not an arbitrary message signer. */
  sign(intent:TreasureStagedSigningIntent,binding:StagedTreasureBinding):Promise<TreasureStagedSigningResult>;
  isCurrent(binding:StagedTreasureBinding):boolean;
  now():number;
  observationMs?:number;
}>;
type Providers=Readonly<{
  ark:Pick<ArkProvider,'getInfo'|'submitTx'|'finalizeTx'>;
  indexer:Pick<IndexerProvider,'getVtxos'|'getVirtualTxs'>;
  emulator:Pick<EmulatorProvider,'getInfo'|'submitTx'>;
}>;
/** Deterministic tests only. Normal production callers provide no third-party
 * URL, alternate key, fake acknowledgement or transport selection. */
export type TreasureStagedSubmitTestDependencies=Readonly<{testOnly:true;providers:Providers;emulatorPublicKey:string}>;
export type TreasureStagedSubmitResult=Readonly<{
  status:'not-started'|'blocked'|'unknown'|'awaiting-receipt';state:StagedTreasureState;
  reason?:'context-changed'|'admission-expired'|'preflight-unavailable'|'original-reconciliation-required'|'signing-unresolved'|'original-outcome-unavailable';
}>;
const invalid=()=>Error('Original staged treasure transport could not be verified. Existing funds remain reserved.');
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(key=>[key,(v as Record<string,unknown>)[key]])):v);
const seal=<T>(value:T):T=>{
  const copy=structuredClone(value),freeze=(v:unknown)=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};
  freeze(copy);return copy;
};
type Completion=Readonly<{kind:'emulator'|'submit';response:unknown}>|
  Readonly<{kind:'root'|'checkpoint';intent:TreasureStagedSigningIntent;response:TreasureStagedSigningResult}>|
  Readonly<{kind:'finalize';response:undefined}>;

/** Real SDK staged transport, not creation activation or receipt confirmation.
 * Callbacks persist private original material; no payload/error is logged. */
export function createTreasureStagedSubmitter(controls:TreasureStagedSubmitControls,testDependencies?:TreasureStagedSubmitTestDependencies){
  if(testDependencies&&testDependencies.testOnly!==true)throw invalid();
  if(controls.observationMs!==undefined&&(!Number.isSafeInteger(controls.observationMs)||controls.observationMs<1||controls.observationMs>30000))throw invalid();
  const operator=testNetwork('mutinynet').operator;
  const pin=testDependencies?.emulatorPublicKey??TREASURE_EMULATOR.key;
  const providers:Providers=testDependencies?.providers??{
    ark:new RestArkProvider(operator),indexer:new RestIndexerProvider(operator),emulator:new RestEmulatorProvider(TREASURE_EMULATOR.url),
  };
  const flights=new Map<string,Promise<TreasureStagedSubmitResult>>(),completions=new Map<string,Completion>();
  function key(binding:StagedTreasureBinding){
    validateStagedTreasureBinding(binding);
    if(binding.artifactVersion!==4||binding.terms.network!=='mutinynet'||binding.terms.emulator!==pin.slice(-64)||!/^0[23][a-f0-9]{64}$/.test(pin))throw invalid();
    return stable(binding);
  }
  async function load(binding:StagedTreasureBinding){const value=await controls.load(binding);validateStagedTreasureState(value,binding);return seal(value);}
  async function persist(previous:StagedTreasureState,event:StagedTreasureEvent,binding:StagedTreasureBinding){
    const next=transitionStagedTreasureState(previous,event,binding);await controls.persist(next,binding);return next;
  }
  async function observed<T>(start:()=>Promise<T>,until:number){
    const remaining=Math.floor(until-performance.now()),milliseconds=Math.min(controls.observationMs??15000,remaining);
    if(milliseconds<1)throw invalid();let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([start(),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(invalid()),milliseconds);})]);}
    finally{clearTimeout(timer);}
  }
  function remember<T>(id:string,kind:Completion['kind'],work:Promise<T>,intent?:TreasureStagedSigningIntent){
    // Retain a late original response privately in this instance. Adoption is
    // explicit; closure does not promise provider replay or automatic recovery.
    return work.then(response=>{
      if(kind==='root'||kind==='checkpoint')completions.set(id,{kind,intent:intent!,response:response as TreasureStagedSigningResult});
      else if(kind==='finalize')completions.set(id,{kind,response:undefined});
      else completions.set(id,{kind,response});
      return response;
    });
  }
  const eligible=(binding:StagedTreasureBinding)=>{
    const now=controls.now(),deadline=buildAuthorizedTreasureScript(binding.terms).deadlineSeconds*1000;
    return Number.isSafeInteger(now)&&now>=binding.terms.startedAtMs&&(binding.branch==='refund'?now>=deadline:now<deadline);
  };
  async function preflight(binding:StagedTreasureBinding,emulator:boolean,until:number){
    const [info,coins,wire]=await observed(()=>Promise.all([
      providers.ark.getInfo(),providers.indexer.getVtxos({outpoints:[binding.funding]}),providers.indexer.getVirtualTxs([binding.funding.txid]),
    ]),until);
    inspectTreasureDirectPolicy('mutinynet',info);
    if(!/^(?:0[23])?[a-f0-9]{64}$/.test(info.forfeitPubkey))throw invalid();
    assertValidServerUnrollScript(info.checkpointTapscript,{...defaultCheckpointExitDelayPolicy(getNetwork('mutinynet')),
      advertisedForfeitPubkey:hex.decode(info.forfeitPubkey.slice(-64))});
    if(info.signerPubkey.slice(-64)!==binding.terms.operator||info.checkpointTapscript!==binding.checkpointTapscript||coins.page||wire.page||
      coins.vtxos.length!==1||wire.txs.length!==1)throw invalid();
    const coin=coins.vtxos[0],flags=coin as unknown as Record<string,unknown>,now=controls.now();
    const script=hex.encode(buildAuthorizedTreasureScript(binding.terms).script.pkScript);
    if(coin.txid!==binding.funding.txid||coin.vout!==binding.funding.vout||coin.value!==1000||coin.script!==script||
      flags.isSpent!==false||flags.isSwept!==false||flags.isUnrolled!==false||flags.isPreconfirmed||flags.expiresAtHeight!==undefined||
      !(flags.expiresAt instanceof Date)||!Number.isFinite(flags.expiresAt.getTime())||flags.expiresAt.getTime()<=now||
      !canSpendOffchain(coin,{timestamp:new Date(now)})||coin.assets!==undefined&&coin.assets.length!==0)throw invalid();
    const encoded=wire.txs[0];if(typeof encoded!=='string'||encoded.length>500000)throw invalid();
    const previous=/^(?:[a-f0-9]{2})+$/.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));
    if(previous.id!==binding.funding.txid||hex.encode(previous.toBytes(false,false))!==binding.previousTransaction)throw invalid();
    if(emulator&&(await observed(()=>providers.emulator.getInfo(),until)).signerPubkey!==pin)throw invalid();
  }
  function signingIntent(state:StagedTreasureState,binding:StagedTreasureBinding,kind:'root'|'checkpoint'):TreasureStagedSigningIntent{
    return seal({artifactVersion:4,kind,contractId:binding.contractId,operationId:binding.operationId,bindingCommitment:state.bindingCommitment,
      actors:treasureAuthorizationActors(binding.branch),arkTx:kind==='root'?state.emulator!.signedArkTx:state.operator!.finalArkTx,
      checkpoints:kind==='root'?state.emulator!.signedCheckpointTxs:state.operator!.signedCheckpointTxs});
  }
  function signingEvent(kind:'root'|'checkpoint',response:TreasureStagedSigningResult,atMs:number):StagedTreasureEvent{
    if(!response||typeof response!=='object')throw invalid();
    if(kind==='root'){
      if(Object.keys(response).join(',')!=='arkTx'||!('arkTx' in response)||typeof response.arkTx!=='string')throw invalid();
      return {type:'actor-root',atMs,arkTx:response.arkTx};
    }
    if(Object.keys(response).join(',')!=='checkpoints'||!('checkpoints' in response)||!Array.isArray(response.checkpoints))throw invalid();
    return {type:'actor-checkpoints',atMs,checkpoints:response.checkpoints};
  }
  async function sign(state:StagedTreasureState,binding:StagedTreasureBinding,kind:'root'|'checkpoint',id:string,until:number){
    const intent=signingIntent(state,binding,kind);
    // The current original stage plus this durable claim precedes signing. The
    // root maps the claim to its private exact-operation signing journal.
    const claim=await controls.claimSigning(intent,binding);
    if(claim.status==='pending')return undefined;
    if(claim.status!=='granted'&&claim.status!=='completed')throw invalid();
    let response:TreasureStagedSigningResult;
    if(claim.status==='completed')response=claim.result;
    else{
      if(!controls.isCurrent(binding))throw invalid();
      try{response=await observed(()=>remember(id,kind,controls.sign(intent,binding),intent),until);}
      catch{await controls.markSigningUnknown(intent,binding);throw invalid();}
    }
    const event=signingEvent(kind,response,controls.now());
    // Authenticate before marking a signing request completed or accepting its
    // output into storage. Persistence failures retain the original claim.
    const next=transitionStagedTreasureState(state,event,binding);
    await controls.completeSigning(intent,response,binding);await controls.persist(next,binding);completions.delete(id);return next;
  }
  async function markUnknown(binding:StagedTreasureBinding,fallback:StagedTreasureState){
    try{
      const latest=await load(binding);
      if(['emulator-pending','submit-pending','finalize-pending'].includes(latest.phase))return await persist(latest,{type:'unknown',atMs:controls.now()},binding);
      return latest;
    }catch{return fallback;}
  }
  async function execute(binding:StagedTreasureBinding,id:string):Promise<TreasureStagedSubmitResult>{
    let state=await load(binding);const until=performance.now()+120000;
    const result=(status:TreasureStagedSubmitResult['status'],reason?:TreasureStagedSubmitResult['reason']):TreasureStagedSubmitResult=>({status,state,...(reason?{reason}:{})});
    if(['emulator-pending','emulator-unknown','submit-pending','submit-unknown','finalize-pending','finalize-unknown'].includes(state.phase))
      return result('unknown','original-reconciliation-required');
    if(!controls.isCurrent(binding))return result('blocked','context-changed');
    try{
      if(state.phase==='prepared'){
        if(!eligible(binding))return result('not-started','admission-expired');
        try{await preflight(binding,true,until);}catch{return result('not-started','preflight-unavailable');}
        if(!controls.isCurrent(binding))return result('blocked','context-changed');
        if(!eligible(binding))return result('not-started','admission-expired');
        state=await persist(state,{type:'emulator-request',atMs:controls.now()},binding);
        if(!controls.isCurrent(binding)||!eligible(binding))throw invalid();
        const response=await observed(()=>remember(id,'emulator',providers.emulator.submitTx(state.emulatorRequest!.arkTx,[...state.emulatorRequest!.checkpoints])),until);
        state=await persist(state,{type:'emulator-response',atMs:controls.now(),response},binding);completions.delete(id);
      }
      if(!controls.isCurrent(binding))return result('blocked','context-changed');
      if(state.phase==='emulator-signed'){
        const signed=await sign(state,binding,'root',id,until);if(!signed)return result('unknown','signing-unresolved');state=signed;
      }
      if(!controls.isCurrent(binding))return result('blocked','context-changed');
      if(state.phase==='actor-root-signed'){
        try{await preflight(binding,false,until);}catch{return result('blocked','preflight-unavailable');}
        if(!controls.isCurrent(binding))return result('blocked','context-changed');
        state=await persist(state,{type:'submit',atMs:controls.now()},binding);
        if(!controls.isCurrent(binding))throw invalid();
        const response=await observed(()=>remember(id,'submit',providers.ark.submitTx(state.submitRequest!.signedArkTx,[...state.submitRequest!.checkpointTxs])),until);
        state=await persist(state,{type:'operator-response',atMs:controls.now(),response},binding);completions.delete(id);
      }
      if(!controls.isCurrent(binding))return result('blocked','context-changed');
      if(state.phase==='operator-signed'){
        const signed=await sign(state,binding,'checkpoint',id,until);if(!signed)return result('unknown','signing-unresolved');state=signed;
      }
      if(!controls.isCurrent(binding))return result('blocked','context-changed');
      if(state.phase==='actor-checkpoints-signed'){
        state=await persist(state,{type:'finalize',atMs:controls.now()},binding);
        if(!controls.isCurrent(binding))throw invalid();
        await observed(()=>remember(id,'finalize',providers.ark.finalizeTx(state.finalizeRequest!.arkTxid,[...state.finalizeRequest!.finalCheckpointTxs])),until);
        completions.delete(id);return result('awaiting-receipt');
      }
      return result('blocked','original-reconciliation-required');
    }catch{
      state=await markUnknown(binding,state);return result('unknown','original-outcome-unavailable');
    }
  }
  return Object.freeze({
    run(binding:StagedTreasureBinding,expectedState?:StagedTreasureState):Promise<TreasureStagedSubmitResult>{
      const id=key(binding);if(expectedState)validateStagedTreasureState(expectedState,binding);
      const active=flights.get(id);if(active)return active;
      // Defer work until the flight is registered, including reentrant hooks.
      const work=Promise.resolve().then(()=>execute(seal(binding),id));flights.set(id,work);
      void work.finally(()=>{if(flights.get(id)===work)flights.delete(id);}).catch(()=>{});return work;
    },
    /** Adopt only a buffered result of this instance's original call. No RPC,
     * re-signing or automatic continuation occurs; a reload needs root recovery. */
    async adoptCompletedResponse(binding:StagedTreasureBinding):Promise<TreasureStagedSubmitResult>{
      const id=key(binding);if(flights.has(id))return {status:'unknown',state:await load(binding),reason:'original-reconciliation-required'};
      const completed=completions.get(id);let state=await load(binding);
      if(!completed)return {status:'unknown',state,reason:'original-reconciliation-required'};
      try{
        if(completed.kind==='finalize')return {status:'awaiting-receipt',state};
        if(completed.kind==='root'||completed.kind==='checkpoint'){
          const next=transitionStagedTreasureState(state,signingEvent(completed.kind,completed.response,controls.now()),binding);
          await controls.completeSigning(completed.intent,completed.response,binding);await controls.persist(next,binding);state=next;
        }else state=await persist(state,completed.kind==='emulator'?{type:'emulator-response',atMs:controls.now(),response:completed.response as Awaited<ReturnType<EmulatorProvider['submitTx']>>}:
          {type:'operator-response',atMs:controls.now(),response:completed.response as Awaited<ReturnType<ArkProvider['submitTx']>>},binding);
        completions.delete(id);return {status:'blocked',state,reason:'original-reconciliation-required'};
      }catch{return {status:'unknown',state,reason:'original-outcome-unavailable'};}
    },
  });
}
