import {Transaction,verifyTapscriptSignatures} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';

export type TreasureSpendBinding = Readonly<{
  funding: Readonly<{txid:string;vout:number;script:string}>;
  destinationScript:string;participantKeys:readonly string[];
}>;

/** Validate the exact contract -> checkpoint -> virtual spend chain before submission or recovery.
 * This verifies local intent and signatures, not remote admission or financial settlement.
 */
export function inspectTreasureSpendPlan(arkPsbt:string,checkpointPsbts:readonly string[],binding:TreasureSpendBinding) {
  const invalid=()=>Error('Treasure spend does not match its original binding.');
  if(checkpointPsbts.length!==1||!binding.participantKeys.length||
    ![binding.funding.txid,...binding.participantKeys].every(value=>/^[a-f0-9]{64}$/.test(value))||
    !Number.isSafeInteger(binding.funding.vout)||binding.funding.vout<0||
    !/^5120[a-f0-9]{64}$/.test(binding.funding.script)||!/^5120[a-f0-9]{64}$/.test(binding.destinationScript))throw invalid();
  const tx=Transaction.fromPSBT(base64.decode(arkPsbt));
  const checkpoint=Transaction.fromPSBT(base64.decode(checkpointPsbts[0]));
  if(tx.inputsLength!==1||tx.outputsLength!==3||checkpoint.inputsLength!==1||checkpoint.outputsLength!==2)throw invalid();
  const parent=checkpoint.getInput(0),input=tx.getInput(0),output=tx.getOutput(0),continuation=checkpoint.getOutput(0);
  if(!parent.txid||hex.encode(parent.txid)!==binding.funding.txid||parent.index!==binding.funding.vout||
    parent.witnessUtxo?.amount!==1000n||hex.encode(parent.witnessUtxo.script)!==binding.funding.script||
    !input.txid||hex.encode(input.txid)!==checkpoint.id||input.index!==0||
    input.witnessUtxo?.amount!==1000n||continuation.amount!==1000n||
    !continuation.script||hex.encode(input.witnessUtxo.script)!==hex.encode(continuation.script)||
    output.amount!==1000n||!output.script||hex.encode(output.script)!==binding.destinationScript||
    tx.getOutput(1).amount!==0n||tx.getOutput(1).script?.[0]!==0x6a)throw invalid();
  for(const candidate of [tx,checkpoint]){
    const anchor=candidate.getOutput(candidate.outputsLength-1);
    if(anchor.amount!==0n||!anchor.script||hex.encode(anchor.script)!=='51024e73')throw invalid();
    verifyTapscriptSignatures(candidate,0,[...binding.participantKeys]);
  }
  return Object.freeze({transactionId:tx.id,checkpointTransactionId:checkpoint.id});
}
