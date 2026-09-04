import type { BisBalance } from '../core/context';
import { AddressRow } from './AccountAddresses';

export function AccountBalances({ balance }: { balance: BisBalance }) {
  const value = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => balance.status === 'ready'
    ? `${balance[field].toLocaleString('en-US')} sats`
    : balance.status === 'unavailable' ? 'Balance unavailable' : 'Loading...';
  return <div className="bis-addresses bis-account-balances">
    <AddressRow label="Total balance" address={value('totalSats')} disabled={balance.status !== 'ready'} />
    <div className="bis-balance-columns">
      <AddressRow label="Bitcoin balance" address={value('bitcoinSats')} disabled={balance.status !== 'ready'} />
      <AddressRow label="Arkade balance" address={value('arkadeSats')} disabled={balance.status !== 'ready'} />
    </div>
  </div>;
}
