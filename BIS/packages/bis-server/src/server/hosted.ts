import { MAX_OPERATION_EXPOSURE_SATS, MAX_DAILY_EXPOSURE_SATS } from './signing-limits.ts';
import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { MnemonicIdentity, Transaction, Extension, RestArkProvider, RestIndexerProvider } from '@arkade-os/sdk';
import { schnorr } from '@noble/curves/secp256k1.js';
import { SIGNER_PROTOCOL, decodeSigningValue, encodeSigningValue, toHex } from '../../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { createWalletPool, type WalletRequirement } from './wallet-pool.ts';
import { readPrivateEnvironment, type GameNetwork } from './environment.ts';
import { proxySignetArkadeRead } from './arkade-read-proxy.ts';
import { finalizeSignetArkadeTransaction, preservesArkadeSignatures, sameArkadeSignatureMaterial, sameUnsignedArkadePsbtMetadata, submitSignetArkadeTransaction, validSignetArkadeFinalize, validSignetArkadeSubmit, verifySignetSubmissionAuthorizations } from './arkade-write-proxy.ts';
import { createRedisArkadeSubmissionStore, type ArkadeSubmissionStore } from './arkade-submission-store.ts';
import { createSigningAuthorization, signingDigest } from './signing-authorization.ts';
import { coordinatedSigning, coordinatedTreasureCheckpointSigning, createRedisSigningStore, type SigningStore, type SigningClaim, type TreasureCheckpointClaim } from './signing-store.ts';
import { executeHostedSigning } from './hosted-session.ts';
import { createPlayerAuthorization } from './player-authorization.ts';
import { createPaymentAuthorization } from './payment-authorization.ts';
import { readPaymentContext } from './payment-context.ts';
import { validateOffchainPayment } from './offchain-policy.ts';
import { assetBurnCandidates, validateAssetBurn, validateAssetIssuance, validateAssetDelivery } from './asset-policy.ts';
import { validateOwnerOffchain } from './owner-offchain-policy.ts';
import { readMarketplacePaymentReceipt } from './marketplace-payment-receipt.ts';
import { parseGameContractIntent, validateGameContractTransaction } from './contract-policy.ts';
import type {TreasureSigningPolicy} from './treasure-contract-policy.ts';
import { createSettlementAuthorization } from './settlement-authorization.ts';
import { readSettlementContext } from './settlement-context.ts';
import { readSettlementBatchInfo } from './settlement-batch-info.ts';
import { createTreasureActorPlanAuthorization,type TreasureActorBinding } from './treasure-actor-plan.ts';
import { deriveTreasureGameActorAuthorization,parseTreasureActorAuthorizationRequest,type AuthenticatedTreasureActorScope,type TreasureActorAuthorizationReader } from './treasure-actor-authorization.ts';

const maxBody = 1024 * 1024;
async function jsonBody(request: Request): Promise<Record<string, any>> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw Error('JSON required.');
  if (Number(request.headers.get('content-length') ?? 0) > maxBody) throw Error('Request too large.');
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > maxBody) { await reader.cancel(); throw Error('Request too large.'); } chunks.push(item.value); } }
  finally { reader.releaseLock(); }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Invalid JSON object.');
  return body;
}
const networkOf = (network: unknown): GameNetwork => { if (network !== 'signet' && network !== 'mutinynet') throw Error('Test network required.'); return network; };
/** Parse a fail-closed allowlist of supported test networks. */
const signingNetworks = (configured: string | undefined) => {
  if (!configured) return [];
  const networks = configured.split(',').map(value => value.trim());
  return networks.length > 0 && networks.every(value => value === 'signet' || value === 'mutinynet') ? networks : [];
};
/** Public signer opt-in is scoped to an explicit test-network allowlist. */
const publicSigningAllowed = (values: NodeJS.ProcessEnv, network: GameNetwork) => {
  return values.BIS_PUBLIC_PAYMENT_SIGNING === 'true' && signingNetworks(values.BIS_PUBLIC_SIGNING_NETWORKS).includes(network);
};
/** Owner signing defaults to the deployment's public network boundary. */
const ownerSigningAllowed = (values: NodeJS.ProcessEnv, network: GameNetwork) => {
  return signingNetworks(values.BIS_OWNER_SIGNING_NETWORKS ?? values.BIS_PUBLIC_SIGNING_NETWORKS).includes(network);
};
const assertOwnerSigningAllowed = (values: NodeJS.ProcessEnv, network: GameNetwork) => {
  if (!ownerSigningAllowed(values, network)) throw Error('Owner signing authorization required.');
};
const cap = (value: string | undefined, max: number) => { const number = Number(value ?? 0); if (!Number.isSafeInteger(number) || number < 0 || number > max) throw Error('Signing budget configuration invalid.'); return number; };
const exactObject=(value:unknown,keys:readonly string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(value))&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const actorTime=(branch:'reject'|'cancel'|'refund',deadline:number,now:number)=>{
  if(!Number.isSafeInteger(now)||(branch==='refund'?now<deadline:now>=deadline))throw Error('Treasure Game actor authorization is outside the signing policy.');
};
function actorBody(value:unknown,planned:boolean){
  const keys=['id','operationId','network','profileId','method','args','treasureActorProof','connectionToken',...(planned?['treasureActorPlan']:[])];
  if(!exactObject(value,keys))throw Error('Treasure Game actor authorization is outside the signing policy.');
  const body=value as Record<string,any>;
  if(typeof body.id!=='string'||!/^[a-z0-9-]{1,100}$/i.test(body.id)||typeof body.operationId!=='string'||
    !/^[a-z0-9-]{1,100}$/i.test(body.operationId)||body.network!=='mutinynet'||typeof body.profileId!=='string'||
    !/^[a-f0-9]{64}$/.test(body.profileId)||body.method!=='signMessage'||typeof body.connectionToken!=='string'||
    body.connectionToken.length>4096||!Array.isArray(body.args)||body.args.length!==2||
    !exactObject(body.args[0],['$type','value'])||body.args[0].$type!=='bytes'||typeof body.args[0].value!=='string'||
    !/^[a-f0-9]{64}$/.test(body.args[0].value)||body.args[1]!=='schnorr'||
    planned&& (typeof body.treasureActorPlan!=='string'||body.treasureActorPlan.length>8192))throw Error('Treasure Game actor authorization is outside the signing policy.');
  const proof=parseTreasureActorAuthorizationRequest(body.treasureActorProof);
  if(proof.operationId!==body.operationId)throw Error('Treasure Game actor authorization is outside the signing policy.');
  return {id:body.id,operationId:body.operationId,network:body.network,profileId:body.profileId,method:body.method,args:body.args,
    treasureActorProof:proof,connectionToken:body.connectionToken,...(planned?{treasureActorPlan:body.treasureActorPlan}:{})};
}
const actorRequestDigest=(body:ReturnType<typeof actorBody>)=>signingDigest({id:body.id,operationId:body.operationId,network:body.network,
  profileId:body.profileId,method:body.method,args:body.args,treasureActorProof:body.treasureActorProof,connectionToken:body.connectionToken});
function actorMessage(body:ReturnType<typeof actorBody>){
  const args=decodeSigningValue(body.args);
  if(!Array.isArray(args)||args.length!==2||!(args[0] instanceof Uint8Array)||args[0].length!==32||args[1]!=='schnorr')throw Error('Treasure Game actor authorization is outside the signing policy.');
  return args[0];
}
function verifyActorResult(result:unknown,message:Uint8Array,publicKey:string){
  if(!exactObject(result,['$type','value'])||(result as Record<string,unknown>).$type!=='bytes')throw Error('Treasure Game actor authorization is outside the signing policy.');
  const signature=decodeSigningValue(result);
  if(!(signature instanceof Uint8Array)||signature.length!==64||!schnorr.verify(signature,message,Buffer.from(publicKey.slice(2),'hex')))
    throw Error('Treasure Game actor authorization is outside the signing policy.');
}

/** Hosted transport is separate from loopback development authority. Public signing
 * stays closed until the public workflow policies pass acceptance. Owner grants
 * bind the exact request, identity, network and operation; no wallet secret is a token.
 */
export function createHostedHandler(options: { env?: NodeJS.ProcessEnv; store?: SigningStore; submissionStore?: ArkadeSubmissionStore; pool?: ReturnType<typeof createWalletPool>; now?: () => number; arkadeFetch?: typeof fetch; paymentContext?: typeof readPaymentContext; settlementContext?: typeof readSettlementContext; settlementBatchInfo?: typeof readSettlementBatchInfo; marketplaceReceipt?: typeof readMarketplacePaymentReceipt; actorAuthorizationReader?:(scope:AuthenticatedTreasureActorScope)=>TreasureActorAuthorizationReader } = {}) {
  const values = options.env ?? readPrivateEnvironment({ hosted: true });
  const gameId = values.BIS_GAME_ID ?? 'stealth-and-steel';
  const now = options.now ?? Date.now, pool = options.pool ?? createWalletPool(values);
  const authorization = createSigningAuthorization(values.BIS_OWNER_TOKEN, now, values.BIS_OWNER_ACCESS_TOKEN);
  const players = createPlayerAuthorization(values.BIS_OWNER_TOKEN, now);
  const payments = createPaymentAuthorization(values.BIS_OWNER_TOKEN, now);
  const ownerPlans = createPaymentAuthorization(values.BIS_OWNER_TOKEN, now, 'owner');
  const settlements = createSettlementAuthorization(values.BIS_OWNER_TOKEN, now);
  const ownerSettlements = createSettlementAuthorization(values.BIS_OWNER_TOKEN, now, 'owner');
  const actorPlans=createTreasureActorPlanAuthorization(values.BIS_OWNER_TOKEN,now);
  const completeCheckpoint = async (authority:ReturnType<typeof createPaymentAuthorization>,raw:Record<string,any>,binding:{audience:string;gameId:string;network:GameNetwork;profileId:string;operationId:string;connectionId:string},connection:{id:string;expires:number})=>{
    const planToken=raw.ownerPlan??raw.paymentPlan;
    const reference=authority.checkpointReference(planToken,raw,binding);
    const scope=`${gameId}:mutinynet:${raw.profileId}`;
    const prior=await store().readCompleted?.({scope,id:reference.rootRequestId,digest:reference.rootRequestDigest});
    if(!prior||prior.status!=='completed')throw Error('Treasure checkpoint result unavailable; reconcile before retrying.');
    const verified=authority.checkpointCompletion(planToken,raw,binding,prior.result);
    if(verified.rootRequestId!==reference.rootRequestId||verified.rootRequestDigest!==reference.rootRequestDigest||verified.rootClaimDay!==reference.rootClaimDay)
      throw Error('Treasure recovery authorization: ROOT binding changed.');
    const operationCapSats=cap(values.BIS_SIGNING_OPERATION_CAP_SATS,MAX_OPERATION_EXPOSURE_SATS),
      dailyCapSats=cap(values.BIS_SIGNING_DAILY_CAP_SATS,MAX_DAILY_EXPOSURE_SATS);
    const claimBase={scope,id:raw.id,digest:signingDigest(raw),inputs:[...verified.checkpointInputs],transactionId:verified.rootTransactionId,
      operationId:verified.operationId,exposureSats:verified.exposureSats,
      dailyCapSats,operationCapSats,day:new Date(now()).toISOString().slice(0,10),exposureId:verified.rootTransactionId,contractPolicy:true};
    if(claimBase.exposureSats<0||claimBase.operationId!==raw.operationId||claimBase.exposureSats>operationCapSats)throw Error('Treasure recovery authorization: invalid exposure.');
    const parent:SigningClaim={...claimBase,id:verified.rootRequestId,digest:verified.rootRequestDigest,inputs:[...verified.rootInputs],day:verified.rootClaimDay};
    const checkpoint:SigningClaim={...claimBase};
    const checkpointOutpoint=verified.checkpointOutpoint;
    const checkpointFamilyDigest=signingDigest({domain:'bis-treasure-v4-checkpoint-family-v1',rootRequestId:verified.rootRequestId,
      txid:checkpointOutpoint.txid,index:checkpointOutpoint.index,checkpointDigest:checkpoint.digest});
    const storeClaim:TreasureCheckpointClaim={parent,parentResult:verified.parentResult,checkpoint,checkpointOutpoint,
      rootRequestDigest:verified.rootRequestDigest,rootClaimDay:verified.rootClaimDay,checkpointFamilyDigest};
    const wallet=await pool.original('mutinynet',raw.profileId);
    return coordinatedTreasureCheckpointSigning(store(),storeClaim,async owner=>authority.verifyCheckpointResult(planToken,raw,binding,
      await executeHostedSigning({identity:MnemonicIdentity.fromMnemonic(wallet.mnemonic,{isMainnet:false}),secret:values.BIS_OWNER_TOKEN!,
        connectionId:connection.id,connectionExpires:connection.expires,now:now(),store:store(),claim:checkpoint,owner,
        method:raw.method,args:decodeSigningValue(raw.args)})));
  };
  let shared = options.store;
  const store = () => shared ??= createRedisSigningStore(values);
  let sharedSubmissions = options.submissionStore;
  const submissions = () => sharedSubmissions ??= createRedisArkadeSubmissionStore(values);
  const origins = new Set((values.BIS_ALLOWED_ORIGINS ?? 'https://samuelasherrivello.github.io').split(',').map(value => value.trim()).filter(Boolean));
  const reply = (request: Request, status: number, body: unknown) => {
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' });
    const origin = request.headers.get('origin');
    if (origin && origins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
  };
  const actorAccess=async(request:Request,body:ReturnType<typeof actorBody>,authority:'public'|'owner',playerPublicKey:string)=>{
    const network=networkOf(body.network),wallet=await pool.original(network,body.profileId);
    if(wallet.network!==network||network!=='mutinynet')throw Error('Treasure Game actor authorization is outside the signing policy.');
    const connection=authorization.connection(body.connectionToken,{gameId,network,profileId:body.profileId});
    const scope:AuthenticatedTreasureActorScope={network:'mutinynet',gamePublicKey:wallet.publicKey,playerPublicKey,operationId:body.operationId};
    const binding:TreasureActorBinding={audience:new URL(request.url).origin,gameId,network:'mutinynet',profileId:body.profileId,
      operationId:body.operationId,connectionId:connection.id,playerPublicKey,authority};
    const reader=options.actorAuthorizationReader?.(scope)??(()=>{
      const operator='https://mutinynet.arkade.sh',ark=new RestArkProvider(operator),indexer=new RestIndexerProvider(operator);
      return {authenticatedScope:async()=>scope,info:()=>ark.getInfo(),
        coins:(outpoints:readonly {txid:string;vout:number}[])=>indexer.getVtxos({outpoints:[...outpoints],spendableOnly:true}),
        transactions:(ids:readonly string[])=>indexer.getVirtualTxs([...ids]),now};
    })();
    return {network,wallet,connection,binding,reader};
  };
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url), path = url.pathname.replace(/\/$/, '');
    const origin = request.headers.get('origin');
    if (origin && !origins.has(origin)) return reply(request, 403, { error: 'Origin is not allowed.' });
    if (request.method === 'OPTIONS') {
      const response = reply(request, 204, null);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-BIS-Signing-Grant');
      return response;
    }
    if (values.BIS_SERVER_ENABLED === 'false') return reply(request, 404, { error: 'Game signer disabled.' });
    if (path === '/api/bis/arkade/signet/v1/tx/submit' || path === '/api/bis/arkade/signet/v1/tx/finalize') {
      if (request.method !== 'POST') return reply(request, 405, { error: 'Arkade writes require POST.' });
      let authorizationVerified=false;
      try {
        const raw = await jsonBody(request), finalize = path.endsWith('/finalize');
        const keys = finalize ? ['arkTxid', 'finalCheckpointTxs', 'authorizations', 'operationId', 'signedArkTx', 'checkpointTxs'] :
          ['signedArkTx', 'checkpointTxs', 'authorizations', 'operationId'];
        if (!exactObject(raw, keys) || typeof raw.operationId !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(raw.operationId) ||
          !Array.isArray(raw.authorizations) || raw.authorizations.length < 1 || raw.authorizations.length > 33) throw Error('Arkade submission authorization is invalid.');
        const submitted = { signedArkTx: raw.signedArkTx, checkpointTxs: finalize ? raw.finalCheckpointTxs : raw.checkpointTxs };
        if (!validSignetArkadeSubmit(submitted)) throw Error('Arkade submission authorization is invalid.');
        if (finalize && (!validSignetArkadeSubmit({ signedArkTx: raw.signedArkTx, checkpointTxs: raw.checkpointTxs }) ||
          !validSignetArkadeFinalize({ arkTxid: raw.arkTxid, finalCheckpointTxs: raw.finalCheckpointTxs }) ||
          raw.checkpointTxs.length !== raw.finalCheckpointTxs.length)) throw Error('Arkade finalization authorization is invalid.');
        const operationId = raw.operationId as string;
        const verified = await verifySignetSubmissionAuthorizations({
          gameId, operationId, authorizations: raw.authorizations, signedArkTx: raw.signedArkTx, checkpointTxs: submitted.checkpointTxs,
          store: store(), verifyConnection: (token, profileId) => {
            authorization.connection(token, { gameId, network: 'signet', profileId }); return true;
          },
        });
        authorizationVerified=true;
        const scope = `${gameId}:signet:${verified.profileId}`;
        await store().consumePublicRequest(`${gameId}:signet`, now(), { perMinute: 30, perDay: 300 });
        const submissionStore = submissions();
        if (finalize) {
          const rootPrior = await submissionStore.read({ stage: 'submit', scope, operationId, transactionId: verified.transactionId });
          if (raw.arkTxid !== verified.transactionId || rootPrior.status !== 'completed' || !rootPrior.result || typeof rootPrior.result !== 'object' ||
            (rootPrior.result as Record<string, unknown>).arkTxid !== raw.arkTxid) throw Error('Original Arkade submit receipt is unavailable. Reconcile before finalization.');
          const prior = rootPrior.result as Record<string, unknown>;
          if (typeof prior.finalArkTx!=='string'||
            !sameUnsignedArkadePsbtMetadata(Transaction.fromPSBT(Buffer.from(prior.finalArkTx,'base64')),Transaction.fromPSBT(Buffer.from(raw.signedArkTx as string,'base64')))||
            !sameArkadeSignatureMaterial(Transaction.fromPSBT(Buffer.from(prior.finalArkTx,'base64')),Transaction.fromPSBT(Buffer.from(raw.signedArkTx as string,'base64')))||
            !Array.isArray(prior.signedCheckpointTxs) || prior.signedCheckpointTxs.length !== (raw.finalCheckpointTxs as unknown[]).length ||
            (prior.signedCheckpointTxs as string[]).some((value, index) => {
              const priorTx=Transaction.fromPSBT(Buffer.from(value,'base64')),
                submittedTx=Transaction.fromPSBT(Buffer.from((raw.checkpointTxs as string[])[index],'base64')),
                finalTx=Transaction.fromPSBT(Buffer.from((raw.finalCheckpointTxs as string[])[index],'base64'));
              return !sameUnsignedArkadePsbtMetadata(priorTx,submittedTx)||!sameArkadeSignatureMaterial(priorTx,submittedTx)||
                !sameUnsignedArkadePsbtMetadata(priorTx,finalTx)||!preservesArkadeSignatures(priorTx,finalTx);
            }))
            throw Error('Arkade finalization differs from the original submit receipt.');
        }
        const stage = finalize ? 'finalize' : 'submit';
        const digest = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
        const key = { stage, scope, operationId, transactionId: verified.transactionId, digest } as const;
        const claim = await submissionStore.claim(key);
        if (claim.status === 'conflict') return reply(request, 409, { error: 'Arkade submission request changed. Reconcile before retrying.' });
        if (claim.status === 'pending') return reply(request, 409, { error: 'Arkade submission outcome is unresolved. Reconcile before retrying.' });
        if (claim.status === 'replay') return finalize ? reply(request, 204, null) : reply(request, 200, claim.result);
        const result = finalize
          ? (await finalizeSignetArkadeTransaction({ arkTxid: raw.arkTxid as string, finalCheckpointTxs: raw.finalCheckpointTxs as string[] }, options.arkadeFetch), { finalized: true })
          : await submitSignetArkadeTransaction({ signedArkTx: raw.signedArkTx as string, checkpointTxs: raw.checkpointTxs as string[] }, options.arkadeFetch);
        if (!await submissionStore.complete(key, claim.owner, result)) return reply(request, 503, { error: 'Arkade submission receipt persistence is unresolved. Reconcile before retrying.' });
        return finalize ? reply(request, 204, null) : reply(request, 200, result);
      } catch {
        return authorizationVerified
          ? reply(request, 503, { error: 'Arkade submission or its durable journal is unresolved. Reconcile before retrying.' })
          : reply(request, 403, { error: 'Arkade transaction is not bound to a completed Signet authorization.' });
      }
    }
    if (path.startsWith('/api/bis/arkade/')) {
      const forwarded = request.headers.get('x-forwarded-for')?.trim() ?? '';
      const client = isIP(forwarded) ? forwarded : 'unknown';
      const quota = createHash('sha256').update(client).digest('hex').slice(0, 32);
      try { await store().consumePublicRequest(`${gameId}-${quota}:signet`, now(), { perMinute: 60, perDay: 600 }); }
      catch { return reply(request, 429, { error: 'Signet Arkade read request limit exceeded or unavailable.' }); }
      const proxied = await proxySignetArkadeRead(request, options.arkadeFetch);
      const headers = new Headers(proxied.headers);
      if (origin && origins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
      return new Response(proxied.body, { status: proxied.status, headers });
    }
    try {
      if (path === '/api/bis/health' && request.method === 'GET') {
        await store().ping();
        return reply(request, 200, { service: 'bis-server', protocol: SIGNER_PROTOCOL, runtime: 'vercel', storage: 'ready',
          publicSigning: publicSigningAllowed(values, 'signet') || publicSigningAllowed(values, 'mutinynet'), ownerSigning: authorization.configured,
          networks: { signet: (await pool.publicWallets('signet')).length, mutinynet: (await pool.publicWallets('mutinynet')).length } });
      }
      if (path === '/api/bis/identity' && request.method === 'GET') {
        const network = networkOf(url.searchParams.get('network') ?? 'signet');
        const wallet = await pool.select(network);
        const capabilities = publicSigningAllowed(values, network) ? ['sign', 'signMessage', 'signerSession'] : [];
        return reply(request, 200, { service: 'bis-server', protocol: SIGNER_PROTOCOL, gameId, network, publicKey: wallet.publicKey, profileId: wallet.profileId, slot: wallet.slot, capabilities, signingReady: capabilities.length > 0 });
      }
      if (request.method !== 'POST') return reply(request, 404, { error: 'Signer route not found.' });
      const body = await jsonBody(request);
      if(path==='/api/bis/treasure/checkpoint/complete'||path==='/api/bis/owner/treasure/checkpoint/complete'){
        const owner=path.startsWith('/api/bis/owner/'),recoveryError=()=>Error('Treasure recovery authorization is outside the checkpoint-completion policy.');
        if(owner){authorization.assertOwner(request.headers.get('authorization'));assertOwnerSigningAllowed(values,'mutinynet');}
        else if(!publicSigningAllowed(values,'mutinynet'))throw recoveryError();
        const wrapperKeys=owner?['version','requestId','requestDigest','requestJson','connectionToken']:
          ['version','requestId','requestDigest','requestJson','connectionToken','playerToken'];
        if(!exactObject(body,wrapperKeys)||body.version!==1||typeof body.requestId!=='string'||!/^[a-z0-9-]{1,100}$/i.test(body.requestId)||
          typeof body.requestDigest!=='string'||!/^[a-f0-9]{64}$/.test(body.requestDigest)||typeof body.requestJson!=='string'||body.requestJson.length>maxBody||
          typeof body.connectionToken!=='string'||body.connectionToken.length>4096||!owner&&(typeof body.playerToken!=='string'||body.playerToken.length>4096))throw recoveryError();
        let original:unknown;try{original=JSON.parse(body.requestJson);}catch{throw recoveryError();}
        if(!original||typeof original!=='object'||Array.isArray(original)||JSON.stringify(original)!==body.requestJson||
          (original as any).id!==body.requestId||signingDigest(original)!==body.requestDigest)throw recoveryError();
        const raw=original as Record<string,any>;
        if(raw.network!=='mutinynet'||typeof raw.profileId!=='string'||!/^[a-f0-9]{64}$/.test(raw.profileId)||
          raw.connectionToken!==body.connectionToken||raw.method!=='sign'||raw.sessionId!==undefined||
          (owner?typeof raw.ownerPlan!=='string'||raw.paymentPlan!==undefined:typeof raw.paymentPlan!=='string'||raw.ownerPlan!==undefined))throw recoveryError();
        const connection=authorization.connection(body.connectionToken,{gameId,network:'mutinynet',profileId:raw.profileId},{allowExpiredForCompletedRead:true});
        if(!owner&&request.headers.get('authorization')!==`Bearer ${body.connectionToken}`)throw recoveryError();
        const binding={audience:url.origin,gameId,network:'mutinynet' as const,profileId:raw.profileId,operationId:raw.operationId,connectionId:connection.id};
        const authority=owner?ownerPlans:payments,planToken=owner?raw.ownerPlan:raw.paymentPlan;
        const reference=authority.checkpointReference(planToken,raw,binding);
        if(!owner){
          const player=players.verify(body.playerToken,{audience:url.origin,gameId,network:'mutinynet',profileId:raw.profileId,operationId:raw.operationId});
          if(player.expires<now()+540000||player.playerPublicKey!==reference.playerPublicKey)throw recoveryError();
          await store().consumePublicRequest(`${gameId}:mutinynet`,now());
        }
        const result=await completeCheckpoint(authority,raw,binding,connection);
        return reply(request,200,{result});
      }
      if(path==='/api/bis/treasure/recover'){
        const recoveryError=()=>Error('Treasure recovery authorization is outside the read-only policy.');
        if(!exactObject(body,['version','requestId','requestDigest','requestJson','connectionToken'])||body.version!==1||
          typeof body.requestId!=='string'||!/^[a-z0-9-]{1,100}$/i.test(body.requestId)||
          typeof body.requestDigest!=='string'||!/^[a-f0-9]{64}$/.test(body.requestDigest)||
          typeof body.requestJson!=='string'||body.requestJson.length>maxBody||
          typeof body.connectionToken!=='string'||body.connectionToken.length>4096)throw recoveryError();
        let original:unknown;
        try{original=JSON.parse(body.requestJson);}catch{throw recoveryError();}
        if(!original||typeof original!=='object'||Array.isArray(original)||JSON.stringify(original)!==body.requestJson||
          (original as any).id!==body.requestId||signingDigest(original)!==body.requestDigest)throw recoveryError();
        const raw=original as Record<string,any>,network=networkOf(raw.network);
        if(typeof raw.profileId!=='string'||!/^[a-f0-9]{64}$/.test(raw.profileId)||
          raw.connectionToken!==undefined&&raw.connectionToken!==body.connectionToken)throw recoveryError();
        const connection=authorization.connection(body.connectionToken,{gameId,network,profileId:raw.profileId},{allowExpiredForCompletedRead:true});
        const bearer=request.headers.get('authorization'),scope=`${gameId}:${network}:${raw.profileId}`;
        let recovered:unknown;
        if(Object.hasOwn(raw,'treasureActorPlan')||Object.hasOwn(raw,'treasureActorProof')){
          const prepared=actorBody(raw,true),authority=actorPlans.authority(prepared.treasureActorPlan),playerPublicKey=actorPlans.playerKey(prepared.treasureActorPlan);
          if(prepared.connectionToken!==body.connectionToken||authority==='public'&&bearer!==`Bearer ${body.connectionToken}`||
            authority==='owner'&&(!bearer||bearer===`Bearer ${body.connectionToken}`))throw recoveryError();
          if(authority==='owner'){authorization.assertOwner(bearer);assertOwnerSigningAllowed(values,network);}
          else if(!publicSigningAllowed(values,network))throw recoveryError();
          const binding:TreasureActorBinding={audience:url.origin,gameId,network:'mutinynet',profileId:prepared.profileId,
            operationId:prepared.operationId,connectionId:connection.id,playerPublicKey,authority};
          const requestDigest=actorRequestDigest(prepared),accepted=actorPlans.recoverCompleted(prepared.treasureActorPlan,binding,requestDigest);
          const prior=await store().readCompleted?.({scope,id:prepared.id,digest:body.requestDigest});
          if(!prior||prior.status!=='completed')return reply(request,409,{error:'Signing result unavailable; reconcile before retrying.'});
          verifyActorResult(prior.result,Buffer.from(accepted.message,'hex'),accepted.gamePublicKey);
          recovered={result:prior.result};
        }else{
          const owner=Object.hasOwn(raw,'ownerPlan');
          if(owner===Object.hasOwn(raw,'paymentPlan')||raw.settlementPlan!==undefined||raw.ownerSettlementPlan!==undefined||
            typeof raw[owner?'ownerPlan':'paymentPlan']!=='string')throw recoveryError();
          if(owner){authorization.assertOwner(bearer);assertOwnerSigningAllowed(values,network);}
          else if(bearer!==`Bearer ${body.connectionToken}`)throw recoveryError();
          if(!owner&&!publicSigningAllowed(values,network))throw recoveryError();
          const binding={audience:url.origin,gameId,network,profileId:raw.profileId,operationId:raw.operationId,connectionId:connection.id};
          (owner?ownerPlans:payments).verifyReplay(raw[owner?'ownerPlan':'paymentPlan'],raw,binding);
          const prior=await store().readCompleted?.({scope,id:body.requestId,digest:body.requestDigest});
          if(!prior||prior.status!=='completed')return reply(request,409,{error:'Signing result unavailable; reconcile before retrying.'});
          recovered=(owner?ownerPlans:payments).recoverCompleted(raw[owner?'ownerPlan':'paymentPlan'],raw,binding,prior.result);
        }
        return reply(request,200,recovered);
      }
      if (/^\/api\/bis\/(?:owner\/)?settlement\/(?:plan|authorize|batch|session\/authorize|finalization\/authorize)$/.test(path)) {
        const owner = path.startsWith('/api/bis/owner/');
        if (owner) authorization.assertOwner(request.headers.get('authorization'));
        else if (values.BIS_PUBLIC_SETTLEMENT_SIGNING !== 'true') throw Error('Settlement authorization required.');
        const raw = body.request;
        if (!raw || typeof raw !== 'object' || raw.paymentPlan !== undefined || raw.ownerPlan !== undefined ||
            (owner ? raw.settlementPlan !== undefined : raw.ownerSettlementPlan !== undefined)) throw Error('Settlement authorization required.');
        const network = networkOf(raw.network);
        if (owner) assertOwnerSigningAllowed(values, network);
        if (!owner && !publicSigningAllowed(values, network)) throw Error('Settlement authorization required.');
        const wallet = await pool.original(network, raw.profileId);
        const connection = authorization.connection(owner ? body.connectionToken ?? raw.connectionToken : request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '', { gameId, network, profileId: raw.profileId });
        const binding = { audience: url.origin, gameId, network, profileId: raw.profileId, operationId: raw.operationId, connectionId: connection.id };
        if (!owner) {
          players.verify(body.playerToken, { audience: url.origin, gameId, network, profileId: raw.profileId, operationId: raw.operationId });
          await store().consumePublicRequest(`${gameId}:${network}`, now());
        }
        const authority = owner ? ownerSettlements : settlements, field = owner ? 'ownerSettlementPlan' : 'settlementPlan';
        if (path.endsWith('/finalization/authorize')) return reply(request, 200, { grant: authority.authorizeFinalization(raw[field], raw.settlementBatchPlan, raw, binding) });
        if (path.endsWith('/session/authorize')) return reply(request, 200, { grant: authority.authorizeSession(raw[field], raw.settlementBatchPlan, raw, binding) });
        if (path.endsWith('/authorize')) return reply(request, 200, { grant: authority.authorize(raw[field], raw, binding) });
        if (path.endsWith('/batch')) {
          if (raw.method !== 'session.init' || typeof body.batchExpiry !== 'string' || !/^[1-9][0-9]{0,7}$/.test(body.batchExpiry)) throw Error('Settlement authorization required.');
          const args = decodeSigningValue(raw.args), commitment = decodeSigningValue(body.commitment);
          if (!Array.isArray(args) || args.length !== 3 || !commitment || typeof commitment.toPSBT !== 'function') throw Error('Settlement authorization required.');
          // Fail expired/legacy plans before making provider requests.
          await authority.sessionIdentity(raw[field], binding);
          const info = await (options.settlementBatchInfo ?? readSettlementBatchInfo)(network, request.signal);
          if (info.network !== network || info.advertisedBatchExpiry !== undefined && String(info.advertisedBatchExpiry) !== body.batchExpiry) throw Error('Settlement authorization required.');
          const batchPlan = authority.batchPlan(raw[field], binding, { tree: args[0], commitment: Transaction.fromPSBT(commitment.toPSBT()), scriptRoot: args[1], sharedAmount: args[2] }, { ...info, batchExpiry: BigInt(body.batchExpiry) });
          return reply(request, 200, { settlementBatchPlan: batchPlan });
        }
        if (raw.method !== 'sign' || !Array.isArray(body.outpoints)) throw Error('Settlement authorization required.');
        const args = decodeSigningValue(raw.args);
        if (!Array.isArray(args) || !args[0] || typeof args[0].toPSBT !== 'function') throw Error('Settlement authorization required.');
        const context = await (options.settlementContext ?? readSettlementContext)({ network, gamePublicKey: wallet.publicKey, outpoints: body.outpoints,
          maximumExposureSats: cap(values.BIS_SIGNING_OPERATION_CAP_SATS, MAX_OPERATION_EXPOSURE_SATS), signal: request.signal });
        if (body.sessionKeyMode !== undefined) {
          if (body.sessionKeyMode !== 'operation-v1') throw Error('Settlement authorization required.');
          const prepared = await authority.operationPlan(binding, Transaction.fromPSBT(args[0].toPSBT()), context);
          return reply(request, 200, { [field]: prepared.plan, sessionPublicKey: prepared.sessionPublicKey });
        }
        return reply(request, 200, { [field]: authority.plan(binding, Transaction.fromPSBT(args[0].toPSBT()), context) });
      }
      if(path==='/api/bis/treasure/actor/plan'||path==='/api/bis/treasure/actor/authorize'||
        path==='/api/bis/owner/treasure/actor/plan'||path==='/api/bis/owner/treasure/actor/authorize'){
        const owner=path.startsWith('/api/bis/owner/'),authorizing=path.endsWith('/authorize');
        if(owner){authorization.assertOwner(request.headers.get('authorization'));assertOwnerSigningAllowed(values,'mutinynet');}
        else if(!publicSigningAllowed(values,'mutinynet'))throw Error('Player authorization required.');
        const wrapperKeys=owner?['request','connectionToken','contractPlayerPublicKey']:['request','playerToken'];
        if(!exactObject(body,wrapperKeys))throw Error('Treasure Game actor authorization is outside the signing policy.');
        const prepared=actorBody(body.request,authorizing),planToken=authorizing?prepared.treasureActorPlan:undefined;
        const bindingPlayer=owner?body.contractPlayerPublicKey:
          players.verify(body.playerToken,{audience:url.origin,gameId,network:'mutinynet',profileId:prepared.profileId,operationId:prepared.operationId}).playerPublicKey;
        const bearer=request.headers.get('authorization'),publicBearer=bearer?.startsWith('Bearer ')?bearer.slice(7):'';
        if(typeof bindingPlayer!=='string'||!/^0[23][a-f0-9]{64}$/.test(bindingPlayer)||
          owner&&(typeof body.connectionToken!=='string'||body.connectionToken!==prepared.connectionToken)||
          !owner&&(publicBearer!==prepared.connectionToken||bearer!==`Bearer ${prepared.connectionToken}`))throw Error('Treasure Game actor authorization is outside the signing policy.');
        const access=await actorAccess(request,prepared,owner?'owner':'public',bindingPlayer);
        if(!owner)await store().consumePublicRequest(`${gameId}:mutinynet`,now());
        const derived=await deriveTreasureGameActorAuthorization(prepared.treasureActorProof,access.reader),requestDigest=actorRequestDigest(prepared);
        if(!Buffer.from(actorMessage(prepared)).equals(Buffer.from(derived.message)))throw Error('Treasure Game actor authorization is outside the signing policy.');
        if(!authorizing)return reply(request,200,{treasureActorPlan:actorPlans.plan(access.binding,requestDigest,derived)});
        if(typeof planToken!=='string')throw Error('Treasure Game actor authorization is outside the signing policy.');
        return reply(request,200,{grant:actorPlans.authorize(planToken,access.binding,requestDigest,derived)});
      }
      if (path === '/api/bis/owner/plan' || path === '/api/bis/owner/authorize') {
        authorization.assertOwner(request.headers.get('authorization'));
        const raw = body.request;
        if (!raw || typeof raw !== 'object' || raw.paymentPlan !== undefined) throw Error('Payment authorization required.');
        const network = networkOf(raw.network);
        assertOwnerSigningAllowed(values, network);
        const wallet = await pool.original(network, raw.profileId);
        const connection = authorization.connection(body.connectionToken ?? raw.connectionToken, { gameId, network, profileId: raw.profileId });
        const binding = { audience: url.origin, gameId, network, profileId: raw.profileId, operationId: raw.operationId, connectionId: connection.id };
        if (path.endsWith('/authorize')) return reply(request, 200, { grant: ownerPlans.authorize(raw.ownerPlan, raw, binding, undefined) });
        if (raw.method !== 'sign' || !Array.isArray(body.outpoints)) throw Error('Payment authorization required.');
        const args = decodeSigningValue(raw.args);
        if (!Array.isArray(args) || !args[0] || typeof args[0].toPSBT !== 'function') throw Error('Payment authorization required.');
        // A privately authenticated owner can supply the original public Player
        // key for contract recovery. It is not a fabricated Player credential.
        const contract = body.contract === undefined ? undefined : parseGameContractIntent(body.contract);
        if (contract && (typeof body.contractPlayerPublicKey !== 'string' || !/^0[23][a-f0-9]{64}$/.test(body.contractPlayerPublicKey))) throw Error('Payment authorization required.');
        const context = await (options.paymentContext ?? readPaymentContext)({ network, gamePublicKey: wallet.publicKey, playerPublicKey: contract ? body.contractPlayerPublicKey : wallet.publicKey, outpoints: body.outpoints, maximumExposureSats: cap(values.BIS_SIGNING_OPERATION_CAP_SATS, MAX_OPERATION_EXPOSURE_SATS), signal: request.signal, allowAssets: true, contract });
        const transaction = Transaction.fromPSBT(args[0].toPSBT());
        const validated = contract ? validateGameContractTransaction(transaction, context, contract) : validateOwnerOffchain(transaction, context);
        return reply(request, 200, { ownerPlan: ownerPlans.plan(binding, undefined, validated,raw) });
      }
      if (path === '/api/bis/payment/plan' || path === '/api/bis/payment/authorize') {
        const raw = body.request;
        if (!raw || typeof raw !== 'object') throw Error('Payment authorization required.');
        const network = networkOf(raw.network);
        if (!publicSigningAllowed(values, network)) throw Error('Payment authorization required.');
        const wallet = await pool.original(network, raw.profileId);
        const connection = authorization.connection(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '', { gameId, network, profileId: raw.profileId });
        const binding = { audience: url.origin, gameId, network, profileId: raw.profileId, operationId: raw.operationId, connectionId: connection.id };
        const player = players.verify(body.playerToken, { audience: url.origin, gameId, network, profileId: raw.profileId, operationId: raw.operationId });
        await store().consumePublicRequest(`${gameId}:${network}`, now());
        if (path.endsWith('/plan')) {
          if (raw.method !== 'sign' || !Array.isArray(body.outpoints)) throw Error('Payment authorization required.');
          const args = decodeSigningValue(raw.args);
          if (!Array.isArray(args) || !args[0] || typeof args[0].toPSBT !== 'function') throw Error('Payment authorization required.');
          const tx = Transaction.fromPSBT(args[0].toPSBT());
          const contract = body.contract === undefined ? undefined : parseGameContractIntent(body.contract);
          const hasAssets = Array.from({ length: tx.outputsLength }, (_, index) => tx.getOutput(index).script).some(script => script && Extension.isExtension(script));
          if (hasAssets && !(contract&&'artifactVersion' in contract) && values.BIS_PUBLIC_ASSET_SIGNING !== 'true') throw Error('Payment authorization required.');
          if (contract && values.BIS_PUBLIC_CONTRACT_SIGNING !== 'true') throw Error('Payment authorization required.');
          const context = await (options.paymentContext ?? readPaymentContext)({ network, gamePublicKey: wallet.publicKey, playerPublicKey: player.playerPublicKey, outpoints: body.outpoints, maximumExposureSats: cap(values.BIS_SIGNING_OPERATION_CAP_SATS, MAX_OPERATION_EXPOSURE_SATS), signal: request.signal, allowAssets: hasAssets, contract });
          let validated: ReturnType<typeof validateOffchainPayment> & { issuedAssets?: string[]; assetPolicy?: boolean; receiptKeys?: string[]; contractPolicy?: boolean;treasurePolicy?:TreasureSigningPolicy };
          if (contract) validated = validateGameContractTransaction(tx, context, contract);
          else if (!hasAssets) validated = validateOffchainPayment(tx, context);
          else {
            const packet = Extension.fromTx(tx).getAssetPacket();
            if (!packet) throw Error('Payment authorization required.');
            if (packet.groups.some(group => group.isIssuance())) validated = validateAssetIssuance(tx, context);
            else if (tx.getOutput(0).script && Buffer.from(tx.getOutput(0).script!).equals(Buffer.from(context.changeScript))) {
              const candidates = assetBurnCandidates(tx, context), allowed = new Set<string>();
              for (const id of candidates) if (await store().assetAllowed(`${gameId}:${network}:${raw.profileId}`, id, player.playerPublicKey)) allowed.add(id);
              validated = validateAssetBurn(tx, context, allowed);
            }
            else {
              const targets = packet.groups.filter(group => group.outputs.some(output => output.vout === 0));
              if (targets.length > 1) throw Error('Payment authorization required.');
              const id = targets[0]?.assetId?.toString(), allowed = new Set<string>();
              if (id && await store().assetAllowed(`${gameId}:${network}:${raw.profileId}`, id, player.playerPublicKey)) allowed.add(id);
              let receiptKey: string | undefined;
              if (id && !allowed.has(id) && body.marketplacePayment !== undefined) {
                if (typeof body.marketplacePayment !== 'string' || !/^[a-f0-9]{64}$/.test(body.marketplacePayment)) throw Error('Payment authorization requires Marketplace evidence.');
                const receipt = await (options.marketplaceReceipt ?? readMarketplacePaymentReceipt)({ network, gamePublicKey: wallet.publicKey,
                  playerPublicKey: player.playerPublicKey, assetId: id, transactionId: body.marketplacePayment, signal: request.signal });
                if (receipt.assetId !== id || receipt.transactionId !== body.marketplacePayment || receipt.network !== network || receipt.gamePublicKey !== wallet.publicKey || receipt.playerPublicKey !== player.playerPublicKey || receipt.receiptKey !== `marketplace-payment:${body.marketplacePayment}:0`) throw Error('Payment authorization requires Marketplace evidence.');
                receiptKey = receipt.receiptKey;
                allowed.add(id);
              }
              validated = validateAssetDelivery(tx, context, allowed);
              if (receiptKey) validated.receiptKeys = [receiptKey];
            }
          }
          return reply(request, 200, { paymentPlan: payments.plan(binding, player.playerPublicKey, validated,raw) });
        }
        return reply(request, 200, { grant: payments.authorize(raw.paymentPlan, raw, binding, player.playerPublicKey) });
      }
      if (path === '/api/bis/player/challenge' || path === '/api/bis/player/authenticate') {
        if (body.gameId !== gameId) throw Error('Player authorization required.');
        const network = networkOf(body.network);
        await pool.original(network, body.profileId);
        const binding = { audience: url.origin, gameId, network, profileId: body.profileId, operationId: body.operationId };
        if (path.endsWith('/challenge')) return reply(request, 200, players.challenge({ ...binding, playerPublicKey: body.playerPublicKey }));
        return reply(request, 200, players.authenticate(body.challenge, body.signature, binding));
      }
      if (path === '/api/bis/proof') {
        const network = networkOf(body.network);
        // Deployment verification exposes a domain-separated Signet identity
        // proof only; it does not enable payment signing or Mutinynet signing.
        if (network !== 'signet') throw Error('Public proof authorization required.');
        const wallet = await pool.select(network);
        const id = randomUUID(), message = signingDigest(['bis-server-deployment-proof-v1', gameId, network, wallet.profileId, id, now()]);
        const claim: SigningClaim = { scope: `proof:${network}:${wallet.profileId}`, id, operationId: id, digest: message, inputs: [], transactionId: message, exposureSats: 0, dailyCapSats: 0, operationCapSats: 0, day: new Date(now()).toISOString().slice(0, 10) };
        const signature = await coordinatedSigning(store(), claim, async () => toHex(await MnemonicIdentity.fromMnemonic(wallet.mnemonic, { isMainnet: false }).signMessage(Buffer.from(message, 'hex'), 'schnorr')));
        return reply(request, 200, { network, profileId: wallet.profileId, publicKey: wallet.publicKey, message, signature });
      }
      if (path === '/api/bis/connect') {
        if (body.gameId !== gameId) throw Error('Game scope mismatch.');
        const network = networkOf(body.network), requirement: WalletRequirement = body.requirement ?? {};
        // A connection identifies a signer but cannot authorize signing. Public
        // callers still need a verified Player proof and an exact policy grant.
        // An explicitly supplied owner credential must never be ignored.
        const credential = request.headers.get('authorization');
        if (credential !== null || !publicSigningAllowed(values, network)) {
          authorization.assertOwner(credential);
          assertOwnerSigningAllowed(values, network);
        }
        else {
          if (!authorization.configured) throw Error('Private owner authorization required.');
          await store().consumePublicRequest(`${gameId}:${network}`, now());
        }
        if (body.profileId !== undefined && (typeof body.profileId !== 'string' || !/^[0-9a-f]{64}$/.test(body.profileId) || body.requirement !== undefined)) throw Error('Invalid original game wallet request.');
        const wallet = body.profileId !== undefined ? await pool.original(network, body.profileId)
          : await pool.select(network, requirement, AbortSignal.any([request.signal, AbortSignal.timeout(15000)]));
        const token = authorization.connect({ gameId, network, profileId: wallet.profileId });
        return reply(request, 200, { protocol: SIGNER_PROTOCOL, gameId, network, publicKey: wallet.publicKey, profileId: wallet.profileId, capabilities: ['sign', 'signMessage', 'signerSession'], runtime: 'vercel', token, slot: wallet.slot });
      }
      if (path === '/api/bis/authorize') {
        const raw = body.request;
        if (!raw || typeof raw !== 'object') throw Error('Signing request required.');
        const network = networkOf(raw.network);
        authorization.assertOwner(request.headers.get('authorization'));
        assertOwnerSigningAllowed(values, network);
        await pool.original(network, raw.profileId);
        const grant = authorization.issue(request.headers.get('authorization'), { gameId, network, profileId: raw.profileId, operationId: body.operationId, digest: signingDigest(raw) });
        return reply(request, 200, { grant });
      }
      if (path !== '/api/bis/sign') return reply(request, 404, { error: 'Signer route not found.' });
      const network = networkOf(body.network), digest = signingDigest(body);
      if(Object.hasOwn(body,'treasureActorPlan')||Object.hasOwn(body,'treasureActorProof')){
        const prepared=actorBody(body,true),message=actorMessage(prepared),authority=actorPlans.authority(prepared.treasureActorPlan);
        if(authority==='public'&&!publicSigningAllowed(values,'mutinynet'))throw Error('Player authorization required.');
        if(authority==='owner')assertOwnerSigningAllowed(values,'mutinynet');
        const bearer=request.headers.get('authorization');
        if(authority==='public'&&bearer!==`Bearer ${prepared.connectionToken}`||authority==='owner'&&bearer!==null)
          throw Error('Treasure Game actor authorization is outside the signing policy.');
        const playerPublicKey=actorPlans.playerKey(prepared.treasureActorPlan),access=await actorAccess(request,prepared,authority,playerPublicKey);
        const grant=request.headers.get('x-bis-signing-grant');if(!grant)throw Error('Treasure Game actor authorization is outside the signing policy.');
        const requestDigest=actorRequestDigest(prepared);
        const scope=`${gameId}:mutinynet:${prepared.profileId}`;
        const claimDigest=digest;
        const actorStore=store();
        if(!actorStore.readCompleted)throw Error('Treasure Game actor authorization is outside the signing policy.');
        const prior=await actorStore.readCompleted({scope,id:prepared.id,digest:claimDigest});
        if(prior.status==='unresolved')throw Error('Treasure Game actor signing is unresolved; reconcile before retrying.');
        if(prior.status==='completed'){
          const accepted=actorPlans.verifyReplay(prepared.treasureActorPlan,grant,access.binding,requestDigest);
          verifyActorResult(prior.result,Buffer.from(accepted.message,'hex'),accepted.gamePublicKey);
          return reply(request,200,{result:prior.result});
        }
        const derived=await deriveTreasureGameActorAuthorization(prepared.treasureActorProof,access.reader);
        const accepted=actorPlans.verify(prepared.treasureActorPlan,grant,access.binding,requestDigest,derived);
        if(!Buffer.from(message).equals(Buffer.from(derived.message)))throw Error('Treasure Game actor authorization is outside the signing policy.');
        actorTime(accepted.branch,accepted.deadlineMs,now());
        if(authority==='public')await actorStore.consumePublicRequest(`${gameId}:mutinynet`,now());
        const operationCapSats=cap(values.BIS_SIGNING_OPERATION_CAP_SATS,MAX_OPERATION_EXPOSURE_SATS),
          dailyCapSats=cap(values.BIS_SIGNING_DAILY_CAP_SATS,MAX_DAILY_EXPOSURE_SATS);
        // This is a constrained VM authorization, not a spend reservation. The
        // later ROOT claim must reserve the funded input using its final family ID.
        const claim:SigningClaim={scope,id:prepared.id,digest:claimDigest,inputs:[],
          transactionId:accepted.templateRootId,operationId:prepared.operationId,exposureSats:0,dailyCapSats,operationCapSats,day:new Date(now()).toISOString().slice(0,10)};
        actorTime(accepted.branch,accepted.deadlineMs,now());
        const result=await coordinatedSigning(actorStore,claim,async()=>{
          actorTime(accepted.branch,accepted.deadlineMs,now());
          const signature=await MnemonicIdentity.fromMnemonic(access.wallet.mnemonic,{isMainnet:false}).signMessage(message,'schnorr');
          verifyActorResult(encodeSigningValue(signature),message,accepted.gamePublicKey);
          actorTime(accepted.branch,accepted.deadlineMs,now());
          return encodeSigningValue(signature);
        });
        verifyActorResult(result,message,accepted.gamePublicKey);
        return reply(request,200,{result});
      }
      if (body.settlementPlan !== undefined || body.ownerSettlementPlan !== undefined) {
        const owner = body.ownerSettlementPlan !== undefined;
        if (body.paymentPlan !== undefined || body.ownerPlan !== undefined || owner && body.settlementPlan !== undefined) throw Error('Settlement authorization required.');
        if (owner) {
          authorization.assertOwner(request.headers.get('authorization'));
          assertOwnerSigningAllowed(values, network);
        }
        else if (!publicSigningAllowed(values, network) || values.BIS_PUBLIC_SETTLEMENT_SIGNING !== 'true') throw Error('Settlement authorization required.');
        const connection = authorization.connection(owner ? body.connectionToken : request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '', { gameId, network, profileId: body.profileId });
        const binding = { audience: url.origin, gameId, network, profileId: body.profileId, operationId: body.operationId, connectionId: connection.id };
        const authority = owner ? ownerSettlements : settlements, planToken = owner ? body.ownerSettlementPlan : body.settlementPlan;
        const session = typeof body.method === 'string' && body.method.startsWith('session.');
        const approved = body.settlementFinalization === true ? authority.verifyFinalization(request.headers.get('x-bis-signing-grant') ?? '', planToken, body.settlementBatchPlan, body, binding)
          : session ? authority.verifySession(request.headers.get('x-bis-signing-grant') ?? '', planToken, body.settlementBatchPlan, body, binding)
          : authority.verify(request.headers.get('x-bis-signing-grant') ?? '', planToken, body, binding);
        if (!owner) await store().consumePublicRequest(`${gameId}:${network}`, now());
        const operationCapSats = cap(values.BIS_SIGNING_OPERATION_CAP_SATS, MAX_OPERATION_EXPOSURE_SATS), dailyCapSats = cap(values.BIS_SIGNING_DAILY_CAP_SATS, MAX_DAILY_EXPOSURE_SATS);
        if (approved.exposureSats > operationCapSats) throw Error('Settlement authorization required.');
        const wallet = await pool.original(network, body.profileId);
        const claim: SigningClaim = { ...approved, scope: `${gameId}:${network}:${body.profileId}`, id: body.id, digest, operationCapSats, dailyCapSats, day: new Date(now()).toISOString().slice(0, 10) };
        const derived = session ? await authority.sessionIdentity(planToken, binding) : undefined;
        const sessionPolicy = derived ? { identity: derived.identity, reservationId: derived.reservationId, publicKey: toHex(await derived.identity.compressedPublicKey()) } : undefined;
        const result = await coordinatedSigning(store(), claim, owner => executeHostedSigning({ identity: MnemonicIdentity.fromMnemonic(wallet.mnemonic, { isMainnet: false }), secret: values.BIS_OWNER_TOKEN!, connectionId: connection.id, connectionExpires: connection.expires, now: now(), store: store(), claim, owner, method: body.method, args: decodeSigningValue(body.args), sessionId: body.sessionId, sessionPolicy }));
        return reply(request, 200, { result });
      }
      if (body.ownerPlan !== undefined) {
        authorization.assertOwner(request.headers.get('authorization'));
        assertOwnerSigningAllowed(values, network);
        if (body.paymentPlan !== undefined) throw Error('Payment authorization required.');
        const connection = authorization.connection(body.connectionToken, { gameId, network, profileId: body.profileId });
        const binding = { audience: url.origin, gameId, network, profileId: body.profileId, operationId: body.operationId, connectionId: connection.id };
        const approved = ownerPlans.verify(request.headers.get('x-bis-signing-grant') ?? '', body.ownerPlan, body, binding);
        const operationCapSats = cap(values.BIS_SIGNING_OPERATION_CAP_SATS, MAX_OPERATION_EXPOSURE_SATS), dailyCapSats = cap(values.BIS_SIGNING_DAILY_CAP_SATS, MAX_DAILY_EXPOSURE_SATS);
        if (approved.exposureSats > operationCapSats) throw Error('Payment authorization required.');
        const wallet = await pool.original(network, body.profileId);
        const claim: SigningClaim = { ...approved, scope: `${gameId}:${network}:${body.profileId}`, id: body.id, digest, operationCapSats, dailyCapSats, day: new Date(now()).toISOString().slice(0, 10) };
        if(ownerPlans.isV4Checkpoint(body.ownerPlan,body,binding)){
          const result=await completeCheckpoint(ownerPlans,body,binding,connection);
          return reply(request,200,{result});
        }
        const result = await coordinatedSigning(store(), claim, owner => ownerPlans.sign(body.ownerPlan,body,binding,()=>executeHostedSigning({ identity: MnemonicIdentity.fromMnemonic(wallet.mnemonic, { isMainnet: false }), secret: values.BIS_OWNER_TOKEN!, connectionId: connection.id, connectionExpires: connection.expires, now: now(), store: store(), claim, owner, method: body.method, args: decodeSigningValue(body.args), sessionId: body.sessionId }),claim.day));
        return reply(request, 200, ownerPlans.response(result));
      }
      if (body.paymentPlan !== undefined) {
        if (!publicSigningAllowed(values, network)) throw Error('Payment authorization required.');
        const connection = authorization.connection(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '', { gameId, network, profileId: body.profileId });
        const binding = { audience: url.origin, gameId, network, profileId: body.profileId, operationId: body.operationId, connectionId: connection.id };
        const approved = payments.verify(request.headers.get('x-bis-signing-grant') ?? '', body.paymentPlan, body, binding);
        if (approved.assetPolicy && values.BIS_PUBLIC_ASSET_SIGNING !== 'true') throw Error('Payment authorization required.');
        if (approved.contractPolicy && values.BIS_PUBLIC_CONTRACT_SIGNING !== 'true') throw Error('Payment authorization required.');
        await store().consumePublicRequest(`${gameId}:${network}`, now());
        const operationCapSats = cap(values.BIS_SIGNING_OPERATION_CAP_SATS, MAX_OPERATION_EXPOSURE_SATS), dailyCapSats = cap(values.BIS_SIGNING_DAILY_CAP_SATS, MAX_DAILY_EXPOSURE_SATS);
        if (approved.exposureSats > operationCapSats) throw Error('Payment authorization required.');
        const wallet = await pool.original(network, body.profileId);
        const claim: SigningClaim = { ...approved, scope: `${gameId}:${network}:${body.profileId}`, id: body.id, digest, operationCapSats, dailyCapSats, day: new Date(now()).toISOString().slice(0, 10) };
        if(payments.isV4Checkpoint(body.paymentPlan,body,binding)){
          const result=await completeCheckpoint(payments,body,binding,connection);
          return reply(request,200,{result});
        }
        const result = await coordinatedSigning(store(), claim, owner => payments.sign(body.paymentPlan,body,binding,()=>executeHostedSigning({ identity: MnemonicIdentity.fromMnemonic(wallet.mnemonic, { isMainnet: false }), secret: values.BIS_OWNER_TOKEN!, connectionId: connection.id, connectionExpires: connection.expires, now: now(), store: store(), claim, owner, method: body.method, args: decodeSigningValue(body.args), sessionId: body.sessionId }),claim.day));
        return reply(request, 200, payments.response(result));
      }
      const grant = authorization.verify(request.headers.get('x-bis-signing-grant') ?? '', { gameId, network, profileId: body.profileId, operationId: body.operationId, digest });
      const clientToken = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      const connection = authorization.connection(clientToken, { gameId, network, profileId: body.profileId });
      const wallet = await pool.original(network, body.profileId);
      const args = decodeSigningValue(body.args);
      const inputs: string[] = []; let transactionId = digest, exposure = 0;
      if (body.method === 'sign') {
        const tx = args?.[0] as Transaction;
        if (!tx || typeof tx.toPSBT !== 'function' || tx.inputsLength > 100 || tx.outputsLength > 100) throw Error('Invalid signing transaction.');
        transactionId = tx.id;
        const indexes: number[] = args[1] ?? Array.from({ length: tx.inputsLength }, (_, index) => index);
        for (const index of indexes) {
          if (!Number.isSafeInteger(index) || index < 0 || index >= tx.inputsLength) throw Error('Invalid signing index.');
          const input = tx.getInput(index);
          if (!input.txid || input.index === undefined || !input.witnessUtxo || input.sighashType && input.sighashType !== 1) throw Error('Signing input must commit its full transaction and witness value.');
          inputs.push(`${toHex(input.txid)}:${input.index}`);
          // Conservative owner budget: bound all authorized input value, not a
          // client-supplied fee/change claim. Public net-spend policy remains pending.
          exposure += Number(input.witnessUtxo.amount);
        }
      } else if (body.method === 'session.init') {
        if (typeof args?.[2] !== 'bigint' || !args[0] || typeof args[0].iterator !== 'function') throw Error('Invalid session value.');
        transactionId = args[0].root.id;
        let nodes = 0;
        for (const node of args[0].iterator()) {
          if (++nodes > 100 || node.root.inputsLength > 100 || node.root.outputsLength > 100) throw Error('Signing tree too large.');
          for (let index = 0; index < node.root.inputsLength; index++) {
            const input = node.root.getInput(index);
            if (!input.txid || input.index === undefined || input.sighashType && input.sighashType !== 1) throw Error('Invalid signing tree input.');
            inputs.push(`${toHex(input.txid)}:${input.index}`);
          }
        }
        exposure = Number(args[2]);
      }
      const dailyCapSats = cap(values.BIS_SIGNING_DAILY_CAP_SATS, MAX_DAILY_EXPOSURE_SATS), operationCapSats = cap(values.BIS_SIGNING_OPERATION_CAP_SATS, MAX_OPERATION_EXPOSURE_SATS);
      if (!Number.isSafeInteger(exposure) || exposure < 0 || exposure > operationCapSats) return reply(request, 403, { error: 'Signing authorization exceeds the configured operation cap.' });
      const claim: SigningClaim = { scope: `${gameId}:${network}:${body.profileId}`, id: body.id, digest, inputs, transactionId, operationId: grant.operationId, exposureSats: exposure, dailyCapSats, operationCapSats, day: new Date(now()).toISOString().slice(0, 10) };
      const result = await coordinatedSigning(store(), claim, owner => executeHostedSigning({
        identity: MnemonicIdentity.fromMnemonic(wallet.mnemonic, { isMainnet: false }), secret: values.BIS_OWNER_TOKEN!,
        connectionId: connection.id, connectionExpires: connection.expires, now: now(), store: store(), claim, owner,
        method: body.method, args, sessionId: body.sessionId,
      }));
      return reply(request, 200, { result });
    } catch (error) {
      // Do not expose request bodies, SDK errors, environment values or nonce data.
      if (error instanceof Error && error.message === 'Player authorization required.') return reply(request, 403, { error: 'Player proof is invalid, expired or has the wrong scope.' });
      if (error instanceof Error && error.message === 'Public signing request limit exceeded.') return reply(request, 429, { error: 'Public signing request limit exceeded. Wait before retrying or reconcile existing work.' });
      if (error instanceof Error && /Treasure Game actor authorization/.test(error.message)) return reply(request, 403, { error: 'Treasure Game actor request is not authorized by the configured policy.' });
      if (error instanceof Error && /Treasure Game actor signing is unresolved/.test(error.message)) return reply(request, 503, { error: 'Treasure Game actor signing is unresolved. Reconcile before retrying.' });
      if (error instanceof Error && /Treasure checkpoint result unavailable/.test(error.message)) return reply(request, 409, { error: 'Completed Treasure ROOT signing result is unavailable. Reconcile before retrying.' });
      if (error instanceof Error && /Treasure recovery authorization/.test(error.message)) return reply(request,403,{error:'Completed Treasure signing result is not authorized for recovery.'});
      if (error instanceof Error && /Settlement authorization|Settlement intent|Fresh settlement context/.test(error.message)) return reply(request, 403, { error: 'Settlement request is not authorized by the configured policy.' });
      if (error instanceof Error && /Payment authorization|Offchain payment|Fresh payment context|Asset transaction|Owner transaction/.test(error.message)) return reply(request, 403, { error: 'Payment request is not authorized by the configured policy.' });
      const denied = error instanceof Error && /authorization required|grant required|grant invalid|grant expired/.test(error.message);
      return reply(request, denied ? 403 : 503, { error: denied ? 'Hosted signing requires a private owner grant. Public workflow authorization is not enabled.' : 'Hosted signing unavailable or request unresolved. Reconcile before retrying.' });
    }
  };
}
