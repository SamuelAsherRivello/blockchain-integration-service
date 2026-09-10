import type { ReactNode } from 'react';
import type { BisBalance } from '../core/context';
import { CopyableValueField } from './CopyableValueField';

export function AccountBalances({ balance, directionControl }: { balance: BisBalance; directionControl?: ReactNode }) {
  const value = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => balance.status === 'ready'
    ? `${balance[field].toLocaleString('en-US')} sats`
    : '';
  const available = (amount: number) => balance.status === 'ready' ? `${amount.toLocaleString('en-US')} sats` : '';
  const tooltip = (title: string, amount: string, availableAmount: string) => <>
    <strong>{title}</strong>
    <span>Balance: {amount}</span>
    <span>Available balance: {availableAmount}</span>
  </>;
  return <div className="bis-addresses bis-account-balances">
    <CopyableValueField label="Total balance" value={value('totalSats')} disabled={balance.status !== 'ready'} tooltipName="Total balance" tooltip={tooltip('Total balance',value('totalSats'),balance.status === 'ready' ? available(balance.availableSats) : '')} />
    <div className={`bis-balance-columns${directionControl ? ' bis-balance-columns-with-direction' : ''}`}>
      <CopyableValueField label="Bitcoin balance" value={value('bitcoinSats')} disabled={balance.status !== 'ready'} tooltipName="Bitcoin balance" tooltip={tooltip('Bitcoin balance',value('bitcoinSats'),value('bitcoinSats'))} />
      {directionControl}
      <CopyableValueField label="Arkade balance" value={value('arkadeSats')} disabled={balance.status !== 'ready'} tooltipName="Game balance" tooltip={tooltip('Game balance',value('arkadeSats'),balance.status === 'ready' ? available(balance.availableSats) : '')} />
    </div>
  </div>;
}
