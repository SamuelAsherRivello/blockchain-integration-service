import type { BoardingRecord } from './boarding-record.ts';
import { assetBaseUnits, type AssetRecord } from './assets.ts';

export type BisTransaction = Readonly<{
  id: string;
  amountSats: number;
  direction: 'Incoming' | 'Outgoing' | 'Bitcoin → Arkade' | 'Arkade → Bitcoin' | 'Mint';
  status: 'Pending' | 'Confirmed' | 'Settled offchain' | 'Pending offchain' | 'Status unavailable' | 'Pending — preparing' | 'Pending — outcome unknown' | 'Pending — registered, awaiting verification' | 'Transfer verified' | 'Not submitted' | 'Mint recorded';
  identifier: string;
  createdAt?: number;
  kind?: string;
  assets?: readonly Readonly<{assetId?:string;quantity:string;name?:string;ticker?:string;decimals?:number}>[];
  satsUnknown?: boolean;
}>;
export type BisActivity = Readonly<{ status: 'idle' | 'loading' }> | Readonly<{status:'unavailable';transactions?:readonly BisTransaction[]}> |
  Readonly<{ status: 'ready'; transactions: readonly BisTransaction[] }>;
export function formatTransactionSummary(t: BisTransaction): string {
  const amount = t.satsUnknown ? 'Sats unknown' : `${t.amountSats.toLocaleString('en-US')} sats`;
  const status = t.status.startsWith('Pending') ? 'Pending' : t.status === 'Settled offchain' ? 'Settled' : t.status;
  return `${amount} | ${t.direction} | ${status}`;
}
export function formatTransactionDetail(t: BisTransaction): string {
  return [`Amount: ${t.satsUnknown ? 'Sats not yet reported' : `${t.amountSats} sats`}`, `Direction: ${t.direction}`, `Status: ${t.status}`,
    ...(t.kind ? [`Type: ${t.kind}`] : []), '', 'Identifiers:', ...t.identifier.split(/\s+/),
    ...(t.assets?.flatMap((a, i) => ['', `Asset ${i + 1}:`, `Asset ID: ${a.assetId ?? 'ID pending'}`, ...(a.name ? [`Name: ${a.name}`] : []), ...(a.ticker ? [`Ticker: ${a.ticker}`] : []), `Quantity: ${a.quantity} base units`, ...(a.decimals === undefined ? [] : [`Decimals: ${a.decimals}`])]) ?? [])].join('\n');
}
export function formatTransactions(transactions: readonly BisTransaction[]): string {
  return transactions.map(t => {
    const assets=t.assets?.map(a=>{
      const amount=a.decimals===undefined?`${a.quantity} base units`:a.quantity.padStart(a.decimals+1,'0').replace(new RegExp(`(\\d{${a.decimals}})$`),a.decimals?'.$1':'');
      return `${amount}${a.ticker?` ${a.ticker}`:''}${a.name?` (${a.name})`:''} [asset:${a.assetId??'ID pending'}]`;
    }).join(', ');
    return `${t.satsUnknown?'Sats not yet reported':`${t.amountSats} sats`} | ${t.direction}${t.kind?` | ${t.kind}`:''} | ${t.status}${assets?` | ${assets}`:''} | ${t.identifier}`;
  }).join('\n');
}

export function withMintActivity(rows:readonly BisTransaction[], records:readonly AssetRecord[]):readonly BisTransaction[] {
  let result=[...rows];
  for(const record of records) {
    const matches=(row:BisTransaction)=>!!record.transactionId && row.identifier.split(' ').includes(`ark:${record.transactionId}`);
    if(result.some(matches)) {
      result=result.map(row=>matches(row)?Object.freeze({...row,kind:'Asset mint',identifier:`${row.identifier} mint-operation:${record.request.operationId}`}):row);
      continue;
    }
    const asset=Object.freeze({assetId:record.asset?.assetId,quantity:assetBaseUnits(record.request.amount,record.request.decimals).toString(),name:record.request.name,ticker:record.request.ticker,decimals:record.request.decimals});
    const row:BisTransaction=Object.freeze({id:`mint:${record.request.operationId}`,amountSats:0,satsUnknown:true,direction:'Mint',kind:'Asset mint',status:record.status==='pending'?'Pending — outcome unknown':'Mint recorded',assets:Object.freeze([asset]),identifier:`mint-operation:${record.request.operationId}${record.transactionId?` ark:${record.transactionId}`:''}`});
    if(record.status==='pending')result.unshift(row);else result.push(row);
  }
  return Object.freeze(result);
}

// A registered intent can precede SDK transaction history. Identify its source
// explicitly and never invent a transaction ID, timestamp, or confirmation.
export function withTransferActivity(rows:readonly BisTransaction[], record:BoardingRecord|undefined, profileId:string):readonly BisTransaction[] {
  if(!record || record.profileId!==profileId)return rows;
  const status:BisTransaction['status']=record.status==='succeeded'?'Transfer verified':record.status==='not-submitted'?'Not submitted':record.phase==='registered'?'Pending — registered, awaiting verification':record.phase==='prepared'?'Pending — preparing':'Pending — outcome unknown';
  const refs=[`operation:${record.id}`,record.intentId&&`intent:${record.intentId}`,record.commitmentTxid&&`commitment:${record.commitmentTxid}`].filter(Boolean).join(' ');
  const matches=(row:BisTransaction)=>!!record.commitmentTxid && row.identifier.split(' ').some(ref=>ref===record.commitmentTxid||ref===`commitment:${record.commitmentTxid}`||ref.startsWith(`${record.commitmentTxid}:`));
  if(rows.some(matches))return Object.freeze(rows.map(row=>matches(row)?Object.freeze({...row,status,identifier:`${row.identifier} operation:${record.id}${record.intentId?` intent:${record.intentId}`:''}`}):row));
  const transfer:BisTransaction=Object.freeze({id:`transfer:${record.id}`,amountSats:record.quote.amountSats,direction:record.quote.direction==='to-arkade'?'Bitcoin → Arkade':'Arkade → Bitcoin',status,identifier:refs});
  return Object.freeze(record.status==='pending'?[transfer,...rows]:[...rows,transfer]);
}
