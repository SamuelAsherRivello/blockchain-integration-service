import type {ContractRecord} from '../state-layer-core/contracts.ts';
import type {ContractRecovery} from '../state-layer-core/contract-storage.ts';
import {validateTreasureServerRecovery} from '../state-layer-core/treasure-server-recovery.ts';
import {advanceTreasureServerJournal} from './treasure-server-journal.ts';
import type {TreasureServerPersistence} from './server-wallet.ts';
import type {createTreasureServerTransport} from './treasure-server-transport.ts';

type Factory=(persistence:TreasureServerPersistence)=>Promise<Pick<ReturnType<typeof createTreasureServerTransport>,'recover'>>;
const fail=()=>Error('Original Treasure signing result remains unavailable. Original operations remain reserved.');
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);

/** One bounded original-result lookup per controller reconciliation pass. The
 * supplied capability has no planning, request allocation or signing method.
 * Each authenticated result is saved through the controller's current CAS. */
export async function recoverOriginalTreasureSigning(record:ContractRecord,recovery:ContractRecovery,
  factory:Factory,commit:(recovery:ContractRecovery)=>Promise<void>,isCurrent:()=>boolean):Promise<void>{
  const current=()=>{if(!isCurrent())throw fail();};
  current();validateTreasureServerRecovery(record,recovery);
  const entry=Object.entries(recovery.treasureServerJournals??{}).find(([_id,journal])=>
    journal.requests.some(request=>request.phase==='sign-pending'||request.phase==='sign-unknown'));
  if(!entry)return;
  const [operationId,original]=entry,request=original.requests.find(value=>value.phase==='sign-pending'||value.phase==='sign-unknown')!;
  let material=recovery;
  const transport=await factory({isCurrent,
    read:async()=>{current();const journal=material.treasureServerJournals?.[operationId];if(!journal)throw fail();return journal;},
    commit:async(before,after)=>{
      current();const saved=material.treasureServerJournals?.[operationId];if(!saved||!same(before,saved))throw fail();
      const previous=before.requests.find(value=>value.id===request.id),observed=after.requests.find(value=>value.id===request.id);
      if(!previous||!['sign-pending','sign-unknown'].includes(previous.phase)||observed?.phase!=='completed'||
        after.requests.length!==before.requests.length||before.requests.some((value,index)=>value.id!==request.id&&!same(value,after.requests[index])))throw fail();
      advanceTreasureServerJournal(before,after);
      const next={...material,treasureServerJournals:{...material.treasureServerJournals,[operationId]:after}};
      validateTreasureServerRecovery(record,next);await commit(next);current();material=next;
    },
  });
  current();await transport.recover(request.id);current();
}
