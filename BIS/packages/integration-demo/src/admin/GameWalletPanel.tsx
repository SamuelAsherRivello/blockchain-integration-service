import { StoryButton } from './StoryButton';
import { StorySection } from './StorySection';
import { useEffect, useState } from 'react';
import { createBisGameWallet, type BisGameWalletState } from '@bis/integration';

export function GameWalletPanel({controller, onDetails, onRecipientChange, onOpenDeveloper}: {
  controller?: ReturnType<typeof createBisGameWallet>;
  onRecipientChange?(recipient: string | undefined): void;
  onOpenDeveloper(): void;
  onDetails(details: unknown): void;
}) {
  const [state, setState] = useState<BisGameWalletState>({status:'loading',selectionVersion:0});
  const [entry, setEntry] = useState(false), [phrase, setPhrase] = useState('');
  const [importing, setImporting] = useState(false), [importMessage, setImportMessage] = useState('');
  useEffect(() => {
    const address = state.addresses?.arkadeAddress;
    onRecipientChange?.(state.profileId ? address : undefined);
  }, [onRecipientChange, state.addresses?.arkadeAddress, state.profileId]);
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
    if (!controller) { setState({status:'loading',selectionVersion:0}); return; }
    const update = () => setState(controller.getState());
    update();
    return controller.subscribe(update);
  }, [controller]);
  const busy = !controller || state.status === 'loading' || importing || boardingBusy;
  async function boardingAction(action: 'review' | 'confirm' | 'check') {
    if (!controller || boardingBusy) return;
    if (action !== 'check' && boardingState !== 'ready') return;
    setBoardingBusy(true); setBoardingMessage('Checking game wallet boarding…');
    try {
      if (action === 'check') {
        const status = await controller.checkBoarding();
        onDetails({operation:'F3 Boarding Status', ...status});
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
    <StoryButton label="F1. Game Wallet (Admin-facing)">
        {state.profileId ? <button disabled={busy} onClick={() => void controller?.logout()}>Logout</button>
          : <button disabled={busy} onClick={() => { setEntry(true); setPhrase(''); setImportMessage(''); }}>Login</button>}
    </StoryButton>
    <StoryButton label="F2. Game Wallet (User-facing)">
      <button disabled={!controller} onClick={onOpenDeveloper}>Open</button>
    </StoryButton>
    <StoryButton label="F3. Board Game Wallet" sublabel={<>{state.balance && <span>Balance: {state.balance.availableSats.toLocaleString()} sats</span>}{boardingState === 'boarded' && <span role="status">Boarded</span>}</>}>
        <button disabled={busy || !state.profileId} onClick={() => void boardingAction('check')}>Details</button>
        {boardingState !== 'boarded' &&
          <button disabled={busy || !state.profileId || boardingState !== 'ready'} onClick={() => void boardingAction('confirm')}>Board Wallet{boardingState === 'waiting' ? ' (Awaiting Confirmation)' : boardingState === 'unknown' && state.profileId ? ' (Status Unavailable)' : ''}</button>}
    </StoryButton>
    {entry && !state.profileId && <form onSubmit={async event => {
      event.preventDefault();
      if (!controller || importing) return;
      const input=phrase;setImporting(true);setImportMessage('');
      try {
        if(await controller.importWallet(input)){setPhrase('');setEntry(false);}
        else setImportMessage(controller.getState().message ?? 'Game wallet login failed. Check the recovery phrase and connection.');
      } catch {
        setImportMessage('Game wallet login failed. Check the recovery phrase and connection.');
      } finally {setImporting(false);}
    }}>
      <label htmlFor="game-wallet-phrase">Recovery phrase</label>
      <input id="game-wallet-phrase" type="password" autoComplete="off" spellCheck={false} value={phrase} onChange={event => setPhrase(event.target.value)} />
      <button className="story-button" type="submit" disabled={!phrase.trim() || busy}>{importing ? 'Importing…' : 'Import'}</button>
      {importing && <p role="status">Importing game wallet…</p>}
      {importMessage && <p role="alert">{importMessage}</p>}
    </form>}
  </StorySection>;
}





