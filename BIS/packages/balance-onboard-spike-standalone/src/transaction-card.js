export function statusBadge(label,tone){
 const badge=document.createElement('span');badge.className=`transaction-badge ${tone}`;badge.textContent=label;return badge;
}
export function incomingCard(row,address,isChange=false){
 const card=document.createElement('article');card.className='transaction-card';
 const header=document.createElement('div');header.className='transaction-header';
 const link=document.createElement('a');link.textContent=row.txid;link.href=`https://mempool.signet.arkade.sh/tx/${row.txid}`;link.target='_blank';link.rel='noopener noreferrer';link.className='transaction-id';
 const when=document.createElement('span');when.className='transaction-time';
 when.textContent=row.confirmed&&Number.isFinite(row.time)?`Confirmed ${new Date(row.time*1000).toLocaleString()}`:row.confirmed?'Included in a Bitcoin block':'Awaiting a Bitcoin block';
 header.append(link,when);
 const body=document.createElement('div');body.className='transaction-body';
 const route=document.createElement('div');route.className='transaction-route';
 const source=document.createElement('div');source.innerHTML='<span class="route-arrow">→</span><span></span>';source.lastChild.textContent=isChange?'Bitcoin change':'Incoming Bitcoin';
 const destination=document.createElement('div');destination.className='transaction-destination';
 const target=document.createElement('span');target.textContent=`${address.slice(0,15)}…${address.slice(-8)}`;target.title=address;
 const amount=document.createElement('strong');amount.textContent=`${row.amount.toLocaleString()} sats`;
 destination.append(target,amount);route.append(source,destination);
 const footer=document.createElement('div');footer.className='transaction-footer';
 const detail=document.createElement('span');detail.className='muted';detail.textContent=`${row.unspent.toLocaleString()} sats currently unspent${row.confirmed?'':' · 0 confirmations'}`;
 footer.append(detail,statusBadge(row.confirmed?'Confirmed':'Unconfirmed',row.confirmed?'confirmed':'unconfirmed'));
 body.append(route,footer);card.append(header,body);return card;
}
export function transferBadge(phase){
 if(phase==='success')return statusBadge('Confirmed','confirmed');
 if(phase==='uncertain')return statusBadge('Status unknown','unknown');
 if(['submitting','registered','committed'].includes(phase))return statusBadge('Unconfirmed','unconfirmed');
 return statusBadge('Not started','neutral');
}
