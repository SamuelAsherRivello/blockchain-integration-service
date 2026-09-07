import { usePendingNotice } from './PendingOperationDialog';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { BisAsset } from '../core/assets';
import type { BisAssets } from '../core/asset-presentation';
import { assetExplorerUrl, assetName, formatAssetDetail, formatAssetQuantity, shortAssetId } from '../core/asset-presentation';
import { CopyFieldLabel } from './CopyFieldLabel';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { BisBurnAssetRequest, BisBurnAssetResult } from '../core/burning';

const preparedIcons = new Set<string>();
function AssetIcon({url}: {url?:string}) {
  const [failed,setFailed]=useState<string>();
  let source:string|undefined;
  try {const parsed=new URL(url!);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)source=parsed.href;} catch { /* Missing or malformed metadata uses local artwork. */ }
  const [ready,setReady]=useState<string>();
  const image=useRef<HTMLImageElement>(null);
  const loading=!!source && failed!==source && ready!==source && !preparedIcons.has(source);
  usePendingNotice(loading,'Loading...',undefined,()=>{});
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
  return <span className="bis-asset-icon" aria-hidden="true">{source&&failed!==source?<img ref={image} onLoad={()=>void loaded()} src={source} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(source)} />:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z M3 7l9 5 9-5 M12 12v10" /></svg>}</span>;
}

function AssetDetails({asset}: {asset: BisAsset}) {
  const id = useId();
  const report = formatAssetDetail(asset);
  const active = useRef(true);
  const copyGeneration = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [copy, setCopy] = useState<Partial<Record<'id' | 'details', 'copying' | 'copied' | 'failed'>>>({});
  useLayoutEffect(() => { copyGeneration.current++; setCopy({}); }, [asset]);
  async function copyText(kind: 'id' | 'details') {
    if (copy[kind] === 'copying') return;
    const generation = copyGeneration.current;
    setCopy(previous => ({...previous, [kind]:'copying'}));
    try {
      await navigator.clipboard.writeText(kind === 'id' ? asset.assetId : report);
      if (active.current && generation === copyGeneration.current) setCopy(previous => ({...previous, [kind]:'copied'}));
    } catch {
      if (active.current && generation === copyGeneration.current) setCopy(previous => ({...previous, [kind]:'failed'}));
    }
  }
  return <>
    <CopyFieldLabel label="Details" copied={copy.details==='copied'} disabled={copy.details==='copying'} onCopy={()=>void copyText('details')} />
    <div className="bis-asset-summary">
      <AssetIcon url={asset.iconUrl} />
      <strong className="bis-asset-quantity">{formatAssetQuantity(asset)}</strong>
      <span>{assetName(asset)}</span>
    </div>
    <div className="bis-asset-id">
      <CopyFieldLabel htmlFor={id} label="Asset ID" copied={copy.id === 'copied'} disabled={copy.id === 'copying'} onCopy={() => void copyText('id')} />
      <input id={id} readOnly value={asset.assetId} />
    </div>
    <span className="bis-sr-only" role="status">{copy.id === 'copied' ? 'Asset ID copied.' : copy.details === 'copied' ? 'Asset details copied.' : ''}</span>
    {(copy.id === 'failed' || copy.details === 'failed') && <>
      <p role="status">Could not copy. Select the text and copy it manually.</p>
      <label htmlFor={`${id}-manual`}>Asset details for manual copy</label>
      <textarea id={`${id}-manual`} className="bis-asset-manual" readOnly rows={8} value={report} />
    </>}
  </>;
}

export function AccountAssets({assets, onDetailChange, onBack, onBurn, onRefresh, onBusyChange}: {assets: BisAssets; onDetailChange: (open: boolean) => void; onBack: () => void; onBurn:(request:BisBurnAssetRequest)=>Promise<BisBurnAssetResult>; onRefresh:()=>Promise<void>; onBusyChange:(busy:boolean)=>void}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmation,setConfirmation]=useState<BisAsset>();
  const [burning,setBurning]=useState(false);
  const [burnError,setBurnError]=useState('');
  const burnInFlight=useRef(false), burnOrigin=useRef(false), mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onBusyChange(false);};},[onBusyChange]);
  useEffect(()=>{onBusyChange(burning||!!confirmation);},[burning,confirmation,onBusyChange]);
  async function burn(asset:BisAsset) {
    if(burnInFlight.current)return;
    burnInFlight.current=true;burnOrigin.current=true;setConfirmation(undefined);setBurning(true);setBurnError('');
    try {
      const result=await onBurn({operationId:crypto.randomUUID(),assetId:asset.assetId,quantity:asset.quantity});
      if(!mounted.current)return;
      if(result.status!=='burned')setBurnError(result.code==='outcome-unknown'?'Outcome not yet confirmed. The burn may still complete. Do not submit it again.':result.message);
      if(result.status==='burned'){setDetailOpen(false);setSelectedId(undefined);restoreFocus.current=true;await onRefresh();}
    } catch {if(mounted.current)setBurnError('Outcome not yet confirmed. The burn may still complete. Do not submit it again.');}
    finally {burnInFlight.current=false;if(mounted.current)setBurning(false);}
  }
  const rows = assets.status === 'ready' ? assets.assets : [];
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
  usePendingNotice(burning || loading,burning?'Burning...':'Loading...', burnError || (assets.status==='unavailable'?'Assets could not be loaded.':undefined),()=>{
    setBurnError('');
    if(detailOpen || burnOrigin.current){burnOrigin.current=false;setDetailOpen(false);setSelectedId(undefined);restoreFocus.current=true;if(assets.status!=='ready')void onRefresh();}
    else onBack();
  });
  return <div ref={container} className="bis-assets">
    <div className="bis-assets-content" aria-busy={loading}>
      {detailOpen ? <div className="bis-asset-detail">
        {selected && <AssetDetails key={selected.assetId} asset={selected} />}
      </div> : <ul ref={list} className="bis-asset-list" aria-label="Owned assets" onScroll={event => { scroll.current = event.currentTarget.scrollTop; }}>
        {rows.map(asset => <li key={asset.assetId}><button className="bis-asset-row" type="button" aria-pressed={selectedId === asset.assetId}
          ref={element => { if (element) buttons.current.set(asset.assetId, element); else buttons.current.delete(asset.assetId); }}
          onClick={() => { if (list.current) scroll.current = list.current.scrollTop; setSelectedId(asset.assetId); setNotice('');setBurnError(''); setDetailOpen(true); }}>
          <AssetIcon url={asset.iconUrl} /><span className="bis-asset-row-text"><strong>{assetName(asset)}</strong><span>{formatAssetQuantity(asset)}</span><code>{shortAssetId(asset.assetId)}</code></span>
        </button></li>)}
      </ul>}
      {assets.status === 'ready' && !rows.length && <p role="status">No assets found.</p>}
      {notice && assets.status === 'ready' && <p role="status">{notice}</p>}
    </div>
    <div className={`bis-actions${detailOpen && selected ? ' bis-asset-detail-actions' : ''}`}>
      {detailOpen && selected && <button type="button" className="bis-button" disabled={burning || !explorerUrl} title={!explorerUrl ? 'Explorer unavailable: invalid asset ID.' : undefined} onClick={() => { if (explorerUrl) window.open(explorerUrl, '_blank', 'noopener,noreferrer'); }}>Open On Explorer</button>}
      {detailOpen && selected && <button className="bis-button bis-danger" disabled={burning} onClick={()=>setConfirmation(selected)}>Burn</button>}
      <button className="bis-button" disabled={burning} onClick={() => {
      if (detailOpen) { restoreFocus.current = true; setDetailOpen(false); } else onBack();
    }}>Back</button></div>
    {confirmation && <ConfirmationDialog onCancel={()=>setConfirmation(undefined)} onConfirm={()=>void burn(confirmation)} />}
  </div>;
}
