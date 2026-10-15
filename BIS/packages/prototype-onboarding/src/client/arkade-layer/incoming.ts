export function incomingTransactions(transactions, address, coins) {
  const rows=[];
  for(const tx of transactions){
    if(!/^[a-f0-9]{64}$/i.test(tx.txid))throw Error('Invalid transaction identifier.');
    const outputs=tx.vout.filter(o=>o.scriptpubkey_address===address);
    if(!outputs.length)continue;
    const values=outputs.map(o=>Number(o.value));
    if(values.some(v=>!Number.isSafeInteger(v)||v<0))throw Error('Invalid transaction value.');
    const amount=values.reduce((a,b)=>a+b,0);
    if(!Number.isSafeInteger(amount))throw Error('Invalid transaction total.');
    const unspent=coins.filter(c=>c.txid===tx.txid).reduce((n,c)=>n+Number(c.value),0);
    if(!Number.isSafeInteger(unspent)||unspent<0)throw Error('Invalid unspent total.');
    rows.push({txid:tx.txid,amount,unspent,confirmed:tx.status.confirmed===true,time:tx.status.block_time});
  }
  return rows.sort((a,b)=>Number(a.confirmed)-Number(b.confirmed)||(b.time??0)-(a.time??0));
}
