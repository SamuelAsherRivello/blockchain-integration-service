import { ReportTextArea } from './ReportTextArea';
import { ItemList, ItemListDetail } from './ItemList';
import { usePendingNotice } from './PendingOperationDialog';
import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { formatTransactionDetail, formatTransactions, transactionRowPresentation, transactionExplorerUrl, withContractActivity, type BisActivity } from '../core/activity';
import type { BisContract } from '../core/contracts';
import type { BisContext } from '../core/context';
import { RecoveryInfoDialog } from './recovery-window';
import { formatOperationRecovery, operationMatches, withWalletOperationActivity, type WalletOperationsReport } from '../core/activity-operations';
import type { RecoveryContext } from './TransactionRecovery';
import { formatTransferRecoveryReport } from '../core/boarding-status';
import { CompactItemRow, StatusTypeIcon, type StatusType } from './StatusTypeIcon';

export function AccountActivity({ activity, onDetailChange, context }: { activity: BisActivity; onDetailChange: (open: boolean) => void; context?: Pick<BisContext, 'checkAccountTransfer' | 'closeAccount' | 'refreshActivity'> & Partial<RecoveryContext & Pick<BisContext,'checkContracts'>> }) {
  const id = useId();
  const [recoveryDialog, setRecoveryDialog] = useState<{ report: string; trigger: HTMLButtonElement }>();
  const [selectedId, setSelectedId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [report, setReport] = useState<WalletOperationsReport>();
  const [reportError, setReportError] = useState(false);
  const [contracts,setContracts]=useState<readonly BisContract[]>([]);
  useEffect(()=>{
    if(!context?.checkContracts)return;
    let active=true,reading=false;
    const refresh=async()=>{if(reading)return;reading=true;try{const result=await context.checkContracts!({includeResolved:true});if(active&&result.status==='ready')setContracts(result.contracts);}catch{}finally{reading=false;}};
    void refresh();const timer=setInterval(()=>void refresh(),2000);
    return()=>{active=false;clearInterval(timer);};
  },[context]);
  useEffect(() => {
    if (!context?.getWalletOperations) return;
    let active = true;
    void context.getWalletOperations().then(value => { if (active) { setReport(value); setReportError(false); } })
      .catch(() => { if (active) { setReport(undefined); setReportError(true); } });
    return () => { active = false; };
  }, [context, activity]);
  const rows = withContractActivity(withWalletOperationActivity(activity.status === 'ready' || activity.status === 'unavailable' ? activity.transactions ?? [] : [], report?.operations ?? []),contracts);
  const selected = rows.find(row => row.id === selectedId);
  const opened = detailOpen ? selected : undefined;
  const recovery = opened ? report?.operations.filter(op => operationMatches(opened, op)) ?? [] : [];
  const funds = report && recovery.length ? [
    `Wallet total: ${report.totalSats === undefined ? 'Unavailable' : `${report.totalSats} sats`}`,
    `Wallet reserved inputs: ${report.reservedInputSats === undefined ? 'Unavailable' : `${report.reservedInputSats} sats`}`,
    `Available for independent payments: ${report.availableSats === undefined ? 'Unavailable' : `${report.availableSats} sats`}`,
    ...(report.reason ? [report.reason] : []),
  ].join('\n') : '';
  const text = opened ? [formatTransactionDetail(opened), ...recovery.map(formatOperationRecovery), ...(funds ? [funds] : [])].join('\n\n') : formatTransactions(rows);
  const explorerUrl = opened ? transactionExplorerUrl(opened) : undefined;
  const recoveryText = [opened?.transfer ? formatTransferRecoveryReport(opened.transfer) : '', ...recovery.map(formatOperationRecovery), funds].filter(Boolean).join('\n\n');
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useLayoutEffect(() => { onDetailChange(detailOpen); }, [detailOpen, onDetailChange]);
  useLayoutEffect(() => { if (activity.status==='ready' && !selected) { setSelectedId(undefined); setDetailOpen(false); } }, [selected?.id,activity.status]);
  useEffect(() => () => onDetailChange(false), [onDetailChange]);
  const loading = activity.status === 'idle' || activity.status === 'loading';
  const foreground=useRef(true);
  if(loading)foreground.current=true;
  if(activity.status==='ready')foreground.current=false;
  usePendingNotice(loading,'Loading...', foreground.current && !rows.length && activity.status==='unavailable'?'Transactions could not be loaded.':undefined,()=>{
    if(detailOpen){setDetailOpen(false);setSelectedId(undefined);void context?.refreshActivity();}
    else context?.closeAccount();
  });
  const Page=opened?ItemListDetail:ItemList;
  return <Page title={opened?'Transaction Detail':'Transactions'} body={opened?'Inspect this transaction and its recovery status.':'Transactions recorded for this account.'}
    fieldLabel={opened?'Transaction':'Transactions'} report={text} listLabel="Transactions" loading={loading}
    onRefresh={()=>context?.refreshActivity()} refreshDisabled={!context?.refreshActivity}
    items={rows.map(row=>{const presentation=transactionRowPresentation(row);return {id:row.id,selected:selectedId===row.id,
      buttonRef:element=>{if(element)buttons.current.set(row.id,element);else buttons.current.delete(row.id);},
      onSelect:()=>{setSelectedId(row.id);setRecoveryDialog(undefined);setDetailOpen(true);},
      content:<CompactItemRow status={presentation.messageType as StatusType} leading={<StatusTypeIcon type={presentation.messageType as StatusType}/>} fields={[
        {icon:'⚙️',label:'Operation',value:presentation.operation},{icon:'✅',label:'Status',value:presentation.status},
        {icon:'📡',label:'Chain',value:presentation.network},{icon:'🪙',label:'Cost',value:presentation.cost},
        {icon:row.direction==='Outgoing'||row.direction==='Arkade → Bitcoin'?'↗️':'↙️',label:'Direction',value:row.direction},{icon:'🕒',label:'Elapsed',value:presentation.time,title:presentation.fullDate},
      ]}/>};})}
    detail={opened?<ReportTextArea id={id} aria-label="Transaction" rows={12} value={text}/>:undefined}
    notice={<>{reportError&&<p role="status">Pending recovery details unavailable. Use Refresh to retry.</p>}
      {activity.status==='unavailable'&&<p role="status">{rows.length?'Showing available records. Full transaction history could not be refreshed. Use Refresh to retry.':'Transactions unavailable. Use Refresh to retry.'}</p>}
      {activity.status==='ready'&&!rows.length&&<p>No transactions.</p>}</>}
    actions={opened&&<>
        <button type="button" className="bis-button" disabled={!recoveryText} onClick={event => setRecoveryDialog({ report: recoveryText, trigger: event.currentTarget })}>View Recovery Info</button>
        <button type="button" className="bis-button" disabled={!explorerUrl} title={!explorerUrl ? 'Explorer unavailable: no supported transaction ID has been reported yet.' : undefined} onClick={() => { if (explorerUrl) window.open(explorerUrl, '_blank', 'noopener,noreferrer'); }}>Open On Explorer</button>
      </>}
    onBack={()=>{if(opened){const previous=opened.id;setDetailOpen(false);onDetailChange(false);requestAnimationFrame(()=>buttons.current.get(previous)?.focus());}else context?.closeAccount();}}
    overlay={recoveryDialog&&<RecoveryInfoDialog {...recoveryDialog} onBack={()=>setRecoveryDialog(undefined)}/>}
  />;
}
