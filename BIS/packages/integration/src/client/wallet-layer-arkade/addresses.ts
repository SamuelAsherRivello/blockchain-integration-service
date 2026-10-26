import { readonlyIdentity } from './wallet-identity.ts';
import { ReadonlyWallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { requireNetwork, operatorFor, withTemporaryWallet, type WalletAccount } from './account.ts';
import { validRecovery } from '../state-layer-core/recovery-validation.ts';
import type { RoleWalletAccess } from './adapter-session.ts';

export type AccountAddresses = Readonly<{ arkadeAddress: string; bitcoinAddress: string }>;
export async function loadAddresses(account: WalletAccount, signal: AbortSignal, session?: RoleWalletAccess): Promise<AccountAddresses> {
  if (!('server' in account) && !validRecovery(account.phrase)) throw new Error('Invalid account.');
  if (session) {
    const {arkadeAddress,bitcoinAddress}=await session.addresses(account,signal);
    if(!arkadeAddress.startsWith('tark1')||!bitcoinAddress.startsWith('tb1'))throw Error('Unexpected address network.');
    return Object.freeze({arkadeAddress,bitcoinAddress});
  }
  signal.throwIfAborted();
  const network=account.network ?? 'signet', provider = new RestArkProvider(operatorFor(network));
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); requireNetwork(info.network,network); return info; };
  return withTemporaryWallet(ReadonlyWallet.create({
    identity: await readonlyIdentity(account),
    arkProvider: provider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  }), signal, async wallet => {
    const [arkadeAddress, bitcoinAddress] = await Promise.all([wallet.getAddress(), wallet.getBoardingAddress()]);
    if (!arkadeAddress.startsWith('tark1') || !bitcoinAddress.startsWith('tb1')) throw new Error('Unexpected address network.');
    return Object.freeze({ arkadeAddress, bitcoinAddress });
  });
}
