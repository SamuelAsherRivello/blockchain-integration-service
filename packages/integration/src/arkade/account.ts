import { MnemonicIdentity, Wallet, RestArkProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

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
  const response = await fetch(`${SIGNET_OPERATOR}/v1/info`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) throw new Error('Test service unavailable.');
  requireSignet((await response.json()).network);
  const phrase = generateMnemonic(wordlist);
  const provider = new RestArkProvider(SIGNET_OPERATOR);
  // Validate the SDK's own configuration read as well as the initial fetch.
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); requireSignet(info.network); return info; };
  const pending = Wallet.create({
    identity: MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false }),
    arkProvider: provider,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  });
  let expired = false;
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(20000)]);
  let onAbort: () => void = () => {};
  try {
    const wallet = await Promise.race([pending, new Promise<never>((_, reject) => {
      onAbort = () => { expired = true; reject(new Error('Creation interrupted.')); };
      if (deadline.aborted) onAbort(); else deadline.addEventListener('abort', onAbort, { once: true });
    })]);
    try { await wallet.getAddress(); signal.throwIfAborted(); return { phrase, profileId: await identify(phrase) }; }
    finally { await wallet.dispose(); }
  } finally {
    deadline.removeEventListener('abort', onAbort);
    if (expired) void pending.then(wallet => wallet.dispose()).catch(() => {});
  }
}
