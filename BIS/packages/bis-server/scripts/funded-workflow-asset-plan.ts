import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {asset,AssetManager,ArkAddress,buildOffchainTx,Extension,Transaction,VtxoScript,Wallet,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import {validateOwnerOffchain} from '../src/server/owner-offchain-policy.ts';
import {assertCanonicalSigningTransaction} from '../src/server/offchain-policy.ts';
import type {TrustedAssetContext} from '../src/server/asset-policy.ts';

export type AssetStep='mint'|'delivery'|'burn';
export type AssetAuthorization='owner'|'player-proof';
export type AssetSelectionMetadata=Readonly<{txid:string;vout:number;expiresAt?:Date;expiresAtHeight?:number;virtualStatus?:{batchExpiry?:number}}>;
export type AssetIntent=Readonly<{step:AssetStep;operationId:string;assetId?:string;carrierSats:number;gamePublicKey:string;authorizationMode:AssetAuthorization}>;
export type AssetCoin=Readonly<{txid:string;vout:number;value:number;script:string;assets:readonly {assetId:string;amount:string}[]}>;
export type AssetPlan=Readonly<{step:AssetStep;operationId:string;assetId:string;transactionId:string;fingerprint:string;outpoints:readonly string[];
  unsignedArkTx:string;unsignedCheckpoints:readonly string[];source:readonly AssetCoin[];outputs:readonly AssetCoin[];
  carrierSats:number;exposureSats:number;budgetSats:number;feeSats:0;gamePublicKey:string;authorizationMode:AssetAuthorization}>;
const fail=()=>Error('Exact asset lineage could not be verified.');
export const assetHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const assetMetadata=(operationId:string)=>({name:`BIS acceptance ${operationId}`,ticker:'BIST',decimals:'0',
  bisKind:'asset',bisSchemaVersion:'1',bisAssetFormatVersion:'0.0.2',bisOperationId:operationId});
export function assetRequest(step:AssetStep,operationId:string,assetId?:string,recipient?:string,authorizationMode:AssetAuthorization='owner'){
  return step==='mint'?{operationId,name:assetMetadata(operationId).name,ticker:'BIST',amount:authorizationMode==='owner'?'2':'1',decimals:0}
    :step==='delivery'?{operationId,assetId,quantity:'1',recipient}:{operationId,assetId,quantity:'1'};
}
export function decodeAssetTransaction(encoded:string){return /^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded));}

/** Execute the installed SDK's unsigned issue/burn/send planner. The terminal
 * submission method captures a real plan and throws before signing or I/O.
 * Context contains only fresh public coins and policy, never a private key.
 */
export async function prepareAssetSdkPlan(context:TrustedAssetContext,intent:AssetIntent,operatorKey:Uint8Array,vtxoMinimumSats:bigint,selectionMetadata:readonly AssetSelectionMetadata[]=[]):Promise<AssetPlan>{
  if(!context.inputs.length||operatorKey.length!==32||vtxoMinimumSats<0n||vtxoMinimumSats>1000n)throw fail();
  const script=VtxoScript.decode(context.inputs[0].tapTree),address=script.address('tark',operatorKey).encode();
  if(!isDeepStrictEqual(script.pkScript,context.changeScript))throw fail();
  let captured:AssetPlan|undefined;
  const coins=context.inputs.map(coin=>{
    const metadata=selectionMetadata.find(item=>item.txid===coin.txid&&item.vout===coin.vout);
    return {...coin,...(metadata?{expiresAt:metadata.expiresAt,expiresAtHeight:metadata.expiresAtHeight,virtualStatus:metadata.virtualStatus}:{})};
  });
  const stopped=Error('Unsigned SDK plan captured before signing.');
  const capture=async(inputs:TrustedAssetContext['inputs'],outputs:Parameters<typeof buildOffchainTx>[1])=>{
    const selected={...context,inputs};
    const tx=buildOffchainTx([...inputs],outputs,context.serverUnrollScript);
    captured=validateAssetPlan(tx.arkTx,selected,intent);throw stopped;
  };
  // Only readonly values and an aborting terminal are supplied. There is no
  // signing identity, signing provider, or network submission implementation.
  const wallet:any={indexerProvider:{},dustAmount:BigInt(intent.carrierSats),getSpendableVtxos:async()=>coins,getAddress:async()=>address,
    buildAndSubmitOffchainTx:capture,offchainTapscript:script,arkServerPublicKey:operatorKey,serverUnrollScript:context.serverUnrollScript,
    network:{hrp:'tark'},logUngatedInputs:()=>{},recipientAddressContext:()=>({hrp:'tark',signerSet:{active:hex.encode(operatorKey),deprecated:new Map()}}),
    arkProvider:{getInfo:async()=>({vtxoMinAmount:vtxoMinimumSats})},_submitOffchainSpend:capture};
  try{
    const manager=new AssetManager(wallet);
    if(intent.step==='mint')await manager.issue({amount:intent.authorizationMode==='owner'?2n:1n,metadata:{...assetMetadata(intent.operationId),decimals:0}});
    else if(intent.step==='burn')await manager.burn({assetId:intent.assetId!,amount:1n});
    else{
      const selected:typeof context.inputs[number][]=[];let quantity=0n;
      for(const coin of [...context.inputs].sort((a,b)=>a.txid.localeCompare(b.txid)||a.vout-b.vout)){
        const held=coin.assets.filter(item=>item.assetId===intent.assetId).reduce((sum,item)=>sum+item.amount,0n);
        if(!held)continue;selected.push(coin);quantity+=held;if(quantity>=1n)break;
      }
      if(quantity<1n)throw fail();
      const destination=new ArkAddress(operatorKey,context.recipientScript.slice(2),'tark').encode();
      const send=Reflect.get(Wallet.prototype,'_sendImpl');if(typeof send!=='function')throw fail();
      await send.call(wallet,{recipients:[{address:destination,amount:intent.carrierSats,assets:[{assetId:intent.assetId!,amount:1n}]}],selectedVtxos:selected});
    }
  }catch(error){if(error!==stopped)throw error;}
  if(!captured)throw fail();return captured;
}

/** Pure validation of the actual SDK plan against fresh, server-derived inputs.
 * Owner two-unit issuance and public one-NFT issuance remain separate lineages.
 */
export function validateAssetPlan(tx:Transaction,context:TrustedAssetContext,intent:AssetIntent):AssetPlan{
  if(!['mint','delivery','burn'].includes(intent.step)||!['owner','player-proof'].includes(intent.authorizationMode)||
    intent.authorizationMode==='player-proof'&&intent.step==='burn'||!/^[a-f0-9]{64}$/.test(intent.gamePublicKey)||
    !/^[a-z][a-z0-9-]{1,47}$/.test(intent.operationId)||!Number.isSafeInteger(intent.carrierSats)||intent.carrierSats<1||intent.carrierSats>1000||
    intent.step!=='mint'&&!/^[a-f0-9]{68}$/.test(intent.assetId??''))throw fail();
  const canonical=validateOwnerOffchain(tx,context),extension=Extension.fromTx(tx),packet=extension.getAssetPacket();
  if(!packet||extension.getPackets().length!==1||!context.inputs.length)throw fail();
  const holdings=new Map<string,{amount:bigint;inputs:ReturnType<typeof asset.AssetInput.create>[]}>();
  context.inputs.forEach((coin,index)=>{for(const holding of coin.assets){
    if(!/^[a-f0-9]{68}$/.test(holding.assetId)||typeof holding.amount!=='bigint'||holding.amount<1n)throw fail();
    const item=holdings.get(holding.assetId)??{amount:0n,inputs:[]};item.amount+=holding.amount;item.inputs.push(asset.AssetInput.create(index,holding.amount));holdings.set(holding.assetId,item);
  }});
  const total=context.inputs.reduce((sum,coin)=>sum+BigInt(coin.value),0n),groups:InstanceType<typeof asset.AssetGroup>[]=[];
  if(total>BigInt(Number.MAX_SAFE_INTEGER))throw fail();
  const issuedId=asset.AssetId.create(tx.id,0).toString(),lineageId=intent.step==='mint'?issuedId:intent.assetId!;
  if(intent.step==='mint'){
    if(tx.outputsLength!==3||tx.getOutput(0).amount!==total||!isDeepStrictEqual(tx.getOutput(0).script,context.changeScript))throw fail();
    const items=Object.entries(assetMetadata(intent.operationId)).map(([key,value])=>asset.Metadata.create(new TextEncoder().encode(key),new TextEncoder().encode(value)));
    groups.push(asset.AssetGroup.create(null,null,[],[asset.AssetOutput.create(0,intent.authorizationMode==='owner'?2n:1n)],items));
  }else{
    const quantity=holdings.get(lineageId)?.amount;
    if(quantity!==(intent.step==='delivery'&&intent.authorizationMode==='owner'?2n:1n))throw fail();
    if(intent.step==='delivery'){
      if(total<=BigInt(intent.carrierSats)||tx.outputsLength!==4||tx.getOutput(0).amount!==BigInt(intent.carrierSats)||
        !isDeepStrictEqual(tx.getOutput(0).script,context.recipientScript)||tx.getOutput(1).amount!==total-BigInt(intent.carrierSats)||!isDeepStrictEqual(tx.getOutput(1).script,context.changeScript))throw fail();
    }else if(tx.outputsLength!==3||tx.getOutput(0).amount!==total||!isDeepStrictEqual(tx.getOutput(0).script,context.changeScript))throw fail();
  }
  for(const [id,item] of holdings){
    const outputs:ReturnType<typeof asset.AssetOutput.create>[]=[];
    if(intent.step==='delivery'){
      if(id===lineageId)outputs.push(asset.AssetOutput.create(0,1n));
      const remaining=item.amount-(id===lineageId?1n:0n);if(remaining)outputs.push(asset.AssetOutput.create(1,remaining));
    }else{
      const remaining=item.amount-(intent.step==='burn'&&id===lineageId?1n:0n);if(remaining)outputs.push(asset.AssetOutput.create(0,remaining));
    }
    groups.push(asset.AssetGroup.create(asset.AssetId.fromString(id),null,item.inputs,outputs,[]));
  }
  if(!isDeepStrictEqual(packet.serialize(),asset.Packet.create(groups).serialize()))throw fail();
  const valueOut=Array.from({length:tx.outputsLength},(_,index)=>tx.getOutput(index).amount??0n).reduce((sum,value)=>sum+value,0n);
  if(valueOut!==total||canonical.exposureSats!==(intent.step==='delivery'?intent.carrierSats:0))throw fail();
  const normalize=(items:readonly {assetId:string;amount:bigint}[])=>items.map(item=>({assetId:item.assetId,amount:String(item.amount)})).sort((a,b)=>a.assetId.localeCompare(b.assetId));
  const source=context.inputs.map(coin=>({txid:coin.txid,vout:coin.vout,value:coin.value,script:hex.encode(context.changeScript),assets:normalize(coin.assets)}));
  const outputs:AssetCoin[]=[];
  for(let vout=0;vout<tx.outputsLength;vout++){
    const output=tx.getOutput(vout);if(!output.amount)continue;
    const assets=groups.flatMap(group=>group.outputs.filter(allocation=>allocation.vout===vout).map(allocation=>({assetId:group.assetId?.toString()??issuedId,amount:allocation.amount})));
    outputs.push({txid:tx.id,vout,value:Number(output.amount),script:hex.encode(output.script!),assets:normalize(assets)});
  }
  const outpoints=source.map(coin=>`${coin.txid}:${coin.vout}`),unsignedArkTx=base64.encode(canonical.arkTx.toPSBT()),unsignedCheckpoints=canonical.checkpoints.map(checkpoint=>base64.encode(checkpoint.toPSBT()));
  const result={...intent,assetId:lineageId,transactionId:tx.id,outpoints,unsignedArkTx,unsignedCheckpoints,source,outputs,
    exposureSats:canonical.exposureSats,budgetSats:canonical.exposureSats,feeSats:0 as const};
  return Object.freeze({...result,fingerprint:assetHash(result)});
}

/** Zero is accepted only as an explicit, fingerprint-bound, conserved plan
 * result. Missing cost/fee/input evidence never defaults to zero.
 */
export function assetBudgetSats(plan:AssetPlan|undefined,maximumSats=1000):number{
  if(!plan||!Number.isSafeInteger(maximumSats)||maximumSats<1||maximumSats>1000||
    !['mint','delivery','burn'].includes(plan.step)||!Number.isSafeInteger(plan.exposureSats)||plan.exposureSats<0||plan.exposureSats>maximumSats||
    plan.feeSats!==0||!Number.isSafeInteger(plan.budgetSats)||plan.budgetSats!==plan.exposureSats||
    plan.exposureSats!==(plan.step==='delivery'?plan.carrierSats:0)||!Array.isArray(plan.source)||!plan.source.length||plan.source.length>100||
    !Array.isArray(plan.outpoints)||plan.outpoints.length!==plan.source.length||new Set(plan.outpoints).size!==plan.outpoints.length||
    plan.source.some((coin,index)=>!/^[a-f0-9]{64}$/.test(coin.txid)||!Number.isSafeInteger(coin.vout)||coin.vout<0||coin.vout>0xffffffff||
      !Number.isSafeInteger(coin.value)||coin.value<1||!/^5120[a-f0-9]{64}$/.test(coin.script)||plan.outpoints[index]!==`${coin.txid}:${coin.vout}`)||
    !Array.isArray(plan.outputs)||!plan.outputs.length||plan.outputs.some(coin=>!Number.isSafeInteger(coin.value)||coin.value<1||!/^5120[a-f0-9]{64}$/.test(coin.script)))throw fail();
  const {fingerprint,...bound}=plan;if(fingerprint!==assetHash(bound))throw fail();
  const tx=decodeAssetTransaction(plan.unsignedArkTx),checkpoints=plan.unsignedCheckpoints.map(decodeAssetTransaction);
  const inputValue=plan.source.reduce((sum,coin)=>sum+BigInt(coin.value),0n),outputValue=Array.from({length:tx.outputsLength},(_,index)=>tx.getOutput(index).amount??0n).reduce((sum,value)=>sum+value,0n);
  if(tx.id!==plan.transactionId||inputValue!==outputValue||plan.outputs.reduce((sum,coin)=>sum+BigInt(coin.value),0n)!==inputValue)throw fail();
  const gameScript=plan.source[0].script;
  if(plan.source.some(coin=>coin.script!==gameScript)||tx.inputsLength!==plan.source.length||checkpoints.length!==plan.source.length||
    plan.outputs.some(coin=>coin.txid!==tx.id||!Number.isSafeInteger(coin.vout)||coin.vout<0||coin.vout>=tx.outputsLength||
      tx.getOutput(coin.vout).amount!==BigInt(coin.value)||hex.encode(tx.getOutput(coin.vout).script??new Uint8Array())!==coin.script))throw fail();
  let retained=0n;
  for(let index=0;index<tx.outputsLength;index++){const output=tx.getOutput(index);if(output.script&&hex.encode(output.script)===gameScript)retained+=output.amount??0n;}
  if(inputValue-retained!==BigInt(plan.exposureSats))throw fail();
  for(const coin of plan.source){
    const candidates=checkpoints.filter(checkpoint=>checkpoint.inputsLength===1&&hex.encode(checkpoint.getInput(0).txid??new Uint8Array())===coin.txid&&checkpoint.getInput(0).index===coin.vout);
    if(candidates.length!==1||candidates[0].getInput(0).witnessUtxo?.amount!==BigInt(coin.value)||
      hex.encode(candidates[0].getInput(0).witnessUtxo?.script??new Uint8Array())!==coin.script||
      !Array.from({length:tx.inputsLength},(_,index)=>tx.getInput(index)).some(input=>hex.encode(input.txid??new Uint8Array())===candidates[0].id&&input.index===0))throw fail();
  }
  return plan.budgetSats;
}

/** Signed originals may add signatures, never replace wire/PSBT intent. */
export function inspectAssetSubmission(body:any,plan:AssetPlan){
  if(typeof body?.signedArkTx!=='string'||!Array.isArray(body.checkpointTxs)||body.checkpointTxs.length!==plan.unsignedCheckpoints.length)throw fail();
  const root=decodeAssetTransaction(body.signedArkTx),expected=decodeAssetTransaction(plan.unsignedArkTx);
  if(root.id!==plan.transactionId)throw fail();
  // Check all non-signature PSBT fields as well as unsigned transaction bytes.
  assertCanonicalSigningTransaction(root,expected);
  for(let index=0;index<root.inputsLength;index++)verifyTapscriptSignatures(root,index,[plan.gamePublicKey]);
  const checkpoints=body.checkpointTxs.map(decodeAssetTransaction);
  for(const original of plan.unsignedCheckpoints){const tx=decodeAssetTransaction(original),matches=checkpoints.filter((item:Transaction)=>item.id===tx.id);if(matches.length!==1)throw fail();assertCanonicalSigningTransaction(matches[0],tx);verifyTapscriptSignatures(matches[0],0,[plan.gamePublicKey]);}
  return {transactionId:root.id,checkpointIds:checkpoints.map((checkpoint:Transaction)=>checkpoint.id)};
}

export function inspectAssetFinalization(body:any,plan:AssetPlan){
  if(body?.arkTxid!==plan.transactionId||!Array.isArray(body.finalCheckpointTxs)||body.finalCheckpointTxs.length!==plan.unsignedCheckpoints.length)throw fail();
  const actual=body.finalCheckpointTxs.map(decodeAssetTransaction);
  for(const encoded of plan.unsignedCheckpoints){
    const expected=decodeAssetTransaction(encoded),matches=actual.filter((tx:Transaction)=>tx.id===expected.id);
    if(matches.length!==1)throw fail();assertCanonicalSigningTransaction(matches[0],expected);verifyTapscriptSignatures(matches[0],0,[plan.gamePublicKey]);
  }
}

/** Real receipt verification uses original input spends, exact wire and every
 * carrier/allocation/change output. A balance delta or disappearance is not burn.
 */
export async function observeAssetReceipt(indexer:any,plan:AssetPlan){
  const requested=[...plan.source,...plan.outputs].map(({txid,vout})=>({txid,vout}));
  const response=await indexer.getVtxos({outpoints:requested});
  if(response.page||!Array.isArray(response.vtxos)||response.vtxos.length!==requested.length)throw fail();
  const map=new Map<string,any>(response.vtxos.map((coin:any)=>[`${coin.txid}:${coin.vout}`,coin]));if(map.size!==requested.length)throw fail();
  const assets=(items:any[])=>items.map(item=>({assetId:item.assetId,amount:String(item.amount)})).sort((a,b)=>a.assetId.localeCompare(b.assetId));
  for(const coin of [...plan.source,...plan.outputs]){const actual=map.get(`${coin.txid}:${coin.vout}`);if(!actual||actual.value!==coin.value||actual.script!==coin.script||!isDeepStrictEqual(assets(actual.assets??[]),coin.assets))throw fail();}
  const checkpoints=plan.unsignedCheckpoints.map(decodeAssetTransaction),ids=checkpoints.map(tx=>tx.id);
  for(const coin of plan.source){const actual=map.get(`${coin.txid}:${coin.vout}`),expected=checkpoints.find(tx=>hex.encode(tx.getInput(0).txid!)===coin.txid&&tx.getInput(0).index===coin.vout);if(!actual.isSpent||!expected||actual.spentBy!==expected.id)throw fail();}
  const wire=await indexer.getVirtualTxs([plan.transactionId,...ids]),decoded=wire.txs.map(decodeAssetTransaction);
  for(const encoded of [plan.unsignedArkTx,...plan.unsignedCheckpoints]){const expected=decodeAssetTransaction(encoded),matches=decoded.filter((tx:Transaction)=>tx.id===expected.id);if(matches.length!==1||!isDeepStrictEqual(matches[0].unsignedTx,expected.unsignedTx))throw fail();}
  return {verified:true,authorizationMode:plan.authorizationMode,step:plan.step,transactionId:plan.transactionId,assetId:plan.assetId,
    mintedQuantity:plan.step==='mint'?(plan.authorizationMode==='owner'?'2':'1'):undefined,deliveredQuantity:plan.step==='delivery'?'1':undefined,burnedQuantity:plan.step==='burn'?'1':undefined,
    feeSats:0,budgetSats:assetBudgetSats(plan),carrierSats:plan.carrierSats,sourceOutpoints:plan.outpoints,outputs:plan.outputs,checkpointIds:ids};
}
