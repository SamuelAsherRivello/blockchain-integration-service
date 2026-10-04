import type { ReactNode } from 'react';
import type { BisBalance } from '../state-layer-core/context';
import { CopyableValueField } from './CopyableValueField';
import { BalanceTooltip } from './BalanceTooltip';

export function AccountBalances({ balance, directionControl }: { balance: BisBalance; directionControl?: ReactNode }) {
  const value = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => balance.status === 'ready'
    ? `${balance[field].toLocaleString('en-US')} sats`
    : '';
  const available = (amount: number) => balance.status === 'ready' ? `${amount.toLocaleString('en-US')} sats` : '';
  return <div className="bis-addresses bis-account-balances">
    <CopyableValueField label="Total balance" value={value('totalSats')} disabled={balance.status !== 'ready'} tooltipName="Total balance" tooltip={<BalanceTooltip title="Total balance" balance={value('totalSats')} available={balance.status === 'ready' ? available(balance.availableSats) : ''} />} />
    <div className={`bis-balance-columns${directionControl ? ' bis-balance-columns-with-direction' : ''}`}>
      <CopyableValueField label="Bitcoin balance" value={value('bitcoinSats')} disabled={balance.status !== 'ready'} tooltipName="Bitcoin balance" tooltip={<BalanceTooltip title="Bitcoin balance" balance={value('bitcoinSats')} available={value('bitcoinSats')} />} />
      {directionControl}
      <CopyableValueField label="Arkade balance" value={value('arkadeSats')} disabled={balance.status !== 'ready'} tooltipName="Game balance" tooltip={<BalanceTooltip title="Game balance" balance={value('arkadeSats')} available={balance.status === 'ready' ? available(balance.availableSats) : ''} />} />
    </div>
  </div>;
}
