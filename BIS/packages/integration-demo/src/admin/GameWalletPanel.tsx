import { StoryButton } from './StoryButton';
import { StorySection } from './StorySection';
import { useEffect, useRef, useState } from 'react';
import { createBisGameWallet, type BisGameWalletState, type BisContext } from '@bis/integration';

export function GameWalletPanel({onController, playerProfileId, recipient, onDetails, onRecipientChange, walletFactory = createBisGameWallet, playerContext, playerActive = false}: {
  onController?(controller: ReturnType<typeof createBisGameWallet> | undefined): void; playerContext?: BisContext; playerActive?: boolean;
  onRecipientChange?(recipient: string | undefined): void;
  walletFactory?: typeof createBisGameWallet; playerProfileId(): string | undefined; recipient?: string; onDetails(details: unknown): void;
}) {
  const [controller, setController] = useState<ReturnType<typeof createBisGameWallet>>();
  const [state, setState] = useState<BisGameWalletState>({status:'loading'});
  const consoleRef = useRef(onDetails);
  consoleRef.current = onDetails;
  const savedRecipient = useRef<string | undefined>(undefined);
  useEffect(() => {
    const address = state.addresses?.arkadeAddress;
    if (!address || savedRecipient.current === address) return;
    if (!import.meta.env.DEV) {
      consoleRef.current({operation:'Game Wallet Configuration', message:'Use the local admin to save this public address into the projects, then rebuild and deploy Stealth.'});
      return;
    }
    let active = true;
    void fetch('/__bis/game-wallet-recipient', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({address}),
    }).then(async response => {
      if (!response.ok || (await response.json()).saved !== true) throw Error();
      if (!active) return;
      savedRecipient.current = address;
      consoleRef.current({operation:'Game Wallet Configuration', address, message:'Public receiving address saved to BIS and Stealth. Future Stealth builds include it.'});
    }).catch(() => {
      if (active) consoleRef.current({operation:'Game Wallet Configuration', message:'Could not save the public address to both projects. Check that both local project folders are available, then use F3 Details to retry.'});
    });
    return () => { active = false; };
  }, [state.addresses?.arkadeAddress]);
  const [entry, setEntry] = useState(false), [phrase, setPhrase] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const setPaymentMessage = (message: string) => onDetails({operation:'Pay Player', message});
  const [paymentRevision, setPaymentRevision] = useState(0);
  const [boardingBusy, setBoardingBusy] = useState(false);
  const [boardingState, setBoardingState] = useState<'ready' | 'waiting' | 'boarded' | 'unknown'>('unknown');
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    setBoardingState('unknown');
    if (!controller || !state.profileId || state.status !== 'ready') return;
    const check = async () => {
      try {
        const result = await controller.checkLiveBoardingState();
        if (!stopped) setBoardingState(result);
      } catch {
        // A failed read is not live proof that boarding is waiting.
        if (!stopped) setBoardingState('unknown');
      }
      if (!stopped) timer = setTimeout(() => void check(), 15000);
    };
    void check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [controller, state.profileId, state.status, boardingBusy]);
  const [quote, setQuote] = useState<Awaited<ReturnType<ReturnType<typeof createBisGameWallet>['quoteBoarding']>>>();
  const setBoardingMessage = (message: string) => { if (message) onDetails({operation:'Board Game Wallet', message}); };
  useEffect(() => { setQuote(undefined); }, [state.profileId]);
  useEffect(() => { if (state.message) onDetails({operation:'Game Wallet', message:state.message}); }, [state.message]);
  useEffect(() => {
    const wallet = walletFactory({playerProfileId,serviceUrl:import.meta.env.VITE_BIS_WALLET_SERVICE_URL || (import.meta.env.DEV?'http://127.0.0.1:8787':'/__bis/wallet'),migrateSavedWallet:true});
    const update = () => {
      const current = wallet.getState();
      setState(current);
      onRecipientChange?.(current.profileId ? current.addresses?.arkadeAddress : undefined);
    };
    setController(wallet); onController?.(wallet); update();
    const unsubscribe = wallet.subscribe(update);
    return () => { onController?.(undefined); unsubscribe(); wallet.dispose(); };
  }, [playerProfileId, walletFactory, onRecipientChange, onController]);
  const busy = !controller || state.status === 'loading' || boardingBusy || paymentBusy;
  const paymentBalance = controller?.getPlayerPaymentBalance?.();
  const paymentBlockReason = !playerActive ? 'Awaiting Player'
    : paymentBusy ? 'Sending' : boardingBusy ? 'Checking Wallet'
    : controller?.getPlayerPaymentBlockReason?.() ?? (!controller ? 'Awaiting Game Wallet' : undefined);
  useEffect(() => {
    if (!controller || !state.profileId) return;
    let stopped = false;
    const check = async () => {
      try {
        if (!controller.hasPendingPlayerPayment()) return;
        const result = await controller.checkPlayerPayment();
        if (!stopped) {
          setPaymentRevision(n => n + 1);
          setPaymentMessage(result.status === 'pending' ? 'Payment pending verification.' : 'Payment sent.');
          if (result.status === 'succeeded') await controller.refresh();
        }
      } catch { /* Pending remains locked until reconciliation succeeds. */ }
    };
    void check();
    const timer = setInterval(() => void check(), 10000);
    const changed = () => setPaymentRevision(n => n + 1);
    window.addEventListener('storage', changed);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('storage', changed); };
  }, [controller, state.profileId]);
  async function payPlayer() {
    const context = playerContext;
    if (!controller || paymentBusy || !playerActive || !context?.getPaymentRecipient) return;
    setPaymentBusy(true); setPaymentMessage('Sending 1000 sats…');
    const profile = context.getState().profileId;
    let sameSession = true;
    const unsubscribe = context.subscribe(() => { if (!context.getState().hasProfile || context.getState().profileId !== profile) sameSession = false; });
    try {
      const recipient = await context.getPaymentRecipient();
      const result = await controller.payPlayer(recipient, () => sameSession && context.getState().phase === 'active');
      onDetails(result);
      setPaymentMessage(result.status === 'pending' ? 'Payment pending verification.' : 'Payment sent.');
      await controller.refresh();
    } catch {
      setPaymentMessage('Payment unavailable. Check the game wallet funds and account state. An unresolved payment must be verified before sending again.');
    } finally { unsubscribe(); setPaymentBusy(false); setPaymentRevision(n => n + 1); }
  }
  async function boardingAction(action: 'review' | 'confirm' | 'check') {
    if (!controller || boardingBusy) return;
    if (action !== 'check' && boardingState !== 'ready') return;
    setBoardingBusy(true); setBoardingMessage('Checking game wallet boarding…');
    try {
      if (action === 'check') {
        const status = await controller.checkBoarding();
        onDetails({operation:'F2 Boarding Status', ...status});
        await controller.refresh();
        return;
      }
      if (await controller.checkLiveBoardingState() !== 'ready') { setQuote(undefined); return; }
      if (action === 'review' || (action === 'confirm' && !quote)) {
        setQuote(undefined);
        const status = await controller.checkBoarding();
        onDetails(status);
        if (status.status === 'pending') { setBoardingMessage('Boarding is pending. Check status before trying again.'); onDetails(status); return; }
        const next = await controller.quoteBoarding();
        setQuote(next);
        onDetails({operation:'Board Game Wallet', ...next, message:'Review this amount and fee, then click Board Wallet to confirm.'});
      } else {
        const status = action === 'confirm' && quote ? await controller.board(quote) : await controller.checkBoarding();
        setQuote(undefined);
        setBoardingMessage(status.status === 'succeeded' ? 'Boarding completed.' : status.status === 'pending' ? 'Boarding pending. Keep this tab open while signing completes. Use Details to verify receipt.' : 'No pending boarding transfer.');
        onDetails(status);
        if (status.status !== 'pending') await controller.refresh();
      }
    } catch {
      setQuote(undefined);
      setBoardingMessage('Boarding unavailable. Funds must be eligible for boarding and providers reachable. If already submitted, use Details; do not submit again while pending.');
    } finally { setBoardingBusy(false); }
  }
  async function copyBitcoinAddress() {
    const address = controller?.getState().addresses?.bitcoinAddress;
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      onDetails({operation:'Copy BTC Addr', message:'Bitcoin funding address copied.', bitcoinReceivingAddress:address});
    } catch {
      onDetails({operation:'Copy BTC Addr', message:'Clipboard unavailable. Copy the Bitcoin funding address below manually.', bitcoinReceivingAddress:address});
    }
  }
  async function details() {
    if (!controller) return;
    onDetails({operation:'F3 Wallet Status', status:'loading'});
    await controller.refresh();
    const current = controller.getState();
    onDetails({
      operation:'F3 Wallet Status',
      status: current.status, profileId: current.profileId,
      paymentStatus: controller.getPlayerPaymentBlockReason?.() ?? 'Ready',
      paymentBalanceSats: controller.getPlayerPaymentBalance?.() ?? 'Unavailable',
      arkadeReceivingAddress: current.addresses?.arkadeAddress ?? 'Unavailable',
      bitcoinReceivingAddress: current.addresses?.bitcoinAddress ?? 'Unavailable',
      balance: current.balance ?? 'Unavailable',
      continueRecipient: current.addresses?.arkadeAddress || 'Not configured',
      ...(current.message ? {readStatus:current.message} : {}),
    });
  }
  return <StorySection title="F. Game Wallet" className="game-wallet-panel">

    <p className="story-summary">Stories: F1, F2, F3</p>
    <StoryButton label="F1. Game Wallet">
        {state.profileId ? <><button disabled={busy || !state.addresses?.bitcoinAddress} onClick={() => void copyBitcoinAddress()}>Copy BTC Addr</button><button disabled={busy} onClick={() => {setPhrase('');setEntry(false);void controller?.logout();}}>Logout</button></>
          : <button disabled={busy} onClick={() => {setEntry(!entry);setPhrase('');}}>Login</button>}
    </StoryButton>
    <StoryButton label="F2. Board Wallet" sublabel={boardingState === 'boarded' ? <span role="status">Boarded</span> : undefined}>
        <button disabled={busy || !state.profileId} onClick={() => void boardingAction('check')}>Details</button>
        {boardingState !== 'boarded' &&
          <button disabled={busy || !state.profileId || boardingState !== 'ready'} onClick={() => void boardingAction('confirm')}>Board Wallet{boardingState === 'waiting' ? ' (Awaiting Confirmation)' : boardingState === 'unknown' && state.profileId ? ' (Status Unavailable)' : ''}</button>}
    </StoryButton>
    <StoryButton label="F3. Send 1000 Sats (Game->Player)" sublabel={<>
      <span className="game-wallet-balance" role="status">Balance: {paymentBalance !== undefined ? `${paymentBalance} sats` : state.status === 'loading' ? 'Loading…' : 'Unavailable'}</span>
      <span id="game-payment-status" role="status">{paymentBlockReason}</span>
    </>}>
      <button data-payment-revision={paymentRevision} aria-describedby="game-payment-status" disabled={busy || !playerActive || !controller?.canPayPlayer?.()} onClick={() => void payPlayer()}>Send 1000 Sats</button>
      <button disabled={busy || !state.profileId} onClick={() => void details()}>Details</button>
    </StoryButton>
    {entry && !state.profileId && <form onSubmit={async event => {
      event.preventDefault();const input=phrase;setPhrase('');
      if(await controller?.importWallet(input))setEntry(false);
    }}>
      <label htmlFor="game-wallet-phrase">Recovery phrase</label>
      <input id="game-wallet-phrase" type="password" autoComplete="off" spellCheck={false} value={phrase} onChange={event => setPhrase(event.target.value)} />
      <button className="story-button" type="submit" disabled={!phrase.trim() || busy}>Import</button>
    </form>}
  </StorySection>;
}





