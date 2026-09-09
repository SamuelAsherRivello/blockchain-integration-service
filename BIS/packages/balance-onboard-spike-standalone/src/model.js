export const canSubmit = (state, confirmedFunding=false) => state.phase === 'idle' && confirmedFunding;
export function fundingEligible(coins, expired) {
 return coins.length>0 && coins.every(c=>c.status.confirmed && !expired(c));
}
export function capturedFunding(inputs, coins) {
  const selected=inputs.map(i=>coins.find(c=>c.txid===i.txid&&c.vout===i.vout&&c.value===i.value));
  if(selected.some(c=>!c))throw Error('Captured funding inputs are unavailable. Nothing submitted.');
  return {selected,confirmed:selected.filter(c=>c.status.confirmed).length};
}
export function half(coins) {
  if (!coins.length || coins.some(c => !Number.isSafeInteger(c.value) || c.value <= 0)) throw Error('Invalid funding amounts.');
  const total = coins.reduce((n,c) => n+c.value,0);
  if (!Number.isSafeInteger(total)) throw Error('Funding amount is too large.');
  return {total, target: Math.floor(total/2)};
}
export function verifiedReceipt(state, transactions, receipts, address) {
  if (!state.inputs?.length || !state.target || !Number.isSafeInteger(state.change)) return;
  if(state.mode==='board-then-return'){
    if(!state.boardingCommitment||!state.commitment)return;
    const board=transactions.find(tx=>tx.txid===state.boardingCommitment&&tx.status.confirmed);
    if(!board||!state.inputs.every(i=>board.vin?.some(v=>v.txid===i.txid&&v.vout===i.vout)))return;
  }
  for (const tx of transactions) {
    if (!tx.status.confirmed || (state.commitment && state.commitment !== tx.txid)) continue;
    if (state.mode!=='board-then-return' && !state.inputs.every(i => tx.vin?.some(v => v.txid === i.txid && v.vout === i.vout))) continue;
    const values = tx.vout.filter(o => o.scriptpubkey_address === address).map(o=>Number(o.value));
    if(values.some(v=>!Number.isSafeInteger(v)||v<0))continue;
    const change = values.reduce((n,v)=>n+v,0);
    const linked = receipts.filter(v=>v.commitmentTxIds?.includes(tx.txid));
    if (linked.length && linked.every(v=>Number.isSafeInteger(v.value)&&v.value>0) && linked.reduce((n,v)=>n+v.value,0) === state.target && change === state.change) return tx.txid;
  }
}
