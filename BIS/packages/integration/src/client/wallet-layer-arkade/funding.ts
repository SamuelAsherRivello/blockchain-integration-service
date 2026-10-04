import { MnemonicIdentity, ReadonlyWallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { operatorFor, requireNetwork, withTemporaryWallet, type AccountSecret } from './account.ts';
import { testNetwork, type TestNetwork } from '../state-layer-core/test-network.ts';

export const SIGNET_FAUCET = 'https://faucet.signet.arkade.sh/faucet';
// An acknowledgement is not confirmation of receipt. Never automatically retry.
export async function requestTestSats(address: string, signal: AbortSignal, send: typeof fetch = fetch, network:TestNetwork='signet'): Promise<void> {
  if (!address.startsWith('tark1')) throw new Error('A test-network Arkade address is required.');
  signal.throwIfAborted();
  const response = await send(testNetwork(network).faucetUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, amount: 1000 }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error('Funding request was not acknowledged.');
}
export async function fundTestAccount(account: AccountSecret, signal: AbortSignal, isCurrent: () => boolean): Promise<void> {
  const network=account.network ?? 'signet', provider = new RestArkProvider(operatorFor(network));
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); requireNetwork(info.network,network); return info; };
  const pending = ReadonlyWallet.create({
    identity: await MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }).toReadonly(), arkProvider: provider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  });
  const address = await withTemporaryWallet(pending, signal, wallet => wallet.getAddress());
  signal.throwIfAborted();
  if (!isCurrent()) throw new Error('Account changed.');
  await requestTestSats(address, signal, fetch, network);
}
