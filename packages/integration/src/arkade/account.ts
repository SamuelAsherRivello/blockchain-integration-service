import { MnemonicIdentity, Wallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { phraseWords, validRecovery } from '../core/recovery-validation.ts';

export const SIGNET_OPERATOR = 'https://signet.arkade.sh';
export type AccountSecret = { phrase: string; profileId: string };
export async function identify(phrase: string): Promise<string> {
  const identity = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false });
  const publicKey = await identity.compressedPublicKey();
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(publicKey));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function requireSignet(network: string) {
  if (network !== 'signet') throw new Error('Only Signet is supported.');
}
export async function createAccount(signal: AbortSignal): Promise<AccountSecret> {
  return restoreAccount(generateMnemonic(wordlist), signal);
}
export async function restoreAccount(input: string, signal: AbortSignal): Promise<AccountSecret> {
  if (!validRecovery(input)) throw new Error('Invalid recovery phrase.');
  const phrase = phraseWords(input).join(' ');
  const response = await fetch(`${SIGNET_OPERATOR}/v1/info`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) throw new Error('Test service unavailable.');
  requireSignet((await response.json()).network);
  const provider = new RestArkProvider(SIGNET_OPERATOR);
  // Validate the SDK's own configuration read as well as the initial fetch.
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); requireSignet(info.network); return info; };
  const pending = Wallet.create({
    identity: MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false }),
    arkProvider: provider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  });
  return withTemporaryWallet(pending, signal, async wallet => {
    await wallet.getAddress();
    return { phrase, profileId: await identify(phrase) };
  });
}
// Private lifecycle seam: the deadline covers address acquisition as well as creation.
export async function withTemporaryWallet<W extends { dispose(): Promise<void> }, T>(
  pending: Promise<W>, signal: AbortSignal, use: (wallet: W) => Promise<T>, timeout = 20000,
): Promise<T> {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(timeout)]);
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
