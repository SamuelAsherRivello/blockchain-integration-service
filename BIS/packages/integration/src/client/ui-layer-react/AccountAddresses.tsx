import type { BisAddresses } from '../state-layer-core/context';
import { CopyableValueField } from './CopyableValueField';

export function AccountAddresses({ addresses, arkadeOnly = false }: { addresses: BisAddresses; arkadeOnly?: boolean }) {
  const ready = addresses.status === 'ready';
  const placeholder = '';
  return <div className="bis-addresses">
    {!arkadeOnly && <CopyableValueField label="Bitcoin address" value={ready ? addresses.bitcoinAddress : placeholder} disabled={!ready} />}
    <CopyableValueField label="Arkade address" value={ready ? addresses.arkadeAddress : placeholder} disabled={!ready} />
  </div>;
}
