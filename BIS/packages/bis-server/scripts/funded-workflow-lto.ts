import {MnemonicIdentity,RestArkProvider,RestIndexerProvider,DefaultVtxo,VtxoScript,CSVMultisigTapscript,Transaction,buildOffchainTx,ConditionWitness,setArkPsbtField,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {buildLtoScript} from '../../integration/src/client/wallet-layer-arkade/lto-script.ts';
import {selectLtoInputs} from '../../integration/src/client/wallet-layer-arkade/lto-contract.ts';
import {inspectLtoRecoveryDescriptor} from '../../integration/src/client/wallet-layer-arkade/lto-recovery-descriptor.ts';
import {inspectWalletNetworkPolicy,requireZeroFeePolicy} from '../../integration/src/client/state-layer-core/wallet-network-policy.ts';
import {decodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {assertCanonicalSigningTransaction} from '../src/server/offchain-policy.ts';
import {boundedPoll,boundedResult} from './funded-workflow-live.ts';
import {lifecycleHash,sameOutpoints,lifecycleCli,runLifecycle,type LifecycleAssignment,type LifecycleContext,type LifecyclePlan,type LifecycleStrategy} from './funded-workflow-lifecycle.ts';
type Point={txid:string;vout:number;value:number;script:string;assets?:readonly any[];isSpent?:boolean;spentBy?:string;isUnrolled?:boolean;isSwept?:boolean};
export type LtoPlan=LifecyclePlan&{approval:'fresh-private-hash-template';ltoAction:'claim'|'reject-refund';playerKey:string;gameKey:string;operatorKey:string;exitDelay:string;playerScript:string;gameScript:string;checkpointTapscript:string;inputs:Point[];policyFingerprint:string};
export type LtoWire={kind:'fund'|'claim'|'refund';transactionId:string;arkTx:string;checkpoints:string[];sourceOutpoints:string[];destinationScript:string;changeScript:string;changeSats:number;roleKey:string;operatorKey:string};
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const decode=(encoded:string)=>/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));
const encode=(tx:Transaction)=>base64.encode(tx.toPSBT());
export function prepareLtoSdkPlan(input:{a:LifecycleAssignment;info:any;playerPublicKey:string;coins:Point[]}):LtoPlan{
 const {a,info}=input,policy=inspectWalletNetworkPolicy(a.network,info);requireZeroFeePolicy(policy,'contract creation and spending');
 if(a.amountSats!==1000||!/^0[23][a-f0-9]{64}$/.test(input.playerPublicKey)||createHash('sha256').update(Buffer.from(input.playerPublicKey,'hex')).digest('hex')!==a.playerProfileId||!/^0[23][a-f0-9]{64}$/.test(info.signerPubkey)||typeof info.unilateralExitDelay!=='bigint'||info.unilateralExitDelay<512n)throw Error('Original LTO keys or policy unavailable.');
 const playerKey=input.playerPublicKey.slice(-64),gameKey=a.serverPublicKey.slice(-64),operatorKey=info.signerPubkey.slice(-64),defaults={serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds' as const,value:info.unilateralExitDelay}};
 const player=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(playerKey)}),game=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(gameKey)});
 const inputs=selectLtoInputs(input.coins.filter(coin=>coin.script===hex.encode(game.pkScript)),a.amountSats,Math.max(Number(info.vtxoMinAmount),330),[]);
 if(inputs.some(coin=>coin.assets?.length))throw Error('This LTO acceptance case requires asset-free selected funding inputs.');
 const binding={approval:'fresh-private-hash-template' as const,ltoAction:a.ltoAction??'claim',network:a.network,playerId:a.playerProfileId,gameId:a.gameProfileId,playerKey,gameKey,operatorKey,exitDelay:String(info.unilateralExitDelay),amountSats:1000,feeSats:0,
  inputs:inputs.map(coin=>({txid:coin.txid,vout:coin.vout,value:coin.value,script:coin.script})),playerScript:hex.encode(player.encode()),gameScript:hex.encode(game.encode()),checkpointTapscript:info.checkpointTapscript,policyFingerprint:policy.fingerprint};
 return {...binding,outpoints:inputs.map(coin=>`${coin.txid}:${coin.vout}`),fingerprint:lifecycleHash(binding)};
}
export async function validateLtoPrivateOriginal(document:any,a:LifecycleAssignment,plan:LtoPlan){
 const records=document?.ledger?.contracts?.filter((row:any)=>row.id===a.runId);if(records?.length!==1)throw Error('Original LTO document unavailable.');const record=records[0],recovery=document.recovery?.[a.runId];
 if(record.sessionId!==a.runId||record.purpose!=='server-sdk-standard-lto'||record.hostReference!=='server-acceptance:'+a.runId||record.amountSats!==1000||!Number.isSafeInteger(record.startedAt)||record.expiresAt!==record.startedAt+600000||record.scope.network!==a.network||record.scope.operator!==`https://${a.network}.arkade.sh`||record.scope.playerId!==a.playerProfileId||record.scope.gameId!==a.gameProfileId||record.scope.exclusivityKey!=='server-sdk:'+a.runId||record.validationMode!=='browser-policy-v1'||recovery?.treasure||!/^[a-f0-9]{64}$/.test(recovery?.secretHex??'')||['playerKey','gameKey','operatorKey','exitDelay','playerScript','gameScript'].some(key=>recovery[key]!==plan[key as keyof LtoPlan]))throw Error('Original LTO template changed.');
 const script=await inspectLtoRecoveryDescriptor(record,recovery);
 const built=buildLtoScript({playerKey:hex.decode(plan.playerKey),gameKey:hex.decode(plan.gameKey),operatorKey:hex.decode(plan.operatorKey),exitDelay:BigInt(plan.exitDelay),secretHash:hex.decode(digest(hex.decode(recovery.secretHex)))});
 if(hex.encode(built.script.pkScript)!==script||hex.encode(built.script.encode())!==recovery.contractScript)throw Error('Original private hash does not reconstruct its actual script.');
 return {record,recovery,built,secretHash:digest(hex.decode(recovery.secretHex))};
}
export function buildLtoWire(plan:LtoPlan,recovery:any,kind:'fund'|'claim'|'refund'):LtoWire{
 const game=VtxoScript.decode(hex.decode(plan.gameScript)),player=VtxoScript.decode(hex.decode(plan.playerScript));
 const contract=buildLtoScript({playerKey:hex.decode(plan.playerKey),gameKey:hex.decode(plan.gameKey),operatorKey:hex.decode(plan.operatorKey),exitDelay:BigInt(plan.exitDelay),secretHash:hex.decode(digest(hex.decode(recovery.secretHex)))});
 if(hex.encode(contract.script.encode())!==recovery.contractScript)throw Error('LTO recovery artifact changed.');
 const source=kind==='fund'?game:contract.script,leaf=kind==='fund'?source.leaves[0]:source.findLeaf(hex.encode(kind==='claim'?contract.claim:contract.refund)),destination=kind==='fund'?contract.script.pkScript:kind==='claim'?player.pkScript:game.pkScript;
 const coins=kind==='fund'?plan.inputs:[recovery.fundingOutput];if(coins.some(coin=>!coin))throw Error('Original LTO funding unavailable.');
 const total=coins.reduce((sum,coin)=>sum+coin.value,0),change=total-1000;if(change<0||kind!=='fund'&&change!==0)throw Error('Original LTO principal changed.');
 const built=buildOffchainTx(coins.map(coin=>({txid:coin.txid,vout:coin.vout,value:coin.value,tapLeafScript:leaf,tapTree:source.encode()})),[{script:destination,amount:1000n},...(change?[{script:game.pkScript,amount:BigInt(change)}]:[])],CSVMultisigTapscript.decode(hex.decode(plan.checkpointTapscript)));
 if(kind==='claim')for(const tx of [built.arkTx,...built.checkpoints])setArkPsbtField(tx,0,ConditionWitness,[hex.decode(recovery.secretHex)]);
 return {kind,transactionId:built.arkTx.id,arkTx:encode(built.arkTx),checkpoints:built.checkpoints.map(encode),sourceOutpoints:coins.map(coin=>`${coin.txid}:${coin.vout}`),destinationScript:hex.encode(destination),changeScript:hex.encode(game.pkScript),changeSats:change,roleKey:kind==='claim'?plan.playerKey:plan.gameKey,operatorKey:plan.operatorKey};
}
export function inspectLtoSubmission(body:any,wire:LtoWire){
 if(typeof body?.signedArkTx!=='string'||!Array.isArray(body.checkpointTxs)||body.checkpointTxs.length!==wire.checkpoints.length)throw Error('Original LTO submission unavailable.');
 const tx=decode(body.signedArkTx);assertCanonicalSigningTransaction(tx,decode(wire.arkTx));
 verifyTapscriptSignatures(tx,0,[wire.roleKey]);
 for(let i=0;i<body.checkpointTxs.length;i++){const cp=decode(body.checkpointTxs[i]);assertCanonicalSigningTransaction(cp,decode(wire.checkpoints[i]));verifyTapscriptSignatures(cp,0,[wire.roleKey]);}
 return wire.transactionId;
}
export function inspectLtoFinalization(body:any,wire:LtoWire){
 if(body?.arkTxid!==wire.transactionId||!Array.isArray(body.finalCheckpointTxs)||body.finalCheckpointTxs.length!==wire.checkpoints.length)throw Error('Original LTO finalization unavailable.');
 for(let i=0;i<body.finalCheckpointTxs.length;i++){const cp=decode(body.finalCheckpointTxs[i]);assertCanonicalSigningTransaction(cp,decode(wire.checkpoints[i]));verifyTapscriptSignatures(cp,0,[wire.roleKey,wire.operatorKey]);}
}
export async function observeLtoWire(indexer:any,wire:LtoWire){
 const points=wire.sourceOutpoints.map(point=>{const [txid,vout]=point.split(':');return {txid,vout:Number(vout)};}),expected=decode(wire.arkTx),checkpoints=wire.checkpoints.map(decode);
 const {vtxos}=await indexer.getVtxos({outpoints:[...points,{txid:wire.transactionId,vout:0},...(wire.changeSats?[{txid:wire.transactionId,vout:1}]:[])]});
 const originals=points.map(point=>vtxos.find((coin:any)=>coin.txid===point.txid&&coin.vout===point.vout));
 if(originals.some((coin:any,index:number)=>!coin?.isSpent||coin.assets?.length||coin.spentBy!==checkpoints[index].id||coin.arkTxId!==wire.transactionId||
  !Number.isSafeInteger(coin.value)||BigInt(coin.value)!==checkpoints[index].getInput(0).witnessUtxo?.amount||coin.script!==hex.encode(checkpoints[index].getInput(0).witnessUtxo!.script)))throw Error('Original LTO input receipts unavailable.');
 const encoded=await indexer.getVirtualTxs([wire.transactionId,...checkpoints.map(tx=>tx.id)]),txs=encoded.txs.map(decode),actual=txs.find((tx:Transaction)=>tx.id===wire.transactionId);
 if(!actual||!isDeepStrictEqual(actual.unsignedTx,expected.unsignedTx))throw Error('Original LTO payout wire unavailable.');
 for(const cp of checkpoints){const actualCp=txs.find((tx:Transaction)=>tx.id===cp.id);if(!actualCp||!isDeepStrictEqual(actualCp.unsignedTx,cp.unsignedTx))throw Error('Original LTO checkpoint wire unavailable.');}
 const payout=vtxos.find((coin:any)=>coin.txid===wire.transactionId&&coin.vout===0);
 if(payout?.value!==1000||payout.script!==wire.destinationScript||payout.assets?.length)throw Error('Original exact LTO payout unavailable.');
 if(wire.changeSats){const change=vtxos.find((coin:any)=>coin.txid===wire.transactionId&&coin.vout===1);if(change?.value!==wire.changeSats||change.script!==wire.changeScript||change.assets?.length)throw Error('Original LTO change unavailable.');}
 const inputTotal=originals.reduce((sum:number,coin:any)=>sum+coin.value,0);let outputTotal=0n;for(let i=0;i<actual.outputsLength;i++)outputTotal+=actual.getOutput(i).amount??0n;
 if(BigInt(inputTotal)!==outputTotal)throw Error('Original LTO fee changed.');
 return {verified:true,kind:wire.kind,transactionId:wire.transactionId,amountSats:1000,feeSats:0,sourceOutpoints:wire.sourceOutpoints,checkpointIds:checkpoints.map(tx=>tx.id),destinationScript:wire.destinationScript,changeSats:wire.changeSats,assetsPreserved:true};
}
async function privateDocument(ctx:LifecycleContext){return ctx.owner.page.evaluate(async(network:string)=>{const load=(path:string)=>import(/* @vite-ignore */path);return (await load('/BIS/packages/integration/src/client/state-layer-core/contract-storage.ts')).createContractStorage(undefined,network).load();},ctx.a.network);}
async function initializeLto(ctx:LifecycleContext){await ctx.owner.page.evaluate(()=>{const s=(globalThis as any).__serverAcceptance;s.lto??=s.api.createBisLto({context:s.context,gameWallet:s.game});});}

export function assertOriginalLtoScope(original:any,saved:any,a:LifecycleAssignment){
 const before=saved.privateOriginalDocument?.ledger.contracts.find((row:any)=>row.id===a.runId),recovery=saved.privateOriginalDocument?.recovery?.[a.runId];
 if(!before||before.startedAt!==original.record.startedAt||before.expiresAt!==original.record.expiresAt||!isDeepStrictEqual(before.scope,original.record.scope)||recovery?.secretHex!==original.recovery.secretHex||recovery?.contractScript!==original.recovery.contractScript)throw Error('Original private LTO recovery changed.');
}
export function assertRefundScopePrerequisites(original:any,saved:any,state:any,a:LifecycleAssignment){
 assertOriginalLtoScope(original,saved,a);
 const operation=state.operations?.find((row:any)=>row.intent.id===a.runId+'-fund');
 if(saved.phase!=='execution-started'||saved.plan?.ltoAction!=='reject-refund'||!saved.originalFundSubmit||!saved.fundingReceipt?.verified||saved.fundingReceipt.transactionId!==saved.fundWire?.transactionId||operation?.state!=='settled'||operation.providerId!==saved.fundWire.transactionId||original.recovery.fundingOutput?.txid!==saved.fundWire.transactionId||original.recovery.fundingOutput?.vout!==0||original.recovery.fundingOutput?.value!==1000)throw Error('Verified original funding is required before another Game operation.');
}
export async function bindLtoRefundOperation(ctx:LifecycleContext,_path:string,raw:any){
 if(ctx.a.ltoAction!=='reject-refund')return;
 const saved=await ctx.read();if(!saved.refundScope)return;
 if(ctx.mode!=='run'||!ctx.financial||Date.now()>=ctx.deadline||typeof raw.operationId!=='string'||!raw.operationId)throw Error('Original refund signing window unavailable.');
 const original=await validateLtoPrivateOriginal(await privateDocument(ctx),ctx.a,ctx.plan as LtoPlan);
 if(original.record.operation.kind!=='refund'||original.record.ended!=='rejected'||original.record.recoveryRequired||!['refunding','unknown'].includes(original.record.financial))throw Error('An explicit original Player rejection is required.');
 let nextServerOperationId:string|undefined;
 await ctx.save((run,state)=>{
  assertRefundScopePrerequisites(original,run,state,ctx.a);
  const scope=run.refundScope;
  if(scope.stage==='awaiting-original-player-reject'){
   if(original.record.operation.submission!=='prepared'||ctx.serverOperationId!==scope.previousServerOperationId||raw.operationId===scope.previousServerOperationId)throw Error('A new explicit refund operation is required.');
   scope.stage='bound';scope.serverOperationId=raw.operationId;scope.contractOperationId=original.record.operation.id;
  }else if(scope.stage!=='bound'||raw.operationId!==scope.serverOperationId||ctx.serverOperationId!==scope.serverOperationId||original.record.operation.id!==scope.contractOperationId)throw Error('Original refund operation changed or repeated.');
  nextServerOperationId=scope.serverOperationId;
 });
 ctx.serverOperationId=nextServerOperationId;
}
export async function waitLtoExit(ctx:LifecycleContext,kind:'claim'|'refund',indexer:any=new RestIndexerProvider(`https://${ctx.a.network}.arkade.sh`)){
 let receipt:any;
 await boundedPoll(async()=>{try{
  const saved=await ctx.read(),wire=saved[kind+'Wire'];
  if(!saved[kind==='claim'?'originalClaimSubmit':'originalRefundSubmit']||!saved[kind==='claim'?'originalClaimFinalize':'originalRefundFinalize']||!wire)return false;
  if(kind==='refund'&&(saved.refundScope?.stage!=='bound'||!saved.successfulServerSigns?.some((row:any)=>row.operationId===saved.refundScope.serverOperationId&&row.method==='sign')))return false;
  receipt=await observeLtoWire(indexer,wire);
  await ctx.owner.page.evaluate(async(runId:string)=>await (globalThis as any).__serverAcceptance.lto.reconcile({sessionId:runId,feedback:'silent'}),ctx.a.runId);
  const original=await validateLtoPrivateOriginal(await privateDocument(ctx),ctx.a,ctx.plan as LtoPlan);assertOriginalLtoScope(original,saved,ctx.a);
  return original.record.financial===(kind==='claim'?'claimed':'refunded')&&original.record.operation.kind===kind&&original.record.operation.submission==='confirmed'&&original.recovery.spend?.transactionId===wire.transactionId&&(kind==='claim'||original.record.ended==='rejected');
 }catch{return false;}},Math.max(1,ctx.deadline-Date.now()));
 return receipt;
}

export const ltoStrategy:LifecycleStrategy={workflow:'standard-lto',source:import.meta.url,operationKinds:['arkade-send','claim','refund'],lifecycleCost:a=>a.amountSats*2,
 async prepare(ctx){
  const endpoint=`https://${ctx.a.network}.arkade.sh`,info=await boundedResult(new RestArkProvider(endpoint).getInfo(),10000),playerPublicKey=hex.encode(await MnemonicIdentity.fromMnemonic(ctx.owner.registration.player.phrase,{isMainnet:false}).compressedPublicKey());
  const defaults={pubKey:hex.decode(ctx.a.serverPublicKey.slice(-64)),serverPubKey:hex.decode(info.signerPubkey.slice(-64)),csvTimelock:{type:'seconds' as const,value:info.unilateralExitDelay}},game=new DefaultVtxo.Script(defaults);
  const {vtxos}=await boundedResult(new RestIndexerProvider(endpoint).getVtxos({scripts:[hex.encode(game.pkScript)],spendableOnly:true}),10000);
  return prepareLtoSdkPlan({a:ctx.a,info,playerPublicKey,coins:vtxos});
 },
 async execute(ctx){
  await initializeLto(ctx);const game=ctx.owner.registration.game,player=ctx.owner.registration.player;
  await ctx.operation('arkade-send',game,ctx.a.runId+'-fund','contract:'+ctx.a.runId,async()=>{
   const result=await ctx.owner.page.evaluate(async(runId:string)=>{const s=(globalThis as any).__serverAcceptance,startedAt=Date.now();return s.lto.start({sessionId:runId,purpose:'server-sdk-standard-lto',hostReference:'server-acceptance:'+runId,amountSats:1000,startedAt,expiresAt:startedAt+600000,exclusivityKey:'server-sdk:'+runId,approveUponCreation:true,validationSolution:'browser-policy-v1'});},ctx.a.runId);
   const saved=await ctx.read();if(!saved.originalFundSubmit||!saved.fundWire)throw Error('Original funding acknowledgement unavailable.');return saved.fundWire.transactionId;
  },player);
  let funding:any;const indexer=new RestIndexerProvider(`https://${ctx.a.network}.arkade.sh`);
  await boundedPoll(async()=>{try{const saved=await ctx.read();funding=await observeLtoWire(indexer,saved.fundWire);return true;}catch{return false;}},Math.max(1,ctx.deadline-Date.now()));
  const settled=await ctx.ledger.reconcile(ctx.a.runId+'-fund',async(row:any)=>({id:row.intent.id,fingerprint:row.fingerprint,providerId:funding.transactionId,outcome:'settled',verified:true,feeSats:0}));if(settled.state!=='settled')throw Error('Original funding not settled.');
  await ctx.save(run=>{run.fundingReceipt=funding;});
  const kind=ctx.a.ltoAction==='reject-refund'?'refund':'claim';
  if(kind==='refund'){
   await ctx.owner.page.evaluate(async(runId:string)=>await (globalThis as any).__serverAcceptance.lto.reconcile({sessionId:runId,feedback:'silent'}),ctx.a.runId);
   const original=await validateLtoPrivateOriginal(await privateDocument(ctx),ctx.a,ctx.plan as LtoPlan);
   await ctx.save((run,state)=>{
    assertRefundScopePrerequisites(original,run,state,ctx.a);
    if(original.record.financial!=='funded'||original.record.operation.kind!=='fund'||original.record.operation.submission!=='confirmed'||original.record.ended||run.refundScope||!ctx.serverOperationId)throw Error('Original funding must be closed before explicit rejection.');
    run.refundScope={stage:'awaiting-original-player-reject',previousServerOperationId:ctx.serverOperationId,fundingTransactionId:funding.transactionId};
   });
  }
  await ctx.operation(kind,kind==='refund'?game:player,ctx.a.runId+'-'+kind,kind==='refund'?ctx.owner.expected.game.arkadeAddress:ctx.owner.expected.player.arkadeAddress,async()=>{
   await ctx.owner.page.evaluate(async(input:any)=>{const s=(globalThis as any).__serverAcceptance,game=s.game.getState(),player=s.context.getState();
    if(game.source!=='server'||game.profileId!==input.gameId||game.network!==input.network||player.phase!=='active'||player.profileId!==input.playerId||player.network!==input.network)throw Error('Original LTO actors changed.');
    return input.kind==='refund'?s.lto.reject(input.runId):s.lto.claim(input.runId);
   },{runId:ctx.a.runId,kind,gameId:ctx.a.gameProfileId,playerId:ctx.a.playerProfileId,network:ctx.a.network});
   // Public claim/reject acknowledges durable acceptance before execution ends.
   // Keep the same financial window until exact original completion is proved.
   const receipt=await waitLtoExit(ctx,kind,indexer);return receipt.transactionId;
  },kind==='refund'?player:game);
 },
 operationScope:bindLtoRefundOperation,
 async server(ctx,path,body){
  const prefix=ctx.a.authorizationMode==='owner'?'owner/':'payment/',raw=body.request??body;
  if(![prefix+'plan',prefix+'authorize','sign'].includes(path)||raw.method!=='sign')throw Error('Unsupported standard LTO signing route.');
  const saved=await ctx.read(),document=await privateDocument(ctx),original=await validateLtoPrivateOriginal(document,ctx.a,ctx.plan as LtoPlan);
  const kind=original.record.operation.kind;
  if(path===prefix+'plan'){
   if(kind!=='fund'&&!(ctx.a.ltoAction==='reject-refund'&&kind==='refund'&&original.record.ended==='rejected'))throw Error('Unassigned original LTO plan.');
   if(kind==='fund'&&(original.record.startedAt>Date.now()||Date.now()-original.record.startedAt>120000))throw Error('Original LTO funding clock changed.');
   if(body.contract?.kind!==kind||body.contract?.secretHash!==original.secretHash||Object.keys(body.contract).length!==2||ctx.a.authorizationMode==='owner'&&body.contractPlayerPublicKey!=='02'+original.recovery.playerKey)throw Error('Actual LTO contract authority changed.');
   if(kind==='refund'){
    assertOriginalLtoScope(original,saved,ctx.a);
    if(saved.refundScope?.stage!=='bound'||saved.refundScope.serverOperationId!==raw.operationId||saved.refundScope.contractOperationId!==original.record.operation.id)throw Error('Original explicit refund scope unavailable.');
   }
   const wire=buildLtoWire(ctx.plan as LtoPlan,original.recovery,kind),args=decodeSigningValue(raw.args);
   if(!sameOutpoints((body.outpoints??[]).map((coin:any)=>`${coin.txid}:${coin.vout}`),wire.sourceOutpoints))throw Error('Original contract inputs changed.');
   assertCanonicalSigningTransaction(Transaction.fromPSBT(args[0].toPSBT()),decode(wire.arkTx));
   await ctx.save(run=>{if(run[kind+'Wire'])throw Error('Original LTO plan already exists.');run[kind+'Wire']=wire;if(kind==='fund')run.privateOriginalDocument=document;else run.refundPrivateDocument=document;});
  }else{
   const wire=saved[kind+'Wire'] as LtoWire;if(!wire||!['fund','refund'].includes(kind)||kind==='refund'&&ctx.a.ltoAction!=='reject-refund')throw Error('Original LTO plan unavailable.');
   const args=decodeSigningValue(raw.args),tx=Transaction.fromPSBT(args[0].toPSBT()),expected=[wire.arkTx,...wire.checkpoints].map(decode).find(candidate=>candidate.id===tx.id);
   if(!expected)throw Error('Unassigned standard LTO signature.');assertCanonicalSigningTransaction(tx,expected);
  }
 },
 async provider(ctx,path,body){
  if(!['/v1/tx/submit','/v1/tx/finalize'].includes(path))throw Error('Unsupported standard LTO provider call.');
  const document=await privateDocument(ctx),original=await validateLtoPrivateOriginal(document,ctx.a,ctx.plan as LtoPlan),saved=await ctx.read();
  assertOriginalLtoScope(original,saved,ctx.a);
  const kind=original.record.operation.kind,expectedExit=ctx.a.ltoAction==='reject-refund'?'refund':'claim';
  if(kind!=='fund'&&kind!==expectedExit)throw Error('Competing LTO action refused.');
  if(kind!=='fund'&&(!saved.fundingReceipt?.verified||original.recovery.fundingOutput?.txid!==saved.fundWire.transactionId||original.recovery.fundingOutput?.vout!==0))throw Error('Original verified LTO funding required.');
  if(kind==='refund'&&(original.record.ended!=='rejected'||saved.refundScope?.stage!=='bound'||saved.refundScope.serverOperationId!==ctx.serverOperationId||saved.refundScope.contractOperationId!==original.record.operation.id))throw Error('Original explicit refund scope changed.');
  const wire=kind==='fund'?saved.fundWire:buildLtoWire(ctx.plan as LtoPlan,original.recovery,kind);
  const title=kind==='fund'?'Fund':kind==='claim'?'Claim':'Refund';
  if(path==='/v1/tx/submit'){
   inspectLtoSubmission(body,wire);
   await ctx.save(run=>{const field='original'+title+'Submit';if(run[field])throw Error('Original LTO submission already attempted.');run[field]=body;run[kind+'Wire']=wire;run[kind+'PrivateDocument']=document;});
  }else{
   inspectLtoFinalization(body,wire);
   await ctx.save(run=>{const field='original'+title+'Finalize';if(run[field]||!run['original'+title+'Submit'])throw Error('Original LTO finalization changed.');run[field]=body;run[kind+'PrivateDocument']=document;});
  }
 },
 async observe(ctx){
  await initializeLto(ctx);const kind=ctx.a.ltoAction==='reject-refund'?'refund':'claim',saved=await ctx.read();
  if(!saved.originalFundSubmit||!saved.fundWire)throw Error('Original LTO funding unavailable.');
  const indexer=new RestIndexerProvider(`https://${ctx.a.network}.arkade.sh`),funding=await observeLtoWire(indexer,saved.fundWire),exit=await waitLtoExit(ctx,kind,indexer);
  for(const [suffix,receipt] of [['fund',funding],[kind,exit]] as const){const settled=await ctx.ledger.reconcile(ctx.a.runId+'-'+suffix,async(row:any)=>({id:row.intent.id,fingerprint:row.fingerprint,providerId:receipt.transactionId,outcome:'settled',verified:true,feeSats:0}));if(settled.state!=='settled')throw Error('Original LTO operation unresolved.');}
  return {verified:true,approval:'fresh-private-hash-template',ltoAction:ctx.a.ltoAction??'claim',contractId:ctx.a.runId,funding,[kind]:exit,originalBrowserJournal:kind==='claim'?'claimed and confirmed':'explicitly rejected, refunded and confirmed',validationMode:'browser-policy-v1',qualification:'standard hashlocked LTO only; no Treasure covenant qualification'};
 },
 async cleanup(ctx){await ctx.owner?.page?.evaluate(()=>{const s=(globalThis as any).__serverAcceptance;s?.lto?.dispose({endSessions:false});}).catch(()=>{});}
};
export const runLtoAcceptance=(a:LifecycleAssignment,mode:'prepare'|'run'|'reconcile',env=process.env)=>runLifecycle(a,mode,ltoStrategy,env);
if(import.meta.main)await lifecycleCli(ltoStrategy);
