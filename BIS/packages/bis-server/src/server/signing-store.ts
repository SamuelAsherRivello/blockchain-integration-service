import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';

export type IssuedAssetAuthorization = { assetId: string; playerPublicKey: string };
export type SettlementBatchBinding = Readonly<{ reservationId: string; digest: string }>;
export type SigningClaim = { scope: string; id: string; digest: string; inputs: string[]; transactionId: string; operationId: string; exposureSats: number; dailyCapSats: number; operationCapSats: number; day: string; exposureId?: string; contractPolicy?: boolean; issuedAssets?: IssuedAssetAuthorization[]; settlementBatch?: SettlementBatchBinding };
export type SigningResultLookup = Readonly<{scope:string;id:string;digest:string}>;
export type SigningResultRead = Readonly<{status:'completed';result:unknown}|{status:'missing'|'unresolved'}>;
export type TreasureCheckpointClaim = Readonly<{
  parent: SigningClaim;
  parentResult: unknown;
  checkpoint: SigningClaim;
  checkpointOutpoint: Readonly<{txid:string;index:number}>;
  rootRequestDigest: string;
  rootClaimDay: string;
  checkpointFamilyDigest: string;
}>;
export interface SigningStore {
  /** Optional for legacy stores. Recovery callers must refuse work when absent.
   * Reads an existing result only; this never authorizes a new signature. */
  readCompleted?(input:SigningResultLookup):Promise<SigningResultRead>;
  /** Atomically claim the one exact V4 checkpoint belonging to a completed ROOT.
   * Legacy stores omit this capability and must fail closed for first-CP recovery. */
  claimTreasureCheckpoint?(input:TreasureCheckpointClaim):Promise<{status:'acquired';owner:string}|{status:'replay';result:unknown}>;
  claim(input: SigningClaim): Promise<{ status: 'acquired'; owner: string } | { status: 'replay'; result: unknown }>;
  complete(input: SigningClaim, owner: string, result: unknown): Promise<void>;
  session(input: SigningClaim, owner: string, id: string, encrypted?: string): Promise<string | null>;
  ping(): Promise<void>;
  assetAllowed(scope: string, assetId: string, playerPublicKey: string): Promise<boolean>;
  consumePublicRequest(scope: string, now: number, limits?: { perMinute: number; perDay: number }): Promise<void>;
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
/** Every read that authorizes a signature executes on Redis's primary via EVAL. */
const claimScript = `
local prior = redis.call('HGET', KEYS[1], 'request:' .. ARGV[1])
if prior then
  local row = cjson.decode(prior)
  if row.digest ~= ARGV[2] then return {'changed'} end
  if (row.batchReservation or '') ~= ARGV[13] or (row.batchDigest or '') ~= ARGV[14] then return {'changed-batch'} end
  if row.done then return {'replay', row.result} end
  return {'unresolved'}
end
if redis.call('HEXISTS', KEYS[1], 'lock') == 1 then return {'busy'} end
local count = tonumber(redis.call('HGET', KEYS[1], 'count') or '0')
if count >= 10000 then return {'capacity'} end
local inputs = cjson.decode(ARGV[4])
for _, input in ipairs(inputs) do
  local previous = redis.call('HGET', KEYS[1], 'input:' .. input)
  if previous and previous ~= ARGV[5] then return {'conflict'} end
end
local batchReservation = ARGV[13]
local batchDigest = ARGV[14]
if batchReservation ~= '' then
  local previous = redis.call('HGET', KEYS[1], 'batch:' .. batchReservation)
  if previous and previous ~= batchDigest then return {'batch-conflict'} end
end
local assets = cjson.decode(ARGV[12])
for _, asset in ipairs(assets) do
  local previous = redis.call('HGET', KEYS[1], 'asset:' .. asset.assetId)
  if previous and previous ~= asset.playerPublicKey then return {'asset-conflict'} end
end
local daily = tonumber(redis.call('HGET', KEYS[2], ARGV[6]) or '0')
local operation = tonumber(redis.call('HGET', KEYS[2], 'operation:' .. ARGV[9]) or '0')
local cost = tonumber(ARGV[7])
local exposureKey = ARGV[11]
if exposureKey ~= '' then
  local charged = redis.call('HGET', KEYS[2], exposureKey)
  if charged then
    if tonumber(charged) ~= cost then return {'changed-exposure'} end
    cost = 0
  end
end
if daily + cost > tonumber(ARGV[8]) or operation + cost > tonumber(ARGV[10]) then return {'budget'} end
redis.call('HSET', KEYS[2], ARGV[6], daily + cost, 'operation:' .. ARGV[9], operation + cost)
if exposureKey ~= '' then redis.call('HSET', KEYS[2], exposureKey, ARGV[7]) end
for _, input in ipairs(inputs) do redis.call('HSET', KEYS[1], 'input:' .. input, ARGV[5]) end
if batchReservation ~= '' then redis.call('HSET', KEYS[1], 'batch:' .. batchReservation, batchDigest) end
redis.call('HSET', KEYS[1], 'count', count + 1, 'lock', ARGV[3], 'request:' .. ARGV[1], cjson.encode({digest=ARGV[2],batchReservation=batchReservation,batchDigest=batchDigest}))
return {'acquired'}
`;
const treasureCheckpointClaimScript = `
local parentRaw = redis.call('HGET', KEYS[1], 'request:' .. ARGV[1])
if not parentRaw then return {'parent-missing'} end
local parentOk, parent = pcall(cjson.decode, parentRaw)
if not parentOk or type(parent) ~= 'table' or parent.digest ~= ARGV[2] or parent.done ~= true or parent.result ~= ARGV[3] or
  parent.batchReservation ~= '' or parent.batchDigest ~= '' then return {'parent-mismatch'} end
local parentFieldCount = 0
for field, _ in pairs(parent) do
  if field ~= 'digest' and field ~= 'done' and field ~= 'result' and field ~= 'batchReservation' and field ~= 'batchDigest' then return {'parent-mismatch'} end
  parentFieldCount = parentFieldCount + 1
end
if parentFieldCount ~= 5 then return {'parent-mismatch'} end

local parentInputs = cjson.decode(ARGV[4])
for _, input in ipairs(parentInputs) do
  if redis.call('HGET', KEYS[1], 'input:' .. input) ~= ARGV[5] then return {'parent-reservation'} end
end

local charged = redis.call('HGET', KEYS[2], ARGV[6])
if not charged or tonumber(charged) ~= tonumber(ARGV[7]) then return {'parent-exposure'} end
if tonumber(redis.call('HGET', KEYS[2], ARGV[8]) or '0') < tonumber(ARGV[7]) or
  tonumber(redis.call('HGET', KEYS[2], 'operation:' .. ARGV[9]) or '0') < tonumber(ARGV[7]) then return {'parent-budget'} end

local family = redis.call('HGET', KEYS[1], ARGV[10])
if family and family ~= ARGV[11] then return {'checkpoint-family'} end
local childRaw = redis.call('HGET', KEYS[1], 'request:' .. ARGV[12])
if childRaw and not family or not childRaw and family then return {'checkpoint-family'} end
local checkpointInputs = cjson.decode(ARGV[14])
for _, input in ipairs(checkpointInputs) do
  if redis.call('HGET', KEYS[1], 'input:' .. input) and redis.call('HGET', KEYS[1], 'input:' .. input) ~= ARGV[15] then return {'conflict'} end
end
if childRaw then
  local childOk, child = pcall(cjson.decode, childRaw)
  if not childOk or type(child) ~= 'table' or child.digest ~= ARGV[13] or (child.batchReservation or '') ~= '' or (child.batchDigest or '') ~= '' then return {'changed'} end
  local childFieldCount = 0
  for field, _ in pairs(child) do
    if field ~= 'digest' and field ~= 'done' and field ~= 'result' and field ~= 'batchReservation' and field ~= 'batchDigest' then return {'changed'} end
    childFieldCount = childFieldCount + 1
  end
  if child.done == true and type(child.result) == 'string' and childFieldCount == 5 then return {'replay', child.result} end
  if child.done == nil and child.result == nil and childFieldCount == 3 then return {'unresolved'} end
  return {'changed'}
end
if redis.call('HEXISTS', KEYS[1], 'lock') == 1 then return {'busy'} end
local count = tonumber(redis.call('HGET', KEYS[1], 'count') or '0')
if count >= 10000 then return {'capacity'} end

-- All parent, exposure, family, capacity, lock and input checks precede writes.
redis.call('HSET', KEYS[1], ARGV[10], ARGV[11])
for _, input in ipairs(checkpointInputs) do redis.call('HSET', KEYS[1], 'input:' .. input, ARGV[15]) end
redis.call('HSET', KEYS[1], 'count', count + 1, 'lock', ARGV[16],
  'request:' .. ARGV[12], cjson.encode({digest=ARGV[13],batchReservation='',batchDigest=''}))
return {'acquired'}
`;
const completeScript = `
if redis.call('HGET', KEYS[1], 'lock') ~= ARGV[1] then return 0 end
local prior = redis.call('HGET', KEYS[1], 'request:' .. ARGV[2])
if not prior or cjson.decode(prior).digest ~= ARGV[3] then return 0 end
local row = cjson.decode(prior)
if (row.batchReservation or '') ~= ARGV[6] or (row.batchDigest or '') ~= ARGV[7] then return 0 end
local assets = cjson.decode(ARGV[5])
for _, asset in ipairs(assets) do
  local previous = redis.call('HGET', KEYS[1], 'asset:' .. asset.assetId)
  if previous and previous ~= asset.playerPublicKey then return 0 end
end
redis.call('HSET', KEYS[1], 'request:' .. ARGV[2], cjson.encode({digest=ARGV[3],done=true,result=ARGV[4],batchReservation=ARGV[6],batchDigest=ARGV[7]}))
for _, asset in ipairs(assets) do redis.call('HSET', KEYS[1], 'asset:' .. asset.assetId, asset.playerPublicKey) end
redis.call('HDEL', KEYS[1], 'lock')
return 1
`;
const sessionScript = `
if redis.call('HGET', KEYS[1], 'lock') ~= ARGV[1] then return {0} end
if ARGV[2] == 'write' then redis.call('SET', KEYS[2], ARGV[3], 'PX', 600000) end
return {1, redis.call('GET', KEYS[2]) or ''}
`;

export function createRedisSigningStore(values: NodeJS.ProcessEnv): SigningStore {
  const url = values.UPSTASH_REDIS_REST_URL ?? values.KV_REST_API_URL;
  const token = values.UPSTASH_REDIS_REST_TOKEN ?? values.KV_REST_API_TOKEN;
  if (!url || !token || !url.startsWith('https://')) throw Error('Hosted signing storage is not configured.');
  const redis = new Redis({ url, token, automaticDeserialization: false, retry: false });
  // Explicit zero retries avoids an SDK transport retry of this read. Keep the
  // existing signing client's behavior and coordination paths unchanged.
  const resultReader = new Redis({url,token,automaticDeserialization:false,retry:{retries:0},enableAutoPipelining:false});
  const namespace = `bis:signer:v1:${values.VERCEL_ENV === 'production' ? 'production' : 'preview'}`;
  const keys = (input: SigningClaim) => [`${namespace}:${digest(input.scope)}`, `${namespace}:budgets:${input.scope.split(':').slice(0, 2).join(':')}`];
  return {
    async readCompleted(input) {
      const lookup=validateResultLookup(input);
      try {
        // EVAL goes to the primary. HGET is the only command: no claim,
        // reservation, budget, expiry or quarantine state may change here.
        const encoded=await resultReader.eval<unknown[],unknown>("return redis.call('HGET', KEYS[1], ARGV[1])",
          [`${namespace}:${digest(lookup.scope)}`],[`request:${lookup.id}`]);
        if(encoded===null)return {status:'missing'};
        if(typeof encoded!=='string')throw Error();
        const row:unknown=JSON.parse(encoded);
        if(!row||typeof row!=='object'||Array.isArray(row)||
          Object.keys(row).some(key=>!['digest','done','result','batchReservation','batchDigest'].includes(key)))throw Error();
        const saved=row as Record<string,unknown>;
        if(saved.digest!==lookup.digest)throw Error();
        const reservation=saved.batchReservation,batchDigest=saved.batchDigest;
        if((reservation===undefined)!==(batchDigest===undefined)||
          reservation!==undefined&&(typeof reservation!=='string'||typeof batchDigest!=='string'||
            !/^(?:[a-f0-9]{64})?$/.test(reservation)||!/^(?:[a-f0-9]{64})?$/.test(batchDigest)||
            (reservation==='')!==(batchDigest==='')))throw Error();
        if(saved.done!==true){
          if(saved.done!==undefined&&saved.done!==false||Object.hasOwn(saved,'result'))throw Error();
          return {status:'unresolved'};
        }
        if(typeof saved.result!=='string')throw Error();
        return {status:'completed',result:JSON.parse(saved.result)};
      }catch{throw Error('Hosted signing result could not be read. Reconcile before retrying.');}
    },
    async consumePublicRequest(scope, now, limits = { perMinute: 60, perDay: 600 }) {
      if (!/^[a-zA-Z0-9-]{1,100}:(signet|mutinynet)$/.test(scope) || !Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(limits.perMinute) || limits.perMinute < 1 || limits.perMinute > 60 || !Number.isSafeInteger(limits.perDay) || limits.perDay < 1 || limits.perDay > 600) throw Error('Invalid public request quota.');
      const day = new Date(now).toISOString().slice(0, 10), key = `${namespace}:publicquota:${digest(scope)}:${day}`;
      const accepted = await redis.eval<unknown[], number>(`
local day = tonumber(redis.call('HGET', KEYS[1], 'day') or '0')
local minute = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
if day >= tonumber(ARGV[3]) or minute >= tonumber(ARGV[2]) then return 0 end
redis.call('HSET', KEYS[1], 'day', day + 1, ARGV[1], minute + 1)
redis.call('EXPIRE', KEYS[1], 172800)
return 1`, [key], [String(Math.floor(now / 60000)), limits.perMinute, limits.perDay]);
      if (accepted !== 1) throw Error('Public signing request limit exceeded.');
    },
    async ping() { if (await redis.ping() !== 'PONG') throw Error('Signing storage unavailable.'); },
    async assetAllowed(scope, assetId, playerPublicKey) {
      if (typeof scope !== 'string' || scope.length > 300 || !/^[a-f0-9]{68}$/.test(assetId) || !/^0[23][a-f0-9]{64}$/.test(playerPublicKey)) throw Error('Invalid asset authorization scope.');
      return await redis.eval<unknown[], number>("if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then return 1 end return 0", [`${namespace}:${digest(scope)}`], ['asset:' + assetId, playerPublicKey]) === 1;
    },
    async claim(input) {
      validateClaim(input);
      const owner = randomUUID();
      // Only server-validated linked transactions may share exposureId. Scope
      // and operation prevent an unrelated wallet or workflow reusing its cap.
      const exposureKey = input.exposureId ? `exposure:${digest(JSON.stringify([input.scope, input.operationId, input.exposureId]))}` : '';
      const response = await redis.eval<unknown[], string[]>(claimScript, keys(input), [input.id, input.digest, owner, JSON.stringify(input.inputs), input.transactionId, input.day, input.exposureSats, input.dailyCapSats, input.operationId, input.operationCapSats, exposureKey, JSON.stringify(input.issuedAssets ?? []), input.settlementBatch?.reservationId ?? '', input.settlementBatch?.digest ?? '']);
      if (response[0] === 'replay') return { status: 'replay', result: JSON.parse(response[1]) };
      if (response[0] !== 'acquired') throw Error(`Hosted signing refused: ${response[0]}.`);
      return { status: 'acquired', owner };
    },
    async claimTreasureCheckpoint(input) {
      validateTreasureCheckpointClaim(input);
      const owner = randomUUID(), parent = input.parent, checkpoint = input.checkpoint;
      const exposureKey = `exposure:${digest(JSON.stringify([parent.scope, parent.operationId, parent.exposureId]))}`;
      const familyField = `treasure-checkpoint:${parent.transactionId}:${input.checkpointOutpoint.txid}:${input.checkpointOutpoint.index}`;
      const familyRecord = JSON.stringify({parentId:parent.id,parentDigest:parent.digest,rootTransactionId:parent.transactionId,
        checkpointOutpoint:input.checkpointOutpoint,checkpointId:checkpoint.id,checkpointDigest:checkpoint.digest,checkpointFamilyDigest:input.checkpointFamilyDigest});
      const parentResultJson = JSON.stringify(input.parentResult);
      const response = await redis.eval<unknown[], string[]>(treasureCheckpointClaimScript,
        [`${namespace}:${digest(parent.scope)}`, `${namespace}:budgets:${parent.scope.split(':').slice(0, 2).join(':')}`],
        [parent.id,parent.digest,parentResultJson,JSON.stringify(parent.inputs),parent.transactionId,exposureKey,String(parent.exposureSats),
          parent.day, parent.operationId,familyField,familyRecord,checkpoint.id,checkpoint.digest,JSON.stringify(checkpoint.inputs),
          checkpoint.transactionId,owner]);
      if (response[0] === 'replay') {
        if (typeof response[1] !== 'string') throw Error('Hosted signing refused: corrupt-checkpoint-replay.');
        try { return {status:'replay' as const,result:JSON.parse(response[1])}; }
        catch { throw Error('Hosted signing refused: corrupt-checkpoint-replay.'); }
      }
      if (response[0] !== 'acquired') throw Error(`Hosted signing refused: ${response[0]}.`);
      return {status:'acquired' as const,owner};
    },
    async complete(input, owner, result) {
      if (await redis.eval<unknown[], number>(completeScript, [keys(input)[0]], [owner, input.id, input.digest, JSON.stringify(result), JSON.stringify(input.issuedAssets ?? []), input.settlementBatch?.reservationId ?? '', input.settlementBatch?.digest ?? '']) !== 1) throw Error('Hosted signing result could not be committed. Reconcile before retrying.');
    },
    async session(input, owner, id, encrypted) {
      if (!/^[a-f0-9-]{36}$/.test(id) || encrypted !== undefined && (typeof encrypted !== 'string' || encrypted.length > 2 * 1024 * 1024)) throw Error('Invalid signing session.');
      const key = keys(input)[0];
      const result = await redis.eval<unknown[], [number, string]>(sessionScript, [key, `${key}:session:${id}`], [owner, encrypted === undefined ? 'read' : 'write', encrypted ?? '']);
      if (result[0] !== 1) throw Error('Signing session claim lost.');
      return result[1] || null;
    },
  };
}
function validateResultLookup(input:SigningResultLookup){
  if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join(',')!=='digest,id,scope')throw Error('Invalid signing result lookup.');
  const {scope,id,digest}=input;
  if(typeof scope!=='string'||!/^[a-zA-Z0-9-]{1,100}:(signet|mutinynet):[a-f0-9]{64}$/.test(scope)||
    typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id)||
    typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))throw Error('Invalid signing result lookup.');
  return {scope,id,digest};
}
function validateClaim(input: SigningClaim) {
  if (![input.exposureSats, input.dailyCapSats, input.operationCapSats].every(value => Number.isSafeInteger(value) && value >= 0) || !/^[a-z0-9-]{1,100}$/i.test(input.id) || !/^[a-z0-9-]{1,100}$/i.test(input.operationId) || !/^[0-9a-f]{64}$/.test(input.digest)) throw Error('Invalid signing claim.');
  if (input.exposureId !== undefined && !/^[0-9a-f]{64}$/.test(input.exposureId)) throw Error('Invalid signing exposure group.');
  if (input.settlementBatch !== undefined && (!input.settlementBatch || typeof input.settlementBatch !== 'object' || Array.isArray(input.settlementBatch) ||
      !/^[0-9a-f]{64}$/.test(input.settlementBatch.reservationId) || !/^[0-9a-f]{64}$/.test(input.settlementBatch.digest) ||
      input.settlementBatch.reservationId !== input.transactionId || input.settlementBatch.reservationId !== input.exposureId)) throw Error('Invalid settlement batch binding.');
  if (input.issuedAssets !== undefined && (!Array.isArray(input.issuedAssets) || input.issuedAssets.length > 1 || input.issuedAssets.some(asset => !asset || !/^[a-f0-9]{68}$/.test(asset.assetId) || !/^0[23][a-f0-9]{64}$/.test(asset.playerPublicKey)))) throw Error('Invalid issued asset authorization.');
}
function validateTreasureCheckpointClaim(input: TreasureCheckpointClaim) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !== 'checkpoint,checkpointFamilyDigest,checkpointOutpoint,parent,parentResult,rootClaimDay,rootRequestDigest') throw Error('Invalid Treasure checkpoint claim.');
  const {parent,checkpoint}=input;
  validateClaim(parent); validateClaim(checkpoint);
  const claimFields='contractPolicy,dailyCapSats,day,digest,exposureId,exposureSats,id,inputs,operationCapSats,operationId,scope,transactionId';
  const dayIsCanonical=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(`${day}T00:00:00.000Z`))&&new Date(`${day}T00:00:00.000Z`).toISOString().slice(0,10)===day;
  if (Object.keys(parent).sort().join(',')!==claimFields||Object.keys(checkpoint).sort().join(',')!==claimFields||
      input.rootRequestDigest !== parent.digest || input.rootClaimDay!==parent.day || !/^[0-9a-f]{64}$/.test(input.checkpointFamilyDigest) ||
      parent.scope !== checkpoint.scope || parent.operationId !== checkpoint.operationId || parent.id === checkpoint.id ||
      !/^[a-zA-Z0-9-]{1,100}:mutinynet:[a-f0-9]{64}$/.test(parent.scope)||
      parent.contractPolicy!==true||checkpoint.contractPolicy!==true||
      !dayIsCanonical(parent.day)||!dayIsCanonical(checkpoint.day)||
      !/^[0-9a-f]{64}$/.test(parent.transactionId) || parent.transactionId !== parent.exposureId ||
      !input.checkpointOutpoint||typeof input.checkpointOutpoint!=='object'||Array.isArray(input.checkpointOutpoint)||
      Object.keys(input.checkpointOutpoint).sort().join(',')!=='index,txid'||! /^[0-9a-f]{64}$/.test(input.checkpointOutpoint.txid)||
      !parent.inputs.includes(`${input.checkpointOutpoint.txid}:${input.checkpointOutpoint.index}`)||
      !Number.isSafeInteger(input.checkpointOutpoint.index)||input.checkpointOutpoint.index<0||input.checkpointOutpoint.index>0xffffffff||
      checkpoint.transactionId !== parent.transactionId || checkpoint.exposureId !== parent.exposureId ||
      checkpoint.exposureSats !== parent.exposureSats || parent.settlementBatch !== undefined || checkpoint.settlementBatch !== undefined ||
      !Array.isArray(parent.inputs) || !Array.isArray(checkpoint.inputs) || !parent.inputs.length || !checkpoint.inputs.length ||
      new Set(parent.inputs).size !== parent.inputs.length || new Set(checkpoint.inputs).size !== checkpoint.inputs.length ||
      parent.inputs.some(value => typeof value !== 'string' || value.length < 1 || value.length > 200) ||
      checkpoint.inputs.some(value => typeof value !== 'string' || value.length < 1 || value.length > 200) ||
      parent.inputs.some(value => !checkpoint.inputs.includes(value))||
      !checkpoint.inputs.includes(`${input.checkpointOutpoint.txid}:${input.checkpointOutpoint.index}`)) throw Error('Invalid Treasure checkpoint claim.');
  const expected=JSON.stringify(input.parentResult);
  if (typeof expected !== 'string' || expected.length > 2 * 1024 * 1024) throw Error('Invalid Treasure checkpoint claim.');
}
export async function coordinatedSigning(store: SigningStore, claim: SigningClaim, sign: (owner: string) => Promise<unknown>) {
  validateClaim(claim);
  const acquired = await store.claim(claim);
  if (acquired.status === 'replay') return acquired.result;
  // No finally-unlock: a crash, lost response or failed persistence leaves the wallet
  // quarantined. Neither elapsed time nor another instance can release its claims.
  const result = await sign(acquired.owner);
  await store.complete(claim, acquired.owner, result);
  return result;
}
export async function coordinatedTreasureCheckpointSigning(store:SigningStore,input:TreasureCheckpointClaim,sign:(owner:string)=>Promise<unknown>){
  validateTreasureCheckpointClaim(input);
  if(!store.claimTreasureCheckpoint)throw Error('Hosted signing refused: checkpoint-recovery-unavailable.');
  const acquired=await store.claimTreasureCheckpoint(input);
  if(acquired.status==='replay')return acquired.result;
  // Preserve the same fail-closed quarantine behavior as ordinary coordinated
  // signing: an exception or lost commit leaves this exact CP unresolved.
  const result=await sign(acquired.owner);
  await store.complete(input.checkpoint,acquired.owner,result);
  return result;
}
