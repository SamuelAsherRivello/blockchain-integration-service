import type { BoardingRecord } from './boarding-record.ts';

type Transaction = {txid:string;status:{confirmed:boolean};vin?:{txid:string;vout:number}[];vout:{scriptpubkey_address?:string;value:string|number}[]};
type Receipt = {value:number;commitmentTxIds?:string[]};
type Consumed = {txid:string;vout:number;isSpent?:boolean;settledBy?:string};
export function verifiedBoardingCommitment(record:BoardingRecord, transactions:Transaction[], receipts:Receipt[], consumed:Consumed[]=[]) {
  for(const tx of transactions) {
    if(!tx.status.confirmed || (record.commitmentTxid && record.commitmentTxid!==tx.txid))continue;
    const boarding=record.quote.direction==='to-arkade';
    if(!record.inputs.every(i=>boarding ? tx.vin?.some(v=>v.txid===i.txid&&v.vout===i.vout) : consumed.some(v=>v.txid===i.txid&&v.vout===i.vout&&v.isSpent&&v.settledBy===tx.txid)))continue;
    const values=receipts.filter(v=>v.commitmentTxIds?.includes(tx.txid)).map(v=>v.value);
    if(!values.every(v=>Number.isSafeInteger(v)&&v>=0) || values.reduce((a,b)=>a+b,0)!==(boarding?record.quote.netSats:record.quote.maxSats-record.quote.amountSats))continue;
    const change=tx.vout.filter(o=>o.scriptpubkey_address===record.bitcoinAddress).map(o=>Number(o.value));
    if(!change.every(v=>Number.isSafeInteger(v)&&v>=0) || change.reduce((a,b)=>a+b,0)!==(boarding?record.quote.maxSats-record.quote.amountSats:record.quote.netSats))continue;
    return tx.txid;
  }
}

