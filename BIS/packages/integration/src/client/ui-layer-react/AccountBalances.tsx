import type { ReactNode } from 'react';
import type { BisBalance } from '../state-layer-core/context';
import { FormValue } from './FormValue';
import { FormTooltip } from './FormTooltip';

export function AccountBalancesFormValue({ balance, directionControl }: { balance: BisBalance; directionControl?: ReactNode }) {
  const loading = balance.status !== 'ready';
  const value = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => balance.status === 'ready'
    ? `${balance[field].toLocaleString('en-US')} sats`
    : '—';
  const tooltipValue = (field: 'totalSats' | 'bitcoinSats' | 'arkadeSats') => loading ? 'Loading ...' : value(field);
  const available = (amount: number) => loading ? 'Loading ...' : `${amount.toLocaleString('en-US')} sats`;
  return <div className="bis-addresses bis-account-balances">
    <FormValue label="Total balance" value={value('totalSats')} copyable disabled={loading} tooltipName="Total balance" tooltip={<FormTooltip title="Total balance" balance={tooltipValue('totalSats')} available={loading ? 'Loading ...' : available(balance.availableSats)} />} />
    <div className={`bis-balance-columns${directionControl ? ' bis-balance-columns-with-direction' : ''}`}>
      <FormValue label="Bitcoin balance" value={value('bitcoinSats')} copyable disabled={loading} tooltipName="Bitcoin balance" tooltip={<FormTooltip title="Bitcoin balance" balance={tooltipValue('bitcoinSats')} available={loading ? 'Loading ...' : 'Checked when you review a transfer'} />} />
      {directionControl}
      <FormValue label="Arkade balance" value={value('arkadeSats')} copyable disabled={loading} tooltipName="Game balance" tooltip={<FormTooltip title="Game balance" balance={tooltipValue('arkadeSats')} available={loading ? 'Loading ...' : available(balance.availableSats)} />} />
    </div>
  </div>;
}
