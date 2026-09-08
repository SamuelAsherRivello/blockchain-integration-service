import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { validateMint, type BisMintAssetRequest, type BisMintAssetResult } from '@bis/integration';
import './assets.css';
import { achievementPresets } from './achievement-presets';
import type { MintDestination, PreparedMintDestination } from './mint-destination';
export function MintAssetDialog({ prepare, onBusy, onClose }: {prepare(destination: MintDestination): Promise<PreparedMintDestination>; onBusy?(busy: boolean): void; onClose(): void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<BisMintAssetRequest>(() => ({operationId: crypto.randomUUID(), name: 'an asset', ticker: 'ASSET', amount: '1', decimals: 0, iconUrl: ''}));
  const [destination, setDestination] = useState<MintDestination>('game');
  const [target, setTarget] = useState<PreparedMintDestination>();
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState('');
  const generation = useRef(0);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<BisMintAssetResult>();
  useEffect(() => {
    const current = ++generation.current;
    let unsubscribe = () => {};
    setLoading(true); setTarget(undefined); setUnavailable('');
    void prepare(destination).then(next => {
      if (generation.current !== current) return;
      const invalidate = () => {
        if (generation.current !== current || next.isCurrent()) return;
        ++generation.current;
        setTarget(undefined); setResult(undefined); setLocked(true);
        setUnavailable('The selected wallet changed. Close and reopen Mint Asset.');
      };
      unsubscribe = next.subscribe(invalidate);
      if (!next.isCurrent()) { invalidate(); return; }
      setTarget(next);
      if (!next.canMint) setUnavailable(next.reason ?? 'Mint is unavailable for this wallet.');
    }).catch(error => {
      if (generation.current === current) setUnavailable(error instanceof Error ? error.message : 'Wallet availability could not be checked.');
    }).finally(() => { if (generation.current === current) setLoading(false); });
    return () => { ++generation.current; unsubscribe(); };
  }, [destination, prepare]);
  useLayoutEffect(() => {
    const el = dialog.current!;
    const previousFocus = document.activeElement;
    el.showModal();
    // Close while the dialog is still connected so native focus restoration
    // runs before React removes the modal from the document.
    return () => {
      el.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  let validation = '';
  try { validateMint(form); } catch { validation = 'Enter a name, ticker, positive amount and 0–18 decimals. Amount must fit the selected precision; an optional icon must use HTTPS.'; }
  const done = result?.status === 'minted' || result?.status === 'already-minted';
  const recoveryChoice = !!target?.request && !locked;
  const blocked = loading || !!unavailable || !target || recoveryChoice;
  function selectDestination(value: MintDestination) {
    if (locked || submitting.current || value === destination) return;
    ++generation.current;
    setLoading(true); setTarget(undefined); setResult(undefined); setUnavailable('');
    setForm(previous => ({...previous, operationId:crypto.randomUUID()}));
    setDestination(value);
  }
  function edit(patch: Partial<BisMintAssetRequest>) { setForm({...form, ...patch}); setResult(undefined); }
  async function submit() {
    if (submitting.current || blocked || validation || done || !target) return;
    const current = generation.current;
    submitting.current = true;
    setPending(true); setLocked(true); onBusy?.(true);
    try {
      const next = await target.mint(form);
      if (generation.current !== current) return;
      setResult(next);
      if (next.status === 'error' && !target.request && !['outcome-unknown', 'account-changed', 'disposed'].includes(next.code)) setLocked(false);
    } finally { submitting.current = false; setPending(false); onBusy?.(false); }
  }
  return <dialog ref={dialog} className="mint-dialog" aria-labelledby="mint-title" onCancel={e => {e.preventDefault(); if (!pending) onClose();}}>
    <header className="mint-header"><button type="button" className="mint-back" aria-label="Close Mint Asset" disabled={pending} onClick={onClose}>←</button><h2 id="mint-title">Mint Asset</h2><span /></header>
    <form onSubmit={e => {e.preventDefault(); void submit();}}>
      <div className="mint-fields mint-destination"><label className="mint-wide">Destination<select aria-label="Destination" autoFocus value={destination} disabled={pending || locked || done} onChange={e => selectDestination(e.target.value as MintDestination)}><option value="player">Player wallet</option><option value="game">Game wallet</option></select></label></div>
      <p className="mint-destination-help">The selected wallet funds and receives the mint.</p>
      <fieldset className="mint-presets" disabled={pending || locked || done || recoveryChoice}><legend>Quick fill</legend>{achievementPresets.map(preset => <button type="button" key={preset.ticker} onClick={() => edit(preset)}>{preset.name}</button>)}</fieldset>
      {recoveryChoice && <p role="status">This wallet has an unresolved mint. <button type="button" className="mint-resume" onClick={() => {setForm(target!.request!);setLocked(true);}}>Resume pending mint</button></p>}
      <div className="mint-summary"><span className="mint-avatar" aria-hidden="true">{form.name.trim().charAt(0).toUpperCase() || 'A'}</span><div><strong>{form.name || 'Asset'}</strong><span className="mint-badge">Unverified</span><p>{form.amount || '0'} {form.ticker}</p></div></div>
      <fieldset className="mint-fields" disabled={pending || locked || done || recoveryChoice}>
        <label>Name *<input required maxLength={128} value={form.name} onChange={e => edit({name:e.target.value})} /></label>
        <label>Ticker *<input required maxLength={16} value={form.ticker} onChange={e => edit({ticker:e.target.value})} /></label>
        <label>Amount *<input required inputMode="decimal" value={form.amount} onChange={e => edit({amount:e.target.value})} /></label>
        <label>Decimals<input required type="number" min={0} max={18} step={1} value={Number.isNaN(form.decimals) ? '' : form.decimals} onChange={e => edit({decimals:e.target.value === '' ? NaN : Number(e.target.value)})} /></label>
        <label className="mint-wide">Icon URL<input placeholder="https://…" value={form.iconUrl ?? ''} onChange={e => edit({iconUrl:e.target.value})} /></label>
        <label className="mint-wide">Control Asset<input readOnly value="None" /></label>
      </fieldset>
      <p className="mint-message" id="mint-message" role="status">{pending ? 'Minting asset…' : unavailable || (loading ? 'Checking destination…' : result?.status === 'error' ? result.message : done ? 'Asset minted. The result is in Admin Console.' : validation || `Mint to the ${destination === 'player' ? 'player' : 'game'} wallet with a fixed supply.`)}</p>
      {done ? <button type="button" className="mint-submit" onClick={onClose}>Done</button> : <button className="mint-submit" type="submit" disabled={pending || blocked || !!validation} aria-describedby="mint-message">{pending ? 'Minting…' : locked ? 'Check mint status' : 'Mint'}</button>}
    </form>
  </dialog>;
}
