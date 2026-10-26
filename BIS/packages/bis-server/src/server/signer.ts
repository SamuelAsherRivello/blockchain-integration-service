import { createHash, randomUUID } from 'node:crypto';
import { MnemonicIdentity, Transaction, TxTree, type SignerSession } from '@arkade-os/sdk';
import { SIGNER_PROTOCOL, encodeSigningValue, decodeSigningValue, toHex } from '../../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';

type Config = { mnemonic?: string; network: 'signet' | 'mutinynet'; gameId: string };
/** Local development signer. Intentionally refuses public/serverless deployment. */
export function createLocalSigner(config: Config, now: () => number = Date.now) {
  let identity: MnemonicIdentity | undefined;
  try { if (config.mnemonic) identity = MnemonicIdentity.fromMnemonic(config.mnemonic, { isMainnet: false }); } catch { /* Never return the SDK's recovery input error. */ }
  const sessions = new Map<string, { scope: string; expires: number; signer: SignerSession; init?: string; signed: boolean; nonces: Map<string, string> }>();
  const clients = new Map<string, number>();
  const replies = new Map<string, { digest: string; work: Promise<unknown> }>();
  const signedInputs = new Map<string, string>();
  let lane = Promise.resolve();
  const run = <T>(use: () => Promise<T>) => {
    const work = lane.then(use); lane = work.then(() => {}, () => {}); return work;
  };
  async function info() {
    if (!identity) throw Error('Game signer is not configured.');
    const publicKey = await identity.compressedPublicKey();
    return { protocol: SIGNER_PROTOCOL, gameId: config.gameId, network: config.network, publicKey: toHex(publicKey), profileId: createHash('sha256').update(publicKey).digest('hex'), capabilities: ['sign', 'signMessage', 'signerSession'], runtime: 'local' };
  }
  return {
    info,
    async connect() {
      const publicInfo = await info();
      for (const [key, until] of clients) if (until < now()) clients.delete(key);
      if (clients.size >= 256) throw Error('Game signer is busy.');
      const token = randomUUID(); clients.set(token, now() + 60 * 60 * 1000);
      return { ...publicInfo, token };
    },
    async request(token: string, raw: unknown) {
      if (!identity || (clients.get(token) ?? 0) <= now()) throw Error('Game signer session expired.');
      const row = raw as { id: string; network: string; profileId: string; method: string; args: unknown; sessionId?: string };
      const publicInfo = await info();
      if (!row || typeof row.id !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(row.id) || row.network !== config.network || row.profileId !== publicInfo.profileId) throw Error('Game signer scope mismatch.');
      const key = `${token}:${row.id}`, digest = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
      const prior = replies.get(key);
      if (prior) { if (prior.digest !== digest) throw Error('Game signer request changed.'); return prior.work; }
      // Never evict a possibly signed reply and permit a changed replay under that ID.
      if (replies.size >= 10000) throw Error('Game signer request capacity reached. Restart after resolving pending work.');
      const work = run(async () => {
        const args = decodeSigningValue(row.args);
        if (!Array.isArray(args)) throw Error('Invalid signer arguments.');
        let result: unknown;
        if (row.method === 'sign') {
          if (!args[0] || typeof args[0].toPSBT !== 'function') throw Error('Invalid signer transaction.');
          if (args[1] !== null && args[1] !== undefined && (!Array.isArray(args[1]) || args[1].some((index: unknown) => !Number.isSafeInteger(index) || Number(index) < 0 || Number(index) >= args[0].inputsLength))) throw Error('Invalid signing indexes.');
          const tx = args[0] as Transaction, transactionId = tx.id;
          const indexes: number[] = args[1] ?? Array.from({ length: tx.inputsLength }, (_, i) => i);
          const inputs = indexes.map(index => { const input = tx.getInput(index); if (!input.txid || input.index === undefined) throw Error('Signing input missing.'); return `${toHex(input.txid)}:${input.index}`; });
          if (inputs.some(input => signedInputs.has(input) && signedInputs.get(input) !== transactionId)) throw Error('Game input already signed for a different transaction.');
          // Retain even on uncertain signing failures. A timeout is not evidence of safety.
          for (const input of inputs) signedInputs.set(input, transactionId);
          result = await identity!.sign(tx, args[1] ?? undefined);
        } else if (row.method === 'signMessage') {
          if (!(args[0] instanceof Uint8Array) || !['schnorr', 'ecdsa'].includes(args[1])) throw Error('Invalid signer message.');
          result = await identity!.signMessage(args[0], args[1]);
        } else if (row.method === 'session.create') {
          for (const [key, session] of sessions) if (session.expires < now()) sessions.delete(key);
          if (sessions.size >= 128) throw Error('Game signer session capacity reached.');
          const sessionId = randomUUID(); sessions.set(sessionId, { scope: token, expires: now() + 10 * 60 * 1000, signer: identity!.signerSession(), signed: false, nonces: new Map() });
          result = sessionId;
        } else {
          const session = row.sessionId && sessions.get(row.sessionId);
          if (!session || session.scope !== token || session.expires <= now()) throw Error('Game signing session lost or expired.');
          if (row.method === 'session.getPublicKey') result = await session.signer.getPublicKey();
          else if (row.method === 'session.init') {
            if (session.init || !(args[0] instanceof TxTree) || !(args[1] instanceof Uint8Array) || typeof args[2] !== 'bigint') throw Error('Game signing transcript already set or invalid.');
            session.init = digest; await session.signer.init(args[0], args[1], args[2]);
          } else if (row.method === 'session.getNonces') {
            if (!session.init || session.signed) throw Error('Invalid signing phase.');
            result = await session.signer.getNonces();
          } else if (row.method === 'session.aggregatedNonces') {
            if (!session.init || session.signed || typeof args[0] !== 'string' || !(args[1] instanceof Map)) throw Error('Invalid signing phase.');
            const transcript = JSON.stringify(encodeSigningValue(args[1]));
            if (session.nonces.has(args[0]) && session.nonces.get(args[0]) !== transcript) throw Error('Signing nonces changed.');
            session.nonces.set(args[0], transcript); result = await session.signer.aggregatedNonces(args[0], args[1]);
          } else if (row.method === 'session.sign') {
            if (!session.init || session.signed) throw Error('Signing session already consumed.');
            session.signed = true; result = await session.signer.sign();
          } else throw Error('Unsupported signer method.');
        }
        return encodeSigningValue(result);
      });
      replies.set(key, { digest, work }); return work;
    },
    dispose() { clients.clear(); sessions.clear(); replies.clear(); signedInputs.clear(); identity = undefined; },
  };
}
