import { loadBalance } from '../../packages/integration/src/client/wallet-layer-arkade/balance.ts';
import { listWalletAssets } from '../../packages/integration/src/client/wallet-layer-arkade/assets.ts';
import { verifiedInventory, status } from './inventory.ts';
import { label, network } from './arguments.ts';
import { Operations } from './operations.ts';
import { fail } from './errors.ts';
import { readinessTarget, classifyReadiness, boundedObservation } from './readiness.ts';

export async function observe(vault, options = {}, adapters = {}) {
  const target = readinessTarget(options);
  if (options.account !== undefined) label(options.account);
  if (options.network !== undefined) network(options.network);
  const selected = await vault.transaction(async state => {
    await verifiedInventory(state);
    const accounts = state.accounts.filter(row => !options.account || row.label === options.account);
    if (options.account && !accounts.length) fail('account-not-registered');
    return structuredClone(accounts);
  });
  const observations = new Map();
  for (const account of selected) for (const selectedNetwork of options.network ? [options.network] : ['signet', 'mutinynet']) {
    const scope = { ...account, network: selectedNetwork }, signal = AbortSignal.timeout(30000);
    const [balanceResult, assetsResult, pendingResult] = await Promise.all([
      boundedObservation(() => Promise.resolve().then(() => (adapters.balance ?? loadBalance)(scope, signal)), signal).then(value => ({status:'fulfilled',value}), () => ({status:'rejected'})),
      boundedObservation(() => Promise.resolve().then(() => (adapters.assets ?? listWalletAssets)(scope, signal)), signal).then(value => ({status:'fulfilled',value}), () => ({status:'rejected'})),
      adapters.pending
        ? boundedObservation(() => Promise.resolve().then(() => adapters.pending(scope, signal)), signal).then(value => ({status:'fulfilled',value}), () => ({status:'rejected'}))
        : Promise.resolve({status:'unavailable'}),
    ]);
    let pendingCount = pendingResult.status === 'fulfilled' && Number.isSafeInteger(pendingResult.value) && pendingResult.value >= 0
      ? pendingResult.value : undefined;
    const reads = { balance: balanceResult.status === 'fulfilled' ? 'ok' : 'failed',
      assets: assetsResult.status === 'fulfilled' ? 'ok' : 'failed',
      appPending: pendingCount === undefined ? 'unavailable' : pendingCount > 0 ? 'positive' : 'zero' };
    let observation = { network: selectedNetwork, observedAt: new Date().toISOString(), reads,
      readiness: 'unavailable', reason: 'live-read-unavailable' };
    if (balanceResult.status === 'fulfilled' && assetsResult.status === 'fulfilled') {
      const balance = balanceResult.value, assets = assetsResult.value;
      const names = ['availableSats', 'availableBitcoinSats', 'availableArkadeSats', 'totalSats', 'bitcoinSats', 'arkadeSats'];
      const valid = balance && names.every(key => Number.isSafeInteger(balance[key]) && balance[key] >= 0) && Array.isArray(assets) &&
        balance.availableSats === balance.availableArkadeSats && balance.totalSats === balance.bitcoinSats + balance.arkadeSats &&
        balance.availableBitcoinSats <= balance.bitcoinSats && balance.availableArkadeSats <= balance.arkadeSats;
      if (valid) observation = { ...observation, ...classifyReadiness(balance, assets.length, target, pendingCount),
        ...(target ? { target } : {}), ...(pendingCount === undefined ? {} : { pendingCount }),
        balances: Object.fromEntries(names.map(key => [key, balance[key]])), assetCount: assets.length };
    }
    const reportedPending = await vault.transaction(async state => {
      await verifiedInventory(state);
      const current = state.accounts.find(row => row.label === account.label);
      if (!current || current.profileId !== account.profileId || current.generation !== account.generation) fail('observation-identity-changed');
      return Boolean(current.reportedPending?.[selectedNetwork]);
    });
    const pending = (await new Operations(vault).list()).filter(row => [row.intent.profileId, row.intent.target?.profileId].includes(account.profileId) &&
      row.intent.network === selectedNetwork && !['settled', 'failed', 'cancelled'].includes(row.state));
    if (pending.length) observation = { ...observation, readiness: 'pending', reason: 'runner-operation-unresolved', operationIds: pending.map(row => row.intent.id) };
    if (reportedPending) observation = { ...observation, readiness: 'pending',
      reason: 'user-reported-onboarding-unreconciled' };
    observations.set(`${account.label}:${selectedNetwork}`, observation);
  }
  const result = await status(vault, options);
  return { ...result, accounts: result.accounts.map(account => ({ ...account,
    networks: account.networks.map(row => observations.get(`${account.label}:${row.network}`) ?? row) })) };
}

