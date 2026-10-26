import type { GameWalletStorage } from './game-wallet-storage.ts';
import type { WalletAccount } from '../wallet-layer-arkade/wallet-identity.ts';
import { probeGameSigner, selectGameSigner, signerEndpoint, type ServerWalletReference, type SignerProbe, type ServerWalletRequirement } from '../wallet-layer-arkade/server-wallet.ts';
import type { TestNetwork } from './test-network.ts';

type RememberedProfile = { load(network: TestNetwork): string | undefined; save(account: ServerWalletReference): void };
/** Public source selection survives reload; credentials and signing plans never do. */
export function createServerProfileMemory(storage: Pick<Storage, 'getItem' | 'setItem'>, endpoint = signerEndpoint): RememberedProfile {
  const scope = (network: TestNetwork) => {
    const value = endpoint();
    if (!value) return;
    return { endpoint: value.endsWith('/') ? value : value + '/', network, gameId: 'stealth-and-steel' };
  };
  const key = (value: NonNullable<ReturnType<typeof scope>>) => 'bis-game-server-profile-v1:' + encodeURIComponent(JSON.stringify(value));
  return {
    load(network) {
      const selected = scope(network);
      if (!selected) return;
      const value = storage.getItem(key(selected));
      if (value === null) return;
      if (!/^[0-9a-f]{64}$/.test(value)) throw Error('Saved server wallet selection is invalid.');
      return value;
    },
    save(account) {
      const selected = scope(account.network);
      if (!selected || selected.endpoint !== account.server.endpoint || selected.gameId !== account.server.gameId || !/^[0-9a-f]{64}$/.test(account.profileId)) throw Error('Server wallet selection changed.');
      const destination = key(selected);
      storage.setItem(destination, account.profileId);
      if (storage.getItem(destination) !== account.profileId) throw Error('Server wallet selection could not be saved.');
    },
  };
}

export function createServerFirstStorage(local: GameWalletStorage, network: () => TestNetwork, probe: (network: TestNetwork, options?: { profileId?: string }) => Promise<SignerProbe> = probeGameSigner, remembered?: RememberedProfile, select = selectGameSigner) {
  let server: ServerWalletReference | undefined, lastNetwork: TestNetwork | undefined;
  const profiles = new Map<TestNetwork, string>();
  let result: SignerProbe = { status: 'absent', message: '' };
  let manualSelected = false, hadServer = false, disposed = false, generation = 0;
  let probing: Promise<void> | undefined;
  const source = () => ({ source: server && !manualSelected ? 'server' as const : 'manual' as const, serverStatus: result.status, serverMessage: result.status === 'connected' ? undefined : result.message });
  async function refresh() {
    const selected = network();
    if (probing && lastNetwork === selected) return probing;
    lastNetwork = selected;
    const current = ++generation;
    const work = (async () => {
      let profileId: string | undefined;
      let unreadable = false;
      try { profileId = profiles.get(selected) ?? remembered?.load(selected); }
      catch { unreadable = true; }
      let next = await probe(selected, { profileId });
      if (disposed || current !== generation || selected !== network()) return;
      // Metadata failure must not hide a genuinely absent backend or disable
      // manual login. A reachable substitute is never accepted as recovery.
      if (unreadable && next.status !== 'absent') next = { status: 'error', message: 'Original server wallet selection could not be read. Reconnect its signing source before retrying.' };
      if (next.status === 'connected' && profileId !== undefined && next.account.profileId !== profileId) next = { status: 'error', message: 'Original BIS server wallet is unavailable. Reconnect its signing source before retrying.' };
      if (next.status === 'connected') {
        try { remembered?.save(next.account); }
        catch { next = { status: 'error', message: 'Original server wallet selection could not be saved. Retry before starting work.' }; }
      }
      result = next; server = next.status === 'connected' ? next.account : undefined;
      if (server) { hadServer = true; profiles.set(selected, server.profileId); }
    })();
    probing = work;
    try { await work; } finally { if (probing === work) probing = undefined; }
  }
  const storage: GameWalletStorage<WalletAccount> = {
    async load() {
      if (result.status === 'error' && !manualSelected) throw Error(result.message);
      if (server && !manualSelected) return server;
      if (hadServer && !manualSelected) return null;
      return local.load();
    },
    async select(account) {
      if ('server' in account) throw Error('Server identities cannot be imported.');
      if (server && !manualSelected) throw Error('Game server selected.');
      await local.select(account); manualSelected = true;
    },
    async logout() { if (server && !manualSelected) return; await local.logout(); manualSelected = false; },
    async reset() { if (server && !manualSelected) return; await local.reset(); manualSelected = false; },
    subscribe: listener => local.subscribe(listener),
    dispose() { disposed = true; generation++; local.dispose(); },
  };
  return { storage, source, refresh,
    async selectForOperation(account: WalletAccount, requirement: ServerWalletRequirement, signal: AbortSignal, canReplace: (candidate?: WalletAccount) => boolean) {
      if (!('server' in account)) return account;
      const current = generation;
      const assertCurrent = (candidate?: WalletAccount) => {
        signal.throwIfAborted();
        if (disposed || manualSelected || !server || generation !== current || server.profileId !== account.profileId || server.server.endpoint !== account.server.endpoint || network() !== account.network || !canReplace(candidate)) throw Error('Original game wallet has active or unresolved work. Reconcile before selecting another signer.');
      };
      assertCurrent();
      const next = await select(account, requirement, signal);
      assertCurrent(next);
      if (next.network !== account.network || next.server.endpoint !== account.server.endpoint || next.server.gameId !== account.server.gameId) throw Error('Game wallet selection scope changed.');
      remembered?.save(next);
      profiles.set(next.network, next.profileId); server = next; result = { status: 'connected', account: next };
      generation++;
      return next;
    },
  };
}
