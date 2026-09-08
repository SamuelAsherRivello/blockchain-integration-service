import type { BoardingRecord } from './boarding-record.ts';
import { boardingAssets } from './boarding-assets.ts';

type Transaction = {txid:string;status:{confirmed:boolean};vin?:{txid:string;vout:number}[];vout:{scriptpubkey_address?:string;value:string|number}[]};
type Receipt = {txid?:string;vout?:number;value:number;commitmentTxIds?:string[];script?:string;assets?:{assetId:string;amount:bigint}[]};
type Consumed = {txid:string;vout:number;isSpent?:boolean;settledBy?:string};
export function verifiedBoardingCommitment(record:BoardingRecord, transactions:Transaction[], receipts:Receipt[], consumed:Consumed[]=[], records:BoardingRecord[]=[record]) {
  for(const tx of transactions) {
    if(!tx.status.confirmed || (record.commitmentTxid && record.commitmentTxid!==tx.txid))continue;
    const boarding=record.quote.direction==='to-arkade';
    if(!record.inputs.every(i=>boarding ? tx.vin?.some(v=>v.txid===i.txid&&v.vout===i.vout) : consumed.some(v=>v.txid===i.txid&&v.vout===i.vout&&v.isSpent&&v.settledBy===tx.txid)))continue;
    const peers=records.filter(r=>r.profileId===record.profileId&&r.status!=='not-submitted'&&(!r.commitmentTxid||r.commitmentTxid===tx.txid)&&r.inputs.every(i=>r.quote.direction==='to-arkade'?tx.vin?.some(v=>v.txid===i.txid&&v.vout===i.vout):consumed.some(v=>v.txid===i.txid&&v.vout===i.vout&&v.isSpent&&v.settledBy===tx.txid)));
    if(peers.length>1) {
      if(peers.some(r=>r.id===record.id)&&verifySharedReceipts(peers,tx,receipts))return tx.txid;
      continue;
    }
    const owned=receipts.filter(v=>v.commitmentTxIds?.includes(tx.txid));
    const values=owned.map(v=>v.value), inputSats=record.quote.inputSats??record.quote.maxSats;
    if(!values.every(v=>Number.isSafeInteger(v)&&v>=0) || values.reduce((a,b)=>a+b,0)!==(boarding?record.quote.netSats:inputSats-record.quote.amountSats))continue;
    if(record.assetChange) {
      const expected=record.assetChange;
      try {
        if(owned.length!==1 || owned[0].script!==expected.script || owned[0].value!==expected.sats ||
           JSON.stringify(boardingAssets(owned))!==JSON.stringify([...expected.assets].sort((a,b)=>a.assetId.localeCompare(b.assetId))))continue;
      } catch {continue;}
    }
    const change=tx.vout.filter(o=>o.scriptpubkey_address===record.bitcoinAddress).map(o=>Number(o.value));
    if(!change.every(v=>Number.isSafeInteger(v)&&v>=0) || change.reduce((a,b)=>a+b,0)!==(boarding?inputSats-record.quote.amountSats:record.quote.netSats))continue;
    return tx.txid;
  }
}

// Match the complete local batch as a multiset. Each owned receipt is consumed
// once; equal amounts do not allow one output to satisfy two operations.
function verifySharedReceipts(records:BoardingRecord[],tx:Transaction,receipts:Receipt[]) {
  const inputs=records.flatMap(r=>r.inputs.map(i=>`${i.txid}:${i.vout}`));
  if(new Set(inputs).size!==inputs.length||new Set(records.map(r=>r.id)).size!==records.length)return false;
  const remaining=receipts.filter(v=>v.commitmentTxIds?.includes(tx.txid));
  if(remaining.some(v=>typeof v.txid!=='string'||!/^[a-f0-9]{64}$/i.test(v.txid)||!Number.isSafeInteger(v.vout)||v.vout!<0))return false;
  if(new Set(remaining.map(v=>`${v.txid}:${v.vout}`)).size!==remaining.length)return false;
  const bitcoin=new Map<string,number>();
  // Match constrained asset receipts first, before unconstrained plain sats.
  for(const r of [...records].sort((a,b)=>Number(!!b.assetChange)-Number(!!a.assetChange))) {
    const boarding=r.quote.direction==='to-arkade',change=(r.quote.inputSats??r.quote.maxSats)-r.quote.amountSats;
    const expected=boarding?r.quote.netSats:change;
    bitcoin.set(r.bitcoinAddress,(bitcoin.get(r.bitcoinAddress)??0)+(boarding?change:r.quote.netSats));
    if(expected===0)continue;
    const index=remaining.findIndex(v=>{
      if(!Number.isSafeInteger(v.value)||v.value!==expected)return false;
      if(!r.assetChange)return true;
      try{return v.script===r.assetChange.script&&v.value===r.assetChange.sats&&JSON.stringify(boardingAssets([v]))===JSON.stringify([...r.assetChange.assets].sort((a,b)=>a.assetId.localeCompare(b.assetId)));}
      catch{return false;}
    });
    if(index<0)return false;
    remaining.splice(index,1);
  }
  if(remaining.length)return false;
  for(const [address,expected] of bitcoin) {
    const values=tx.vout.filter(o=>o.scriptpubkey_address===address).map(o=>Number(o.value));
    if(!Number.isSafeInteger(expected)||!values.every(v=>Number.isSafeInteger(v)&&v>=0)||values.reduce((a,b)=>a+b,0)!==expected)return false;
  }
  return true;
}

