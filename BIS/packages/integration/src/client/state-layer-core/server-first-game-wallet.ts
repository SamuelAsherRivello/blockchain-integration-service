import type { GameWalletStorage } from './game-wallet-storage.ts';
import type { WalletAccount } from '../wallet-layer-arkade/wallet-identity.ts';
import { probeGameSigner, selectGameSigner, signerEndpoint, type ServerWalletReference, type SignerProbe, type ServerWalletRequirement } from '../wallet-layer-arkade/server-wallet.ts';
import type { TestNetwork } from './test-network.ts';
import {defaultGameWalletWorkflowMode} from './game-wallet-workflow.ts';

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

export function createServerFirstStorage(local: GameWalletStorage, network: () => TestNetwork, probe: (network: TestNetwork, options?: { profileId?: string }) => Promise<SignerProbe> = probeGameSigner, remembered?: RememberedProfile, select = selectGameSigner, manualOnly = false) {
  let server: ServerWalletReference | undefined, lastNetwork: TestNetwork | undefined;
  const profiles = new Map<TestNetwork, string>();
  let result: SignerProbe = { status: 'absent', message: '' };
  let disposed = false, generation = 0;
  let probing: Promise<void> | undefined;
  const mode=()=>manualOnly?'local' as const:defaultGameWalletWorkflowMode(network());
  const source = () => mode()==='local'
    ?{workflowMode:'local' as const,source:'manual' as const,serverStatus:'absent' as const,serverMessage:undefined}
    :{workflowMode:'server' as const,source:server?.network===network()?'server' as const:'manual' as const,serverStatus:lastNetwork===network()?result.status:'absent' as const,serverMessage:lastNetwork===network()&&result.status!=='connected'?result.message:undefined};
  async function refresh() {
    const selected = network();
    if(mode()==='local'){
      generation++;lastNetwork=selected;server=undefined;result={status:'absent',message:''};
      return;
    }
    if (probing && lastNetwork === selected) return probing;
    lastNetwork = selected;
    const current = ++generation;
    const work = (async () => {
      let profileId: string | undefined;
      let unreadable = false;
      try { profileId = profiles.get(selected) ?? remembered?.load(selected); }
      catch { unreadable = true; }
      let next = await probe(selected, { profileId });
      if (disposed || current !== generation || selected !== network() || mode()!=='server') return;
      // Metadata failure must not hide a genuinely absent backend or disable
      // manual login. A reachable substitute is never accepted as recovery.
      if (unreadable && next.status !== 'absent') next = { status: 'error', message: 'Original server wallet selection could not be read. Reconnect its signing source before retrying.' };
      if (next.status === 'connected' && profileId !== undefined && next.account.profileId !== profileId) next = { status: 'error', message: 'Original BIS server wallet is unavailable. Reconnect its signing source before retrying.' };
      if (next.status === 'connected') {
        try { remembered?.save(next.account); }
        catch { next = { status: 'error', message: 'Original server wallet selection could not be saved. Retry before starting work.' }; }
      }
      result = next; server = next.status === 'connected' ? next.account : undefined;
      if (server) profiles.set(selected, server.profileId);
    })();
    probing = work;
    try { await work; } finally { if (probing === work) probing = undefined; }
  }
  const storage: GameWalletStorage<WalletAccount> = {
    async load() {
      if(mode()==='local')return local.load();
      if(lastNetwork===network()&&result.status==='error')throw Error(result.message);
      if(server?.network===network())return server;
      // Server failure must not activate an old browser signing identity.
      return null;
    },
    async select(account) {
      if ('server' in account) throw Error('Server identities cannot be imported.');
      if (mode()==='server') throw Error('Game server selected.');
      await local.select(account);generation++;server=undefined;
    },
    async logout() { if (mode()==='server') return; await local.logout(); },
    async reset() { if (mode()==='server') return; await local.reset(); },
    subscribe: listener => local.subscribe(listener),
    dispose() { disposed = true; generation++; local.dispose(); },
  };
  return { storage, source, refresh,
    async selectForOperation(account: WalletAccount, requirement: ServerWalletRequirement, signal: AbortSignal, canReplace: (candidate?: WalletAccount) => boolean) {
      if (!('server' in account)) return account;
      const current = generation;
      const assertCurrent = (candidate?: WalletAccount) => {
        signal.throwIfAborted();
        if (disposed || mode()!=='server' || !server || generation !== current || server.profileId !== account.profileId || server.server.endpoint !== account.server.endpoint || network() !== account.network || !canReplace(candidate)) throw Error('Original game wallet has active or unresolved work. Reconcile before selecting another signer.');
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
