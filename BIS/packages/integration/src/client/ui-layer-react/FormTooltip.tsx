export function FormTooltip({ title, balance, available }: {
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

export function formatBalanceSats(amount: number | undefined, unknown = 'Unavailable') {
  return amount === undefined ? unknown : `${amount.toLocaleString('en-US')} sats`;
}
