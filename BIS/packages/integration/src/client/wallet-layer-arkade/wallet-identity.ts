import { MnemonicIdentity, type Identity, type ReadonlyIdentity } from '@arkade-os/sdk';
import type { AccountSecret } from './account.ts';
import { remoteReadonlyIdentity, remoteSigningIdentity, type ServerWalletReference, type ServerSigningOperation } from './server-wallet.ts';
import { preserveGameWalletSource } from '../state-layer-core/game-wallet-source.ts';
export type WalletAccount = AccountSecret | ServerWalletReference;
export function signingIdentity(account: WalletAccount, operation?: () => ServerSigningOperation | undefined): Identity {
  if(typeof window !== 'undefined')preserveGameWalletSource(account, window.localStorage);
  return 'server' in account ? remoteSigningIdentity(account, operation) : MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false });
}
export async function readonlyIdentity(account: WalletAccount): Promise<ReadonlyIdentity> {
  return 'server' in account ? remoteReadonlyIdentity(account) : MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }).toReadonly();
}
export function walletSourceKey(account: WalletAccount): string {
  return 'server' in account ? JSON.stringify(['server', account.server.endpoint, account.profileId, account.network]) : JSON.stringify(['manual', account.profileId, account.network]);
}
