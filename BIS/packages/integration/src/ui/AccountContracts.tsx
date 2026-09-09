import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BisContext } from '../core/context.ts';
import type { BisContract } from '../core/contracts.ts';
import { contractController } from '../core/lto-service.ts';
import { ItemList, ItemListDetail } from './ItemList';
import { usePendingNotice } from './PendingOperationDialog';

export function AccountContracts({context,onDetailChange}: {context:BisContext;onDetailChange:(open:boolean)=>void}) {
  const [contracts,setContracts]=useState<readonly BisContract[]>([]),[selected,setSelected]=useState<string>(),[status,setStatus]=useState('loading'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const generation=useRef(0),acting=useRef(false);
  const buttons=useRef(new Map<string,HTMLButtonElement>()),loaded=useRef(false);
  const detail=contracts.find(contract=>contract.id===selected);
  if(status==='ready')loaded.current=true;
  usePendingNotice(status==='loading','Loading...',!loaded.current&&status==='unavailable'?'Contracts could not be loaded. Recovery records have been retained.':undefined,()=>context.closeAccount());
  useLayoutEffect(()=>{onDetailChange(!!detail);return()=>onDetailChange(false);},[!!detail,onDetailChange]);
  useEffect(()=>{
    const current=++generation.current;let reading=false;
    const refresh=async()=>{
      if(reading)return;reading=true;
      try {
        const result=await context.checkContracts?.();
        if(generation.current!==current)return;
        setStatus(result?.status??'unavailable');
        if(result?.status==='ready')setContracts(result.contracts);
      }catch{if(generation.current===current)setStatus('unavailable');}
      finally{reading=false;}
    };
    void refresh();const timer=setInterval(()=>{void refresh();},1000);
    return()=>{generation.current++;clearInterval(timer);};
  },[context]);
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
  const report=(detail?[detail]:contracts).map(contract=>`Contract ID: ${contract.id}\nType: ${contract.type}\nPurpose: ${contract.purpose}\nRole: ${contract.role??'Unavailable'}\nAmount: ${contract.amountSats} sats\nFunds: ${contract.financial}\nOffer: ${contract.eligibility}\nEvidence: ${contract.evidence??'Local record'}\nExpires: ${new Date(contract.expiresAt).toISOString()}\nReference: ${contract.hostReference}\nOperation: ${contract.operationId??'Unavailable'}\nFunding transaction: ${contract.fundingTransactionId??'Not verified'}\nCurrent transaction: ${contract.transactionId??'Not submitted'}`).join('\n\n');
  const Page=detail?ItemListDetail:ItemList;
  return <Page title={detail?'Contract Details':'Contracts'} body={detail?'Inspect this offer and its locked funds.':'Open contracts for this account.'} fieldLabel={detail?'Contract':'Contracts'} report={report} listLabel="Contracts" loading={status==='loading'}
    items={status==='ready'?contracts.map(contract=>({id:contract.id,selected:selected===contract.id,buttonRef:(element:HTMLButtonElement|null)=>{if(element)buttons.current.set(contract.id,element);else buttons.current.delete(contract.id);},onSelect:()=>{setSelected(contract.id);setMessage('');},content:<><strong>{contract.purpose}</strong><span>{contract.amountSats.toLocaleString('en-US')} sats · {contract.eligibility==='expired'?'Expired':contract.financial}</span></>})):[]}
    detail={detail&&<>
      <dl className="bis-contract-fields"><dt>Type</dt><dd>Limited-time offer</dd><dt>Purpose</dt><dd>{detail.purpose}</dd><dt>Amount</dt><dd>{detail.amountSats.toLocaleString('en-US')} sats</dd><dt>Funds</dt><dd>{detail.financial}</dd><dt>Offer</dt><dd>{detail.eligibility}</dd><dt>Expires</dt><dd>{new Date(detail.expiresAt).toLocaleString()}</dd><dt>Contract ID</dt><dd>{detail.id}</dd><dt>Reference</dt><dd>{detail.hostReference}</dd></dl>
      <p>Role: {detail.role??'Unavailable'} · Evidence: {detail.evidence??'Local record'}. Submission is rechecked before spending.</p>
      {[...new Set([detail.fundingTransactionId,detail.transactionId].filter((id):id is string=>!!id&&/^[a-f0-9]{64}$/i.test(id)))].map(id=><p key={id}><a href={`https://explorer.signet.arkade.sh/tx/${id}`} target="_blank" rel="noopener noreferrer">View transaction {id.slice(0,8)}…</a></p>)}
      {detail.eligibility==='expired'&&detail.financial!=='refunded'&&<p>The offer has expired. Its funds remain locked until the refund is verified.</p>}
    </>}
    actions={detail&&<>
        {detail.role==='player'&&<><button className="bis-button bis-primary" disabled={!available||busy||!detail.canClaim} onClick={()=>void act('claim')}>Claim</button>
        <button className="bis-button" disabled={!available||busy||!detail.canReject} onClick={()=>void act('reject')}>Reject</button></>}
        {detail.role==='game'&&<button className="bis-button" disabled={!available||busy||!detail.canRefund} onClick={()=>void act('refund')}>Refund to game</button>}
    </>}
    notice={<>{status==='loading'?<p role="status">Loading contracts…</p>:status==='unavailable'?<p role="status">Contracts are unavailable. Recovery records have been retained.</p>:!detail&&contracts.length===0?<p>No active contracts.</p>:null}{message&&<p role="status">{message}</p>}</>}
    onBack={()=>{if(detail){const previous=detail.id;setSelected(undefined);setMessage('');requestAnimationFrame(()=>buttons.current.get(previous)?.focus());}else context.closeAccount();}}
  />;
}
