import type { ReactNode } from 'react';
import type { BisBalance } from '../core/context';
import { AddressRow } from './AccountAddresses';

export function AccountBalances({ balance, directionControl }: { balance: BisBalance; directionControl?: ReactNode }) {
  const value = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => balance.status === 'ready'
    ? `${balance[field].toLocaleString('en-US')} sats`
    : '';
  return <div className="bis-addresses bis-account-balances">
    <AddressRow label="Total balance" address={value('totalSats')} disabled={balance.status !== 'ready'} />
    <div className={`bis-balance-columns${directionControl ? ' bis-balance-columns-with-direction' : ''}`}>
      <AddressRow label="Bitcoin balance" address={value('bitcoinSats')} disabled={balance.status !== 'ready'} />
      {directionControl}
      <AddressRow label="Arkade balance" address={value('arkadeSats')} disabled={balance.status !== 'ready'} />
    </div>
  </div>;
}
