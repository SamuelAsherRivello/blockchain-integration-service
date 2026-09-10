import { useMemo, useState, useSyncExternalStore } from 'react';
import type { AccountSecret } from '../arkade/account.ts';
import { validRecovery } from '../core/recovery-validation.ts';
import { createBisGameWallet } from '../core/game-wallet.ts';
import { RecoveryPhrasePanel } from './RecoveryPhrasePanel';
import { FieldHeading } from './FieldHeading';

type GameWallet = ReturnType<typeof createBisGameWallet>;

/** Private F2 setup surface. It receives no Admin balance, address, or boarding capability. */
export function GameWalletLogin({ wallet, onBack }: { wallet: GameWallet; onBack(): void }) {
  const state = useSyncExternalStore(wallet.subscribe, wallet.getState, wallet.getState);
  const [page, setPage] = useState<'start' | 'created' | 'restore'>('start');
  const [candidate, setCandidate] = useState<AccountSecret>();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const recoverySession = useMemo(() => ({}), [candidate?.profileId]);

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
  async function restore() {
    if (busy || !validRecovery(phrase)) return;
    setBusy(true); setMessage('');
    try {
      if (await wallet.importWallet(phrase)) { setPhrase(''); setPage('start'); }
      else setMessage(wallet.getState().message ?? 'Game wallet restore failed. Try again.');
    } finally { setBusy(false); }
  }
  async function logout() {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await wallet.logout(); }
    finally { setBusy(false); }
  }

  if (state.profileId) return <div className="bis-actions">
    <p role="status">Game wallet configured.</p>
    <button className="bis-button bis-danger" disabled={busy} onClick={() => void logout()}>Log Out Game Wallet</button>
    {state.message && <p role="alert">{state.message}</p>}
    <button className="bis-button bis-back" disabled={busy} onClick={onBack}>Back</button>
  </div>;
  if (page === 'created' && candidate) return <>
    <RecoveryPhrasePanel phrase={candidate.phrase} session={recoverySession} disabled={busy} />
    <div className="bis-actions">
      <button className="bis-button bis-primary" disabled={busy} onClick={() => void commit()}>⚡ Continue</button>
      <button className="bis-button bis-back" disabled={busy} onClick={() => { setCandidate(undefined); setPage('start'); }}>Back</button>
    </div>
    {message && <p role="alert">{message}</p>}
  </>;
  if (page === 'restore') return <>
    <div className="bis-address-row bis-game-wallet-recovery">
      <FieldHeading htmlFor="game-wallet-restore-phrase" label="Recovery phrase" />
      <textarea id="game-wallet-restore-phrase" value={phrase} onChange={event => { setPhrase(event.target.value); setMessage(''); }} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
    </div>
    {phrase.trim() && !validRecovery(phrase) && <p role="alert">Enter a valid 12-word recovery phrase.</p>}
    {message && <p role="alert">{message}</p>}
    <div className="bis-actions">
      <button className="bis-button bis-primary" disabled={busy || !validRecovery(phrase)} onClick={() => void restore()}>⚡ Restore Game Wallet</button>
      <button className="bis-button bis-back" disabled={busy} onClick={() => { setPhrase(''); setPage('start'); }}>Back</button>
    </div>
  </>;
  return <div className="bis-actions">
    <button className="bis-button bis-primary" disabled={busy} onClick={() => void create()}>⚡ Create Game Wallet</button>
    <button className="bis-button" disabled={busy} onClick={() => { setMessage(''); setPage('restore'); }}>⚡ Restore Game Wallet</button>
    {message && <p role="alert">{message}</p>}
    <button className="bis-button bis-back" disabled={busy} onClick={onBack}>Back</button>
  </div>;
}
