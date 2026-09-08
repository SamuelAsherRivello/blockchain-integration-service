import { useEffect, useRef, useState } from 'react';
import { createBisContinue } from '@bis/integration';
import { createBisContext, createBisAdminContext, createBisUi, type BisState, type BisMintAssetRequest, type BisMintAssetResult } from '@bis/integration';
import { MintAssetDialog } from './admin/MintAssetDialog';
import '@bis/integration/style.css';
import { AdminPanel } from './admin/AdminPanel';
import { selectAccountStory } from './admin/selectAccountStory';
import { GamePreview } from './preview/GamePreview';
import { CompletionPreview } from './preview/CompletionPreview';
import { SplitWorkspace } from './SplitWorkspace';
import { version } from '../package.json';
import arkadeLogo from './assets/arkade-logo.png';

// Private demo test seam; normal hosts keep the public BIS factory by default.
export function App({ contextFactory = createBisContext }: { contextFactory?: typeof createBisContext } = {}) {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<ReturnType<typeof start> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<BisState>();
  const continueController=useRef<ReturnType<typeof createBisContinue> | undefined>(undefined);
  const [continueBusy,setContinueBusy]=useState(false);
  async function requestContinue() {
    const current=session.current;if(!current || continueController.current?.getState().status==='pending')return;
    continueController.current?.dispose();
    const controller=createBisContinue(current.context,{context:crypto.randomUUID(),onSuccess:result=>{
      if(session.current===current)logAsset('Request Continue',result);
    }});
    continueController.current=controller;
    controller.subscribe(()=>{
      if(session.current!==current)return;
      const result=controller.getState();setContinueBusy(result.status==='pending');
      if(result.status!=='succeeded')logAsset('Request Continue',result);
    });
    if(!controller.getState().canPay){logAsset('Request Continue',{status:'error',message:'Log in to pay to continue.'});return;}
    await controller.pay();
  }
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
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
    const context = contextFactory();
    const adminContext = createBisAdminContext(context);
    const ui = createBisUi(context);
    const restarts = new Set<string>();
    const unsubscribeEvents = context.onEvent(event => {
      if (event.type !== 'restartRequested' || restarts.has(event.logoutId)) return;
      restarts.add(event.logoutId);
      window.location.reload();
    });
    const unsubscribe = context.subscribe(() => setState(context.getState()));
    ui.mount(container.current!);
    setState(context.getState());
    return { context, adminContext, ui, stop() { continueController.current?.dispose(); continueController.current=undefined; unsubscribeEvents(); unsubscribe(); ui.unmount(); context.dispose(); } };
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
  function selectStory(id: string) { if (completionBusy) return; setCompletionOpen(false); setSelected(id); selectAccountStory(id, session.current); }
  function showToast() { session.current?.context.showToast('This is a test message from BIS.'); }
  function showToastWithIcon() {
    const imageUrl = new URL('assets/achievements/v2/level-1-trophy.png', document.baseURI).pathname;
    session.current?.context.showToast('This is a test message from BIS.', {imageUrl});
  }
  async function reset() {
    const current = session.current;
    if(!current) return;
   
    try {
      await current.adminContext.resetClient();
      if(session.current !== current) return;
      current.stop(); session.current = start(); setSelected(null); setCompletionOpen(false); setFunding(false); setConsoleLines([]); setMintOpen(false); setPendingMint(undefined); setAssetBusy(false);
    } catch { /* No API return value is available to display. */ }
  }
  return <div className="demo-app">
    <header className="app-header"><div className="identity"><span className="brand-mark" aria-hidden="true">↗</span>Blockchain Integration Service - Demo</div><div className="version-tag"><span>v{version}</span><a className="github-link" href="https://github.com/SamuelAsherRivello/blockchain-integration-service" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg></a><a className="github-link" href="https://docs.arkadeos.com/" target="_blank" rel="noopener noreferrer" aria-label="View Arkade documentation" title="Arkade documentation"><img src={arkadeLogo} width="18" height="18" alt="" /></a></div></header>
    <SplitWorkspace>
      <AdminPanel onCompleteLevel={()=>{setCompletionOpen(true);setSelected('C6');}} completionOpen={completionOpen} onShowToast={showToast} onShowToastWithIcon={showToastWithIcon} canShowToast={!!state} onContinue={()=>void requestContinue()} continueBusy={continueBusy} onMint={()=>void openMint()} onListAssets={()=>void listAssets()} assetBusy={assetBusy} consoleOutput={consoleLines.join("\n\n")} selected={selected} accountOpen={completionBusy || state?.view === 'account' || state?.phase === 'loading' || state?.phase === 'resetting'} canReset={!completionBusy && state?.phase !== 'loading' && state?.phase !== 'resetting' && (!!selected || !!state?.canReset)} onSelect={selectStory} onReset={()=>void reset()} canFund={!!state?.hasProfile && state?.phase === 'active'} funding={funding} onFund={()=>void fundAccount()} onExplorer={()=>void fundAccount(true)} />
      <GamePreview containerRef={container}>{completionOpen && session.current && <CompletionPreview context={session.current.context} onRestart={()=>{setCompletionOpen(false);setSelected(null);}} onBusy={setCompletionBusy} />}</GamePreview>
    </SplitWorkspace>
    {mintOpen && <MintAssetDialog initial={pendingMint} onMint={mint} onClose={()=>setMintOpen(false)} />}
  </div>;
}
