import type { BisAddresses } from '../core/context';
import { CopyableValueField } from './CopyableValueField';

export function AccountAddresses({ addresses }: { addresses: BisAddresses }) {
  const ready = addresses.status === 'ready';
  const placeholder = '';
  return <div className="bis-addresses">
    <CopyableValueField label="Bitcoin address" value={ready ? addresses.bitcoinAddress : placeholder} disabled={!ready} />
    <CopyableValueField label="Arkade address" value={ready ? addresses.arkadeAddress : placeholder} disabled={!ready} />
  </div>;
}
