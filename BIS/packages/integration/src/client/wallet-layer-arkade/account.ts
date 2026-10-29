import { MnemonicIdentity, ReadonlyWallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { phraseWords, validRecovery } from '../state-layer-core/recovery-validation.ts';
import { arkadeReadEndpointForRuntime, testNetwork, type TestNetwork } from '../state-layer-core/test-network.ts';
import type { RoleWalletAccess } from './adapter-session.ts';

export const SIGNET_OPERATOR = 'https://signet.arkade.sh';
/** `networkAccountFound` is live, read-only evidence collected during restore.
 * It is deliberately not persisted: the encrypted local profile is not a
 * substitute for the selected network's current state. */
export type AccountSecret = { phrase: string; profileId: string; network?: TestNetwork; networkAccountFound?: boolean };
export type { WalletAccount } from './wallet-identity.ts';
export async function identify(phrase: string): Promise<string> {
  const identity = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false });
  const publicKey = await identity.compressedPublicKey();
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(publicKey));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function requireSignet(network: string) {
  if (network !== 'signet') throw new Error('Only Signet is supported.');
}
export function requireNetwork(network: string, expected: TestNetwork) {
  if (network !== expected) throw new Error(`Operator network mismatch: expected ${testNetwork(expected).label}.`);
}
export function operatorFor(network: TestNetwork = 'signet') { return testNetwork(network).operator; }
export function arkadeReadOperatorFor(network: TestNetwork = 'signet') { return arkadeReadEndpointForRuntime(network); }
export async function createAccount(signal: AbortSignal, network: TestNetwork = 'signet', session?:RoleWalletAccess): Promise<AccountSecret> {
  return restoreAccount(generateMnemonic(wordlist), signal, network,session);
}
export async function restoreAccount(input: string, signal: AbortSignal, network: TestNetwork = 'signet', session?:RoleWalletAccess): Promise<AccountSecret> {
  if (!validRecovery(input)) throw new Error('Invalid recovery phrase.');
  const phrase = phraseWords(input).join(' ');
  const operator = arkadeReadOperatorFor(network);
  const response = await fetch(`${operator}/v1/info`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) throw new Error('Test service unavailable.');
  requireNetwork((await response.json()).network, network);
  if(session) {
    const account={phrase,profileId:await identify(phrase),network};
    try {
      // Address derivation always succeeds for a valid mnemonic.  It is not
      // evidence that this account is new (or absent) on the selected network.
      // Ask the live wallet for its balance before choosing restore UI.
      const networkAccountFound=await session.read(account,signal,async wallet=>{
        await wallet.getAddress();
        const balance=await wallet.getBalance();
        return balance.total>0 || balance.assets.length>0;
      });
      return {...account,networkAccountFound};
    }
    catch(error){void session.retire().catch(()=>{});throw error;}
  }
  const provider = new RestArkProvider(operator);
  // Validate the SDK's own configuration read as well as the initial fetch.
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); requireNetwork(info.network, network); return info; };
  const pending = ReadonlyWallet.create({
    identity: await MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false }).toReadonly(),
    arkProvider: provider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  });
  return withTemporaryWallet(pending, signal, async wallet => {
    await wallet.getAddress();
    const balance=await wallet.getBalance();
    return { phrase, profileId: await identify(phrase), network, networkAccountFound:balance.total>0 || balance.assets.length>0 };
  });
}
// Private lifecycle seam: the deadline covers address acquisition as well as creation.
export async function withTemporaryWallet<W extends { dispose(): Promise<void> }, T>(
  pending: Promise<W>, signal: AbortSignal, use: (wallet: W) => Promise<T>, timeout: number | false = 20000,
): Promise<T> {
  const deadline = timeout===false ? signal : AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
  let onAbort: () => void = () => {};
  let acquired: W | undefined;
  let cleanup: Promise<void> | undefined;
  const dispose = () => cleanup ??= acquired ? Promise.resolve().then(() => acquired!.dispose()) : Promise.resolve();
  const work = pending.then(async wallet => {
    acquired=wallet;
    try { deadline.throwIfAborted(); const result = await use(wallet); deadline.throwIfAborted(); return result; }
    finally { await dispose(); }
  });
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      onAbort = () => { if(acquired) void dispose().catch(()=>{}); reject(new Error('Account connection interrupted.')); };
      if (deadline.aborted) onAbort(); else deadline.addEventListener('abort', onAbort, { once: true });
    })]);
  } finally {
    deadline.removeEventListener('abort', onAbort);
  }
}
