import type { BoardingRecord } from './boarding-record.ts';
import { transferStatus, transferProgressLines } from './boarding-status.ts';
import type { BisTransferStatus } from './context.ts';
import type { SendRecord } from './sending.ts';
import { assetBaseUnits, type AssetRecord } from './assets.ts';
import type { BisContract } from './contracts.ts';

export type BisTransaction = Readonly<{
  id: string;
  amountSats: number;
  direction: 'Incoming' | 'Outgoing' | 'Bitcoin → Arkade' | 'Arkade → Bitcoin' | 'Mint' | 'Game → Contract' | 'Contract → Player' | 'Contract → Game';
  status: 'Pending' | 'Confirmed' | 'Settled offchain' | 'Pending offchain' | 'Status unavailable' | 'Pending — preparing' | 'Pending — outcome unknown' | 'Pending — registered, awaiting verification' | 'Transfer verified' | 'Not submitted' | 'Mint recorded';
  identifier: string;
  /** SDK transaction timestamp in Unix milliseconds; missing for undated pending receipts. */
  createdAt?: number;
  kind?: string;
  assets?: readonly Readonly<{assetId?:string;quantity:string;name?:string;ticker?:string;decimals?:number}>[];
  satsUnknown?: boolean;
  /** Fresh owned spendable outputs verify this Arkade receipt, independently of batch settlement. */
  receiptVerified?: boolean;
  transfer?: BisTransferStatus;
  bitcoin?: Readonly<{ txid: string; confirmations?: number; blockHeight?: number }>;
}>;
export type BisActivity = Readonly<{ status: 'idle' | 'loading' }> | Readonly<{status:'unavailable';transactions?:readonly BisTransaction[]}> |
  Readonly<{ status: 'ready'; transactions: readonly BisTransaction[] }>;
export function transactionExplorerUrl(t: BisTransaction): string | undefined {
  const refs = t.identifier.split(/\s+/);
  const bitcoin = t.bitcoin?.txid && /^[a-f0-9]{64}$/i.test(t.bitcoin.txid) ? t.bitcoin.txid :
    refs.map(ref => /^([a-f0-9]{64})(?::\d+)?$/i.exec(ref)?.[1]).find(Boolean);
  if (bitcoin) return `https://mempool.space/signet/tx/${bitcoin}`;
  const ark = refs.map(ref => /^ark:([a-f0-9]{64})$/i.exec(ref)?.[1]).find(Boolean);
  if (ark) return `https://explorer.signet.arkade.sh/tx/${ark}`;
  const commitment = refs.map(ref => /^commitment:([a-f0-9]{64})$/i.exec(ref)?.[1]).find(Boolean);
  if (commitment) return `https://mempool.space/signet/tx/${commitment}`;
  return undefined;
}
export function formatTransactionSummary(t: BisTransaction): string {
  const amount = t.satsUnknown ? 'Sats unknown' : `${t.amountSats.toLocaleString('en-US')} sats`;
  const status = t.status.startsWith('Pending') ? 'Pending' : t.status === 'Settled offchain' ? 'Settled' : t.status;
  return `${amount} | ${t.direction} | ${status}`;
}
export function transactionRowPresentation(t: BisTransaction) {
  const mint = t.kind === 'Asset mint' || t.direction === 'Mint';
  const transferDirection = t.transfer?.direction ??
    (t.direction === 'Bitcoin → Arkade' ? 'to-arkade' : t.direction === 'Arkade → Bitcoin' ? 'to-bitcoin' : undefined);
  const operation = t.kind?.startsWith('Contract ') || t.kind === 'Continue payment' || t.kind === 'Burn Asset' || t.kind === 'Transfer' ? t.kind : mint ? 'Mint Asset' : transferDirection ? `Transfer ${transferDirection === 'to-arkade' ? 'to Arkade' : 'to Bitcoin'}` :
    t.kind === 'Asset transfer' ? (t.direction === 'Outgoing' ? 'Send Asset' : 'Receive Asset') :
    t.direction === 'Outgoing' ? 'Send Balance' : 'Receive Balance';
  const refs = t.identifier.split(/\s+/);
  const bitcoin = t.bitcoin?.txid ? `bitcoin:${t.bitcoin.txid}` :
    refs.find(ref => /^[a-f0-9]{64}(?::\d+)?$/i.test(ref));
  const ark = refs.find(ref => ref.startsWith('ark:'));
  const commitment = refs.find(ref => ref.startsWith('commitment:'));
  const network = transferDirection ? (transferDirection === 'to-arkade' ? 'On-chain → Off-chain' : 'Off-chain → On-chain') :
    bitcoin ? 'On-chain' : ark || mint || t.status.endsWith('offchain') ? 'Off-chain' : commitment ? 'On-chain' : 'Network unavailable';
  const identifier = bitcoin ? (bitcoin.startsWith('bitcoin:') ? bitcoin : `bitcoin:${bitcoin}`) : ark ?? commitment ?? t.identifier;
  return {
    heading: `${operation} · ${t.satsUnknown ? 'Sats unknown' : `${t.amountSats.toLocaleString('en-US')} sats`}`,
    network,
    identifier,
  };
}
export function formatTransactionDetail(t: BisTransaction): string {
  const date = new Date(t.createdAt ?? NaN);
  const timestamp = t.createdAt! > 0 && Number.isFinite(date.getTime())
    ? date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '') : 'Not yet reported';
  return [`Amount: ${t.satsUnknown ? 'Sats not yet reported' : `${t.amountSats} sats`}`, `Direction: ${t.direction}`, `Status: ${t.status}`,
    `Timestamp (UTC): ${timestamp}`,
    ...(t.transfer?transferProgressLines(t.transfer):[]),
    ...(t.kind ? [`Type: ${t.kind}`] : []),
    ...(t.bitcoin ? [
      'Network: Bitcoin Signet (test network)',
      `Confirmations: ${t.bitcoin.confirmations ?? 'Unavailable'}`,
      ...(t.bitcoin.blockHeight === undefined ? [] : [`Confirmed in block: ${t.bitcoin.blockHeight}`]),
      '',
      ...(t.bitcoin.confirmations === 0 ? ['Waiting for the first block (1 confirmation). Confirmation time is unpredictable; no reliable countdown is available.'] :
        t.bitcoin.confirmations === undefined ? ['An exact confirmation count is not available from the latest data. Check the explorer for current progress.'] :
        ['Included in a block. Each subsequent block adds another confirmation.']),
      '', 'Confirmation data refreshes automatically while Activity is open.',
    ] : ['']), 'Identifiers:', ...t.identifier.split(/\s+/),
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

/** Contract evidence is correlated by exact transaction ID, never by balance or amount. */
export function withContractActivity(rows:readonly BisTransaction[],contracts:readonly BisContract[]):readonly BisTransaction[] {
  let result=[...rows];
  for(const contract of contracts){
    const operations=[...(contract.fundingTransactionId?[{kind:'fund',id:contract.fundingTransactionId,confirmed:true}]:[]),
      ...(!contract.fundingTransactionId||contract.operationKind!=='fund'?[{kind:contract.operationKind??'fund',id:contract.transactionId,confirmed:contract.evidence==='verified receipt'}]:[])];
    for(const operation of operations){
      const kind=`Contract ${operation.kind==='fund'?'funding':operation.kind==='claim'?'claim':'refund'}`;
      const direction:BisTransaction['direction']=operation.kind==='fund'?'Game → Contract':operation.kind==='claim'?'Contract → Player':'Contract → Game';
      const status:BisTransaction['status']=operation.confirmed?'Settled offchain':contract.financial==='failed'||contract.financial==='funded'&&operation.kind!=='fund'?'Not submitted':'Pending — outcome unknown';
      const identifier=`contract:${contract.id}${operation.id?` ark:${operation.id}`:''}${contract.operationId&&operation.kind===contract.operationKind?` operation:${contract.operationId}`:''}`;
      const matches=(row:BisTransaction)=>!!operation.id&&row.identifier.split(' ').includes(`ark:${operation.id}`);
      const entry={id:`contract:${contract.id}:${operation.kind}`,amountSats:contract.amountSats,kind,direction,status,identifier};
      if(result.some(matches))result=result.map(row=>matches(row)?{...row,kind,direction,identifier:[...new Set(`${row.identifier} ${identifier}`.split(' '))].join(' ')}:row);
      else result.push(entry);
    }
  }
  return result;
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

export function withSendActivity(rows:readonly BisTransaction[],record:SendRecord|undefined,profileId:string):readonly BisTransaction[] {
  if(!record||record.profileId!==profileId)return rows;
  const matches=(row:BisTransaction)=>row.identifier.split(' ').includes(`ark:${record.transactionId}`);
  if(rows.some(matches))return rows; // Prefer authoritative SDK history without duplicate rows.
  const row:BisTransaction={id:`send:${record.id}`,amountSats:record.quote.amountSats,direction:'Outgoing',status:record.status==='succeeded'?'Settled offchain':'Pending — outcome unknown',kind:'Local send operation',identifier:`send-operation:${record.id} ark:${record.transactionId}`};
  return Object.freeze(record.status==='pending'?[Object.freeze(row),...rows]:[...rows,Object.freeze(row)]);
}

// A registered intent can precede SDK transaction history. Identify its source
// explicitly and never invent a transaction ID, timestamp, or confirmation.
export function withTransferActivity(rows:readonly BisTransaction[], record:BoardingRecord|undefined, profileId:string):readonly BisTransaction[] {
  if(!record || record.profileId!==profileId)return rows;
  rows=rows.filter(row=>row.id!==`transfer:${record.id}`);
  const recovery = Object.freeze({...transferStatus(record), verification: undefined});
  const status:BisTransaction['status']=record.status==='succeeded'?'Transfer verified':record.status==='not-submitted'?'Not submitted':record.phase==='registered'?'Pending — registered, awaiting verification':record.phase==='prepared'?'Pending — preparing':'Pending — outcome unknown';
  const refs=[`operation:${record.id}`,record.intentId&&`intent:${record.intentId}`,record.commitmentTxid&&`commitment:${record.commitmentTxid}`].filter(Boolean).join(' ');
  const matches=(row:BisTransaction)=>(!row.transfer?.operationId||row.transfer.operationId===record.id)&&!!record.commitmentTxid && row.identifier.split(' ').some(ref=>ref===record.commitmentTxid||ref===`commitment:${record.commitmentTxid}`||ref.startsWith(`${record.commitmentTxid}:`));
  if(rows.some(matches))return Object.freeze(rows.map(row=>matches(row)?Object.freeze({...row,status,transfer:recovery,identifier:[...new Set(`${row.identifier} operation:${record.id}${record.intentId?` intent:${record.intentId}`:''}`.split(' '))].join(' ')}):row));
  const transfer:BisTransaction=Object.freeze({id:`transfer:${record.id}`,amountSats:record.quote.amountSats,direction:record.quote.direction==='to-arkade'?'Bitcoin → Arkade':'Arkade → Bitcoin',status,identifier:refs,transfer:recovery});
  return Object.freeze(record.status==='pending'?[transfer,...rows]:[...rows,transfer]);
}
