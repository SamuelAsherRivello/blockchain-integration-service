import { useCallback, useEffect, useRef, useState } from 'react';
import { createBisContinue, createBisGameWallet, createBisLto } from '@bis/integration';
import { TreasureLtoPanel } from './admin/TreasureLtoPanel';
import { StorySection } from './admin/StorySection';
import { StoryAction } from './admin/StoryAction';
import { createBisContext, createBisAdminContext, createBisUi, type BisState, type BisContext } from '@bis/integration';
import { GameWalletPanel } from './admin/GameWalletPanel';
import { MintAssetDialog } from './admin/MintAssetDialog';
import { prepareMintDestination, type MintDestination } from './admin/mint-destination';
import '@bis/integration/style.css';
import { AdminPanel } from './admin/AdminPanel';
import { selectAccountStory } from './admin/selectAccountStory';
import { GamePreview } from './preview/GamePreview';
import { CompletionPreview } from './preview/CompletionPreview';
import { SplitWorkspace } from './SplitWorkspace';
import { version } from '../package.json';
import arkadeLogo from './assets/arkade-logo.png';

// Private demo test seam; normal hosts keep the public BIS factory by default.
export function App({ contextFactory = createBisContext, gameWalletFactory = createBisGameWallet }: { contextFactory?: typeof createBisContext; gameWalletFactory?: typeof createBisGameWallet } = {}) {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<ReturnType<typeof start> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<BisState>();
  const [runtimeContext,setRuntimeContext]=useState<BisContext>();
  const continueController=useRef<ReturnType<typeof createBisContinue> | undefined>(undefined);
  const [recipient, setRecipient] = useState<string | undefined>();
  const [continueBusy,setContinueBusy]=useState(false);
  const [continueReadiness,setContinueReadiness]=useState<{canPay:boolean;reason?:string}>({canPay:false,reason:'Checking balance'});
  useEffect(()=>{
    let active=true,reading=false;
    setContinueReadiness({canPay:false,reason:'Checking balance'});
    const check=async()=>{
      const context=session.current?.context;
      if(reading||!context?.getContinueAvailability)return;
      reading=true;
      try {const next=await context.getContinueAvailability();if(active&&session.current?.context===context)setContinueReadiness(next);}
      catch {if(active)setContinueReadiness({canPay:false,reason:'Balance unavailable'});}
      finally {reading=false;}
    };
    void check();const timer=setInterval(()=>void check(),15000);
    return()=>{active=false;clearInterval(timer);};
  },[state?.profileId,state?.phase,continueBusy,state?.balance,recipient]);
  async function requestContinue() {
    const current=session.current;if(!current || continueController.current?.getState().status==='pending')return;
    continueController.current?.dispose();
    const controller=createBisContinue(current.context,{context:crypto.randomUUID(),onSuccess:result=>{
      if(session.current===current)logAsset('Request Continue',result);
    }});
    continueController.current=controller;
    let notifiedStatus='';
    controller.subscribe(()=>{
      if(session.current!==current)return;
      const result=controller.getState();setContinueBusy(result.status==='pending');
      if(result.status!=='succeeded')logAsset('Request Continue',result);
      if(result.message && result.status!==notifiedStatus && (result.status==='pending' || result.status==='failed')) {
        notifiedStatus=result.status;
        current.context.showToast(result.message, {messageType: result.status === 'failed' ? 'error' : 'info'});
      }
    });
    if(!controller.getState().canPay){
      const message=current.context.getState().hasProfile
        ? controller.getState().message || 'Payment is unavailable. Try again when your account is ready.'
        : 'Log in to pay to continue.';
      logAsset('Request Continue',{status:'error',message});
      current.context.showToast(message, {messageType: 'warning'});
      return;
    }
    await controller.pay();
  }
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [funding, setFunding] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [gameWalletController,setGameWalletController]=useState<ReturnType<typeof createBisGameWallet>>();
  const gameWalletRef = useRef(gameWalletController);
  const [lto,setLto]=useState<ReturnType<typeof createBisLto>>();
  useEffect(()=>{
    if(!gameWalletController||!runtimeContext)return;
    const service=createBisLto({context:runtimeContext,gameWallet:gameWalletController});
    setLto(service);return()=>{service.dispose();setLto(undefined);};
  },[gameWalletController,runtimeContext]);
  gameWalletRef.current = gameWalletController;
  const [gameMintPresent,setGameMintPresent]=useState(false);
  useEffect(()=>{
    const check=()=>setGameMintPresent(!!gameWalletController?.getState().profileId);
    check();
    return gameWalletController?.subscribe(check);
  },[gameWalletController]);
  const [mintOpen, setMintOpen] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const logAsset = (label: string, result: unknown) => setConsoleLines([`${label}\n${JSON.stringify(result, null, 2)}`]);
  function openMint() { if (!assetBusy) setMintOpen(true); }
  const prepareMint = useCallback((destination: MintDestination) => {
    const wallet = destination === 'player' ? session.current?.context : gameWalletRef.current;
    const current = () => destination === 'player'
      ? session.current?.context === wallet && session.current?.context.getState().phase === 'active'
      : gameWalletRef.current === wallet;
    return prepareMintDestination(destination, wallet, current, result => setConsoleLines([`Mint Asset\n${JSON.stringify(result, null, 2)}`])).catch(error => {
      if (current()) setConsoleLines([`Mint Asset\n${JSON.stringify({destination, profileId:wallet?.getState().profileId, status:'error', message:error instanceof Error ? error.message : 'Destination unavailable.'}, null, 2)}`]);
      throw error;
    });
  }, []);
  async function fundAccount(explorer = false) {
    const current = session.current;
    if (!current || funding) return;
    const urls = explorer ? ['about:blank'] : ['https://bitcoinsignetfaucet.com/', 'https://signetfaucet.com/', 'https://signet.2nd.dev/'];
    const tabs = urls.map(url => {
      const tab = window.open(url, '_blank');
      if (tab) tab.opener = null;
      return tab;
    });
    if (tabs.some(tab => !tab)) setConsoleLines(['Allow pop-ups for this demo to open all requested pages.']);
    if (tabs.every(tab => !tab)) return;
    setFunding(true);
    try {
      const address = await current.adminContext.getFundingAddress();
      if (session.current !== current) { if (explorer) tabs[0]?.close(); return; }
      if (explorer) {
        if (tabs[0]) tabs[0].location.href = `https://mempool.space/signet/address/${encodeURIComponent(address)}`;
        return;
      }
      try { await navigator.clipboard.writeText(address); } catch { /* Clipboard access is optional for opening the faucet. */ }
    } catch {
      if (explorer) tabs[0]?.close();
    } finally { if (session.current === current) setFunding(false); }
  }
  const playerProfileId = useCallback(() => session.current?.context.getState().profileId, []);

  const recipientRef = useRef<string | undefined>(undefined);
  const onRecipientChange = useCallback((address: string | undefined) => {
    recipientRef.current = address;
    setRecipient(address);
  }, []);
  function start() {
    // Read the currently imported wallet at submission time without replacing the
    // player context or interrupting reconciliation of an existing payment.
    const context = contextFactory({get continueRecipient() { return recipientRef.current; }});
    setRuntimeContext(context);
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
      current.stop(); session.current = start(); setSelected(null); setCompletionOpen(false); setFunding(false); setConsoleLines([]); setMintOpen(false); setAssetBusy(false);
    } catch { /* No API return value is available to display. */ }
  }
  return <div className="demo-app">
    <header className="app-header"><div className="identity"><span className="brand-mark" aria-hidden="true">↗</span>Blockchain Integration Service - Demo</div><div className="version-tag"><span>v{version}</span><a className="github-link" href="https://github.com/SamuelAsherRivello/blockchain-integration-service" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" /></svg></a><a className="github-link" href="https://docs.arkadeos.com/" target="_blank" rel="noopener noreferrer" aria-label="View Arkade documentation" title="Arkade documentation"><img src={arkadeLogo} width="18" height="18" alt="" /></a></div></header>
    <SplitWorkspace>
      <AdminPanel contracts={<StorySection title="G. Contracts"><p className="story-summary">Stories: G1, G2</p><StoryAction id="G1" label="Contracts UI" disabled={!state?.profileId} onClick={()=>{setSelected('G1');session.current?.context.openAccountDialog();session.current?.context.openAccountContracts?.();}}/><TreasureLtoPanel context={runtimeContext} offers={lto} gameWallet={gameWalletController} onLog={result=>setConsoleLines(previous=>[...previous.slice(-19),`G2. LTO Treasure Chest\n${JSON.stringify(result,null,2)}`])}/></StorySection>} mintAvailable={gameMintPresent || (!!state?.hasProfile && state.phase === 'active')} mintReason="Awaiting Wallet" playerActive={!!state?.hasProfile && state.phase === 'active'} continueReason={continueReadiness.reason} continueAvailable={!!state?.hasProfile && state.phase === 'active' && continueReadiness.canPay} gameWallet={<GameWalletPanel onController={setGameWalletController} playerContext={session.current?.context} playerActive={!!state?.hasProfile && state.phase === 'active'} onRecipientChange={onRecipientChange} walletFactory={gameWalletFactory} onDetails={details => logAsset('Game Wallet', details)} playerProfileId={playerProfileId} recipient={recipient} />} onCompleteLevel={()=>{session.current?.context.closeAccount();setCompletionOpen(true);setSelected('C2');}} completionOpen={completionOpen} onShowToast={showToast} onShowToastWithIcon={showToastWithIcon} canShowToast={!!state} onContinue={()=>void requestContinue()} continueBusy={continueBusy} onMint={()=>void openMint()} assetBusy={assetBusy} consoleOutput={consoleLines.join("\n\n")} selected={selected} accountOpen={completionBusy || state?.view === 'account' || state?.phase === 'loading' || state?.phase === 'resetting'} canReset={!completionBusy && state?.phase !== 'loading' && state?.phase !== 'resetting' && (!!selected || !!state?.canReset)} onSelect={selectStory} onReset={()=>void reset()} canFund={!!state?.hasProfile && state?.phase === 'active'} funding={funding} onFund={()=>void fundAccount()} onExplorer={()=>void fundAccount(true)} />
      <GamePreview containerRef={container}>{completionOpen && session.current && <CompletionPreview context={session.current.context} onRestart={()=>{setCompletionOpen(false);setSelected(null);}} onBusy={setCompletionBusy} />}</GamePreview>
    </SplitWorkspace>
    {mintOpen && <MintAssetDialog prepare={prepareMint} onBusy={setAssetBusy} onClose={()=>setMintOpen(false)} />}
  </div>;
}

