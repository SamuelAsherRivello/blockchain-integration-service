type BoardingLocator = {quote:{direction:string}; inputs:readonly {txid:string;vout:number}[]; commitmentTxid?:string};
type LiveTransaction = {txid:string;status:{confirmed?:boolean};vin?:readonly {txid:string;vout:number}[]};
/** Saved inputs identify the operation; only the fresh network transaction proves waiting. */
export function hasLiveBoardingWait(records: readonly BoardingLocator[], transactions: readonly LiveTransaction[]): boolean {
  return records.some(record => record.quote.direction === 'to-arkade' && record.inputs.length > 0 && transactions.some(tx =>
    tx.status.confirmed === false && (!record.commitmentTxid || record.commitmentTxid === tx.txid)
    && record.inputs.every(input => tx.vin?.some(vin => vin.txid === input.txid && vin.vout === input.vout))));
}

export function liveBoardingState(records: readonly BoardingLocator[], transactions: readonly LiveTransaction[]): 'ready' | 'waiting' | 'boarded' | 'unknown' {
 const own = records.filter(r => r.quote.direction === 'to-arkade' && r.inputs.length > 0);
 if (!own.length) return 'ready';
 const matches = (r: BoardingLocator, tx: LiveTransaction) => (!r.commitmentTxid || r.commitmentTxid === tx.txid) && r.inputs.every(i => tx.vin?.some(v => v.txid === i.txid && v.vout === i.vout));
 if (own.some(r => transactions.some(tx => tx.status.confirmed === true && matches(r, tx)))) return 'boarded';
 if (hasLiveBoardingWait(own, transactions)) return 'waiting';
 return 'unknown';
}
