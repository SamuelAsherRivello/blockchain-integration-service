import type { ReactNode } from 'react';

export function ReviewDetails({ rows }: { rows: readonly (readonly [label: string, value: ReactNode])[] }) {
  return <dl className="bis-review-details">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export const formatSats = (value: number) => `${value.toLocaleString('en-US')} sats`;
