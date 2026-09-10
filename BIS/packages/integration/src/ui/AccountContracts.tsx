import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BisContext } from '../core/context.ts';
import type { BisContract } from '../core/contracts.ts';
import { contractController } from '../core/lto-service.ts';
import { ItemListDetail, type ItemListItem } from './ItemList';
import { CompactItemRow, StatusTypeIcon, type StatusType } from './StatusTypeIcon';

export function AccountContracts({context,onDetailChange}: {context:BisContext;onDetailChange:(open:boolean)=>void}) {
  const [contracts,setContracts]=useState<readonly BisContract[]>([]),[selected,setSelected]=useState<string>(),[status,setStatus]=useState('loading'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const generation=useRef(0),acting=useRef(false),refreshing=useRef(false);
  const buttons=useRef(new Map<string,HTMLButtonElement>());
  const detail=contracts.find(contract=>contract.id===selected);
  useLayoutEffect(()=>{onDetailChange(!!detail);return()=>onDetailChange(false);},[!!detail,onDetailChange]);
  const refresh=useCallback(async()=>{
      if(refreshing.current)return;refreshing.current=true;
      const current=generation.current;
      try {
        const result=await context.checkContracts?.({includeResolved:true});
        if(generation.current!==current)return;
        setStatus(result?.status??'unavailable');
        if(result?.status==='ready')setContracts(result.contracts);
      }catch{if(generation.current===current)setStatus('unavailable');}
      finally{refreshing.current=false;}
  },[context]);
  useEffect(()=>{
    ++generation.current;
    void refresh();const timer=setInterval(()=>{void refresh();},1000);
    return()=>{generation.current++;clearInterval(timer);};
  },[refresh]);
  async function act(kind:'claim'|'reject'|'refund') {
    if(!detail||acting.current)return;
    acting.current=true;const current=generation.current;setBusy(true);setMessage('');
    try {
      const result=await (kind==='claim'?context.claimContract?.(detail.id):kind==='reject'?context.rejectContract?.(detail.id):context.refundContract?.(detail.id));
      if(current!==generation.current)return;
      if(result?.status==='pending')setMessage('Pending. You can return while this completes.');
      else setMessage(result?.status==='too-late'?'This offer has expired.':'This action is currently unavailable.');
    }catch{if(current===generation.current)setMessage('This action is currently unavailable.');}
    finally{acting.current=false;if(current===generation.current)setBusy(false);}
  }
  const available=status==='ready'&&!!contractController(context);
  const rowStatus=(contract:BisContract):StatusType => ['funding','claiming','refunding','unknown'].includes(contract.financial) ? 'info' : contract.financial==='failed' ? 'error' : contract.eligibility==='expired' ? 'warning' : 'success';
  const report=(detail?[detail]:contracts).map(contract=>`Contract ID: ${contract.id}\nType: ${contract.type}\nPurpose: ${contract.purpose}\nRole: ${contract.role??'Unavailable'}\nAmount: ${contract.amountSats} sats\nFunds: ${contract.financial}\nOffer: ${contract.eligibility}\nEvidence: ${contract.evidence??'Local record'}\nExpires: ${new Date(contract.expiresAt).toISOString()}\nReference: ${contract.hostReference}\nOperation: ${contract.operationId??'Unavailable'}\nFunding transaction: ${contract.fundingTransactionId??'Not verified'}\nCurrent transaction: ${contract.transactionId??'Not submitted'}`).join('\n\n');
  const items:readonly ItemListItem[]=contracts.map(contract=>{const type=rowStatus(contract);return {id:contract.id,selected:selected===contract.id,buttonRef:(element:HTMLButtonElement|null)=>{if(element)buttons.current.set(contract.id,element);else buttons.current.delete(contract.id);},onSelect:()=>{setSelected(contract.id);setMessage('');},content:<CompactItemRow status={type} leading={<StatusTypeIcon type={type}/>} fields={[{icon:'⚙️',label:'Operation',value:contract.operationKind??'Offer'},{icon:'🪙',label:'Cost',value:contract.amountSats.toLocaleString('en-US')+' sats'},{icon:'🎯',label:'Purpose',value:contract.purpose},{icon:'⏳',label:'Status',value:contract.eligibility==='expired'?'Expired':contract.financial},{icon:'👤',label:'Role',value:contract.role??'Unavailable'},{icon:'📅',label:'Expires',value:new Date(contract.expiresAt).toLocaleString()}]}/>};});
  const detailContent=detail?<>
      <dl className="bis-contract-fields"><dt>Type</dt><dd>Limited-time offer</dd><dt>Purpose</dt><dd>{detail.purpose}</dd><dt>Amount</dt><dd>{detail.amountSats.toLocaleString('en-US')} sats</dd><dt>Funds</dt><dd>{detail.financial}</dd><dt>Offer</dt><dd>{detail.eligibility}</dd><dt>Expires</dt><dd>{new Date(detail.expiresAt).toLocaleString()}</dd><dt>Contract ID</dt><dd>{detail.id}</dd><dt>Reference</dt><dd>{detail.hostReference}</dd></dl>
      <p>Role: {detail.role??'Unavailable'} · Evidence: {detail.evidence??'Local record'}. Submission is rechecked before spending.</p>
      {[...new Set([detail.fundingTransactionId,detail.transactionId].filter((id):id is string=>!!id&&/^[a-f0-9]{64}$/i.test(id)))].map(id=><p key={id}><a href={`https://explorer.signet.arkade.sh/tx/${id}`} target="_blank" rel="noopener noreferrer">View transaction {id.slice(0,8)}…</a></p>)}
      {detail.eligibility==='expired'&&detail.financial!=='refunded'&&<p>The offer has expired. Its funds remain locked until the refund is verified.</p>}
    </>:contracts.length?<ul className="bis-collection-list" aria-label="Contracts">{items.map(item=><li key={item.id}><button ref={item.buttonRef} type="button" className="bis-collection-item" aria-pressed={item.selected} onClick={item.onSelect}>{item.content}</button></li>)}</ul>:null;
  return <ItemListDetail title={detail?'Contract Details':'Contracts'} body={detail?'Inspect this offer and its locked funds.':'All contracts for this account.'} fieldLabel={detail?'Contract':'Contracts'} report={report} listLabel="Contracts" loading={status==='loading'} items={items}
    onRefresh={refresh} refreshDisabled={!context.checkContracts}
    detail={detailContent}
    actions={detail&&<>
        {detail.role==='player'&&<><button className="bis-button bis-primary" disabled={!available||busy||!detail.canClaim} onClick={()=>void act('claim')}>Claim</button>
        <button className="bis-button" disabled={!available||busy||!detail.canReject} onClick={()=>void act('reject')}>Reject</button></>}
        {detail.role==='game'&&<button className="bis-button" disabled={!available||busy||!detail.canRefund} onClick={()=>void act('refund')}>Refund to game</button>}
    </>}
    notice={message&&<p role="status">{message}</p>}
    onBack={()=>{if(detail){const previous=detail.id;setSelected(undefined);setMessage('');requestAnimationFrame(()=>buttons.current.get(previous)?.focus());}else context.closeAccount();}}
  />;
}
