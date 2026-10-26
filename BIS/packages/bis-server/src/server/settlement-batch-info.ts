import { RestArkProvider, getNetwork, type ArkInfo } from '@arkade-os/sdk';
import { Address, OutScript } from '@scure/btc-signer';
import type { GameNetwork } from './environment.ts';

/** Read only fixed-network public operator parameters. No client-provided URL,
 * key, signing identity, event stream, registration or transaction submission.
 */
export async function readSettlementBatchInfo(network: GameNetwork, signal: AbortSignal, readInfo?: () => Promise<ArkInfo>) {
  const active = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  active.throwIfAborted();
  if (!['signet', 'mutinynet'].includes(network)) throw Error('Fresh settlement batch info unavailable.');
  const provider = new RestArkProvider(network === 'signet' ? 'https://signet.arkade.sh' : 'https://mutinynet.arkade.sh');
  let abort = () => {};
  try {
    const info = await Promise.race([(readInfo ?? (() => provider.getInfo()))(), new Promise<never>((_, reject) => {
      abort = () => reject(Error('Fresh settlement batch info unavailable.'));
      active.addEventListener('abort', abort, { once: true }); if (active.aborted) abort();
    })]);
    active.throwIfAborted();
    if (info.network !== network || !/^(?:0[23])?[a-f0-9]{64}$/.test(info.signerPubkey) || !/^(?:0[23])?[a-f0-9]{64}$/.test(info.forfeitPubkey) ||
        info.vtxoTreeExpiry !== undefined && (typeof info.vtxoTreeExpiry !== 'bigint' || info.vtxoTreeExpiry <= 0n)) throw Error('Fresh settlement batch info unavailable.');
    const forfeitScript = info.forfeitAddress === undefined ? undefined : Buffer.from(OutScript.encode(Address(getNetwork(network)).decode(info.forfeitAddress))).toString('hex');
    return { network, publicKey: info.signerPubkey, forfeitPublicKey: info.forfeitPubkey, advertisedBatchExpiry: info.vtxoTreeExpiry, ...(forfeitScript ? { forfeitScript } : {}) };
  } catch { throw Error('Fresh settlement batch info unavailable.'); }
  finally { active.removeEventListener('abort', abort); }
}
