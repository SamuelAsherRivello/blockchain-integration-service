import {VtxoScript,Transaction} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import type {ContractRecord} from '../state-layer-core/contracts.ts';
import type {ContractRecovery} from '../state-layer-core/contract-storage.ts';
import {operatorFor} from './account.ts';
import {TREASURE_EMULATOR} from './treasure-capability.ts';
import {buildTreasureScript} from './treasure-script.ts';
import {inspectTreasureSpendPlan} from './treasure-spend-plan.ts';
import {validateTreasureStageRecovery} from '../state-layer-core/treasure-staged-recovery.ts';

/** Authenticate original local intent before receipt lookup or identical-request replay.
 * This does not establish remote admission and never changes an uncertain operation.
 */
export function inspectTreasureRecoveryPlan(record:ContractRecord,recovery:ContractRecovery) {
  try {
    if(recovery.treasureArtifactVersion===3){
      validateTreasureStageRecovery(record,recovery);
      const stage=recovery.treasureStage;
      if(!stage||!['claim','refund'].includes(record.operation.kind)||!['submitted','unknown'].includes(record.operation.submission))throw Error();
      return Object.freeze({transactionId:Transaction.fromPSBT(base64.decode(stage.binding.original.arkTx)).id,
        checkpointTransactionId:Transaction.fromPSBT(base64.decode(stage.binding.original.checkpoints[0])).id});
    }
    const t=recovery.treasure,fund=recovery.fundingOutput,spend=recovery.spend,saved=recovery.emulatorSubmission;
    if(!t||!fund||!spend||!saved||record.purpose!=='treasureLTO'||record.validationMode!=='arkade-covenant-v2'||
      t.network!=='mutinynet'||record.scope.network!==t.network||record.scope.operator!==operatorFor(t.network)||
      record.scope.playerId===record.scope.gameId||record.amountSats!==1000||
      t.offerSessionId!==record.sessionId||t.hostReference!==record.hostReference||t.startedAtMs!==record.startedAt||
      (Math.floor(t.startedAtMs/1000)+90)*1000!==record.expiresAt||
      t.player!==recovery.playerKey||t.game!==recovery.gameKey||t.operator!==recovery.operatorKey||
      String(t.exitDelay)!==recovery.exitDelay||t.emulator!==TREASURE_EMULATOR.key.slice(2)||
      !['claim','refund'].includes(record.operation.kind)||!['submitted','unknown'].includes(record.operation.submission)||
      spend.operationId!==record.operation.id||saved.transactionId!==spend.transactionId||
      fund.value!==1000||spend.amountSats!==1000||spend.change!==undefined||spend.inputs.length!==1||
      spend.inputs[0].txid!==fund.txid||spend.inputs[0].vout!==fund.vout||spend.inputs[0].value!==fund.value)throw Error();
    const built=buildTreasureScript(t);
    const playerScript=hex.encode(VtxoScript.decode(hex.decode(recovery.playerScript)).pkScript);
    const gameScript=hex.encode(VtxoScript.decode(hex.decode(recovery.gameScript)).pkScript);
    const destination=record.operation.kind==='claim'?playerScript:gameScript;
    if(hex.encode(built.script.encode())!==recovery.contractScript||
      playerScript!=='5120'+t.playerDestination||gameScript!=='5120'+t.gameDestination||
      spend.destinationScript!==destination)throw Error();
    const plan=inspectTreasureSpendPlan(saved.arkTx,saved.checkpoints,{
      funding:{...fund,script:hex.encode(built.script.pkScript)},destinationScript:destination,
      participantKeys:record.operation.kind==='claim'?[t.player]:[t.game],
    });
    if(plan.transactionId!==saved.transactionId)throw Error();
    return plan;
  }catch {
    // PSBT/parser exceptions may contain private recovery material.
    throw Error('Treasure recovery does not match its original contract. Existing funds remain reserved.');
  }
}
