import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BisContext } from '../state-layer-core/context.ts';
import type { BisContract } from '../state-layer-core/contracts.ts';
import { contractController } from '../state-layer-core/lto-service.ts';
import { CollectionListView, CollectionDetailView, type CollectionListItem } from './ItemList';
import { CompactItemRow, StatusTypeIcon, type StatusType } from './StatusTypeIcon';
import { arkExplorerTransactionUrl, networkLabel, type TestNetwork } from '../state-layer-core/test-network.ts';
import { usePendingNotice } from './PendingOperationDialog.tsx';
import { useEntryLoadingGate, viewLoadingPolicies } from './view-loading';

const contractNetworkLabel = (network:string) => network==='signet'||network==='mutinynet' ? networkLabel(network as TestNetwork) : 'Unavailable';

export function AccountContractsView({context,onDetailChange,onBackDismissalChange}: {context:BisContext;onDetailChange:(open:boolean)=>void;onBackDismissalChange?: (action: (()=>void)|undefined) => void}) {
  const [contracts,setContracts]=useState<readonly BisContract[]>([]),[selected,setSelected]=useState<string>(),[status,setStatus]=useState('loading'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const generation=useRef(0),acting=useRef(false),refreshing=useRef(false);
  const initialLoading=useRef(true);
  const [recoveryOpen,setRecoveryOpen]=useState(false),[recoveryBusy,setRecoveryBusy]=useState(false),[recoveryMessage,setRecoveryMessage]=useState('');
  const recoveryPassword=useRef<HTMLInputElement>(null),recoveryFile=useRef<HTMLInputElement>(null),recovering=useRef(false);
  const buttons=useRef(new Map<string,HTMLButtonElement>());
  const detail=contracts.find(contract=>contract.id===selected);
  useLayoutEffect(()=>{onDetailChange(!!detail);return()=>onDetailChange(false);},[!!detail,onDetailChange]);
  const refresh=useCallback(async(force=false)=>{
      if(refreshing.current)return;refreshing.current=true;
      const current=generation.current;
      try {
        const result=await context.checkContractsAsync?.({includeResolved:true,includeOtherNetworks:true}, force);
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
  const loading=status==='loading';
  const backDismissalEnabled = !loading && !busy;
  const back = () => { if(detail){const previous=detail.id;setSelected(undefined);setMessage('');requestAnimationFrame(()=>buttons.current.get(previous)?.focus());}else context.closeAccount(); };
  useEffect(()=>{onBackDismissalChange?.(backDismissalEnabled ? back : undefined);return()=>onBackDismissalChange?.(undefined);},[backDismissalEnabled,detail?.id,onBackDismissalChange]);
  useEffect(()=>{if (status === 'ready' || status === 'unavailable') initialLoading.current = false;},[status]);
  const loadingNotice=useEntryLoadingGate(loading,initialLoading.current,viewLoadingPolicies.contracts);
  usePendingNotice(loadingNotice,'Loading ...',undefined,()=>context.closeAccount());
  async function refreshSelected() {
    if (detail) await contractController(context)?.reconcile?.({contractId:detail.id,feedback:'explicit'});
    await refresh(true);
  }
  async function act(kind:'claim'|'reject'|'refund') {
    if(!detail||acting.current)return;
    acting.current=true;const current=generation.current;setBusy(true);setMessage('');
    try {
      const result=await (kind==='claim'?context.claimContractAsync?.(detail.id):kind==='reject'?context.rejectContractAsync?.(detail.id):context.refundContract?.(detail.id));
      if(current!==generation.current)return;
      if(result?.status==='pending')setMessage('Pending. You can return while this completes.');
      else setMessage(result?.status==='too-late'?'This offer has expired.':'This action is currently unavailable.');
    }catch{if(current===generation.current)setMessage('This action is currently unavailable.');}
    finally{acting.current=false;if(current===generation.current)setBusy(false);}
  }
  async function portableRecovery(kind:'export'|'import') {
    if(recovering.current)return;
    recovering.current=true;setRecoveryBusy(true);setRecoveryMessage('');
    const current=generation.current,password=recoveryPassword.current?.value??'',file=recoveryFile.current?.files?.[0];
    if(recoveryPassword.current)recoveryPassword.current.value='';
    try {
      const controller=contractController(context);
      if(password.length<16||password.length>1024)throw Error();
      if(kind==='export'){
        if(!controller?.exportRecovery)throw Error();
        const encrypted=await controller.exportRecovery(password);
        if(current!==generation.current)return;
        const url=URL.createObjectURL(new Blob([encrypted],{type:'application/json'}));
        const link=document.createElement('a');link.href=url;link.download=`bis-contract-recovery-${context.getState().network}.json`;link.click();
        setTimeout(()=>URL.revokeObjectURL(url),30_000);
        setRecoveryMessage('Encrypted recovery downloaded. Keep the file and password safe. Export again after further transactions.');
      }else{
        if(!controller?.importRecovery||!file||file.size>8_000_000)throw Error();
        await controller.importRecovery(await file.text(),password);
        if(current!==generation.current)return;
        setRecoveryMessage('Recovery imported without submitting a transaction. Open Contract Details and refresh to verify the original network state.');
        await refresh(true);
      }
    }catch{
      if(current===generation.current)setRecoveryMessage('Recovery unavailable. Use a password of at least 16 characters, the correct file and network, and the original local Player and Game Wallets. Existing records were retained.');
    }finally{
      recovering.current=false;
      if(current===generation.current){setRecoveryBusy(false);if(recoveryFile.current)recoveryFile.current.value='';}
    }
  }
  const available=status==='ready'&&!!contractController(context)&&detail?.scope.network===context.getState().network;
  const rowStatus=(contract:BisContract):StatusType => ['funding','claiming','refunding','unknown'].includes(contract.financial) ? 'info' : contract.financial==='failed' ? 'error' : contract.eligibility==='expired' ? 'warning' : 'success';
  const report=(detail?[detail]:contracts).map(contract=>`Contract ID: ${contract.id}\nType: ${contract.type}\nNetwork: ${contractNetworkLabel(contract.scope.network)}\nPurpose: ${contract.purpose}\nRole: ${contract.role??'Unavailable'}\nAmount: ${contract.amountSats} sats\nFunds: ${contract.financial}\nOffer: ${contract.eligibility}\nEvidence: ${contract.evidence??'Local record'}\nExpires: ${new Date(contract.expiresAt).toISOString()}\nReference: ${contract.hostReference}\nOperation: ${contract.operationId??'Unavailable'}\nFunding transaction: ${contract.fundingTransactionId??'Not verified'}\nCurrent transaction: ${contract.transactionId??'Not submitted'}`).join('\n\n');
  const items:readonly CollectionListItem[]=contracts.map(contract=>{const type=rowStatus(contract);return {id:contract.id,selected:selected===contract.id,buttonRef:(element:HTMLButtonElement|null)=>{if(element)buttons.current.set(contract.id,element);else buttons.current.delete(contract.id);},onSelect:()=>{setSelected(contract.id);setMessage('');},content:<CompactItemRow status={type} leading={<StatusTypeIcon type={type}/>} fields={[{icon:'🌐',label:'Network',value:contractNetworkLabel(contract.scope.network)},{icon:'⚙️',label:'Operation',value:contract.operationKind??'Offer'},{icon:'🪙',label:'Cost',value:contract.amountSats.toLocaleString('en-US')+' sats'},{icon:'🎯',label:'Purpose',value:contract.purpose},{icon:'⏳',label:'Status',value:contract.eligibility==='expired'?'Expired':contract.financial},{icon:'👤',label:'Role',value:contract.role??'Unavailable'},{icon:'📅',label:'Expires',value:new Date(contract.expiresAt).toLocaleString()}]}/>};});
  const Page=detail?CollectionDetailView:CollectionListView;
  const detailNotice=detail?<>
      <p>Role: {detail.role??'Unavailable'} · Evidence: {detail.evidence??'Local record'}. Submission is rechecked before spending.</p>
      <p>Validation: {detail.validationMode==='arkade-covenant-v2'?'Arkade co-signer':'Browser validation (less secure)'}. {detail.validationDescription??'Real contract transactions. Browser expiry checks can be bypassed by a modified client.'}</p>
      {detail.recoveryRequired&&<p role="status">Imported recovery needs network verification. Funds remain reserved and spending is disabled. Refresh Contract Details to check the original contract.</p>}
      {detail.eligibility==='expired'&&detail.financial!=='refunded'&&<p>The offer has expired. Its funds remain locked until the refund is verified.</p>}
    </>:undefined;
  return <Page network={networkLabel(context.getState().network)} title={detail?'Contract Details':'Contracts'} body={detail?'Inspect this offer and its locked funds.':'All BIS-tracked contracts for this account.'} fieldLabel={detail?'Contract':'Contracts'} report={report} listLabel="Contracts" loading={loading} items={items}
    onRefresh={()=>void refreshSelected()} refreshDisabled={!context.checkContractsAsync}
    actions={<>
      {!detail&&<button className="bis-button" onClick={()=>setRecoveryOpen(open=>!open)}>Portable recovery</button>}
      {detail&&<>
        {[...new Set([detail.fundingTransactionId,detail.transactionId].filter((id):id is string=>!!id&&/^[a-f0-9]{64}$/i.test(id)))].map(id=>{const explorer=arkExplorerTransactionUrl(detail.scope.network as TestNetwork,id);return explorer?<a className="bis-button" key={id} href={explorer} target="_blank" rel="noopener noreferrer">View transaction {id.slice(0,8)}…</a>:null;})}
        {detail.role==='player'&&<><button className="bis-button bis-primary" disabled={!available||busy||!detail.canClaim} onClick={()=>void act('claim')}>Claim</button>
        <button className="bis-button" disabled={!available||busy||!detail.canReject} onClick={()=>void act('reject')}>Reject</button></>}
        {detail.role==='game'&&<button className="bis-button" disabled={!available||busy||!detail.canRefund} onClick={()=>void act('refund')}>Refund to game</button>}
    </>}</>}
    notice={<>{detailNotice}{!detail&&recoveryOpen&&<section aria-label="Portable contract recovery">
      <p>Back up unresolved contracts for the selected local Player and Game Wallets. This encrypted file contains private contract recovery material, not wallet phrases. Restore both wallets separately on another device. Import does not submit transactions or prove payment. Close the old client before recovering on another device.</p>
      <label>Recovery password<input ref={recoveryPassword} type="password" autoComplete="off" minLength={16} maxLength={1024} disabled={recoveryBusy} /></label>
      <label>Recovery file<input ref={recoveryFile} type="file" accept="application/json,.json" disabled={recoveryBusy} /></label>
      <button className="bis-button" disabled={recoveryBusy} onClick={()=>void portableRecovery('export')}>Export encrypted recovery</button>
      <button className="bis-button" disabled={recoveryBusy} onClick={()=>void portableRecovery('import')}>Import encrypted recovery</button>
      {recoveryBusy&&<p role="status">Protecting or checking recovery. Back remains available.</p>}
      {recoveryMessage&&<p role="status">{recoveryMessage}</p>}
    </section>}{status==='unavailable'?<p role="status">Contracts are unavailable. Recovery records have been retained.</p>:status==='ready'&&!detail&&contracts.length===0?<p>No contracts.</p>:null}{detail&&detail.scope.network!==context.getState().network?<p role="status">Switch to {contractNetworkLabel(detail.scope.network)} to manage this contract.</p>:null}{message&&<p role="status">{message}</p>}</>}
    onBack={back}
  />;
}
