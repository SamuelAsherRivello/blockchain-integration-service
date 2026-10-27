import { readFileSync, lstatSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

export const environmentPath = fileURLToPath(new URL('../../.env.local', import.meta.url));
export type SignerEnvironmentOptions = { env?: NodeJS.ProcessEnv; path?: string; hosted?: boolean };
export type SignerConfiguration = { mnemonic?: string; network: 'signet' | 'mutinynet'; gameId: string; enabled?: boolean; walletEnvironment?: NodeJS.ProcessEnv };
const previewIsolatedKeys = [
  'BIS_OWNER_TOKEN', 'BIS_SIGNING_DAILY_CAP_SATS', 'BIS_SIGNING_OPERATION_CAP_SATS',
  'BIS_GAME_WALLET_MNEMONIC', 'BIS_GAME_WALLET_NETWORK', 'BIS_SERVER_ENABLED', 'BIS_GAME_ID', 'BIS_ALLOWED_ORIGINS',
  'BIS_PUBLIC_ASSET_SIGNING', 'BIS_PUBLIC_CONTRACT_SIGNING', 'BIS_PUBLIC_PAYMENT_SIGNING', 'BIS_PUBLIC_SETTLEMENT_SIGNING', 'BIS_PUBLIC_SIGNING_NETWORKS',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
  ...(['SIGNET', 'MUTINYNET'] as const).flatMap(network => ['01', '02', '03'].map(slot => `BIS_GAME_WALLET_${network}_${slot}_MNEMONIC`)),
];
function hostedEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (env.VERCEL_ENV !== 'preview') return { ...env };
  const preview = { ...env };
  for (const key of previewIsolatedKeys) {
    const previewKey = key.startsWith('BIS_') ? `BIS_PREVIEW_${key.slice(4)}` : `BIS_PREVIEW_${key}`;
    const value = env[previewKey];
    if (value === undefined) delete preview[key];
    else preview[key] = value;
  }
  return preview;
}
export function readPrivateEnvironment(options: SignerEnvironmentOptions = {}): NodeJS.ProcessEnv {
  const env = options.env ?? process.env;
  let file: Record<string, string | undefined> = {};
  try {
    if (options.hosted) return hostedEnvironment(env);
    const path = options.path ?? environmentPath, info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 65536) throw Error();
    file = parseEnv(readFileSync(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw Error('Game signer configuration unavailable.');
  }
  return { ...file, ...env };
}
export function loadSignerEnvironment(options: SignerEnvironmentOptions = {}): SignerConfiguration {
  const values = readPrivateEnvironment(options);
  const get = (key: string) => values[key];
  const network = get('BIS_GAME_WALLET_NETWORK') ?? 'signet';
  if (network !== 'signet' && network !== 'mutinynet') throw Error('Game signer network unsupported.');
  const walletEnvironment = Object.fromEntries(Object.entries(values).filter(([key]) => /^BIS_GAME_WALLET_(SIGNET|MUTINYNET)_0[123]_MNEMONIC$/.test(key)));
  return { mnemonic: get('BIS_GAME_WALLET_MNEMONIC'), network, gameId: get('BIS_GAME_ID') ?? 'stealth-and-steel', enabled: get('BIS_SERVER_ENABLED') !== 'false', walletEnvironment };
}

export type GameNetwork = 'signet' | 'mutinynet';
export type WalletCandidate = { slot: '01' | '02' | '03'; mnemonic: string; network: GameNetwork };
/** Candidates never leave the server. Blank process overrides deliberately disable a slot. */
export function walletCandidates(network: GameNetwork, values: NodeJS.ProcessEnv): WalletCandidate[] {
  if (network !== 'signet' && network !== 'mutinynet') throw Error('Game signer network unsupported.');
  return (['01', '02', '03'] as const).flatMap(slot => {
    const mnemonic = values[`BIS_GAME_WALLET_${network.toUpperCase()}_${slot}_MNEMONIC`]?.trim();
    return mnemonic ? [{ slot, mnemonic, network }] : [];
  });
}
