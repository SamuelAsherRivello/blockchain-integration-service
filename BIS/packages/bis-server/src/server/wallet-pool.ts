import { createHash } from 'node:crypto';
import { MnemonicIdentity, ReadonlyWallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { walletCandidates, type GameNetwork } from './environment.ts';

export type PublicWallet = { network: GameNetwork; slot: '01' | '02' | '03'; profileId: string; publicKey: string };
export type WalletBalance = { availableArkadeSats: number; availableBitcoinSats: number; mintMinimumSats?: number; boardingMinimumSats?: number; assets?: Readonly<Record<string,string>> };
export type WalletRequirement = { arkadeSats?: number; bitcoinSats?: number; purpose?: 'mint' | 'boarding' | 'asset'; excludedProfiles?: readonly string[]; asset?: Readonly<{assetId:string;quantity:string;exact?:boolean}> };
export type SelectedWallet = PublicWallet & { mnemonic: string };
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

/** Balance is read-only, network-backed and never treated as a cached spending reservation. */
export async function readCandidateBalance(wallet: SelectedWallet, signal: AbortSignal, requirement: WalletRequirement = {}): Promise<WalletBalance> {
  signal.throwIfAborted();
  const operator = wallet.network === 'signet' ? 'https://signet.arkade.sh' : 'https://mutinynet.arkade.sh';
  const provider = new RestArkProvider(operator), indexer = new RestIndexerProvider(operator);
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); if (info.network !== wallet.network) throw Error('Game signer operator network mismatch.'); return info; };
  let failed = false;
  const getVtxos = indexer.getVtxos.bind(indexer);
  indexer.getVtxos = async (...args) => { try { return await getVtxos(...args); } catch { failed = true; throw Error('Game wallet balance unavailable.'); } };
  const info = await provider.getInfo();
  signal.throwIfAborted();
  const pending = ReadonlyWallet.create({ identity: await MnemonicIdentity.fromMnemonic(wallet.mnemonic, { isMainnet: false }).toReadonly(), arkProvider: provider, indexerProvider: indexer,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() } });
  let acquired: ReadonlyWallet | undefined;
  const work = pending.then(async resource => {
    acquired = resource;
    try {
      signal.throwIfAborted();
      const amounts = await resource.getBalance();
      let assets: Record<string,string> | undefined;
      if (requirement.asset) {
        assets = Object.create(null);
        for (const coin of await resource.getSpendableVtxos({withRecoverable:false,withUnrolled:false})) for (const holding of coin.assets ?? []) {
          const id=String(holding.assetId);
          if (!/^[0-9a-f]{68}$/i.test(id) || typeof holding.amount !== 'bigint' || holding.amount <= 0n) throw Error('Game wallet asset balance unavailable.');
          assets![id.toLowerCase()]=(BigInt(assets![id.toLowerCase()]??'0')+holding.amount).toString();
        }
      }
      const connection = resource.getProviderConnectionState();
      if (failed || connection.mode !== 'online' || connection.source !== 'live') throw Error('Game wallet balance unavailable.');
      return { availableArkadeSats: amounts.available, availableBitcoinSats: amounts.boarding.confirmed, mintMinimumSats: Number(resource.dustAmount), boardingMinimumSats: Math.max(Number(info.vtxoMinAmount), 1), assets };
    } finally { await resource.dispose(); }
  });
  let abort: () => void = () => {};
  try { return await Promise.race([work, new Promise<never>((_, reject) => {
    abort = () => { void acquired?.dispose().catch(() => {}); reject(Error('Game wallet balance check interrupted.')); };
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
  })]); } finally { signal.removeEventListener('abort', abort); }
}
export function createWalletPool(values: NodeJS.ProcessEnv, balance = readCandidateBalance, candidateTimeoutMs = 4000) {
  let candidatesByNetwork: Promise<Record<GameNetwork, SelectedWallet[]>> | undefined;
  async function loadCandidates(network: GameNetwork) {
    const wallets: SelectedWallet[] = [], profiles = new Set<string>();
    for (const candidate of walletCandidates(network, values)) {
      try {
        const identity = MnemonicIdentity.fromMnemonic(candidate.mnemonic, { isMainnet: false });
        const publicKey = hex(await identity.compressedPublicKey());
        const profileId = createHash('sha256').update(Buffer.from(publicKey, 'hex')).digest('hex');
        if (!profiles.has(profileId)) { wallets.push({ ...candidate, publicKey, profileId }); profiles.add(profileId); }
      } catch { /* A malformed slot is ineligible. Never include SDK/phrase details in diagnostics. */ }
    }
    return wallets;
  }
  async function candidates(network: GameNetwork) {
    if (network !== 'signet' && network !== 'mutinynet') throw Error('Game signer network unsupported.');
    if (!candidatesByNetwork) {
      candidatesByNetwork = (async () => {
        const [signet, mutinynet] = await Promise.all([loadCandidates('signet'), loadCandidates('mutinynet')]);
        const mutinynetProfiles = new Set(mutinynet.map(wallet => wallet.profileId));
        const crossNetworkDuplicates = new Set(signet.filter(wallet => mutinynetProfiles.has(wallet.profileId)).map(wallet => wallet.profileId));
        return {
          signet: signet.filter(wallet => !crossNetworkDuplicates.has(wallet.profileId)),
          mutinynet: mutinynet.filter(wallet => !crossNetworkDuplicates.has(wallet.profileId)),
        };
      })();
    }
    return (await candidatesByNetwork)[network];
  }
  return {
    async select(network: GameNetwork, requirement: WalletRequirement = {}, signal = AbortSignal.timeout(15000)) {
      const arkade = requirement.arkadeSats ?? 0, bitcoin = requirement.bitcoinSats ?? 0;
      if (![arkade, bitcoin].every(value => Number.isSafeInteger(value) && value >= 0)) throw Error('Invalid wallet requirement.');
      if (requirement.purpose !== undefined && !['mint', 'boarding', 'asset'].includes(requirement.purpose)) throw Error('Invalid wallet purpose.');
      if (requirement.excludedProfiles !== undefined && (!Array.isArray(requirement.excludedProfiles) || requirement.excludedProfiles.length>3 || requirement.excludedProfiles.some(id=>typeof id!=='string'||!/^[0-9a-f]{64}$/.test(id)))) throw Error('Invalid excluded wallet profiles.');
      const wanted = requirement.asset;
      if (wanted !== undefined && (!wanted || requirement.purpose!=='asset' || !/^[0-9a-f]{68}$/i.test(wanted.assetId) || typeof wanted.quantity!=='string' || !/^[1-9][0-9]{0,19}$/.test(wanted.quantity) || BigInt(wanted.quantity)>18446744073709551615n || (wanted.exact!==undefined && typeof wanted.exact!=='boolean'))) throw Error('Invalid asset requirement.');
      if (requirement.purpose==='asset' && !wanted) throw Error('Asset requirement missing.');
      const wallets = await candidates(network);
      for (const wallet of wallets) {
        signal.throwIfAborted();
        if (requirement.excludedProfiles?.includes(wallet.profileId)) continue;
        if (arkade === 0 && bitcoin === 0 && requirement.purpose === undefined) return wallet;
        try {
          const candidateSignal = AbortSignal.any([signal, AbortSignal.timeout(candidateTimeoutMs)]);
          let abort: () => void = () => {};
          let amounts: WalletBalance;
          try { amounts = await Promise.race([balance(wallet, candidateSignal, requirement), new Promise<never>((_, reject) => {
            abort = () => reject(Error('Game wallet balance check timed out.'));
            candidateSignal.addEventListener('abort', abort, { once: true }); if (candidateSignal.aborted) abort();
          })]); } finally { candidateSignal.removeEventListener('abort', abort); }
          if (![amounts.availableArkadeSats, amounts.availableBitcoinSats].every(value => Number.isSafeInteger(value) && value >= 0)) continue;
          const minimum = requirement.purpose === 'mint' || requirement.purpose === 'asset' ? amounts.mintMinimumSats : requirement.purpose === 'boarding' ? amounts.boardingMinimumSats : 0;
          if (typeof minimum !== 'number' || !Number.isSafeInteger(minimum) || minimum < 0 || (requirement.purpose !== undefined && minimum === 0)) continue;
          if (wanted) {
            const owned=amounts.assets?.[wanted.assetId.toLowerCase()];
            if (typeof owned!=='string' || !/^[1-9][0-9]*$/.test(owned) || owned.length>100 || (wanted.exact ? BigInt(owned)!==BigInt(wanted.quantity) : BigInt(owned)<BigInt(wanted.quantity))) continue;
          }
          if (amounts.availableArkadeSats >= Math.max(arkade, requirement.purpose === 'mint' || requirement.purpose === 'asset' ? minimum : 0) && amounts.availableBitcoinSats >= Math.max(bitcoin, requirement.purpose === 'boarding' ? minimum : 0)) return wallet;
        } catch { signal.throwIfAborted(); /* Unknown balance is not proof of eligibility. */ }
      }
      throw Error(wallets.length ? 'No game wallet meets the requested spendable balance.' : 'No valid game wallet is configured for this network.');
    },
    /** Signing and recovery resolve exactly, never repeat balance-based selection. */
    async original(network: GameNetwork, profileId: string) {
      const wallet = (await candidates(network)).find(wallet => wallet.profileId === profileId);
      if (!wallet) throw Error('Original game wallet is unavailable. Reconcile before retrying.');
      return wallet;
    },
    async publicWallets(network: GameNetwork): Promise<PublicWallet[]> {
      return (await candidates(network)).map(({ mnemonic: _mnemonic, ...wallet }) => wallet);
    },
  };
}
