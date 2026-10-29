import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';

export type ArkadeSubmissionStage = 'submit' | 'finalize';
export type ArkadeSubmissionKey = Readonly<{ stage: ArkadeSubmissionStage; scope: string; operationId: string; transactionId: string; digest: string }>;
export type ArkadeSubmissionClaim = Readonly<{ status: 'acquired'; owner: string } | { status: 'pending' } | { status: 'replay'; result: unknown } | { status: 'conflict' }>;
export interface ArkadeSubmissionStore {
  claim(input: ArkadeSubmissionKey): Promise<ArkadeSubmissionClaim>;
  complete(input: ArkadeSubmissionKey, owner: string, result: unknown): Promise<boolean>;
  read(input: Omit<ArkadeSubmissionKey, 'digest' | 'stage'> & { stage: ArkadeSubmissionStage }): Promise<{ status: 'completed'; digest: string; result: unknown } | { status: 'missing' | 'pending' }>;
}

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const valid = (input: ArkadeSubmissionKey) => input && ['submit', 'finalize'].includes(input.stage) &&
  /^[a-zA-Z0-9-]{1,100}:(?:signet|mutinynet):[a-f0-9]{64}$/.test(input.scope) &&
  /^[a-z0-9-]{1,100}$/i.test(input.operationId) && /^[a-f0-9]{64}$/i.test(input.transactionId) && /^[a-f0-9]{64}$/.test(input.digest);

/** Durable submit journal. A pending row is deliberately never expired or retried:
 * after a lost upstream acknowledgement only authoritative reconciliation may clear it. */
export function createRedisArkadeSubmissionStore(values: NodeJS.ProcessEnv): ArkadeSubmissionStore {
  const url = values.UPSTASH_REDIS_REST_URL ?? values.KV_REST_API_URL;
  const token = values.UPSTASH_REDIS_REST_TOKEN ?? values.KV_REST_API_TOKEN;
  if (!url || !token || !url.startsWith('https://')) throw Error('Arkade submission storage is not configured.');
  const redis = new Redis({ url, token, automaticDeserialization: false, retry: false });
  const namespace = `bis:signer:v1:${values.VERCEL_ENV === 'production' ? 'production' : 'preview'}:arkade-submit`;
  const key = (input: Pick<ArkadeSubmissionKey, 'stage' | 'scope' | 'operationId' | 'transactionId'>) =>
    `${namespace}:${sha(JSON.stringify([input.stage, input.scope, input.operationId, input.transactionId]))}`;
  const readRow = async (input: Pick<ArkadeSubmissionKey, 'stage' | 'scope' | 'operationId' | 'transactionId'>) => {
    const raw = await redis.get<string>(key(input));
    if (raw === null) return undefined;
    if (typeof raw !== 'string' || raw.length > 3 * 1024 * 1024) throw Error('Arkade submission journal is invalid.');
    const row: unknown = JSON.parse(raw);
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error('Arkade submission journal is invalid.');
    const data = row as Record<string, unknown>;
    if (!['pending', 'completed'].includes(String(data.status)) || typeof data.digest !== 'string' || !/^[a-f0-9]{64}$/.test(data.digest) ||
      data.status === 'pending' && (typeof data.owner !== 'string' || !/^[a-f0-9-]{36}$/.test(data.owner) || Object.hasOwn(data, 'result')) ||
      data.status === 'completed' && (typeof data.result !== 'string' || Object.hasOwn(data, 'owner'))) throw Error('Arkade submission journal is invalid.');
    return data;
  };
  return {
    async claim(input) {
      if (!valid(input)) throw Error('Invalid Arkade submission journal key.');
      const recordKey = key(input), owner = randomUUID();
      const raw = await redis.eval<unknown[], unknown>(`
local raw = redis.call('GET', KEYS[1])
if raw then
  local ok, row = pcall(cjson.decode, raw)
  if not ok or type(row) ~= 'table' or row.digest ~= ARGV[1] then return {'conflict'} end
  if row.status == 'completed' then return {'replay', row.result} end
  if row.status == 'pending' then return {'pending'} end
  return {'conflict'}
end
redis.call('SET', KEYS[1], cjson.encode({status='pending',digest=ARGV[1],owner=ARGV[2]}))
return {'acquired', ARGV[2]}
`, [recordKey], [input.digest, owner]);
      if (!Array.isArray(raw) || typeof raw[0] !== 'string') throw Error('Arkade submission journal unavailable. Reconcile before retrying.');
      if (raw[0] === 'acquired' && raw[1] === owner) return { status: 'acquired', owner };
      if (raw[0] === 'pending') return { status: 'pending' };
      if (raw[0] === 'conflict') return { status: 'conflict' };
      if (raw[0] === 'replay' && typeof raw[1] === 'string') return { status: 'replay', result: JSON.parse(raw[1]) };
      throw Error('Arkade submission journal unavailable. Reconcile before retrying.');
    },
    async complete(input, owner, result) {
      if (!valid(input) || !/^[a-f0-9-]{36}$/.test(owner)) throw Error('Invalid Arkade submission journal completion.');
      const encoded = JSON.stringify(result);
      if (Buffer.byteLength(encoded) > 2 * 1024 * 1024) throw Error('Arkade submission result is too large.');
      return await redis.eval<unknown[], number>(`
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local ok, row = pcall(cjson.decode, raw)
if not ok or type(row) ~= 'table' or row.status ~= 'pending' or row.owner ~= ARGV[1] or row.digest ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[1], cjson.encode({status='completed',digest=ARGV[2],result=ARGV[3]}))
return 1
`, [key(input)], [owner, input.digest, encoded]) === 1;
    },
    async read(input) {
      const row = await readRow(input);
      if (!row) return { status: 'missing' };
      if (row.status === 'pending') return { status: 'pending' };
      return { status: 'completed', digest: row.digest as string, result: JSON.parse(row.result as string) };
    },
  };
}
