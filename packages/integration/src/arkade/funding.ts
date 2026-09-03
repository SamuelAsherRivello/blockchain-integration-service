import { MnemonicIdentity, Wallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { SIGNET_OPERATOR, requireSignet, withTemporaryWallet, type AccountSecret } from './account.ts';

export const SIGNET_FAUCET = 'https://faucet.signet.arkade.sh/faucet';
// An acknowledgement is not confirmation of receipt. Never automatically retry.
export async function requestTestSats(address: string, signal: AbortSignal, send: typeof fetch = fetch): Promise<void> {
  if (!address.startsWith('tark1')) throw new Error('A Signet Arkade address is required.');
  signal.throwIfAborted();
  const response = await send(SIGNET_FAUCET, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, amount: 1000 }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error('Funding request was not acknowledged.');
}
export async function fundTestAccount(account: AccountSecret, signal: AbortSignal, isCurrent: () => boolean): Promise<void> {
  const provider = new RestArkProvider(SIGNET_OPERATOR);
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); requireSignet(info.network); return info; };
  const pending = Wallet.create({
    identity: MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }), arkProvider: provider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  });
  const address = await withTemporaryWallet(pending, signal, wallet => wallet.getAddress());
  signal.throwIfAborted();
  if (!isCurrent()) throw new Error('Account changed.');
  await requestTestSats(address, signal);
}
