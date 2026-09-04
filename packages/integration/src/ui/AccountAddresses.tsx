import { useEffect, useId, useState } from 'react';
import type { BisAddresses } from '../core/context';
import { CopyFieldLabel } from './CopyFieldLabel';

export function AddressRow({ label, address, disabled = false }: { label: string; address: string; disabled?: boolean }) {
  const inputId = useId();
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  useEffect(() => { setStatus('idle'); }, [address, disabled]);
  async function copy() {
    setStatus('copying');
    try { await navigator.clipboard.writeText(address); setStatus('copied'); }
    catch { setStatus('failed'); }
  }
  return <div className="bis-address-row">
    <CopyFieldLabel htmlFor={inputId} label={label} copied={status === 'copied'} disabled={disabled || status === 'copying'} onCopy={()=>void copy()} />
    <input id={inputId} aria-label={label} readOnly value={address} onFocus={event=>event.target.select()} />
    <span className="bis-copy-status" role="status">{status === 'failed' ? 'Could not copy. Select the value and copy it manually.' : status === 'copied' ? `${label} copied.` : ''}</span>
  </div>;
}
export function AccountAddresses({ addresses }: { addresses: BisAddresses }) {
  const ready = addresses.status === 'ready';
  const placeholder = addresses.status === 'unavailable' ? 'Addresses unavailable' : 'Loading...';
  return <div className="bis-addresses">
    <AddressRow label="Bitcoin address" address={ready ? addresses.bitcoinAddress : placeholder} disabled={!ready} />
    <AddressRow label="Arkade address" address={ready ? addresses.arkadeAddress : placeholder} disabled={!ready} />
    <span className="bis-sr-only" role="status">{addresses.status === 'unavailable' ? 'Addresses unavailable. Use Refresh to retry.' : ready ? 'Addresses loaded.' : 'Loading...'}</span>
  </div>;
}
