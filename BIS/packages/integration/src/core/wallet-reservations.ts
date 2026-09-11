import {readBoardingRecords} from './boarding-record.ts';
import {readSendRecords} from './sending.ts';
import {readContinuations} from './continuation.ts';
import {readAssetRecords} from './assets.ts';
import {readBurnRecords} from './burning.ts';
import {readAssetDeliveryRecords} from './asset-delivery.ts';
import {readContractReservations} from './contract-reservations.ts';
import {readAccountOnboarding} from './onboarding-record.ts';

export type ReservedOperation = {id:string; transactionId?:string; inputs?:readonly {txid:string;vout:number}[]; independent?:readonly {txid:string;vout:number}[]};
export class ReservationError extends Error {}
const journalKey=(profileId:string)=>`bis-signet-wallet-operations-v2:${encodeURIComponent(profileId)}`;
type Journal={version:2;profileId:string;operations:ReservedOperation[]};
function readJournal(profileId:string):Journal|undefined {
  const raw=localStorage.getItem(journalKey(profileId));if(raw===null)return;
  try {
    const value:Journal=JSON.parse(raw);
    if(value.version!==2||value.profileId!==profileId||!Array.isArray(value.operations)||new Set(value.operations.map(r=>r.id)).size!==value.operations.length)throw Error();
    for(const operation of value.operations) {
      if(typeof operation.id!=='string'||!operation.id)throw Error();
      if(operation.inputs!==undefined&&(!Array.isArray(operation.inputs)||!operation.inputs.length||operation.inputs.some(i=>!/^[a-f0-9]{64}$/i.test(i.txid)||!Number.isSafeInteger(i.vout)||i.vout<0)))throw Error();
    }
    return value;
  } catch {throw new ReservationError('Wallet reservation recovery data could not be verified.');}
}
/** Caller holds the wallet mutation lock. Legacy operation records are retained. */
export function migrateWalletReservations(profileId:string) {
  readJournal(profileId);
  const operations=walletReservations(profileId);
  const raw=JSON.stringify({version:2,profileId,operations} satisfies Journal),key=journalKey(profileId);
  localStorage.setItem(key,raw);
  if(localStorage.getItem(key)!==raw)throw new ReservationError('Wallet reservations could not be saved.');
}
export function walletReservations(profileId:string):ReservedOperation[] {
  const saved=readJournal(profileId);
  const operations:ReservedOperation[]=[];
  for(const r of readAccountOnboarding(profileId))if(r.status==='pending'&&r.plan)operations.push({id:`onboarding:${r.id}`,inputs:[...r.plan.inputs,...r.boarding.receipts??[],...r.returning.receipts??[]],independent:r.independent??[]});
  for(const r of readContractReservations())if(r.pending&&(r.gameId===profileId||r.playerId===profileId))operations.push({id:`contract:${r.id}`,inputs:r.inputs,transactionId:r.transactionId});
  for(const r of readBoardingRecords(profileId))if(r.status==='pending')operations.push({id:`transfer:${r.id}`,inputs:r.inputs});
  for(const r of readSendRecords(profileId))if(r.status==='pending')operations.push({id:`send:${r.id}`,inputs:r.inputs});
  for(const r of readContinuations(profileId))if(r.status==='pending')operations.push({id:`continue:${r.request.operationId}`,inputs:r.send?.inputs});
  for(const r of readAssetRecords(profileId))if(r.status==='pending')operations.push({id:`mint:${r.request.operationId}`,transactionId:r.transactionId});
  for(const burn of readBurnRecords(profileId))if(burn.status==='pending')operations.push({id:`burn:${burn.id}`,transactionId:burn.transactionId,inputs:burn.inputs});
  for(const delivery of readAssetDeliveryRecords(profileId))if(delivery.status==='pending')operations.push({id:`delivery:${delivery.id}`,transactionId:delivery.transactionId,inputs:delivery.inputs});
  return operations.map(operation=>{
    const recovered=saved?.operations.find(r=>r.id===operation.id&&r.transactionId===operation.transactionId);
    return !operation.inputs&&operation.transactionId&&recovered?.inputs?{...operation,inputs:recovered.inputs}:operation;
  });
}
/** Caller holds the mutation lock and has verified the transaction ancestry and ownership. */
export function saveReconstructedReservation(profileId:string,id:string,transactionId:string,inputs:NonNullable<ReservedOperation['inputs']>) {
  const operations=walletReservations(profileId),record=operations.find(r=>r.id===id&&r.transactionId===transactionId);
  if(!record||record.inputs)return;
  record.inputs=inputs;
  const raw=JSON.stringify({version:2,profileId,operations} satisfies Journal),key=journalKey(profileId);
  localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw new ReservationError('Recovered reservations could not be saved.');
  readJournal(profileId);
}
export function eligibleUnreservedCoins<T extends {txid:string;vout:number}>(coins:readonly T[], operations:readonly ReservedOperation[]):T[] {
  const reserved=new Set<string>();
  for(const operation of operations) {
    if(!operation.inputs?.length)throw new ReservationError('Pending operation inputs could not be verified. Open recovery details; receiving and inspection remain available.');
    for(const input of operation.inputs)reserved.add(`${input.txid}:${input.vout}`);
  }
  return coins.filter(coin=>!reserved.has(`${coin.txid}:${coin.vout}`)&&operations.every(r=>!r.independent||r.independent.some(i=>i.txid===coin.txid&&i.vout===coin.vout)));
}
