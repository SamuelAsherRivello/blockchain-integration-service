import type { ReactNode } from 'react';
import type { BisBalance } from '../state-layer-core/context';
import { CopyableValueField } from './CopyableValueField';
import { BalanceTooltip } from './BalanceTooltip';

export function AccountBalances({ balance, directionControl }: { balance: BisBalance; directionControl?: ReactNode }) {
  const loading = balance.status !== 'ready';
  const value = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => balance.status === 'ready'
    ? `${balance[field].toLocaleString('en-US')} sats`
    : '—';
  const tooltipValue = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => loading ? 'Loading ...' : value(field);
  const available = (amount: number) => loading ? 'Loading ...' : `${amount.toLocaleString('en-US')} sats`;
  return <div className="bis-addresses bis-account-balances">
    <CopyableValueField label="Total balance" value={value('totalSats')} disabled={loading} tooltipName="Total balance" tooltip={<BalanceTooltip title="Total balance" balance={tooltipValue('totalSats')} available={loading ? 'Loading ...' : available(balance.availableSats)} />} />
    <div className={`bis-balance-columns${directionControl ? ' bis-balance-columns-with-direction' : ''}`}>
      <CopyableValueField label="Bitcoin balance" value={value('bitcoinSats')} disabled={loading} tooltipName="Bitcoin balance" tooltip={<BalanceTooltip title="Bitcoin balance" balance={tooltipValue('bitcoinSats')} available={tooltipValue('bitcoinSats')} />} />
      {directionControl}
      <CopyableValueField label="Arkade balance" value={value('arkadeSats')} disabled={loading} tooltipName="Game balance" tooltip={<BalanceTooltip title="Game balance" balance={tooltipValue('arkadeSats')} available={loading ? 'Loading ...' : available(balance.availableSats)} />} />
    </div>
  </div>;
}
