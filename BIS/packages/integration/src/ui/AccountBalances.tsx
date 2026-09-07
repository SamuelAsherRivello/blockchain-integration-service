import type { ReactNode } from 'react';
import type { BisBalance } from '../core/context';
import { CopyableValueField } from './CopyableValueField';

export function AccountBalances({ balance, directionControl }: { balance: BisBalance; directionControl?: ReactNode }) {
  const value = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => balance.status === 'ready'
    ? `${balance[field].toLocaleString('en-US')} sats`
    : '';
  return <div className="bis-addresses bis-account-balances">
    <CopyableValueField label="Total balance" value={value('totalSats')} disabled={balance.status !== 'ready'} />
    <div className={`bis-balance-columns${directionControl ? ' bis-balance-columns-with-direction' : ''}`}>
      <CopyableValueField label="Bitcoin balance" value={value('bitcoinSats')} disabled={balance.status !== 'ready'} />
      {directionControl}
      <CopyableValueField label="Arkade balance" value={value('arkadeSats')} disabled={balance.status !== 'ready'} />
    </div>
  </div>;
}
