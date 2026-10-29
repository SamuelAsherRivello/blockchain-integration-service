import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import type { AccountSecret } from '../wallet-layer-arkade/account.ts';
import { createBisGameWallet } from '../state-layer-core/game-wallet.ts';
import { RecoveryPhrasePanel } from './RecoveryPhrasePanel';
import { RecoveryPhraseEntry } from './RecoveryPhraseEntry';
import { usePendingNotice } from './PendingOperationDialog';
import { FormValue } from './FormValue';
import { FormValueList } from './FormValueList';
import { FormTooltip, formatBalanceSats } from './FormTooltip';
import { configureBisServer, signerEndpoint } from '../wallet-layer-arkade/server-wallet.ts';
import type { BisTransferStatus } from '../state-layer-core/context.ts';
import type { BisGameWalletState } from '../state-layer-core/game-wallet.ts';
import { currentServerSignetBoardingReview, quoteServerSignetBoarding, ServerBoardingNotSubmittedError, serverSignetBoardingAmountSats, submitServerSignetBoarding, type ServerBoardingReview } from '../state-layer-core/server-game-wallet-boarding.ts';

type GameWallet = ReturnType<typeof createBisGameWallet>;

function OwnerSignerAccess({ wallet }: { wallet: GameWallet }) {
  const inputId = useId();
  const [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const endpoint = signerEndpoint();
  let destination: URL;
  try {
    destination = new URL(endpoint ?? '');
    if (destination.protocol !== 'https:' || destination.username || destination.password || destination.search || destination.hash) return null;
  } catch { return null; }

  async function update(forget = false) {
    if (busy) return;
    if (!forget && credential.trim().length < 32) { setMessage('Use an owner token of at least 32 characters, not a recovery phrase.'); return; }
    const token = forget ? undefined : credential.trim();
    setCredential(''); setBusy(true); setMessage('');
    configureBisServer({ url: endpoint, ownerToken: token });
    try {
      await wallet.refresh();
      const connected = wallet.getState().serverStatus === 'connected';
      setMessage(forget ? 'Owner access forgotten in this tab.' : connected ? 'Owner access connected for this tab only.' : 'Owner access was not accepted or the signer is unavailable. Check the token and retry.');
    } catch { setMessage('Owner connection could not be checked. Retry without submitting another operation.'); }
    finally { setBusy(false); }
  }

  return <details className="bis-owner-access">
    <summary>Operator owner access</summary>
    <p>Operator only. Never share this token with players. This is not Game Wallet Login and does not change wallet ownership.</p>
    <p>Credential destination: {destination.origin}{destination.pathname}</p>
    <form autoComplete="off" onSubmit={event => { event.preventDefault(); void update(); }}>
      <label htmlFor={inputId}>Private owner token</label>
      <input id={inputId} type="password" autoComplete="off" spellCheck={false} value={credential} disabled={busy} onChange={event => setCredential(event.target.value)} />
      <button className="bis-button" type="submit" disabled={busy || !credential.trim()}>Connect owner access</button>
      <button className="bis-button" type="button" disabled={busy} onClick={() => void update(true)}>Forget owner access</button>
    </form>
    <p>The token stays in this tab's memory. It is not saved in browser storage. Reloading clears it.</p>
    {message && <p role="status">{message}</p>}
  </details>;
}

function ServerBoardingView({ wallet, state }: { wallet: GameWallet; state: BisGameWalletState }) {
  const [review, setReview] = useState<ServerBoardingReview>();
  const [transfer, setTransfer] = useState<BisTransferStatus>();
  const [busy, setBusy] = useState(false);
  const [consented, setConsented] = useState(false);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [needsStatusCheck, setNeedsStatusCheck] = useState(false);
  const inFlight = useMemo(() => ({ current: false }), []);
  const eligible = state.source === 'server' && state.status === 'ready' && state.network === 'signet' && !!state.profileId;
  const quoteCurrent = !!review && currentServerSignetBoardingReview(wallet, review, now);
  const unresolved = needsStatusCheck || transfer?.status === 'pending';
  const inputRows: readonly (readonly [string, string])[] = review?.quote.inputOutpoints?.map((input, index) => [
    `Bitcoin input ${index + 1}`,
    `${input.txid}:${input.vout} · ${input.valueSats.toLocaleString()} sats${input.assets.length ? ` · Assets: ${input.assets.map(asset => `${asset.assetId} × ${asset.amount}`).join(', ')}` : ''}`,
  ]) ?? [];

  useEffect(() => {
    if (!review) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [review]);

  useEffect(() => {
    if (!eligible) return;
    let active = true;
    setBusy(true);
    void wallet.checkBoarding().then(result => {
      if (!active) return;
      setTransfer(result);
      if (result.status === 'pending') {
        setNeedsStatusCheck(true);
        setMessage('An earlier Signet transfer is unresolved. Check its status before requesting another quote.');
      } else if (result.status === 'succeeded') setMessage('Signet onboarding completed and verified.');
      else setNeedsStatusCheck(false);
    }).catch(() => {
      if (!active) return;
      setTransfer({ status: 'pending', direction: 'to-arkade', verification: 'unavailable' });
      setNeedsStatusCheck(true);
      setMessage('An earlier transfer could not be checked. Keep it reserved and check status before requesting another quote.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [wallet, eligible, state.profileId, state.selectionVersion]);

  async function getQuote() {
    if (busy || inFlight.current || !eligible) return;
    setBusy(true); setMessage(''); setReview(undefined); setConsented(false);
    try {
      const next = await quoteServerSignetBoarding(wallet);
      setReview(next);
      setNow(Date.now());
    } catch {
      setMessage('A fresh Signet onboarding quote could not be verified. No transfer was submitted.');
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (busy || inFlight.current || !review || !quoteCurrent || !consented) return;
    inFlight.current = true;
    setBusy(true); setMessage(''); setTransfer(undefined);
    try {
      const result = await submitServerSignetBoarding(wallet, review, consented);
      setTransfer(result);
      if (result.status === 'succeeded') {
        setReview(undefined); setMessage('Signet onboarding completed and verified.');
      } else if (result.status === 'not-submitted') {
        inFlight.current = false;
        setNeedsStatusCheck(false);
        setReview(undefined); setConsented(false);
        setMessage('The transfer was not submitted. Request a fresh quote before trying again.');
      } else {
        setNeedsStatusCheck(true);
        setReview(undefined); setConsented(false);
        setMessage('The transfer is pending. Check its status before taking another action.');
      }
    } catch (error) {
      if (error instanceof ServerBoardingNotSubmittedError) {
        inFlight.current = false;
        setNeedsStatusCheck(false); setTransfer({ status: 'not-submitted', direction: 'to-arkade' });
        setReview(undefined); setConsented(false); setMessage(error.message);
        return;
      }
      setNeedsStatusCheck(true);
      setReview(undefined); setConsented(false);
      setMessage('The result could not be verified. Check this transfer before trying again.');
    } finally { setBusy(false); }
  }

  async function checkStatus() {
    if (busy || !eligible) return;
    setBusy(true); setMessage('');
    try {
      const result = await wallet.checkBoarding();
      setTransfer(result);
      if (result.status === 'succeeded') { setNeedsStatusCheck(false); setMessage('Signet onboarding completed and verified.'); }
      else if (result.status === 'not-submitted') {
        inFlight.current = false; setNeedsStatusCheck(false);
        setMessage('The transfer was not submitted. Request a fresh quote before trying again.');
      } else { setNeedsStatusCheck(true); setMessage('No verified completion is recorded. Keep the transfer reserved and check again later.'); }
    } catch {
      setNeedsStatusCheck(true);
      setMessage('Transfer status is unavailable. Keep the transfer reserved and retry the status check later.');
    } finally { setBusy(false); }
  }

  return <section className="bis-server-boarding" aria-label="Server Game Wallet Signet onboarding">
    <h3>Signet Bitcoin → Arkade</h3>
    <p>A quote is read-only. The server wallet will not move funds until you review the quote and confirm it.</p>
    {state.network !== 'signet' && <p role="status">Server-wallet onboarding is available on Signet only.</p>}
    {review && <div className="bis-review" aria-label="Signet onboarding quote">
      <h3>Review 1,000-sat onboarding</h3>
      <FormValueList rows={[
        ['Network', 'Signet'], ...inputRows,
        ['Total Bitcoin inputs', `${(review.quote.inputSats ?? 0).toLocaleString()} sats`],
        ['Amount to Arkade', `${review.quote.amountSats.toLocaleString()} sats`], ['Operator fee', `${review.quote.feeSats.toLocaleString()} sats`],
        ['Arkade credit', `${review.quote.netSats.toLocaleString()} sats`], ['Bitcoin balance after', `${review.quote.bitcoinAfterSats.toLocaleString()} sats`],
        ['Arkade balance after', `${review.quote.arkadeAfterSats.toLocaleString()} sats`],
      ]} />
      <p role="status">{quoteCurrent ? `Quote expires in ${Math.max(0, Math.ceil((review.quote.expiresAt - now) / 1000))} seconds.` : 'This quote expired or the wallet changed. Request a new quote.'}</p>
      <label>
        <input type="checkbox" checked={consented} disabled={busy || !quoteCurrent} onChange={event => setConsented(event.target.checked)} />
        I approve moving exactly 1,000 sats from the Signet server Game Wallet to Arkade.
      </label>
      <button className="bis-button bis-primary" disabled={busy || !quoteCurrent || !consented} onClick={() => void confirm()}>
        Confirm 1,000-sat Signet onboarding
      </button>
    </div>}
    {unresolved && <button className="bis-button" disabled={busy || !eligible} onClick={() => void checkStatus()}>
      {busy ? 'Checking status…' : 'Check existing transfer status'}
    </button>}
    {!unresolved && transfer?.status !== 'succeeded' && <button className="bis-button" disabled={busy || !eligible} onClick={() => void getQuote()}>
      {busy ? 'Checking live Signet funds…' : 'Get a 1,000-sat Signet quote'}
    </button>}
    {transfer?.status === 'pending' && <p role="status">Funds remain reserved until the original transfer is verified.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}

/** Private A.G.2 setup surface. It receives no Admin balance, address, or boarding capability. */
export function GameWalletLoginView({ wallet, onBack }: { wallet: GameWallet; onBack(): void }) {
  const state = useSyncExternalStore(wallet.subscribe, wallet.getState, wallet.getState);
  const [page, setPage] = useState<'start' | 'created' | 'restore'>('start');
  const [candidate, setCandidate] = useState<AccountSecret>();
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState('');
  const recoverySession = useMemo(() => ({}), [candidate?.profileId]);
  usePendingNotice(busy, loggingOut ? 'Logging out ...' : page === 'restore' ? 'Loading ...' : 'Logging in ...', message || undefined, () => setMessage(''));

  async function create() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const next = await wallet.createWallet?.();
      if (!next) { setMessage(wallet.getState().message ?? 'Game wallet creation failed. Try again.'); return; }
      setCandidate(next); setPage('created');
    } finally { setBusy(false); }
  }
  async function commit() {
    if (!candidate || busy) return;
    setBusy(true); setMessage('');
    try {
      if (await wallet.selectWallet?.(candidate)) { setCandidate(undefined); setPage('start'); }
      else setMessage(wallet.getState().message ?? 'Game wallet setup failed. Try again.');
    } finally { setBusy(false); }
  }
  async function restore(phrase: string) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      if (await wallet.importWallet(phrase)) { setPage('start'); }
      else setMessage(wallet.getState().message ?? 'Game wallet restore failed. Try again.');
    } finally { setBusy(false); }
  }
  async function logout() {
    if (busy) return;
    setBusy(true); setLoggingOut(true); setMessage('');
    try { await wallet.logout(); }
    finally { setLoggingOut(false); setBusy(false); }
  }

  if (state.source === 'server' || state.serverStatus === 'error') return <div className="bis-actions">
    <p role="status">{state.source === 'server' ? 'Game wallet source: Server' : 'Game server unavailable'}</p>
    {state.source === 'server' && <FormValue label="Arkade address" value={state.addresses?.arkadeAddress ?? '—'} copyable disabled={!state.addresses?.arkadeAddress} />}
    {state.source === 'server' && <ServerBoardingView wallet={wallet} state={state} />}
    {state.serverMessage && <p role="alert">{state.serverMessage}</p>}
    <OwnerSignerAccess wallet={wallet} />
    <button className="bis-button" onClick={() => void wallet.refresh()}>Retry server connection</button>
    <button className="bis-button bis-back" onClick={onBack}>Back</button>
  </div>;
  if (!state.playerConnected) return <div className="bis-actions">
    <p role="status">Connect a Player Wallet before creating, restoring, or logging in to a Game Wallet.</p>
    <button className="bis-button bis-back" onClick={onBack}>Back</button>
  </div>;
  if (state.profileId) return <div className="bis-actions">
    <p role="status">Game wallet configured.</p>
    <div className="bis-addresses">
      <FormValue label="Arkade address" value={state.addresses?.arkadeAddress ?? '—'} copyable disabled={!state.addresses?.arkadeAddress} />
      <FormValue label="Arkade balance" value={formatBalanceSats(state.balance?.arkadeSats, '—')} copyable disabled={!state.balance} tooltipName="Arkade balance" tooltip={<FormTooltip title="Arkade balance" balance={formatBalanceSats(state.balance?.arkadeSats, '—')} available={formatBalanceSats(state.balance?.availableSats, '—')} />} />
    </div>
    <button className="bis-button bis-danger" disabled={busy} onClick={() => void logout()}>Log Out Game Wallet</button>
    {state.message && state.status !== 'unavailable' && <p role="alert">{state.message}</p>}
    <button className="bis-button bis-back" disabled={busy} onClick={onBack}>Back</button>
  </div>;
  if (page === 'created' && candidate) return <>
    <RecoveryPhrasePanel phrase={candidate.phrase} session={recoverySession} disabled={busy} />
    <div className="bis-actions">
      <button className="bis-button bis-primary" disabled={busy} onClick={() => void commit()}>&#x26A1; Continue</button>
      <button className="bis-button bis-back" disabled={busy} onClick={() => { setCandidate(undefined); setPage('start'); }}>Back</button>
    </div>
    {message && <p role="alert">{message}</p>}
  </>;
  if (page === 'restore') return <RecoveryPhraseEntry editable={!busy} disabled={busy} submitLabel="⚡ Restore Wallet"
    onSubmit={phrase => void restore(phrase)} onBack={() => { setMessage(''); setPage('start'); }} backDisabled={busy} message={message} />;
  return <div className="bis-actions">
    {state.serverMessage && <><p role="status">{state.serverMessage}</p><button className="bis-button" onClick={() => void wallet.refresh()}>Retry server connection</button></>}
    <div className="bis-account-actions">
      <button className="bis-button bis-primary" disabled={busy} onClick={() => void create()}>&#x26A1; Create Wallet</button>
      <button className="bis-button" disabled={busy} onClick={() => { setMessage(''); setPage('restore'); }}>&#x26A1; Restore Wallet</button>
    </div>
    {message && <p role="alert">{message}</p>}
    <button className="bis-button bis-back" disabled={busy} onClick={onBack}>Back</button>
  </div>;
}
