import {DefaultVtxo} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import type {ContractRecord} from '../state-layer-core/contracts.ts';
import type {ContractRecovery} from '../state-layer-core/contract-storage.ts';
import {testNetwork} from '../state-layer-core/test-network.ts';
import {TREASURE_EMULATOR} from './treasure-capability.ts';
import {buildAuthorizedTreasureScript} from './treasure-authorized-script.ts';
import type {TreasureScriptTerms} from './treasure-script.ts';

/** Allocate a NEW V4 descriptor before its first durable funding preparation.
 * This pure factory neither upgrades an existing descriptor nor selects V4 as
 * the default. Provider/identity/capability checks remain the caller's duty.
 */
export function allocateAuthorizedTreasureRecovery(record:ContractRecord,terms:TreasureScriptTerms):ContractRecovery{
  try{
    if(record.purpose!=='treasureLTO'||record.financial!=='funding'||record.operation.kind!=='fund'||record.operation.submission!=='prepared'||
      record.recoveryRequired||record.amountSats!==1000||record.scope.network!=='mutinynet'||terms.network!=='mutinynet'||
      record.scope.operator!==testNetwork('mutinynet').operator||record.scope.playerId===record.scope.gameId||
      terms.emulator!==TREASURE_EMULATOR.key.slice(2)||terms.offerSessionId!==record.sessionId||terms.hostReference!==record.hostReference||
      terms.startedAtMs!==record.startedAt||record.validationMode!==undefined&&record.validationMode!=='arkade-covenant-v2')throw Error();
    const built=buildAuthorizedTreasureScript(terms);
    if(built.deadlineSeconds*1000!==record.expiresAt)throw Error();
    const defaults={serverPubKey:hex.decode(terms.operator),csvTimelock:{type:'seconds' as const,value:BigInt(terms.exitDelay)}};
    const player=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(terms.player)}),game=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(terms.game)});
    if(hex.encode(player.pkScript)!=='5120'+terms.playerDestination||hex.encode(game.pkScript)!=='5120'+terms.gameDestination)throw Error();
    return Object.freeze({treasureArtifactVersion:4,treasure:Object.freeze({...terms}),playerKey:terms.player,gameKey:terms.game,
      operatorKey:terms.operator,exitDelay:String(terms.exitDelay),playerScript:hex.encode(player.encode()),gameScript:hex.encode(game.encode()),
      contractScript:hex.encode(built.script.encode())});
  }catch{throw Error('A new authorized Treasure descriptor could not be allocated with its original terms.');}
}
