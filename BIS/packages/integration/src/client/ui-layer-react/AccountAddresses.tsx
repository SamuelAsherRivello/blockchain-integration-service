import type { BisAddresses } from '../state-layer-core/context';
import { FormValue } from './FormValue';

export function AccountAddressesFormValue({ addresses, arkadeOnly = false }: { addresses: BisAddresses; arkadeOnly?: boolean }) {
  const ready = addresses.status === 'ready';
  const placeholder = '';
  return <div className="bis-addresses">
    {!arkadeOnly && <FormValue label="Bitcoin address" value={ready ? addresses.bitcoinAddress : placeholder} copyable disabled={!ready} />}
    <FormValue label="Arkade address" value={ready ? addresses.arkadeAddress : placeholder} copyable disabled={!ready} />
  </div>;
}
