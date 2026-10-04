import { useMemo, useState, useSyncExternalStore } from 'react';
import type { AccountSecret } from '../wallet-layer-arkade/account.ts';
import { createBisGameWallet } from '../state-layer-core/game-wallet.ts';
import { RecoveryPhrasePanel } from './RecoveryPhrasePanel';
import { RecoveryPhraseEntry } from './RecoveryPhraseEntry';
import { usePendingNotice } from './PendingOperationDialog';
import { CopyableValueField } from './CopyableValueField';
import { BalanceTooltip, formatBalanceSats } from './BalanceTooltip';

type GameWallet = ReturnType<typeof createBisGameWallet>;

/** Private A.G.2 setup surface. It receives no Admin balance, address, or boarding capability. */
export function GameWalletLogin({ wallet, onBack }: { wallet: GameWallet; onBack(): void }) {
  const state = useSyncExternalStore(wallet.subscribe, wallet.getState, wallet.getState);
  const [page, setPage] = useState<'start' | 'created' | 'restore'>('start');
  const [candidate, setCandidate] = useState<AccountSecret>();
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState('');
  const recoverySession = useMemo(() => ({}), [candidate?.profileId]);
  usePendingNotice(busy, loggingOut ? 'Logging out...' : 'Logging in...', message || undefined, () => setMessage(''));

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

  if (!state.playerConnected) return <div className="bis-actions">
    <p role="status">Connect a Player Wallet before creating, restoring, or logging in to a Game Wallet.</p>
    <button className="bis-button bis-back" onClick={onBack}>Back</button>
  </div>;
  if (state.profileId) return <div className="bis-actions">
    <p role="status">Game wallet configured.</p>
    <div className="bis-addresses">
      <CopyableValueField label="Arkade address" value={state.addresses?.arkadeAddress ?? ''} disabled={!state.addresses?.arkadeAddress} />
      <CopyableValueField label="Arkade balance" value={formatBalanceSats(state.balance?.arkadeSats)} disabled={!state.balance} tooltipName="Arkade balance" tooltip={<BalanceTooltip title="Arkade balance" balance={formatBalanceSats(state.balance?.arkadeSats)} available={formatBalanceSats(state.balance?.availableSats)} />} />
    </div>
    <button className="bis-button bis-danger" disabled={busy} onClick={() => void logout()}>Log Out Game Wallet</button>
    {state.message && <p role="alert">{state.message}</p>}
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
    <div className="bis-account-actions">
      <button className="bis-button bis-primary" disabled={busy} onClick={() => void create()}>&#x26A1; Create Wallet</button>
      <button className="bis-button" disabled={busy} onClick={() => { setMessage(''); setPage('restore'); }}>&#x26A1; Restore Wallet</button>
    </div>
    {message && <p role="alert">{message}</p>}
    <button className="bis-button bis-back" disabled={busy} onClick={onBack}>Back</button>
  </div>;
}
