import { MnemonicIdentity } from '@arkade-os/sdk';
import type { StoredAccount } from '../state-layer-core/account-storage.ts';
import type { TestNetwork } from '../state-layer-core/test-network.ts';
import type { ServerWalletReference } from './server-wallet.ts';
import { authenticatePlayerProof } from './player-proof-client.ts';

export type AppPlayerProof = (request: { account: ServerWalletReference; operationId: string; signal: AbortSignal; fetcher?: typeof fetch }) => Promise<Awaited<ReturnType<typeof authenticatePlayerProof>> & { assertCurrent?: () => void }>;
type Scope = { phase: string; profileId?: string; network?: TestNetwork };

/** Private app composition only. No public API, global account cache or storage
 * of proofs. Re-read private storage before and after proving possession.
 */
export function createAppPlayerProof(options: { load(): Promise<StoredAccount>; scope(): Scope; subscribe(listener: () => void): () => void }): AppPlayerProof {
  return async request => {
    const initial = { ...options.scope() }, controller = new AbortController();
    const valid = () => {
      const current = options.scope();
      return ['active', 'logout-confirmation'].includes(current.phase) && current.profileId === initial.profileId && current.network === initial.network && current.network === request.account.network && !!current.profileId;
    };
    const signal = AbortSignal.any([request.signal, controller.signal]);
    const check = () => { signal.throwIfAborted(); if (!valid()) throw Error('Original Player scope is unavailable.'); };
    check();
    const unsubscribe = options.subscribe(() => { if (!valid()) controller.abort(Error('Original Player scope changed.')); });
    try {
      const stored = await options.load();
      check();
      const account = stored.account;
      if (!account || stored.logout || account.profileId !== initial.profileId || (account.network ?? 'signet') !== initial.network) throw Error('Original Player account is unavailable.');
      const result = await authenticatePlayerProof({ endpoint: request.account.server.endpoint,
        identity: MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }),
        binding: { gameId: request.account.server.gameId, network: request.account.network, profileId: request.account.profileId, operationId: request.operationId },
        signal, fetcher: request.fetcher });
      const latest = await options.load();
      check();
      if (latest.logout || latest.generation !== stored.generation || latest.account?.profileId !== account.profileId || latest.account?.phrase !== account.phrase || (latest.account?.network ?? 'signet') !== initial.network) throw Error('Original Player account changed.');
      return Object.freeze({ ...result, assertCurrent: check });
    } finally { unsubscribe(); }
  };
}
