import { useLayoutEffect, useRef, useState } from 'react';
import { validateMint, type BisMintAssetRequest, type BisMintAssetResult } from '@bis/integration';
import './assets.css';
import { achievementPresets } from './achievement-presets';
export function MintAssetDialog({ initial, onMint, onClose }: {initial?: BisMintAssetRequest; onMint(request: BisMintAssetRequest): Promise<BisMintAssetResult>; onClose(): void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<BisMintAssetRequest>(() => initial ?? {operationId: crypto.randomUUID(), name: 'an asset', ticker: 'ASSET', amount: '1', decimals: 0, iconUrl: ''});
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(!!initial);
  const [result, setResult] = useState<BisMintAssetResult>();
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
  function edit(patch: Partial<BisMintAssetRequest>) { setForm({...form, ...patch}); setResult(undefined); }
  async function submit() {
    if (pending || validation || done) return;
    setPending(true); setLocked(true);
    try {
      const next = await onMint(form); setResult(next);
      if (next.status === 'error' && !['outcome-unknown', 'account-changed', 'disposed'].includes(next.code)) setLocked(false);
    } finally { setPending(false); }
  }
  return <dialog ref={dialog} className="mint-dialog" aria-labelledby="mint-title" onCancel={e => {e.preventDefault(); if (!pending) onClose();}}>
    <header className="mint-header"><button type="button" className="mint-back" aria-label="Close Mint Asset" disabled={pending} onClick={onClose}>←</button><h2 id="mint-title">Mint Asset</h2><span /></header>
    <form onSubmit={e => {e.preventDefault(); void submit();}}>
      <div className="mint-summary"><span className="mint-avatar" aria-hidden="true">{form.name.trim().charAt(0).toUpperCase() || 'A'}</span><div><strong>{form.name || 'Asset'}</strong><span className="mint-badge">Unverified</span><p>{form.amount || '0'} {form.ticker}</p></div></div>
      <fieldset className="mint-presets" disabled={pending || locked || done}><legend>Quick fill</legend>{achievementPresets.map(preset => <button type="button" key={preset.ticker} onClick={() => edit(preset)}>{preset.name}</button>)}</fieldset>
      <fieldset className="mint-fields" disabled={pending || locked || done}>
        <label>Name *<input autoFocus required maxLength={128} value={form.name} onChange={e => edit({name:e.target.value})} /></label>
        <label>Ticker *<input required maxLength={16} value={form.ticker} onChange={e => edit({ticker:e.target.value})} /></label>
        <label>Amount *<input required inputMode="decimal" value={form.amount} onChange={e => edit({amount:e.target.value})} /></label>
        <label>Decimals<input required type="number" min={0} max={18} step={1} value={Number.isNaN(form.decimals) ? '' : form.decimals} onChange={e => edit({decimals:e.target.value === '' ? NaN : Number(e.target.value)})} /></label>
        <label className="mint-wide">Icon URL<input placeholder="https://…" value={form.iconUrl ?? ''} onChange={e => edit({iconUrl:e.target.value})} /></label>
        <label className="mint-wide">Control Asset<input readOnly value="None" /></label>
      </fieldset>
      <p className="mint-message" id="mint-message" role="status">{pending ? 'Minting asset…' : result?.status === 'error' ? result.message : done ? 'Asset minted. The result is in Admin Console.' : validation || 'Mint to the active account with a fixed supply.'}</p>
      {done ? <button type="button" className="mint-submit" onClick={onClose}>Done</button> : <button className="mint-submit" type="submit" disabled={pending || !!validation} aria-describedby="mint-message">{pending ? 'Minting…' : locked ? 'Check mint status' : 'Mint'}</button>}
    </form>
  </dialog>;
}
