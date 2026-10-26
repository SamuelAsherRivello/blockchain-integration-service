import test from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey,DefaultVtxo} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {allocateAuthorizedTreasureRecovery} from '../../src/client/wallet-layer-arkade/treasure-authorized-recovery.ts';
import {emptyContractLedger,startLto,finishContractOperation} from '../../src/client/state-layer-core/contracts.ts';
import {TREASURE_EMULATOR} from '../../src/client/wallet-layer-arkade/treasure-capability.ts';
import {inspectLtoRecoveryDescriptor} from '../../src/client/wallet-layer-arkade/lto-recovery-descriptor.ts';
import {createContractStorage,type ContractBackend} from '../../src/client/state-layer-core/contract-storage.ts';

test('explicit V4 allocation persists the original terms before funding and cannot upgrade a funded record',async()=>{
  const [player,game,operator]=await Promise.all([1,2,3].map(async n=>hex.encode(await SingleKey.fromHex(n.toString(16).padStart(64,'0')).xOnlyPublicKey())));
  const defaults={serverPubKey:hex.decode(operator),csvTimelock:{type:'seconds' as const,value:2048n}};
  const playerScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(player)}),gameScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(game)});
  const request={id:'new-explicit-v4',operationId:'new-funding',sessionId:'original-offer',purpose:'treasureLTO',hostReference:'original-run',
    amountSats:1000,startedAt:1_800_000_000_123,expiresAt:1_800_000_090_000,
    scope:{network:'mutinynet' as const,operator:'https://mutinynet.arkade.sh',playerId:'original-player',gameId:'original-game',exclusivityKey:'original-slot'}};
  const allocation=startLto(emptyContractLedger(),request,request.startedAt),record={...allocation.contract!,validationMode:'arkade-covenant-v2' as const};
  const terms={network:'mutinynet' as const,offerSessionId:request.sessionId,hostReference:request.hostReference,startedAtMs:request.startedAt,
    player,game,operator,emulator:TREASURE_EMULATOR.key.slice(2),playerDestination:hex.encode(playerScript.pkScript.slice(2)),
    gameDestination:hex.encode(gameScript.pkScript.slice(2)),exitDelay:2048};
  const recovery=allocateAuthorizedTreasureRecovery(record,terms);assert.equal(recovery.treasureArtifactVersion,4);
  assert.equal(Object.isFrozen(recovery),true);assert.equal(Object.isFrozen(recovery.treasure),true);
  let envelope:Awaited<ReturnType<ContractBackend['read']>>;
  const storage=createContractStorage({read:async()=>structuredClone(envelope),write:async(value,revision)=>{
    assert.equal(envelope?.revision??0,revision);envelope=structuredClone(value);
  }},'mutinynet');
  const empty=await storage.load(),saved=await storage.save({...empty,ledger:{...allocation.ledger,contracts:[record]},recovery:{[record.id]:recovery}});
  assert.deepEqual((await storage.load()).recovery[record.id],recovery);assert.ok(await inspectLtoRecoveryDescriptor(saved.ledger.contracts[0],saved.recovery[record.id]));
  const funded=finishContractOperation(record,{operationId:record.operation.id,kind:'fund',outcome:'confirmed'});
  assert.throws(()=>allocateAuthorizedTreasureRecovery(funded,terms));
  for(const changed of [{...terms,startedAtMs:terms.startedAtMs+1000},{...terms,hostReference:'another-run'},
    {...terms,emulator:operator},{...terms,playerDestination:gameScript.pkScript.slice(2).toString()}])assert.throws(()=>allocateAuthorizedTreasureRecovery(record,changed));
  assert.throws(()=>allocateAuthorizedTreasureRecovery({...record,operation:{...record.operation,submission:'unknown'}},terms));
});
