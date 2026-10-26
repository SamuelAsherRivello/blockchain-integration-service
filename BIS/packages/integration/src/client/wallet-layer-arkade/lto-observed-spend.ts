import {Transaction,VtxoScript,type RestIndexerProvider} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import type {ContractRecord} from '../state-layer-core/contracts.ts';
import type {ContractRecovery} from '../state-layer-core/contract-storage.ts';

/** Discover a different device's real spend through the contract -> checkpoint -> payout chain. */
export async function observeOtherLtoSpend(indexer:Pick<RestIndexerProvider,'getVtxos'|'getVirtualTxs'>,
  record:ContractRecord,recovery:ContractRecovery,contractScript:string):Promise<{record:ContractRecord;recovery:ContractRecovery}|undefined> {
  const fund=recovery.fundingOutput;
  if(!fund)return;
  const {vtxos}=await indexer.getVtxos({outpoints:[fund]});
  const source=vtxos.find(c=>c.txid===fund.txid&&c.vout===fund.vout);
  if(!source||source.value!==record.amountSats||source.script!==contractScript||source.assets?.length||source.isUnrolled||source.isSwept)return;
  if(!source.isSpent&&!source.spentBy)return {record:{...record,recoveryRequired:false},recovery};
  if(!/^[a-f0-9]{64}$/.test(source.spentBy??'')||!/^[a-f0-9]{64}$/.test(source.arkTxId??''))return;
  const wire=await indexer.getVirtualTxs([source.spentBy!,source.arkTxId!]);
  const txs=wire.txs.map(encoded=>/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded)));
  const checkpoint=txs.find(tx=>tx.id===source.spentBy),spend=txs.find(tx=>tx.id===source.arkTxId);
  const spends=(tx:Transaction|undefined,txid:string,vout:number)=>tx?.inputsLength===1&&
    !!tx.getInput(0).txid&&hex.encode(tx.getInput(0).txid!)===txid&&tx.getInput(0).index===vout;
  if(!spends(checkpoint,fund.txid,fund.vout)||!checkpoint||checkpoint.outputsLength!==2||checkpoint.getOutput(0).amount!==BigInt(record.amountSats)||
    !spends(spend,checkpoint.id,0)||!spend||spend.getOutput(0).amount!==BigInt(record.amountSats)||!spend.getOutput(0).script)return;
  const destination=hex.encode(spend.getOutput(0).script!);
  const player=hex.encode(VtxoScript.decode(hex.decode(recovery.playerScript)).pkScript),game=hex.encode(VtxoScript.decode(hex.decode(recovery.gameScript)).pkScript);
  const kind=destination===player?'claim':destination===game?'refund':undefined;
  if(!kind)return;
  const payout=(await indexer.getVtxos({outpoints:[{txid:spend.id,vout:0}]})).vtxos.find(c=>c.txid===spend.id&&c.vout===0);
  if(!payout||payout.value!==record.amountSats||payout.script!==destination||payout.assets?.length)return;
  const operationId=`observed:${spend.id}`;
  return {record:{...record,recoveryRequired:false,financial:kind==='claim'?'claimed' as const:'refunded' as const,
    operation:{id:operationId,kind,submission:'confirmed' as const}},
    recovery:{...recovery,submission:undefined,emulatorSubmission:undefined,finalization:undefined,
      observedPrevious:recovery.observedPrevious??JSON.stringify({operation:record.operation,spend:recovery.spend,
        submission:recovery.submission,emulatorSubmission:recovery.emulatorSubmission,finalization:recovery.finalization}),
      spend:{operationId,transactionId:spend.id,inputs:[fund],destinationScript:destination,amountSats:record.amountSats}}};
}
