import { MnemonicIdentity, Wallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { requireSignet, SIGNET_OPERATOR, withTemporaryWallet, type AccountSecret } from './account.ts';
import { validRecovery } from '../core/recovery-validation.ts';

export type AccountAddresses = Readonly<{ arkadeAddress: string; bitcoinAddress: string }>;
export async function loadAddresses(account: AccountSecret, signal: AbortSignal): Promise<AccountAddresses> {
  if (!validRecovery(account.phrase)) throw new Error('Invalid account.');
  signal.throwIfAborted();
  const provider = new RestArkProvider(SIGNET_OPERATOR);
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); requireSignet(info.network); return info; };
  return withTemporaryWallet(Wallet.create({
    identity: MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }),
    arkProvider: provider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  }), signal, async wallet => {
    const [arkadeAddress, bitcoinAddress] = await Promise.all([wallet.getAddress(), wallet.getBoardingAddress()]);
    if (!arkadeAddress.startsWith('tark1') || !bitcoinAddress.startsWith('tb1')) throw new Error('Unexpected address network.');
    return Object.freeze({ arkadeAddress, bitcoinAddress });
  });
}
