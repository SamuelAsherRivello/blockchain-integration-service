import type { Identity, ReadonlyIdentity, SignerSession } from '@arkade-os/sdk';
import type { TestNetwork } from '../state-layer-core/test-network.ts';
import { Transaction } from '@arkade-os/sdk';
import { SIGNER_PROTOCOL, fromHex, encodeSigningValue, decodeSigningValue } from './server-wallet-protocol.ts';
import type { AppPlayerProof } from './app-player-proof.ts';
import type { ServerSettlement } from './server-settlement.ts';

export type ServerWalletReference = { profileId: string; network: TestNetwork; phrase?: never; server: { endpoint: string; publicKey: string; gameId: string } };
export type ServerContractIntent = Readonly<{playerPublicKey:string}&(
  |{kind:'fund'|'refund';secretHash:string}
  |{artifactVersion:3|4;kind:'fund'|'refund';branch:'fund'|'reject'|'cancel'|'refund';offerSessionId:string;hostReference:string;startedAtMs:number}
)>;
type ServerPaymentOperation={outpoints:{txid:string;vout:number}[];marketplacePayment?:string;contract?:ServerContractIntent;
  plan?:string;ownerPlan?:string;treasureRootReceipt?:string;treasureRootId?:string;
  treasureRootRequest?:Readonly<{id:string;transactionId:string;argsJson:string;connectionToken:string;authority:'owner'|'player-proof'}>};
type ServerArkadeAuthorization=Readonly<{request:Readonly<Record<string,unknown>>;connectionToken:string}>;
type ServerArkadeSubmission=Readonly<{signedArkTx:string;checkpointTxs:readonly string[];authorizations:readonly ServerArkadeAuthorization[];arkTxid:string}>;
export type ServerSigningOperation = Readonly<{ id: string; signal?: AbortSignal; playerProof?: AppPlayerProof; settlement?: { active?: ServerSettlement }; payment?: { active?: ServerPaymentOperation };
  submission?:{authorizations:ServerArkadeAuthorization[];active?:ServerArkadeSubmission} }>;
const standaloneArkadeAuthorizations = new WeakMap<ServerSigningOperation,ServerArkadeAuthorization[]>();
function arkadeAuthorizations(operation:ServerSigningOperation){
  if(operation.submission)return operation.submission.authorizations;
  let authorizations=standaloneArkadeAuthorizations.get(operation);
  if(!authorizations){authorizations=[];standaloneArkadeAuthorizations.set(operation,authorizations);}
  return authorizations;
}

/** Public contract terms only. The Player key is supplied separately to the
 * owner route or independently recovered from public Player proof. */
export function serverContractRequest(intent:ServerContractIntent|undefined){
  if(!intent)return undefined;
  return 'artifactVersion' in intent
    ?{artifactVersion:intent.artifactVersion,kind:intent.kind,branch:intent.branch,offerSessionId:intent.offerSessionId,
      hostReference:intent.hostReference,startedAtMs:intent.startedAtMs}
    :{kind:intent.kind,secretHash:intent.secretHash};
}
type Connection = { token: string; publicKey: string; profileId: string; network: TestNetwork; gameId: string; endpoint: string; fetcher: typeof fetch; runtime?: string; ownerToken?: string };
const connections = new Map<string, Connection>();
let configuredUrl: string | undefined;
let configuredOwnerToken: string | undefined;
/** Owner credentials are explicitly supplied at runtime, never persisted or read from VITE_ variables. */
export function configureBisServer(options: { url?: string; ownerToken?: string }) {
  // Forget credentials held by previously created adapters too. Changing the
  // operator credential requires a new successful probe, not silent reuse.
  if (configuredOwnerToken !== options.ownerToken) {
    for (const connection of connections.values()) connection.ownerToken = undefined;
  }
  configuredUrl = options.url;
  configuredOwnerToken = options.ownerToken;
}
export function signerEndpoint(): string | undefined {
  const local = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (configuredUrl !== undefined) return configuredUrl || undefined;
  if (local) return '/api/bis/';
  return (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_BIS_SERVER_URL || undefined;
}
const connectionKey = (account: ServerWalletReference) => JSON.stringify([account.server.endpoint, account.profileId, account.network]);
export type SignerProbe = { status: 'connected'; account: ServerWalletReference } | { status: 'absent' | 'error'; message: string };
export type ServerWalletRequirement = Readonly<{ arkadeSats?: number; bitcoinSats?: number; purpose?: 'mint' | 'boarding' | 'asset'; excludedProfiles?:readonly string[]; asset?:Readonly<{assetId:string;quantity:string;exact?:boolean}> }>;
type ProbeOptions = { endpoint?: string; fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number; gameId?: string; profileId?: string };
export function probeGameSigner(network: TestNetwork, options: ProbeOptions = {}): Promise<SignerProbe> { return connectGameSigner(network, options); }
/** A provider-backed selection is not a reachability probe or authority to sign. */
export async function selectGameSigner(account: ServerWalletReference, requirement: ServerWalletRequirement, signal: AbortSignal): Promise<ServerWalletReference> {
  if (![requirement.arkadeSats ?? 0, requirement.bitcoinSats ?? 0].every(value => Number.isSafeInteger(value) && value >= 0)) throw Error('Invalid server wallet balance requirement.');
  if (requirement.purpose !== undefined && !['mint', 'boarding', 'asset'].includes(requirement.purpose)) throw Error('Invalid server wallet purpose.');
  const connection = connections.get(connectionKey(account));
  if (!connection) throw Error('Original game signer connection is unavailable.');
  const next = await connectGameSigner(account.network, { endpoint: account.server.endpoint, gameId: account.server.gameId, fetcher: connection.fetcher, signal, timeoutMs: 15000 }, requirement);
  signal.throwIfAborted();
  if (next.status !== 'connected') throw Error('No server wallet could be selected with a verified spendable balance. Retry selection or inspect the original wallet.');
  return next.account;
}
async function connectGameSigner(network: TestNetwork, options: ProbeOptions = {}, requirement?: ServerWalletRequirement): Promise<SignerProbe> {
  const endpoint = options.endpoint ?? signerEndpoint();
  if (!endpoint) return { status: 'absent', message: 'No BIS backend configured. Use Game Wallet Login.' };
  const base = endpoint.endsWith('/') ? endpoint : endpoint + '/', transport = options.fetcher ?? fetch;
  // Stored browser transports must not receive the connection object as `this`.
  const fetcher: typeof fetch = (input, init) => transport(input, init);
  const signal = AbortSignal.any([options.signal ?? new AbortController().signal, AbortSignal.timeout(options.timeoutMs ?? 1500)]);
  let response: Response;
  if (options.profileId !== undefined && !/^[0-9a-f]{64}$/.test(options.profileId)) return { status: 'error', message: 'Original BIS server wallet reference is invalid.' };
  try { response = await fetcher(base + 'connect', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(configuredOwnerToken ? { Authorization: `Bearer ${configuredOwnerToken}` } : {}) }, body: JSON.stringify({ network, gameId: options.gameId ?? 'stealth-and-steel', profileId: options.profileId, requirement }), signal, cache: 'no-store', redirect: 'error' }); }
  catch { return { status: requirement ? 'error' : 'absent', message: 'BIS server not reachable. Use Game Wallet Login or retry.' }; }
  if (response.status === 404) return { status: requirement ? 'error' : 'absent', message: 'BIS server not found. Use Game Wallet Login.' };
  if (!response.ok) return { status: 'error', message: 'BIS server configuration or authorization unavailable. Retry.' };
  try {
    const info = await response.json();
    if (options.profileId !== undefined && info.profileId !== options.profileId) throw Error();
    if (info.protocol !== SIGNER_PROTOCOL || info.network !== network || info.gameId !== (options.gameId ?? 'stealth-and-steel') || !/^(02|03)[0-9a-f]{64}$/i.test(info.publicKey) || !/^[0-9a-f]{64}$/i.test(info.profileId) || typeof info.token !== 'string' || !['sign', 'signMessage', 'signerSession'].every(cap => info.capabilities?.includes(cap))) throw Error();
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(fromHex(info.publicKey)));
    if (Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') !== info.profileId) throw Error();
    const account: ServerWalletReference = { profileId: info.profileId, network, server: { endpoint: base, publicKey: info.publicKey, gameId: info.gameId } };
    const key = connectionKey(account), existing = connections.get(key);
    if(existing)Object.assign(existing,{...info,endpoint:base,fetcher,ownerToken:configuredOwnerToken});
    else connections.set(key, { ...info, endpoint: base, fetcher, ownerToken: configuredOwnerToken });
    return { status: 'connected', account };
  } catch { return { status: 'error', message: 'BIS server identity, network or signing protocol is incompatible.' }; }
}
export function remoteReadonlyIdentity(account: ServerWalletReference): ReadonlyIdentity {
  return { compressedPublicKey: async () => fromHex(account.server.publicKey), xOnlyPublicKey: async () => fromHex(account.server.publicKey).slice(1) };
}
export function remoteSigningIdentity(account: ServerWalletReference, operation?: () => ServerSigningOperation | undefined): Identity {
  const connection = connections.get(connectionKey(account));
  if (!connection || connection.publicKey !== account.server.publicKey) throw Error('Original game signer connection is unavailable. Retry that server.');
  // Standalone temporary wallets have one operation. Retained application
  // wallets supply the current exclusive lease instead of a wallet-lifetime ID.
  const standaloneOperation: ServerSigningOperation | undefined = operation ? undefined : Object.freeze({ id: crypto.randomUUID(),submission:{authorizations:[]} });
  function currentOperation(): ServerSigningOperation {
    const selected = operation ? operation() : standaloneOperation;
    if (!selected) throw Error('Game signing requires an active operation lease.');
    selected.signal?.throwIfAborted();
    return selected;
  }
  function assertOperation(selected: ServerSigningOperation) {
    if (operation && operation() !== selected) throw Error('Original game signing operation ended. Reconcile before retrying.');
    selected.signal?.throwIfAborted();
  }
  async function settlementAccess(selected: ServerSigningOperation, requestedToken = connection!.token) {
    const settlement = selected.settlement?.active;
    if (!settlement) throw Error('Original settlement plan required.');
    const owner = Boolean(connection!.ownerToken), operationId = selected.id;
    if (settlement.owner !== undefined && settlement.owner !== owner) throw Error('Original settlement authority changed. Reconcile before retrying.');
    settlement.owner = owner;
    settlement.connectionToken ??= requestedToken;
    const token = settlement.connectionToken;
    const signal = AbortSignal.any([selected.signal ?? new AbortController().signal, AbortSignal.timeout(30000)]);
    const proof = owner ? undefined : await selected.playerProof?.({ account, operationId, signal, fetcher: connection!.fetcher });
    if (!owner && !proof) throw Error('Settlement Player proof required.');
    const assertCurrent = () => {
      assertOperation(selected); proof?.assertCurrent?.();
      if (selected.settlement?.active !== settlement) throw Error('Original settlement signing operation ended.');
      if (settlement.captureError) throw Error('Original settlement batch context changed. Reconcile before retrying.');
      if (owner && !connection!.ownerToken) throw Error('Original owner access was removed.');
    };
    const send = async (path: string, payload: unknown) => {
      assertCurrent();
      const response = await connection!.fetcher(connection!.endpoint + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner ? connection!.ownerToken : token}` },
        body: JSON.stringify(payload), signal, redirect: 'error', cache: 'no-store' });
      if (!response.ok) throw Error(`Original game signer refused settlement authorization (${response.status}).`);
      const result = await response.json(); assertCurrent(); return result;
    };
    const prefix = owner ? 'owner/settlement/' : 'settlement/', field = owner ? 'ownerSettlementPlan' as const : 'settlementPlan' as const;
    settlement.plan ??= send(prefix + 'plan', { request: { id: crypto.randomUUID(), operationId, network: account.network, profileId: account.profileId, method: 'sign', args: encodeSigningValue([settlement.registerProof, undefined]) },
      sessionKeyMode: 'operation-v1', outpoints: settlement.outpoints, playerToken: proof?.token, connectionToken: token }).then(planned => {
      if (typeof planned[field] !== 'string' || !planned[field] || planned[field].length > 512 * 1024 ||
          typeof planned.sessionPublicKey !== 'string' || !/^0[23][a-f0-9]{64}$/.test(planned.sessionPublicKey)) throw Error('Invalid settlement signing plan.');
      return { token: planned[field], sessionPublicKey: planned.sessionPublicKey };
    });
    const plan = await settlement.plan; assertCurrent();
    settlement.sessionPublicKey = plan.sessionPublicKey;
    return { owner, token, proof, prefix, field, plan, send, assertCurrent };
  }
  // Capture the connection, not a mutable current source. Old work cannot migrate.
  async function request(method: string, args: unknown[], sessionId?: string, token = connection!.token, selected = currentOperation()) {
    assertOperation(selected);
    const operationId = selected.id;
    const body: { id: string; operationId: string; method: string; network: TestNetwork; profileId: string; args: unknown; sessionId?: string; paymentPlan?: string; ownerPlan?: string; settlementPlan?: string; ownerSettlementPlan?: string; settlementBatchPlan?: string; settlementFinalization?: boolean; settlementCommitment?: unknown; settlementConnectors?: unknown; connectionToken?: string;treasureRootReceipt?:string } = { id: crypto.randomUUID(), operationId, method, network: account.network, profileId: account.profileId, args: encodeSigningValue(args), sessionId };
    const payment=selected.payment?.active,transactionId=method==='sign'?(args[0] as {id?:unknown})?.id:undefined;
    if(connection!.runtime==='vercel'&&payment?.contract&&'artifactVersion' in payment.contract){
      if(payment.contract.artifactVersion===4)throw Error('Versioned Treasure signing requires its saved private journal.');
      if(method!=='sign'||typeof transactionId!=='string'||!/^[a-f0-9]{64}$/.test(transactionId))throw Error('Original treasure signing request is unavailable.');
      const authority=connection!.ownerToken?'owner':'player-proof';
      // Keep one original root request in the private operation lease. Losing
      // its response must not manufacture a new signing request on retry.
      payment.treasureRootRequest??=Object.freeze({id:body.id,transactionId,argsJson:JSON.stringify(body.args),connectionToken:token,authority});
      const original=payment.treasureRootRequest;
      if(original.authority!==authority)throw Error('Original treasure signing authority changed.');
      token=original.connectionToken;
      if(transactionId===original.transactionId){
        if(JSON.stringify(body.args)!==original.argsJson)throw Error('Original treasure signing arguments changed.');
        body.id=original.id;
      }else if(!payment.treasureRootReceipt)throw Error('Original treasure root signing result is unresolved.');
    }
    if(payment?.treasureRootReceipt){
      if(!payment.contract||!('artifactVersion' in payment.contract)||payment.contract.artifactVersion!==3||
        typeof transactionId!=='string'||!/^[a-f0-9]{64}$/.test(transactionId)||!payment.treasureRootId)throw Error('Original treasure signing receipt is unavailable.');
      if(transactionId!==payment.treasureRootId)body.treasureRootReceipt=payment.treasureRootReceipt;
    }
    let grant: string | undefined;
    let assertPlayerScope: (() => void) | undefined;
    if (connection!.runtime === 'vercel') {
      if (selected.settlement?.active) {
        const settlement = selected.settlement.active;
        const isSession = ['session.create', 'session.getPublicKey', 'session.init', 'session.getNonces', 'session.aggregatedNonces', 'session.sign'].includes(method);
        if (method !== 'sign' && !isSession) throw Error('Settlement batch signing requires validated batch authority.');
        if (settlement.captureError) throw Error('Original settlement batch context changed. Reconcile before retrying.');
        if ((method === 'session.init' && !settlement.candidate) || (isSession && !['session.create', 'session.getPublicKey', 'session.init'].includes(method) && !settlement.batchPlan)) throw Error('Settlement batch signing requires validated batch authority.');
        const access = await settlementAccess(selected, token);
        token = access.token;
        assertPlayerScope = access.assertCurrent;
        if (access.owner) body.connectionToken = token;
        body[access.field] = access.plan.token;
        if (method === 'session.init') {
          const candidate = settlement.candidate!;
          settlement.batchPlan ??= access.send(access.prefix + 'batch', { request: body, commitment: encodeSigningValue(candidate.commitment), batchExpiry: String(candidate.batchExpiry), playerToken: access.proof?.token, connectionToken: token }).then(planned => {
            if (typeof planned.settlementBatchPlan !== 'string' || !planned.settlementBatchPlan || planned.settlementBatchPlan.length > 32768) throw Error('Invalid settlement batch plan.');
            return planned.settlementBatchPlan as string;
          });
        }
        if (isSession && settlement.batchPlan) { body.settlementBatchPlan = await settlement.batchPlan; access.assertCurrent(); }
        const finalization = method === 'sign' ? settlement.finalization : undefined;
        if (finalization) {
          if (!settlement.batchPlan || !settlement.candidate || finalization.id !== settlement.candidate.id) throw Error('Original settlement finalization context is unavailable.');
          body.settlementBatchPlan = await settlement.batchPlan;
          body.settlementFinalization = true;
          body.settlementCommitment = encodeSigningValue(finalization.commitment);
          if (finalization.connectors) body.settlementConnectors = encodeSigningValue(finalization.connectors);
          access.assertCurrent();
        }
        if (settlement.captureError) throw Error('Original settlement batch context changed. Reconcile before retrying.');
        const authorizationPath = finalization ? 'finalization/authorize' : isSession ? 'session/authorize' : 'authorize';
        const authorized = await access.send(access.prefix + authorizationPath, { request: body, playerToken: access.proof?.token, connectionToken: token });
        if (typeof authorized.grant !== 'string' || !authorized.grant || authorized.grant.length > 4096) throw Error('Invalid settlement signing grant.');
        grant = authorized.grant;
      } else if (!connection!.ownerToken) {
        const payment = selected.payment?.active;
        if (!selected.playerProof || !payment || method !== 'sign') throw Error('Private owner grant is required; public signing policy is not enabled.');
        const signal = AbortSignal.any([selected.signal ?? new AbortController().signal, AbortSignal.timeout(30000)]);
        const proof = await selected.playerProof({ account, operationId, signal, fetcher: connection!.fetcher });
        assertPlayerScope = proof.assertCurrent;
        assertPlayerScope?.();
        assertOperation(selected);
        const send = async (path: string, payload: unknown) => {
          assertOperation(selected);
          assertPlayerScope?.();
          const response = await connection!.fetcher(connection!.endpoint + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload), signal, redirect: 'error', cache: 'no-store' });
          if (!response.ok) throw Error('Original game signer refused payment authorization.');
          const result = await response.json(); assertOperation(selected); assertPlayerScope?.(); return result;
        };
        if (!payment.plan) {
          const contract = serverContractRequest(payment.contract);
          const planned = await send('payment/plan', { request: body, playerToken: proof.token, outpoints: payment.outpoints, marketplacePayment: payment.marketplacePayment, contract });
          if (typeof planned.paymentPlan !== 'string' || !planned.paymentPlan || planned.paymentPlan.length > 512 * 1024) throw Error('Invalid payment signing plan.');
          payment.plan = planned.paymentPlan;
        }
        body.paymentPlan = payment.plan;
        const authorized = await send('payment/authorize', { request: body, playerToken: proof.token });
        if (typeof authorized.grant !== 'string' || !authorized.grant || authorized.grant.length > 4096) throw Error('Invalid payment signing grant.');
        grant = authorized.grant;
      } else if (method === 'sign' && selected.payment?.active) {
        const payment = selected.payment.active;
        const send = async (path: string, payload: unknown) => {
          assertOperation(selected);
          if (!connection!.ownerToken) throw Error('Original owner access was removed.');
          const response = await connection!.fetcher(connection!.endpoint + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection!.ownerToken}` }, body: JSON.stringify(payload), signal: AbortSignal.any([selected.signal ?? new AbortController().signal, AbortSignal.timeout(15000)]), redirect: 'error', cache: 'no-store' });
          if (!response.ok) throw Error('Original game signer refused owner plan authorization.');
          const result = await response.json(); assertOperation(selected); return result;
        };
        if (!payment.ownerPlan) {
          const contract = serverContractRequest(payment.contract);
          const planned = await send('owner/plan', { request: body, connectionToken: token, outpoints: payment.outpoints, contract, contractPlayerPublicKey: payment.contract?.playerPublicKey });
          if (typeof planned.ownerPlan !== 'string' || !planned.ownerPlan || planned.ownerPlan.length > 512 * 1024) throw Error('Invalid owner signing plan.');
          payment.ownerPlan = planned.ownerPlan;
        }
        body.ownerPlan = payment.ownerPlan; body.connectionToken = token;
        const authorized = await send('owner/authorize', { request: body, connectionToken: token });
        if (typeof authorized.grant !== 'string' || !authorized.grant || authorized.grant.length > 4096) throw Error('Invalid owner signing grant.');
        grant = authorized.grant;
      } else {
      const authorized = await connection!.fetcher(connection!.endpoint + 'authorize', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection!.ownerToken}` }, body: JSON.stringify({ request: body, operationId }), signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!authorized.ok) throw Error('Original game signer refused signing authorization.');
      grant = (await authorized.json()).grant;
      }
    }
    assertOperation(selected);
    assertPlayerScope?.();
    if ((body.ownerPlan || body.ownerSettlementPlan) && !connection!.ownerToken) throw Error('Original owner access was removed.');
    const response = await connection!.fetcher(connection!.endpoint + 'sign', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${body.ownerPlan || body.ownerSettlementPlan ? connection!.ownerToken : token}`, ...(grant ? { 'X-BIS-Signing-Grant': grant } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!response.ok) throw Error('Original game signer unavailable; reconcile before retrying.');
    const payload=await response.json();
    assertOperation(selected);assertPlayerScope?.();
    if(payment&&selected.payment?.active!==payment)throw Error('Original payment signing operation ended.');
    const result = decodeSigningValue(payload.result);
    if(connection!.runtime==='vercel'&&payment?.contract&&'artifactVersion' in payment.contract&&
      !payment.treasureRootReceipt&&payload.treasureRootReceipt===undefined)throw Error('Original treasure signing receipt is unavailable.');
    if(payload.treasureRootReceipt!==undefined){
      if(!payment?.contract||!('artifactVersion' in payment.contract)||payment.contract.artifactVersion!==3||
        typeof transactionId!=='string'||!/^[a-f0-9]{64}$/.test(transactionId)||typeof payload.treasureRootReceipt!=='string'||
        !payload.treasureRootReceipt||payload.treasureRootReceipt.length>512*1024||body.treasureRootReceipt||
        payment.treasureRootId!==undefined&&payment.treasureRootId!==transactionId||
        payment.treasureRootReceipt!==undefined&&payment.treasureRootReceipt!==payload.treasureRootReceipt)throw Error('Original treasure signing receipt changed.');
      payment.treasureRootReceipt=payload.treasureRootReceipt;payment.treasureRootId=transactionId;
    }
    if(connection!.runtime==='vercel'&&method==='sign'){
      const authorizations=arkadeAuthorizations(selected);
      const existing=authorizations.find(item=>item.request.id===body.id);
      if(existing){if(JSON.stringify(existing.request)!==JSON.stringify(body)||existing.connectionToken!==token)throw Error('Original Signet submit authorization changed.');}
      else authorizations.push(Object.freeze({request:Object.freeze({...body}),connectionToken:token}));
    }
    assertOperation(selected);
    assertPlayerScope?.();
    return result;
  }
  return {
    ...remoteReadonlyIdentity(account),
    sign: (tx, indexes) => request('sign', [tx, indexes]),
    signMessage: (message, type) => request('signMessage', [message, type]),
    signerSession(): SignerSession {
      let session: Promise<string> | undefined, sessionToken: string | undefined;
      let sessionOperation: ServerSigningOperation | undefined;
      let sessionSettlement: NonNullable<NonNullable<ServerSigningOperation['settlement']>['active']> | undefined;
      const call = async (method: string, args: unknown[]) => {
        sessionOperation ??= currentOperation();
        assertOperation(sessionOperation!);
        sessionSettlement ??= sessionOperation.settlement?.active;
        if (sessionSettlement && sessionOperation.settlement?.active !== sessionSettlement) throw Error('Original settlement signing operation ended.');
        if (sessionSettlement && connection!.runtime === 'vercel') {
          if (sessionSettlement.captureError) throw Error('Original settlement batch context changed. Reconcile before retrying.');
          if (method === 'init' ? !sessionSettlement.candidate : method !== 'getPublicKey' && !sessionSettlement.batchPlan) throw Error('Settlement batch signing requires validated batch authority.');
        }
        if(!session){sessionToken=connection!.token;session=request('session.create', [], undefined, sessionToken, sessionOperation);}
        return request(`session.${method}`, args, await session, sessionToken, sessionOperation);
      };
      return { getPublicKey: async () => {
        const selected = sessionOperation ?? currentOperation();
        if (!selected.settlement?.active) return call('getPublicKey', []);
        sessionOperation ??= selected;
        assertOperation(selected);
        sessionSettlement ??= selected.settlement.active;
        if (sessionSettlement !== selected.settlement.active) throw Error('Original settlement signing operation ended.');
        if (connection!.runtime === 'vercel') return fromHex((await settlementAccess(selected, sessionToken)).plan.sessionPublicKey);
        // Local SDK sessions also have their own random key. Preserve the
        // actual server session lookup rather than substituting the wallet key.
        return call('getPublicKey', []);
      }, init: (tree, scriptRoot, amount) => call('init', [tree, scriptRoot, amount]), getNonces: () => call('getNonces', []), aggregatedNonces: (txid, nonces) => call('aggregatedNonces', [txid, nonces]), sign: () => call('sign', []) };
    },
  };
}

function transactionIdFromAuthorization(item:ServerArkadeAuthorization):string|undefined{
  try{const args=decodeSigningValue(item.request.args);return Array.isArray(args)&&args[0]&&typeof args[0].id==='string'?args[0].id:undefined;}catch{return undefined;}
}
function fromBase64(value:string){const binary=atob(value);return Uint8Array.from(binary,char=>char.charCodeAt(0));}
function submissionAuthorizations(operation:ServerSigningOperation,transactionIds:ReadonlySet<string>){
  const selected=arkadeAuthorizations(operation).filter(item=>transactionIds.has(transactionIdFromAuthorization(item)??''));
  if(!selected.length||selected.some(item=>!transactionIds.has(transactionIdFromAuthorization(item)??'')))throw Error('Completed Signet signing receipts are unavailable for this exact transaction.');
  return selected;
}
function serverSubmissionEndpoint(connection:Connection){
  if(connection.runtime!=='vercel'||connection.network!=='signet')throw Error('Hosted Arkade writes are available on Signet only.');
  return `${connection.endpoint}arkade/signet/v1/tx/`;
}
async function serverSubmitRequest(connection:Connection,operation:ServerSigningOperation,path:'submit'|'finalize',body:unknown){
  assertOperationForSubmission(operation);
  const response=await connection.fetcher(serverSubmissionEndpoint(connection)+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
    signal:AbortSignal.any([operation.signal??new AbortController().signal,AbortSignal.timeout(30000)]),cache:'no-store',redirect:'error'});
  if(!response.ok)throw Error('Original Signet submit outcome is unavailable. Reconcile before retrying.');
  if(path==='finalize')return;
  const result=await response.json();
  if(!result||typeof result!=='object'||typeof result.arkTxid!=='string'||!/^[a-f0-9]{64}$/i.test(result.arkTxid)||typeof result.finalArkTx!=='string'||
    !Array.isArray(result.signedCheckpointTxs)||!result.signedCheckpointTxs.every((value:unknown)=>typeof value==='string'))throw Error('Original Signet submit receipt is invalid.');
  return result as {arkTxid:string;finalArkTx:string;signedCheckpointTxs:string[]};
}
function assertOperationForSubmission(operation:ServerSigningOperation){operation.signal?.throwIfAborted();}

/** Server-wallet Ark transactions use the same-origin, journal-bound Signet route. */
export async function submitServerArkadeTransaction(account:ServerWalletReference,operation:ServerSigningOperation,signedArkTx:string,checkpointTxs:string[]){
  const connection=connections.get(connectionKey(account));if(!connection)throw Error('Original game signer connection is unavailable.');
  const transactionIds=new Set([Transaction.fromPSBT(fromBase64(signedArkTx)).id,...checkpointTxs.map(value=>Transaction.fromPSBT(fromBase64(value)).id)]);
  const authorizations=submissionAuthorizations(operation,transactionIds);
  const result=await serverSubmitRequest(connection,operation,'submit',{operationId:operation.id,signedArkTx,checkpointTxs,authorizations});
  if(!result)throw Error('Original Signet submit receipt is unavailable.');
  operation.submission!.active=Object.freeze({signedArkTx,checkpointTxs:Object.freeze([...checkpointTxs]),authorizations:Object.freeze([...authorizations]),arkTxid:result.arkTxid});
  return result;
}

/** Finalization is allowed only for the exact durable submit receipt in this lease. */
export async function finalizeServerArkadeTransaction(account:ServerWalletReference,operation:ServerSigningOperation,arkTxid:string,finalCheckpointTxs:string[]){
  const connection=connections.get(connectionKey(account)),prior=operation.submission?.active;
  if(!connection||!prior||prior.arkTxid!==arkTxid||prior.checkpointTxs.length!==finalCheckpointTxs.length)throw Error('Original Signet submit receipt is unavailable. Reconcile before finalization.');
  const originalIds=[Transaction.fromPSBT(fromBase64(prior.signedArkTx)).id,...prior.checkpointTxs.map(value=>Transaction.fromPSBT(fromBase64(value)).id)];
  const finalIds=finalCheckpointTxs.map(value=>Transaction.fromPSBT(fromBase64(value)).id);
  if(prior.arkTxid!==originalIds[0]||finalIds.length!==originalIds.length-1||finalIds.some((id,index)=>id!==originalIds[index+1]))throw Error('Signet finalization differs from its original submit receipt.');
  const authorizations=submissionAuthorizations(operation,new Set(originalIds));
  await serverSubmitRequest(connection,operation,'finalize',{operationId:operation.id,arkTxid,finalCheckpointTxs,authorizations,signedArkTx:prior.signedArkTx,checkpointTxs:prior.checkpointTxs});
}

export type TreasureServerPersistence=Readonly<{
  read:()=>Promise<import('./treasure-server-journal.ts').TreasureServerJournal>;
  commit:(before:import('./treasure-server-journal.ts').TreasureServerJournal,
    after:import('./treasure-server-journal.ts').TreasureServerJournal)=>Promise<void>;
  isCurrent:()=>boolean;signal?:AbortSignal;
}>;

/** Fresh journal authority only. Historical journals retain their saved mode. */
export function serverTreasureAuthority(account:ServerWalletReference):'owner'|'player-proof'|undefined{
  const connection=connections.get(connectionKey(account));
  if(!connection||connection.publicKey!==account.server.publicKey||connection.network!==account.network||
    connection.gameId!==account.server.gameId)throw Error('Original game signer connection is unavailable.');
  return connection.runtime==='vercel'&&account.network==='mutinynet'?(connection.ownerToken?'owner':'player-proof'):undefined;
}

/** Private Game-lease composition. Owner secrets stay in the verified original
 * connection registry and cannot be supplied by an imported journal endpoint. */
export async function createLeasedTreasureServerTransport(account:ServerWalletReference,
  operation:()=>ServerSigningOperation|undefined,persistence:TreasureServerPersistence){
  const connection=connections.get(connectionKey(account)),selected=operation();
  if(!selected||!connection||connection.runtime!=='vercel'||account.network!=='mutinynet'||
    connection.publicKey!==account.server.publicKey||connection.gameId!==account.server.gameId||connection.network!==account.network)
    throw Error('Original hosted Treasure signing lease is unavailable.');
  const signal=AbortSignal.any([selected.signal??new AbortController().signal,persistence.signal??new AbortController().signal]);
  const isCurrent=()=>operation()===selected&&!signal.aborted&&persistence.isCurrent();
  if(!isCurrent())throw Error('Original hosted Treasure signing lease ended.');
  const connectionToken=connection.token,original=await persistence.read();
  if(!isCurrent())throw Error('Original hosted Treasure signing lease ended.');
  const {createTreasureServerTransport}=await import('./treasure-server-transport.ts');
  if(!isCurrent())throw Error('Original hosted Treasure signing lease ended.');
  return createTreasureServerTransport({account,authority:original.binding.authority,connectionToken,
    ownerToken:()=>connection.ownerToken,playerProof:selected.playerProof,fetcher:connection.fetcher,signal,isCurrent,
    read:persistence.read,commit:persistence.commit});
}
