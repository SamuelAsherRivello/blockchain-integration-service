export function toSats(value) {
  return Number(value ?? 0n);
}

export async function readFaucetBalance(wallet) {
  if (!wallet) {
    const error = new Error('Funding is not configured for this network.');
    error.code = 'UNAVAILABLE';
    throw error;
  }
  const value = await wallet.getBalance();
  return {
    total: toSats(value.total),
    available: toSats(value.available),
    settled: toSats(value.settled),
    preconfirmed: toSats(value.preconfirmed),
    recoverable: toSats(value.recoverable),
  };
}
