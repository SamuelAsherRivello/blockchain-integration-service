import {DefaultVtxo} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import type {ContractRecord} from '../state-layer-core/contracts.ts';
import type {ContractRecovery} from '../state-layer-core/contract-storage.ts';
import {operatorFor} from './account.ts';
import {buildLtoScript} from './lto-script.ts';
import {buildTreasureScript} from './treasure-script.ts';
import {buildStagedTreasureScript} from './treasure-staged-script.ts';
import {buildAuthorizedTreasureScript} from './treasure-authorized-script.ts';
import {validateTreasureStageRecovery} from '../state-layer-core/treasure-staged-recovery.ts';
import {TREASURE_EMULATOR} from './treasure-capability.ts';

/** Recompile imported private descriptors. Never trust an imported script/address alone. */
export async function inspectLtoRecoveryDescriptor(record:ContractRecord,r:ContractRecovery):Promise<string> {
  try {
    const network=record.scope.network;
    validateTreasureStageRecovery(record,r);
    if(!['signet','mutinynet'].includes(network)||record.scope.operator!==operatorFor(network as 'signet'|'mutinynet'))throw Error();
    const defaults={serverPubKey:hex.decode(r.operatorKey),csvTimelock:{type:'seconds' as const,value:BigInt(r.exitDelay)}};
    const player=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(r.playerKey)});
    const game=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(r.gameKey)});
    if(hex.encode(player.encode())!==r.playerScript||hex.encode(game.encode())!==r.gameScript)throw Error();
    let script;
    if(r.treasure){
      const t=r.treasure;
      if(network!=='mutinynet'||record.validationMode!=='arkade-covenant-v2'||record.amountSats!==1000||
        t.network!==network||t.player!==r.playerKey||t.game!==r.gameKey||t.operator!==r.operatorKey||String(t.exitDelay)!==r.exitDelay||
        t.offerSessionId!==record.sessionId||t.hostReference!==record.hostReference||t.startedAtMs!==record.startedAt||
        (Math.floor(t.startedAtMs/1000)+90)*1000!==record.expiresAt||t.emulator!==TREASURE_EMULATOR.key.slice(2)||
        hex.encode(player.pkScript)!=='5120'+t.playerDestination||hex.encode(game.pkScript)!=='5120'+t.gameDestination)throw Error();
      script=r.treasureArtifactVersion===4?buildAuthorizedTreasureScript(t).script:r.treasureArtifactVersion===3?buildStagedTreasureScript(t).script:buildTreasureScript(t).script;
    }else{
      if(record.validationMode==='arkade-covenant-v2'||!r.secretHex)throw Error();
      const secretHash=new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(hex.decode(r.secretHex))));
      script=buildLtoScript({playerKey:hex.decode(r.playerKey),gameKey:hex.decode(r.gameKey),
        operatorKey:hex.decode(r.operatorKey),secretHash,exitDelay:BigInt(r.exitDelay)}).script;
    }
    if(hex.encode(script.encode())!==r.contractScript)throw Error();
    if(r.spend){
      const spend=r.spend,destination=hex.encode(record.operation.kind==='fund'?script.pkScript:record.operation.kind==='claim'?player.pkScript:game.pkScript);
      if(spend.operationId!==record.operation.id||spend.destinationScript!==destination||spend.amountSats!==record.amountSats||
        (spend.change&&spend.change.script!==hex.encode(game.pkScript)))throw Error();
      if(record.operation.kind!=='fund'){
        const fund=r.fundingOutput;
        if(!fund||spend.change||spend.inputs.length!==1||spend.inputs[0].txid!==fund.txid||
          spend.inputs[0].vout!==fund.vout||spend.inputs[0].value!==record.amountSats||fund.value!==record.amountSats)throw Error();
      }
    }
    return hex.encode(script.pkScript);
  }catch{throw Error('Original contract recovery binding could not be verified. Funds remain reserved.');}
}
