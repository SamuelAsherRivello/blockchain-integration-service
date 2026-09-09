import { ReportTextArea } from './ReportTextArea';
import { ItemList, ItemListDetail } from './ItemList';
import { IconButton } from './IconButton';
import { usePendingNotice } from './PendingOperationDialog';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { BisAsset } from '../core/assets';
import type { BisAssets } from '../core/asset-presentation';
import { assetExplorerUrl, assetName, formatAssetDetail, formatAssetQuantity, shortAssetId } from '../core/asset-presentation';
import { useClipboardCopy } from './useClipboardCopy';
import { CopyableValueField } from './CopyableValueField';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { BisToastOptions } from '../core/toasts';
import type { BisBurnAssetRequest, BisBurnAssetResult } from '../core/burning';

const preparedIcons = new Set<string>();
function AssetIcon({url, background = false}: {url?:string; background?:boolean}) {
  const [failed,setFailed]=useState<string>();
  let source:string|undefined;
  try {const parsed=new URL(url!);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)source=parsed.href;} catch { /* Missing or malformed metadata uses local artwork. */ }
  const [ready,setReady]=useState<string>();
  const image=useRef<HTMLImageElement>(null);
  const loading=!!source && failed!==source && ready!==source && !preparedIcons.has(source);
  usePendingNotice(loading && !background,'Loading...',undefined,()=>{});
  useEffect(()=>{
    if(!loading)return;
    const timer=setTimeout(()=>setFailed(source),30000);
    return()=>clearTimeout(timer);
  },[source,loading]);
  async function loaded() {
    const value=source;
    try {await image.current?.decode();} catch {setFailed(value);return;}
    if(value){preparedIcons.add(value);setReady(value);}
  }
  return <span className="bis-asset-icon" aria-hidden="true">{source&&failed!==source?<img ref={image} onLoad={()=>void loaded()} src={source} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(source)} />:<svg width="19.2" height="19.2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z M3 7l9 5 9-5 M12 12v10" /></svg>}</span>;
}

function AssetDetails({asset, background}: {asset: BisAsset; background?:boolean}) {
  const id = useId();
  const report = formatAssetDetail(asset);
  const idCopy = useClipboardCopy(() => asset.assetId, asset);
  return <>
    <div className="bis-asset-summary">
      <AssetIcon url={asset.iconUrl} background={background} />
      <strong className="bis-asset-quantity">{formatAssetQuantity(asset)}</strong>
      <span>{assetName(asset)}</span>
    </div>
    <CopyableValueField label="Asset ID" value={asset.assetId} copy={idCopy} className="bis-asset-id" feedback={false} selectOnFocus={false} />
    <span className="bis-sr-only" role="status">{idCopy.status === 'copied' ? 'Asset ID copied.' : ''}</span>
    {idCopy.status === 'failed' && <>
      <p role="status">Could not copy. Select the text and copy it manually.</p>
      <label htmlFor={`${id}-manual`}>Asset details for manual copy</label>
      <ReportTextArea id={`${id}-manual`} className="bis-asset-manual" rows={8} value={report} />
    </>}
  </>;
}

export function AccountAssets({assets, onDetailChange, onBack, onBurn, onRefresh, onBusyChange, onToast}: {assets: BisAssets; onDetailChange: (open: boolean) => void; onBack: () => void; onBurn:(request:BisBurnAssetRequest)=>Promise<BisBurnAssetResult>; onRefresh:()=>Promise<void>; onBusyChange:(busy:boolean)=>void; onToast:(message:string, options?:BisToastOptions)=>void}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmation,setConfirmation]=useState<BisAsset>();
  const [burning,setBurning]=useState(false);
  const [burnError,setBurnError]=useState('');
  const [backgroundImages,setBackgroundImages]=useState(false);
  const burnInFlight=useRef(false), burnOrigin=useRef(false), mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onBusyChange(false);};},[onBusyChange]);
  useEffect(()=>{onBusyChange(burning||!!confirmation);},[burning,confirmation,onBusyChange]);
  async function burn(asset:BisAsset) {
    if(burnInFlight.current)return;
    burnInFlight.current=true;burnOrigin.current=true;setConfirmation(undefined);setBurning(true);setBurnError('');
    let confirmed=false;
    try {
      onToast('Asset burn (Pending)', {messageType:'info'});
      const result=await onBurn({operationId:crypto.randomUUID(),assetId:asset.assetId,quantity:asset.quantity});
      if(!mounted.current)return;
      if(result.status!=='burned')setBurnError(result.code==='outcome-unknown'?'Outcome not yet confirmed. The burn may still complete. Do not submit it again.':result.message);
      if(result.status==='burned'){confirmed=true;onToast('Asset burn (Confirmed)', {messageType:'success'});setBackgroundImages(true);setDetailOpen(false);setSelectedId(undefined);restoreFocus.current=true;await onRefresh();}
    } catch {if(mounted.current)setBurnError(confirmed?'Assets could not be loaded.':'Outcome not yet confirmed. The burn may still complete. Do not submit it again.');}
    finally {burnInFlight.current=false;if(mounted.current)setBurning(false);}
  }
  const rows = assets.status === 'ready' ? assets.assets : [];
  const report = rows.map(formatAssetDetail).join('\n\n');
  const selected = rows.find(asset => asset.assetId === selectedId);
  const explorerUrl = selected ? assetExplorerUrl(selected.assetId) : undefined;
  const container = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const scroll = useRef(0);
  const restoreFocus = useRef(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useLayoutEffect(() => { onDetailChange(detailOpen); }, [detailOpen, onDetailChange]);
  useEffect(() => () => onDetailChange(false), [onDetailChange]);
  useLayoutEffect(() => {
    if (assets.status === 'ready' && selectedId && !selected) {
      setSelectedId(undefined);
      if (detailOpen) {
        setNotice('Asset is no longer in your owned assets.');
        restoreFocus.current = true;
        setDetailOpen(false);
      }
    }
  }, [assets, selectedId, selected, detailOpen]);
  useLayoutEffect(() => {
    if (detailOpen) return;
    if (list.current) list.current.scrollTop = scroll.current;
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    const frame = requestAnimationFrame(() => {
      const target = selectedId ? buttons.current.get(selectedId) : undefined;
      (target ?? container.current?.closest('section')?.querySelector('h2'))?.focus({preventScroll:true});
    });
    return () => cancelAnimationFrame(frame);
  }, [detailOpen, assets, selectedId]);
  const loading = assets.status === 'idle' || assets.status === 'loading';
  useLayoutEffect(()=>{if(!burning && !burnError && assets.status==='ready')burnOrigin.current=false;},[burning,burnError,assets.status]);
  useEffect(()=>{if(loading && !burning)setBackgroundImages(false);},[loading,burning]);
  usePendingNotice(loading && !burning,'Loading...', burnError || (assets.status==='unavailable'?'Assets could not be loaded.':undefined),()=>{
    setBurnError('');
    if(detailOpen || burnOrigin.current){burnOrigin.current=false;setDetailOpen(false);setSelectedId(undefined);restoreFocus.current=true;if(assets.status!=='ready')void onRefresh();}
    else onBack();
  });
  const Page=detailOpen?ItemListDetail:ItemList;
  return <Page title={detailOpen?'Asset Detail':'Assets'} body={detailOpen?'Inspect this asset and its ownership.':'Assets held by this account.'}
    fieldLabel={detailOpen?'Asset details':'Assets'} report={detailOpen&&selected?formatAssetDetail(selected):report} loading={loading} listLabel="Owned assets"
    headingActions={<IconButton label="Refresh Assets" disabled={loading||burning||!!confirmation} onClick={()=>void onRefresh()}><span aria-hidden="true">↻</span></IconButton>}
    listRef={list} onScroll={event=>{scroll.current=event.currentTarget.scrollTop;}}
    items={rows.map(asset=>({id:asset.assetId,selected:selectedId===asset.assetId,
      buttonRef:element=>{if(element)buttons.current.set(asset.assetId,element);else buttons.current.delete(asset.assetId);},
      onSelect:()=>{if(list.current)scroll.current=list.current.scrollTop;setSelectedId(asset.assetId);setNotice('');setBurnError('');setDetailOpen(true);},
      content:<><AssetIcon url={asset.iconUrl} background={backgroundImages||assets.status==='ready'&&assets.background}/><span className="bis-asset-row-text"><strong>{assetName(asset)}</strong><span>{formatAssetQuantity(asset)}</span><code>{shortAssetId(asset.assetId)}</code></span></>}))}
    detail={detailOpen&&selected?<div ref={container} className="bis-asset-detail"><AssetDetails key={selected.assetId} asset={selected} background={assets.status==='ready'&&assets.background}/></div>:undefined}
    notice={notice&&assets.status==='ready'?<p role="status">{notice}</p>:!loading&&assets.status==='ready'&&!rows.length?<p>No assets.</p>:null}
    actions={<>
      {detailOpen && selected && <button type="button" className="bis-button" disabled={burning || !explorerUrl} title={!explorerUrl ? 'Explorer unavailable: invalid asset ID.' : undefined} onClick={() => { if (explorerUrl) window.open(explorerUrl, '_blank', 'noopener,noreferrer'); }}>Open On Explorer</button>}
      {detailOpen && selected && <button className="bis-button bis-danger" disabled={burning} onClick={()=>setConfirmation(selected)}>Burn</button>}
    </>} backDisabled={burning} onBack={()=>{if(detailOpen){restoreFocus.current=true;setDetailOpen(false);}else onBack();}}
    overlay={confirmation&&<ConfirmationDialog onCancel={()=>setConfirmation(undefined)} onConfirm={()=>void burn(confirmation)}/>}
  />;
}
