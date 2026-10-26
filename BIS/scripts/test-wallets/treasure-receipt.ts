import {Transaction} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';

// Read-only acceptance evidence. A same-value wallet payment is not a contract spend.
export async function verifyTreasureSpendReceipt(indexer, {fundingTxid,contractScript,spendTxid,destinationScript}) {
  const {vtxos}=await indexer.getVtxos({outpoints:[{txid:fundingTxid,vout:0},{txid:spendTxid,vout:0}]});
  const funding=vtxos.find(c=>c.txid===fundingTxid&&c.vout===0);
  const payout=vtxos.find(c=>c.txid===spendTxid&&c.vout===0);
  if(!funding?.isSpent||!/^[a-f0-9]{64}$/.test(funding.spentBy??'')||funding.value!==1000||funding.script!==contractScript||funding.assets?.length||
    !payout||payout.value!==1000||payout.script!==destinationScript||payout.assets?.length)throw Error('treasure-receipt-index-mismatch');
  const wire=await indexer.getVirtualTxs([funding.spentBy,spendTxid]);
  const txs=wire.txs.map(encoded=>/^[a-f0-9]+$/i.test(encoded)?Transaction.fromRaw(hex.decode(encoded)):Transaction.fromPSBT(base64.decode(encoded)));
  const checkpoint=txs.find(tx=>tx.id===funding.spentBy),spend=txs.find(tx=>tx.id===spendTxid);
  const spends=(tx,txid)=>tx?.inputsLength===1&&hex.encode(tx.getInput(0).txid)===txid&&tx.getInput(0).index===0;
  if(!spends(checkpoint,fundingTxid)||checkpoint.getOutput(0).amount!==1000n||!spends(spend,checkpoint.id)||
    spend.getOutput(0).amount!==1000n||hex.encode(spend.getOutput(0).script)!==destinationScript)throw Error('treasure-receipt-chain-mismatch');
  return {fundingTxid,fundingVout:0,checkpointTxid:checkpoint.id,spendTxid,payoutVout:0,amountSats:1000};
}
