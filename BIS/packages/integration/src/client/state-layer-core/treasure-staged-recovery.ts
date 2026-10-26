import {DefaultVtxo,Transaction} from '@arkade-os/sdk';
import {base64,hex} from '@scure/base';
import type {ContractRecovery} from './contract-storage.ts';
import type {ContractRecord} from './contracts.ts';
import {testNetwork} from './test-network.ts';
import {TREASURE_EMULATOR} from '../wallet-layer-arkade/treasure-capability.ts';
import {buildStagedTreasureScript} from '../wallet-layer-arkade/treasure-staged-script.ts';
import {buildAuthorizedTreasureScript} from '../wallet-layer-arkade/treasure-authorized-script.ts';
import {advanceStagedTreasureState,validateStagedTreasureBinding,validateStagedTreasureState,
  type StagedTreasureBinding,type StagedTreasureState} from '../wallet-layer-arkade/treasure-staged-state.ts';

export type TreasureStageRecovery=Readonly<{binding:StagedTreasureBinding;state:StagedTreasureState}>;
const deny=()=>Error('Staged treasure recovery could not be verified. Original funds remain reserved.');
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(key=>[key,(v as Record<string,unknown>)[key]])):v);
const same=(a:unknown,b:unknown)=>stable(a)===stable(b);

/** Authenticate a new artifact explicitly. An absent version always means the
 * original v2 path, even if current provider capabilities have changed. */
export function validateTreasureStageRecovery(record:ContractRecord,recovery:ContractRecovery):void {
  try {
    const version=recovery.treasureArtifactVersion,stage=recovery.treasureStage;
    if(version===undefined){if(stage!==undefined)throw deny();return;}
    const terms=recovery.treasure;
    if(![3,4].includes(version)||!terms||terms.network!=='mutinynet'||record.scope.network!==terms.network||
      record.scope.operator!==testNetwork(terms.network).operator||record.purpose!=='treasureLTO'||
      record.amountSats!==1000||record.validationMode!=='arkade-covenant-v2'||recovery.secretHex!==undefined||
      recovery.emulatorSubmission!==undefined||terms.emulator!==TREASURE_EMULATOR.key.slice(2)||
      terms.offerSessionId!==record.sessionId||terms.hostReference!==record.hostReference||terms.startedAtMs!==record.startedAt||
      terms.player!==recovery.playerKey||terms.game!==recovery.gameKey||terms.operator!==recovery.operatorKey||
      String(terms.exitDelay)!==recovery.exitDelay)throw deny();
    const defaults={serverPubKey:hex.decode(terms.operator),csvTimelock:{type:'seconds' as const,value:BigInt(terms.exitDelay)}};
    const player=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(terms.player)});
    const game=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(terms.game)});
    const built=version===4?buildAuthorizedTreasureScript(terms):buildStagedTreasureScript(terms);
    if(built.deadlineSeconds*1000!==record.expiresAt||hex.encode(built.script.encode())!==recovery.contractScript||
      hex.encode(player.encode())!==recovery.playerScript||hex.encode(game.encode())!==recovery.gameScript||
      hex.encode(player.pkScript)!=='5120'+terms.playerDestination||hex.encode(game.pkScript)!=='5120'+terms.gameDestination)throw deny();
    // The artifact is allocated before funding. Its spend-stage journal can
    // only be prepared once the actual funding output/transaction are known.
    if(stage===undefined)return;
    if(!stage||typeof stage!=='object'||Array.isArray(stage)||Object.keys(stage).sort().join(',')!=='binding,state')throw deny();
    validateStagedTreasureBinding(stage.binding);validateStagedTreasureState(stage.state,stage.binding);
    const binding=stage.binding,spend=recovery.spend,funding=recovery.fundingOutput;
    if(binding.artifactVersion!==version||binding.contractId!==record.id||binding.operationId!==record.operation.id||record.operation.kind==='fund'||
      !same(binding.terms,terms)||!same(binding.funding,funding)||!spend||spend.operationId!==binding.operationId||
      spend.transactionId!==Transaction.fromPSBT(base64.decode(binding.original.arkTx)).id||
      spend.amountSats!==1000||spend.change!==undefined||spend.inputs.length!==1||!same(spend.inputs[0],funding)||
      spend.destinationScript!==(binding.branch==='claim'?hex.encode(player.pkScript):hex.encode(game.pkScript))||
      (record.operation.kind==='claim')!==(binding.branch==='claim')||
      binding.branch==='reject'&&record.ended!=='rejected'||binding.branch==='cancel'&&record.ended!=='session-ended'||
      record.operation.submission==='not-submitted'&&stage.state.phase!=='prepared')throw deny();
  }catch{throw deny();}
}

/** Called inside the existing encrypted document CAS. Same-operation writes
 * may retain a stage or persist exactly its next event, never skip or rewind. */
export function advanceTreasureStageRecovery(beforeRecord:ContractRecord,afterRecord:ContractRecord,
  before:ContractRecovery,after:ContractRecovery):void {
  try {
    if(before.treasureArtifactVersion!==after.treasureArtifactVersion)throw deny();
    const previous=before.treasureStage,next=after.treasureStage;
    if(beforeRecord.operation.id!==afterRecord.operation.id){
      if(previous&&(beforeRecord.operation.submission!=='not-submitted'||previous.state.phase!=='prepared'))throw deny();
      if(next&&(next.state.phase!=='prepared'||next.state.history.length!==1))throw deny();
      return;
    }
    if(!previous){if(next&&(next.state.phase!=='prepared'||next.state.history.length!==1))throw deny();return;}
    if(!next||!same(previous.binding,next.binding))throw deny();
    if(!same(previous.state,next.state))advanceStagedTreasureState(previous.state,next.state,next.binding);
  }catch{throw deny();}
}
