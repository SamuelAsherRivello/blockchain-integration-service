export function formatBalanceSats(amount: number | undefined) {
  return amount === undefined ? 'Unavailable' : `${amount.toLocaleString('en-US')} sats`;
}

export function BalanceTooltip({ title, balance, available }: {
  title: string;
  balance: string;
  available: string;
}) {
  return <>
    <strong>{title}</strong>
    <span>Balance: {balance}</span>
    <span>Available balance: {available}</span>
  </>;
}
