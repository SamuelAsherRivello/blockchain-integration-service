import { useEffect, useRef, useState } from 'react';
import { createBisContext, createBisAdminContext, createBisUi, type BisState, type BisMintAssetRequest, type BisMintAssetResult } from '@bis/integration';
import { MintAssetDialog } from './admin/MintAssetDialog';
import '@bis/integration/style.css';
import { AdminPanel } from './admin/AdminPanel';
import { selectAccountStory } from './admin/selectAccountStory';
import { GamePreview } from './preview/GamePreview';
import { SplitWorkspace } from './SplitWorkspace';
import { version } from '../package.json';

export function App() {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<ReturnType<typeof start> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<BisState>();
  const [funding, setFunding] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [mintOpen, setMintOpen] = useState(false);
  const [pendingMint, setPendingMint] = useState<BisMintAssetRequest>();
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const logAsset = (label: string, result: unknown) => setConsoleLines(lines => [...lines, `${label}\n${JSON.stringify(result, null, 2)}`].slice(-100));
  async function openMint() {
    const current = session.current; if (!current || assetBusy) return;
    setAssetBusy(true);
    try {
      const pending = await current.context.getPendingAssetMint();
      if (session.current !== current) return;
      if (pending.status === 'error' && pending.code !== 'account-required') { logAsset('Mint Asset', pending); return; }
      setPendingMint(pending.status === 'success' ? pending.request ?? undefined : undefined); setMintOpen(true);
    } finally { if (session.current === current) setAssetBusy(false); }
  }
  async function mint(request: BisMintAssetRequest): Promise<BisMintAssetResult> {
    const current = session.current!; setAssetBusy(true);
    logAsset('Mint Asset', {status:'pending', profileId:current.context.getState().profileId, operationId:request.operationId});
    try {
      const result = await current.context.mintAsset(request);
      if (session.current === current) logAsset('Mint Asset', result);
      return result;
    } catch { const result = {status:'error',code:'unavailable',message:'Mint unavailable.'} as const; if(session.current===current)logAsset('Mint Asset',result); return result; }
    finally { if (session.current === current) setAssetBusy(false); }
  }
  async function listAssets() {
    const current = session.current; if (!current || assetBusy) return;
    setAssetBusy(true); logAsset('List Assets', {status:'pending',profileId:current.context.getState().profileId});
    try { const result = await current.context.listAssets(); if (session.current === current) logAsset('List Assets',result); }
    catch { if(session.current===current)logAsset('List Assets',{status:'error',message:'Assets unavailable.'}); }
    finally { if(session.current===current)setAssetBusy(false); }
  }
  async function fundAccount(explorer = false) {
    const current = session.current;
    if (!current || funding) return;
    const faucet = window.open('about:blank', '_blank');
    if (!faucet) return;
    faucet.opener = null;
    setFunding(true);
    try {
      const address = await current.adminContext.getFundingAddress();
      if (session.current !== current) { faucet.close(); return; }
      if (explorer) {
        faucet.location.href = `https://mempool.space/signet/address/${encodeURIComponent(address)}`;
        return;
      }
      try { await navigator.clipboard.writeText(address); } catch { /* Clipboard access is optional for opening the faucet. */ }
      if (session.current !== current) { faucet.close(); return; }
      faucet.location.href = 'https://signetfaucet.com/';
    } catch {
      faucet.close();
    } finally { if (session.current === current) setFunding(false); }
  }
  function start() {
    const context = createBisContext();
    const adminContext = createBisAdminContext(context);
    const ui = createBisUi(context);
    const unsubscribe = context.subscribe(() => setState(context.getState()));
    ui.mount(container.current!);
    setState(context.getState());
    return { context, adminContext, ui, stop() { unsubscribe(); ui.unmount(); context.dispose(); } };
  }
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) session.current = start(); });
    return () => {
      cancelled = true;
      const old = session.current;
      session.current = null;
      queueMicrotask(() => old?.stop());
    };
  }, []);
  function selectStory(id: string) { setSelected(id); selectAccountStory(id, session.current); }
  async function reset() {
    const current = session.current;
    if(!current) return;
   
    try {
      await current.adminContext.resetClient();
      if(session.current !== current) return;
      current.stop(); session.current = start(); setSelected(null); setFunding(false); setConsoleLines([]); setMintOpen(false); setPendingMint(undefined); setAssetBusy(false);
    } catch { /* No API return value is available to display. */ }
  }
  return <div className="demo-app">
    <header className="app-header"><div className="identity"><span className="brand-mark" aria-hidden="true">↗</span>Blockchain Integration Service - Demo</div><div className="version-tag"><span>v{version}</span><a className="github-link" href="https://github.com/SamuelAsherRivello/blockchain-integration-service" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg></a></div></header>
    <SplitWorkspace>
      <AdminPanel onMint={()=>void openMint()} onListAssets={()=>void listAssets()} assetBusy={assetBusy} consoleOutput={consoleLines.join("\n\n")} selected={selected} accountOpen={state?.view === 'account' || state?.phase === 'loading' || state?.phase === 'resetting'} canReset={state?.phase !== 'loading' && state?.phase !== 'resetting' && (!!selected || !!state?.canReset)} onSelect={selectStory} onReset={()=>void reset()} canFund={!!state?.hasProfile && state?.phase === 'active'} funding={funding} onFund={()=>void fundAccount()} onExplorer={()=>void fundAccount(true)} />
      <GamePreview containerRef={container} />
    </SplitWorkspace>
    {mintOpen && <MintAssetDialog initial={pendingMint} onMint={mint} onClose={()=>setMintOpen(false)} />}
  </div>;
}
