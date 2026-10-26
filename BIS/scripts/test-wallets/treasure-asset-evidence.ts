import {Transaction,Extension,createAssetPacket} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';

type Asset={assetId:string;amount:string|bigint};
type Source={txid:string;vout:number;value:number;assets?:Asset[]};
export function assetManifest(coins:readonly {assets?:readonly Asset[]}[]){
  const totals=new Map<string,bigint>();
  for(const coin of coins)for(const asset of coin.assets??[]){
    const amount=String(asset.amount);
    if(!/^[a-f0-9]{68}$/.test(asset.assetId)||!/^[1-9][0-9]*$/.test(amount))throw Error('asset-manifest-invalid');
    totals.set(asset.assetId,(totals.get(asset.assetId)??0n)+BigInt(amount));
  }
  return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([assetId,amount])=>({assetId,amount:String(amount)}));
}

/** Independent live index and wire proof. The setup transfer is not this proof. */
export async function verifyTreasureAssetFunding(indexer,{fundingTxid,contractScript,gameScript,inputs}:{fundingTxid:string;contractScript:string;gameScript:string;inputs:Source[]}){
  const expectedAssets=assetManifest(inputs),total=inputs.reduce((sum,c)=>sum+c.value,0),change=total-1000;
  if(!expectedAssets.length||change<330||!Number.isSafeInteger(total)||new Set(inputs.map(c=>c.txid+':'+c.vout)).size!==inputs.length)throw Error('asset-funding-precondition');
  const {vtxos}=await indexer.getVtxos({outpoints:[...inputs.map(({txid,vout})=>({txid,vout})),{txid:fundingTxid,vout:0},{txid:fundingTxid,vout:1}]});
  const sources=inputs.map(input=>vtxos.find(c=>c.txid===input.txid&&c.vout===input.vout));
  const sameAssets=(coins,expected)=>JSON.stringify(assetManifest(coins))===JSON.stringify(expected);
  const contract=vtxos.find(c=>c.txid===fundingTxid&&c.vout===0),retained=vtxos.find(c=>c.txid===fundingTxid&&c.vout===1);
  if(sources.some((coin,i)=>!coin?.isSpent||coin.arkTxId!==fundingTxid||coin.script!==gameScript||coin.value!==inputs[i].value||!/^[a-f0-9]{64}$/.test(coin.spentBy??'')||!sameAssets([coin],assetManifest([inputs[i]])))||
    !contract||contract.script!==contractScript||contract.value!==1000||contract.assets?.length||
    !retained||retained.script!==gameScript||retained.value!==change||!sameAssets([retained],expectedAssets))throw Error('asset-funding-index-mismatch');
  const wire=await indexer.getVirtualTxs([fundingTxid,...sources.map(c=>c.spentBy)]);
  const txs=wire.txs.map(encoded=>/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded)));
  const funding=txs.find(tx=>tx.id===fundingTxid);
  if(!funding||funding.inputsLength!==inputs.length||funding.outputsLength!==4)throw Error('asset-funding-wire-mismatch');
  for(let i=0;i<inputs.length;i++){
    const checkpoint=txs.find(tx=>tx.id===sources[i].spentBy),input=funding.getInput(i);
    if(!checkpoint||checkpoint.inputsLength!==1||checkpoint.outputsLength!==2||
      hex.encode(checkpoint.getInput(0).txid)!==inputs[i].txid||checkpoint.getInput(0).index!==inputs[i].vout||
      checkpoint.getOutput(0).amount!==BigInt(inputs[i].value)||hex.encode(checkpoint.getOutput(1).script)!=='51024e73'||checkpoint.getOutput(1).amount!==0n||
      hex.encode(input.txid)!==checkpoint.id||input.index!==0)throw Error('asset-funding-checkpoint-mismatch');
  }
  const extension=Extension.create([createAssetPacket(new Map(inputs.map((coin,i)=>[i,(coin.assets??[]).map(asset=>({...asset,amount:BigInt(asset.amount)}))])),
    [{address:'',amount:1000}],{address:'',amount:change,assets:expectedAssets.map(asset=>({...asset,amount:BigInt(asset.amount)}))})]).txOut();
  const expected=[{amount:1000n,script:contractScript},{amount:BigInt(change),script:gameScript},{amount:0n,script:hex.encode(extension.script)},{amount:0n,script:'51024e73'}];
  if(expected.some((output,i)=>funding.getOutput(i).amount!==output.amount||hex.encode(funding.getOutput(i).script)!==output.script))throw Error('asset-funding-wire-mismatch');
  return {fundingTxid,contractVout:0,amountSats:1000,changeVout:1,changeSats:change,retainedAssets:expectedAssets,
    sourceOutpoints:inputs.map(({txid,vout})=>({txid,vout})),checkpointTxids:sources.map(c=>c.spentBy)};
}
