import { walletReservations } from './wallet-reservations.ts';
import type { WalletAccount } from '../wallet-layer-arkade/wallet-identity.ts';

/** A public provenance record beside browser journals, never signing material. */
export function preserveGameWalletSource(account: WalletAccount, storage: Pick<Storage, 'getItem' | 'setItem'>, pending = () => walletReservations(account.profileId, account.network ?? 'signet').length > 0) {
  const key = `bis-${account.network ?? 'signet'}-game-signer-source-v1:${encodeURIComponent(account.profileId)}`;
  const source = JSON.stringify('server' in account ? { source: 'server', endpoint: account.server.endpoint, profileId: account.profileId, network: account.network } : { source: 'manual', profileId: account.profileId, network: account.network ?? 'signet' });
  const prior = storage.getItem(key);
  if (prior && prior !== source && pending()) throw Error('This game wallet has unresolved operations at its original signing source. Reconnect that source before switching.');
  if (!prior && !('server' in account)) return;
  storage.setItem(key, source);
  if (storage.getItem(key) !== source) throw Error('Game wallet signing source could not be saved.');
}
