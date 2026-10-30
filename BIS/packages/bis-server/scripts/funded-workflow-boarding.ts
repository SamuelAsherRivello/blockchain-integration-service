import {ReadonlyWallet,ReadonlySingleKey,RestArkProvider,RestIndexerProvider,InMemoryWalletRepository,InMemoryContractRepository,CSVMultisigTapscript,hasBoardingTxExpired,Ramps,Intent,Transaction,ArkAddress,getNetwork,verifyTapscriptSignatures,type IWallet,type SettleParams} from '@arkade-os/sdk';
import {Address,OutScript} from '@scure/btc-signer';
import {RawPSBTV0} from '@scure/btc-signer/psbt.js';
import {base64,hex} from '@scure/base';
import {isDeepStrictEqual} from 'node:util';
import {inspectWalletNetworkPolicy,requireZeroFeePolicy} from '../../integration/src/client/state-layer-core/wallet-network-policy.ts';
import {verifiedBoardingCommitment} from '../../integration/src/client/state-layer-core/boarding-reconciliation.ts';
import {decodeSigningValue} from '../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import {readSettlementContext,type SettlementSourceReader} from '../src/server/settlement-context.ts';
import {validateSettlementIntent,type TrustedSettlementContext} from '../src/server/settlement-intent-policy.ts';
import {boundedPoll,boundedResult} from './funded-workflow-live.ts';
import {lifecycleHash,sameOutpoints,lifecycleCli,runLifecycle,type LifecycleAssignment,type LifecycleContext,type LifecyclePlan,type LifecycleStrategy} from './funded-workflow-lifecycle.ts';
export type BoardingPlan=LifecyclePlan&{quote:any;outputs:{amount:string;script:string}[];bitcoinAddress:string;gameAddress:string;policyFingerprint:string;sourceKind:'confirmed-bitcoin-only'};
const decode=(value:string)=>/^[a-f0-9]+$/i.test(value)?Transaction.fromRaw(hex.decode(value)):Transaction.fromPSBT(base64.decode(value));
export async function planBoardingSdk(input:{wallet:any;info:any;profileId:string;network:'signet'|'mutinynet';quote:any}):Promise<BoardingPlan>{
 const {wallet,info,quote}=input,policy=inspectWalletNetworkPolicy(input.network,info);requireZeroFeePolicy(policy,'Account Transfer');
 const [coins,tip,bitcoinAddress,gameAddress]=await Promise.all([wallet.getBoardingUtxos(),wallet.onchainProvider.getChainTip(),wallet.getBoardingAddress(),wallet.getAddress()]);
 const exit=CSVMultisigTapscript.decode(hex.decode(wallet.boardingTapscript.exitScript));
 const eligible=coins.filter((coin:any)=>coin.status?.confirmed&&!hasBoardingTxExpired(coin,exit.params.timelock,tip.height)).sort((a:any,b:any)=>a.txid.localeCompare(b.txid)||a.vout-b.vout);
 const inputs=quote.inputOutpoints?quote.inputOutpoints.map((point:any)=>{
  const coin=eligible.find((coin:any)=>coin.txid===point.txid&&coin.vout===point.vout);
  if(!coin||coin.value!==point.valueSats||point.assets?.length)throw Error('Original quoted boarding input changed.');return coin;
 }):eligible;
 const total=inputs.reduce((sum:number,coin:any)=>sum+coin.value,0);
 if(!inputs.length||inputs.some((coin:any)=>!Number.isSafeInteger(coin.value)||coin.value<1||coin.assets?.length)||new Set(inputs.map((coin:any)=>`${coin.txid}:${coin.vout}`)).size!==inputs.length||!Number.isSafeInteger(total)||total<1||!Number.isSafeInteger(quote.amountSats)||quote.amountSats<1||quote.amountSats>5000||quote.amountSats>total||quote.profileId!==input.profileId||quote.direction!=='to-arkade'||quote.inputSats!==total||quote.feeSats!==0||quote.netSats!==quote.amountSats||quote.maxSats!==total||quote.expiresAt<=Date.now())throw Error('Boarding requires exact eligible quoted inputs and an amount within the approved cap.');
 const change=total-quote.amountSats;
 if(change>0&&(!quote.inputOutpoints||change<Number(info.utxoMinAmount??wallet.dustAmount)))throw Error('Original Bitcoin change is unavailable or below its minimum.');
 let params:SettleParams|undefined;
 const facade={dustAmount:wallet.dustAmount,getAddress:async()=>gameAddress,getBoardingAddress:async()=>bitcoinAddress,settle:async(value:SettleParams)=>{params=value;return 'unsigned-plan-only';}} as unknown as IWallet;
 await new Ramps(facade).onboard(info.fees,inputs,BigInt(quote.amountSats));
 if(!params||params.inputs.length!==inputs.length||!sameOutpoints(params.inputs.map(coin=>`${coin.txid}:${coin.vout}`),inputs.map((coin:any)=>`${coin.txid}:${coin.vout}`))||params.outputs.length!==(change?2:1)||params.outputs[0].address!==gameAddress||params.outputs[0].amount!==BigInt(quote.amountSats)||change&&(params.outputs[1].address!==bitcoinAddress||params.outputs[1].amount!==BigInt(change)))throw Error('Actual SDK boarding plan changed.');
 const bitcoinScript=OutScript.encode(Address(getNetwork(input.network)).decode(bitcoinAddress)!);
 const outputs=[{amount:String(quote.amountSats),script:hex.encode(ArkAddress.decode(gameAddress).pkScript)},...(change?[{amount:String(change),script:hex.encode(bitcoinScript)}]:[])],outpoints=inputs.map((coin:any)=>`${coin.txid}:${coin.vout}`);
 const binding={profileId:input.profileId,network:input.network,inputs:inputs.map((coin:any)=>({txid:coin.txid,vout:coin.vout,value:coin.value})),outputs,bitcoinAddress,policyFingerprint:policy.fingerprint};
 return {amountSats:quote.amountSats,feeSats:0,outpoints,fingerprint:lifecycleHash(binding),quote,outputs,bitcoinAddress,gameAddress,policyFingerprint:policy.fingerprint,sourceKind:'confirmed-bitcoin-only'};
}
export function inspectBoardingIntent(tx:Transaction,context:TrustedSettlementContext,plan:BoardingPlan,message?:string,requireSignatures=false,allowDelete=false){
 const verified=validateSettlementIntent(tx,context);
 const deletion=allowDelete&&!requireSignatures&&verified.kind==='delete'&&verified.outputs.length===0;
 if((verified.kind!=='register'&&!deletion)||verified.exposureSats!==plan.feeSats||!sameOutpoints(verified.sourceOutpoints,plan.outpoints)||!deletion&&!isDeepStrictEqual(verified.outputs,plan.outputs))throw Error('Approved original boarding intent changed.');
 if(message!==undefined){const encoded=RawPSBTV0.decode(tx.toPSBT(0)).global.genericSignedMessage;if(!(encoded instanceof Uint8Array)||new TextDecoder().decode(encoded)!==message||Intent.encodeMessage(JSON.parse(message))!==message)throw Error('Original registration message changed.');}
 if(requireSignatures)for(let index=0;index<tx.inputsLength;index++)verifyTapscriptSignatures(tx,index,[context.gamePublicKey.slice(-64)],[],[1]);
 return verified;
}
async function readonly(ctx:LifecycleContext,use:(wallet:ReadonlyWallet,info:any)=>Promise<any>){
 const endpoint=`https://${ctx.a.network}.arkade.sh`,ark=new RestArkProvider(endpoint),info=await boundedResult(ark.getInfo(),10000);let wallet:ReadonlyWallet|undefined;
 try{
  wallet=await boundedResult(ReadonlyWallet.create({identity:ReadonlySingleKey.fromPublicKey(hex.decode(ctx.a.serverPublicKey)),arkProvider:ark,indexerProvider:new RestIndexerProvider(endpoint),storage:{walletRepository:new InMemoryWalletRepository(),contractRepository:new InMemoryContractRepository()}}),20000);
  if(await wallet.getAddress()!==ctx.owner.expected.game.arkadeAddress||await wallet.getBoardingAddress()!==ctx.owner.expected.game.bitcoinAddress)throw Error('Registered Game address changed.');
  return await use(wallet,info);
 }finally{await wallet?.dispose();}
}
async function browserRecord(ctx:LifecycleContext){
 return ctx.owner.page.evaluate(async(input:any)=>{
  const load=(path:string)=>import(/* @vite-ignore */path),module=await load('/BIS/packages/integration/src/client/state-layer-core/boarding-record.ts');
  const rows=module.readBoardingRecords(input.profileId,input.network).filter((row:any)=>row.quote.fingerprint===input.fingerprint);
  if(rows.length!==1||rows[0].quote.amountSats!==input.amount||JSON.stringify(rows[0].inputs.map((coin:any)=>`${coin.txid}:${coin.vout}`).sort())!==JSON.stringify([...input.outpoints].sort()))throw Error('Original durable boarding journal unavailable.');
  return rows[0];
 },{profileId:ctx.a.gameProfileId,network:ctx.a.network,fingerprint:ctx.plan!.quote.fingerprint,amount:ctx.a.amountSats,outpoints:ctx.plan!.outpoints});
}
async function originalWorkerCommitment(ctx:LifecycleContext){
 let commitment:string|undefined;
 await boundedPoll(async()=>{
  const snapshot=await ctx.owner.page.evaluate(async(input:any)=>{
   const load=(path:string)=>import(/* @vite-ignore */path),records=await load('/BIS/packages/integration/src/client/state-layer-core/boarding-record.ts'),execution=await load('/BIS/packages/integration/src/client/state-layer-core/boarding-execution.ts');
   const rows=records.readBoardingRecords(input.profileId,input.network).filter((row:any)=>row.quote.fingerprint===input.fingerprint);
   if(rows.length!==1||rows[0].quote.amountSats!==input.amount||!Array.isArray(rows[0].inputs)||JSON.stringify(rows[0].inputs.map((coin:any)=>`${coin.txid}:${coin.vout}`).sort())!==JSON.stringify([...input.outpoints].sort()))throw Error('Original durable boarding journal unavailable.');
   return {record:rows[0],workerActive:execution.boardingWorkerActive(input.profileId,rows[0].id)};
  },{profileId:ctx.a.gameProfileId,network:ctx.a.network,fingerprint:ctx.plan!.quote.fingerprint,amount:ctx.a.amountSats,outpoints:ctx.plan!.outpoints});
  if(/^[a-f0-9]{64}$/.test(snapshot.record.commitmentTxid??'')){commitment=snapshot.record.commitmentTxid;return true;}
  if(snapshot.record.status==='not-submitted'||!snapshot.workerActive)throw Error('Original SDK boarding worker stopped without commitment.');
  return false;
 },Math.max(1,ctx.deadline-Date.now()));
 if(!commitment)throw Error('Original commitment acknowledgement unavailable.');return commitment;
}
async function trusted(ctx:LifecycleContext){return readSettlementContext({network:ctx.a.network,gamePublicKey:ctx.a.serverPublicKey,outpoints:ctx.plan!.outpoints.map(point=>{const [txid,vout]=point.split(':');return {txid,vout:Number(vout)};}),maximumExposureSats:ctx.a.amountSats,signal:AbortSignal.timeout(12000)});}
export function assertBoardingServerPath(ctx:Pick<LifecycleContext,'a'|'planToken'|'batchToken'>,path:string,raw:any){
 const prefix=ctx.a.authorizationMode==='owner'?'owner/settlement/':'settlement/',field=ctx.a.authorizationMode==='owner'?'ownerSettlementPlan':'settlementPlan';
 const paths=[prefix+'plan',prefix+'authorize',prefix+'batch',prefix+'session/authorize',prefix+'finalization/authorize','sign'];
 if(!paths.includes(path)||!['sign','session.create','session.getPublicKey','session.init','session.getNonces','session.aggregatedNonces','session.sign'].includes(raw.method))throw Error('Unsupported boarding signer route.');
 if(path!==prefix+'plan'&&(!ctx.planToken||raw[field]!==ctx.planToken))throw Error('Original settlement authority changed.');
 const requiresBatch=path===prefix+'finalization/authorize'||['session.init','session.getNonces','session.aggregatedNonces','session.sign'].includes(raw.method)&&path!==prefix+'batch';
 if(requiresBatch&&(!ctx.batchToken||raw.settlementBatchPlan!==ctx.batchToken))throw Error('Original batch authority changed.');
}
export async function traceBoardingReceipt(input:{plan:BoardingPlan;record:any;transactions:any[];receipts:any[];rawCommitment:Uint8Array;virtual:(ids:string[])=>Promise<any>}){
 const {plan,record}=input;
 if(record.status!=='succeeded'||!/^[a-f0-9]{64}$/.test(record.commitmentTxid??'')||record.quote.fingerprint!==plan.quote.fingerprint||!sameOutpoints(record.inputs.map((coin:any)=>`${coin.txid}:${coin.vout}`),plan.outpoints)||verifiedBoardingCommitment(record,input.transactions,input.receipts)!==record.commitmentTxid)throw Error('Original boarding receipt unverified.');
 const root=Transaction.fromRaw(input.rawCommitment);
 if(root.id!==record.commitmentTxid||!plan.outpoints.every(point=>Array.from({length:root.inputsLength},(_,i)=>root.getInput(i)).some(coin=>coin.txid&&`${hex.encode(coin.txid)}:${coin.index}`===point)))throw Error('Original Bitcoin inputs not in confirmed commitment.');
 const change=Number(plan.quote.inputSats)-plan.amountSats;
 if(change>0){const script=plan.outputs[1]?.script;let actual=0n;for(let index=0;index<root.outputsLength;index++){const output=root.getOutput(index);if(output.script&&hex.encode(output.script)===script)actual+=output.amount??0n;}if(actual!==BigInt(change))throw Error('Original Bitcoin change receipt unverified.');}
 const owned=input.receipts.filter(coin=>coin.commitmentTxIds?.includes(root.id));
 if(!owned.length||owned.some(coin=>coin.assets?.length||coin.script!==plan.outputs[0].script)||owned.reduce((sum,coin)=>sum+coin.value,0)!==plan.amountSats)throw Error('Original Game boarding value or assets changed.');
 for(const coin of owned){
  let id=coin.txid,index=coin.vout;const seen=new Set<string>();
  for(let depth=0;id!==root.id;depth++){
   if(depth>=50||seen.has(id))throw Error('Boarding virtual ancestry unavailable.');seen.add(id);
   const response=await input.virtual([id]),txs=response.txs.map(decode),tx=txs.find((value:Transaction)=>value.id===id);
   if(!tx||index>=tx.outputsLength||tx.inputsLength!==1)throw Error('Boarding virtual ancestry unavailable.');
   if(depth===0&&(tx.getOutput(index).amount!==BigInt(coin.value)||hex.encode(tx.getOutput(index).script!)!==coin.script))throw Error('Boarding virtual wire differs from receipt.');
   const parent=tx.getInput(0);if(!parent.txid||parent.index===undefined)throw Error('Boarding parent unavailable.');id=hex.encode(parent.txid);index=parent.index;
  }
  if(index>=root.outputsLength)throw Error('Boarding commitment output unavailable.');
 }
 return {verified:true,commitmentTxid:root.id,amountSats:plan.amountSats,feeSats:plan.feeSats,sourceOutpoints:plan.outpoints,virtualOutputs:owned.map(coin=>({txid:coin.txid,vout:coin.vout,value:coin.value})),ancestryVerified:true,assetsPreserved:true};
}
export const boardingStrategy:LifecycleStrategy={workflow:'boarding',source:import.meta.url,operationKinds:['btc-send'],lifecycleCost:a=>a.amountSats+a.feeSats,
 async prepare(ctx){
  const quote=await boundedResult(ctx.owner.page.evaluate(async(amount:number)=>{const s=(globalThis as any).__serverAcceptance;return s.game.quoteBoarding(amount);},ctx.a.amountSats),30000);
  return readonly(ctx,(wallet,info)=>planBoardingSdk({wallet,info,profileId:ctx.a.gameProfileId,network:ctx.a.network,quote}));
 },
 async execute(ctx){
  const id=ctx.a.runId+'-board',operation=await ctx.operation('btc-send',ctx.owner.registration.game,id,'boarding:'+ctx.a.gameProfileId,async()=>{
   await ctx.owner.page.evaluate(async(input:any)=>{const s=(globalThis as any).__serverAcceptance;if(s.game.getState().source!=='server'||s.game.getState().profileId!==input.profileId)throw Error('Original server source changed.');return s.game.board(input.quote);},{profileId:ctx.a.gameProfileId,quote:ctx.plan!.quote});
   return originalWorkerCommitment(ctx);
  });
  // Operations.submit preserves sender failures as unknown. Do not enter
  // receipt polling or keep its financial window open after that disposition.
  if(operation?.state!=='pending')throw Error('Original boarding submission unresolved; preserve original protected journals.');
 },
 async server(ctx,path,body){
  const raw=body.request??body;assertBoardingServerPath(ctx,path,raw);
  if(path.endsWith('settlement/plan')){
   if(ctx.planToken||body.sessionKeyMode!=='operation-v1'||!sameOutpoints((body.outpoints??[]).map((coin:any)=>`${coin.txid}:${coin.vout}`),ctx.plan!.outpoints))throw Error('Original boarding plan changed.');
   const args=decodeSigningValue(raw.args);inspectBoardingIntent(Transaction.fromPSBT(args[0].toPSBT()),await trusted(ctx),ctx.plan as BoardingPlan);
  }else if(path.endsWith('settlement/authorize')||path==='sign'&&raw.method==='sign'&&!raw.settlementFinalization){
   const args=decodeSigningValue(raw.args);inspectBoardingIntent(Transaction.fromPSBT(args[0].toPSBT()),{...await trusted(ctx),sessionPublicKey:ctx.sessionPublicKey},ctx.plan as BoardingPlan,undefined,false,true);
  }else if(path.endsWith('settlement/batch')){
   const value=decodeSigningValue(body.commitment);if(typeof value?.toPSBT!=='function')throw Error('Original batch commitment unavailable.');
   await ctx.save(run=>{if(run.originalCommitment)throw Error('Original batch changed.');run.originalCommitment=base64.encode(value.toPSBT());});
  }else if(raw.settlementFinalization){
   const saved=await ctx.read(),value=decodeSigningValue(raw.settlementCommitment);
   if(!saved.originalCommitment||typeof value?.toPSBT!=='function'||!isDeepStrictEqual(Transaction.fromPSBT(value.toPSBT()).unsignedTx,decode(saved.originalCommitment).unsignedTx))throw Error('Original finalization commitment changed.');
  }
 },
 async provider(ctx,path,body){
  const allowed=['/v1/batch/registerIntent','/v1/batch/ack','/v1/batch/tree/submitNonces','/v1/batch/tree/submitSignatures','/v1/batch/submitForfeitTxs'];if(!allowed.includes(path))throw Error('Unsupported boarding provider mutation.');
  const record=await browserRecord(ctx);await ctx.save(run=>{if(run.browserOperationId&&run.browserOperationId!==record.id)throw Error('Original boarding journal changed.');run.browserOperationId=record.id;run.browserRecord=record;});
  if(path==='/v1/batch/registerIntent'){
   const context={...await trusted(ctx),sessionPublicKey:ctx.sessionPublicKey};inspectBoardingIntent(decode(body.intent?.proof),context,ctx.plan as BoardingPlan,body.intent?.message,true);
   await ctx.save(run=>{if(run.originalRegistration)throw Error('Original intent registration already attempted.');run.originalRegistration=body;});
  }else{
   const saved=await ctx.read();if(!saved.originalRegistration||!record.intentId)throw Error('Original registered intent unavailable.');
   if(path==='/v1/batch/ack'){if(body.intentId!==record.intentId)throw Error('Original intent acknowledgement changed.');}
   else if(path.includes('/tree/')){
    if(typeof body.batchId!=='string'||body.pubkey!==ctx.sessionPublicKey)throw Error('Original MuSig scope changed.');
    if(ctx.batchId&&ctx.batchId!==body.batchId)throw Error('Competing batch refused.');ctx.batchId=body.batchId;
   }
   await ctx.save(run=>{run.providerStages??=[];if(run.providerStages.includes(path))throw Error('Original provider stage repeated.');run.providerStages.push(path);});
  }
 },
 async observe(ctx){
  let receipt:any,record:any;
  await boundedPoll(async()=>{try{
   await ctx.owner.page.evaluate(async()=>await (globalThis as any).__serverAcceptance.game.checkBoarding());record=await browserRecord(ctx);if(record.status!=='succeeded')return false;
   receipt=await readonly(ctx,async wallet=>{const [transactions,receipts,rawCommitment]=await Promise.all([wallet.onchainProvider.getTransactions((ctx.plan as BoardingPlan).bitcoinAddress),wallet.getVtxos(),wallet.onchainProvider.getRawTransaction(record.commitmentTxid)]);const indexer=new RestIndexerProvider(`https://${ctx.a.network}.arkade.sh`);return traceBoardingReceipt({plan:ctx.plan as BoardingPlan,record,transactions,receipts,rawCommitment,virtual:ids=>indexer.getVirtualTxs(ids)});});return true;
  }catch{return false;}},Math.max(1,ctx.deadline-Date.now()));
  const operation=await ctx.ledger.reconcile(ctx.a.runId+'-board',async(row:any)=>({id:row.intent.id,fingerprint:row.fingerprint,providerId:receipt.commitmentTxid,outcome:'settled',verified:true,feeSats:receipt.feeSats}));if(operation.state!=='settled'||ctx.mode==='run'&&ctx.counts.sessionSign<1)throw Error('Original remote MuSig boarding not complete.');return {...receipt,originalBrowserJournalId:record.id,remoteMuSig:ctx.mode==='run'?ctx.counts.sessionSign:undefined};
 }};
export const runBoardingAcceptance=(a:LifecycleAssignment,mode:'prepare'|'run'|'reconcile',env=process.env)=>runLifecycle(a,mode,boardingStrategy,env);
if(import.meta.main)await lifecycleCli(boardingStrategy);
