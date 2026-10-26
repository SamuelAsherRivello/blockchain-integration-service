import { createHmac, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Intent, Transaction, TxTree, CosignerPublicKey, getArkPsbtFields } from '@arkade-os/sdk';
import { nonceAggregate } from '@scure/btc-signer/musig2.js';
import { RawPSBTV0 } from '@scure/btc-signer/psbt.js';
import { decodeSigningValue, encodeSigningValue } from '../../../integration/src/client/wallet-layer-arkade/server-wallet-protocol.ts';
import { assertCanonicalSigningTransaction } from './offchain-policy.ts';
import { signingDigest } from './signing-authorization.ts';
import { MAX_OPERATION_EXPOSURE_SATS } from './signing-limits.ts';
import { validateSettlementIntent, type TrustedSettlementContext } from './settlement-intent-policy.ts';
import type { GameNetwork } from './environment.ts';
import { settlementSessionIdentity } from './settlement-session-identity.ts';
import { validateSettlementBatch } from './settlement-batch-policy.ts';
import { settlementFinalizationSources, validateSettlementFinalization } from './settlement-finalization-policy.ts';

export type SettlementBinding = Readonly<{ audience: string; gameId: string; network: GameNetwork; profileId: string; operationId: string; connectionId: string }>;
type Plan = SettlementBinding & { purpose: string; expires: number; reservationId: string; sourceOutpoints: string[]; exposureSats: number; proofs: string[]; sessionDraft?: string; sessionPublicKey?: string; bitcoinScript?: string;
  finalization?: { sources: unknown; dustAmount: string } };
type BatchPlan = SettlementBinding & { purpose: string; expires: number; planDigest: string; reservationId: string; batchDigest: string;
  treeDigest: string; scriptRoot: string; sharedAmount: string; transactionIds: string[]; cosignerKeys: string[]; commitmentId: string; forfeitScript?: string };
const deny = () => Error('Settlement authorization required.');
const encode = (tx: Transaction) => Buffer.from(tx.toPSBT()).toString('base64');
const decode = (value: string) => {
  if (typeof value !== 'string' || !value || value.length > 512 * 1024) throw deny();
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw deny();
  return Transaction.fromPSBT(bytes);
};

/** A sealed public signing plan, not a wallet-operation journal. The immutable
 * reservation ID groups protocol proofs; it is NOT a network transaction ID or
 * evidence of registration/settlement. Every signing claim uses that same ID.
 * MuSig tree/commitment authority needs additional validation before exposure.
 */
export function createSettlementAuthorization(secret: string | undefined, now = Date.now, authority: 'public' | 'owner' = 'public') {
  const domain = `bis-${authority}-settlement-plan-v1`, grantDomain = `bis-${authority}-settlement-grant-v1`;
  const batchDomain = `bis-${authority}-settlement-batch-v1`, sessionGrantDomain = `bis-${authority}-settlement-session-grant-v1`;
  const finalizationGrantDomain = `bis-${authority}-settlement-finalization-grant-v1`;
  const mac = (purpose: string, body: string) => {
    if (typeof secret !== 'string' || secret.length < 32) throw deny();
    return createHmac('sha256', secret).update(`${purpose}:${body}`).digest();
  };
  const seal = (purpose: string, payload: unknown) => {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${mac(purpose, body).toString('base64url')}`;
  };
  const open = (purpose: string, token: string, limit: number) => {
    if (typeof token !== 'string' || token.length > limit) throw deny();
    const pieces = token.split('.');
    if (pieces.length !== 2) throw deny();
    const actual = Buffer.from(pieces[1], 'base64url'), expected = mac(purpose, pieces[0]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw deny();
    return JSON.parse(Buffer.from(pieces[0], 'base64url').toString('utf8'));
  };
  const scope = (payload: SettlementBinding & { expires: number }, expected: SettlementBinding, lifetime: number) => {
    if (!['signet', 'mutinynet'].includes(expected.network) || !Number.isSafeInteger(payload.expires) || payload.expires <= now() || payload.expires > now() + lifetime ||
        Object.entries(expected).some(([key, value]) => Reflect.get(payload, key) !== value)) throw deny();
  };
  const read = (token: string, binding: SettlementBinding): Plan => {
    const plan = open(domain, token, 512 * 1024) as Plan;
    scope(plan, binding, 600000);
    if (plan.purpose !== domain || !/^[a-f0-9]{64}$/.test(plan.reservationId) || !Array.isArray(plan.proofs) || plan.proofs.length !== 3 ||
        !Array.isArray(plan.sourceOutpoints) || !plan.sourceOutpoints.length || plan.sourceOutpoints.length > 100 ||
        plan.sourceOutpoints.some(point => !/^[a-f0-9]{64}:(?:0|[1-9][0-9]{0,9})$/.test(point) || Number(point.split(':')[1]) > 0xffffffff) ||
        new Set(plan.sourceOutpoints).size !== plan.sourceOutpoints.length || !Number.isSafeInteger(plan.exposureSats) || plan.exposureSats < 0 || plan.exposureSats > MAX_OPERATION_EXPOSURE_SATS) throw deny();
    for (const proof of plan.proofs) if (decode(proof).inputsLength !== plan.sourceOutpoints.length + 1) throw deny();
    if (plan.sessionDraft !== undefined || plan.sessionPublicKey !== undefined) {
      if (typeof plan.sessionDraft !== 'string' || typeof plan.sessionPublicKey !== 'string' || !/^0[23][a-f0-9]{64}$/.test(plan.sessionPublicKey) || !/^5120[a-f0-9]{64}$/.test(plan.bitcoinScript ?? '')) throw deny();
      if (decode(plan.sessionDraft).inputsLength !== plan.sourceOutpoints.length + 1) throw deny();
    }
    return plan;
  };
  const requestProof = (plan: Plan, request: any) => {
    if (!request || request.method !== 'sign' || request.network !== plan.network || request.profileId !== plan.profileId || request.operationId !== plan.operationId || request.sessionId !== undefined) throw deny();
    const args = decodeSigningValue(request.args);
    if (!Array.isArray(args) || args.length !== 2 || !args[0] || typeof args[0].toPSBT !== 'function') throw deny();
    const tx = Transaction.fromPSBT(args[0].toPSBT()), proofs = plan.proofs.map(decode);
    const canonical = proofs.find(proof => proof.id === tx.id);
    if (!canonical) throw deny();
    const indexes = args[1];
    if (indexes != null && (!Array.isArray(indexes) || indexes.length !== tx.inputsLength || indexes.some((value, index) => value !== index))) throw deny();
    assertCanonicalSigningTransaction(tx, canonical);
    // Intent metadata is not covered by unsigned transaction ID equality.
    if (!isDeepStrictEqual(RawPSBTV0.decode(tx.toPSBT(0)).global, RawPSBTV0.decode(canonical.toPSBT(0)).global)) throw deny();
    for (let i = 0; i < tx.inputsLength; i++) {
      const input = tx.getInput(i);
      if (input.sighashType !== 1) throw deny();
    }
    return tx;
  };
  const readBatch = (token: string, planToken: string, plan: Plan, binding: SettlementBinding): BatchPlan => {
    const batch = open(batchDomain, token, 32768) as BatchPlan;
    scope(batch, binding, 600000);
    if (batch.purpose !== batchDomain || batch.planDigest !== signingDigest(planToken) || batch.reservationId !== plan.reservationId || batch.expires > plan.expires ||
        ![batch.batchDigest, batch.treeDigest, batch.scriptRoot, batch.commitmentId].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) ||
        batch.forfeitScript !== undefined && (typeof batch.forfeitScript !== 'string' || !/^(?:[a-f0-9]{2}){1,10000}$/.test(batch.forfeitScript)) ||
        typeof batch.sharedAmount !== 'string' || !/^[1-9][0-9]{0,15}$/.test(batch.sharedAmount) || BigInt(batch.sharedAmount) > BigInt(Number.MAX_SAFE_INTEGER) ||
        !Array.isArray(batch.transactionIds) || !batch.transactionIds.length || batch.transactionIds.length > 100 || batch.transactionIds.some(value => !/^[a-f0-9]{64}$/.test(value)) || new Set(batch.transactionIds).size !== batch.transactionIds.length ||
        !Array.isArray(batch.cosignerKeys) || !batch.cosignerKeys.length || batch.cosignerKeys.length > 100 || batch.cosignerKeys.some(value => !/^[a-f0-9]{64}$/.test(value)) || new Set(batch.cosignerKeys).size !== batch.cosignerKeys.length) throw deny();
    return batch;
  };
  const finalizationRequest = (planToken: string, plan: Plan, batchToken: string, request: any, binding: SettlementBinding) => {
    const batch = readBatch(batchToken, planToken, plan, binding);
    if (!plan.finalization || !/^[1-9][0-9]{0,15}$/.test(plan.finalization.dustAmount) || !batch.forfeitScript || !request || request.method !== 'sign' || request.sessionId !== undefined ||
        request.settlementFinalization !== true || request.network !== plan.network || request.profileId !== plan.profileId || request.operationId !== plan.operationId) throw deny();
    const args = decodeSigningValue(request.args);
    if (!Array.isArray(args) || args.length !== 2) throw deny();
    validateSettlementFinalization(args[0], args[1], { commitment: decodeSigningValue(request.settlementCommitment),
      connectors: request.settlementConnectors === undefined ? undefined : decodeSigningValue(request.settlementConnectors) },
    { commitmentId: batch.commitmentId, sources: decodeSigningValue(plan.finalization.sources), dustAmount: BigInt(plan.finalization.dustAmount), forfeitScript: Buffer.from(batch.forfeitScript, 'hex') });
    return batch;
  };
  const sessionRequest = (planToken: string, plan: Plan, batchToken: string | undefined, request: any, binding: SettlementBinding) => {
    if (!plan.sessionDraft || !plan.sessionPublicKey || !request || request.network !== plan.network || request.profileId !== plan.profileId || request.operationId !== plan.operationId ||
        !['session.create', 'session.getPublicKey', 'session.init', 'session.getNonces', 'session.aggregatedNonces', 'session.sign'].includes(request.method)) throw deny();
    if (request.method === 'session.create' ? request.sessionId !== undefined : typeof request.sessionId !== 'string' || !/^[a-f0-9-]{36}$/.test(request.sessionId)) throw deny();
    const args = decodeSigningValue(request.args);
    if (!Array.isArray(args)) throw deny();
    const batch = batchToken === undefined ? undefined : readBatch(batchToken, planToken, plan, binding);
    if (!['session.create', 'session.getPublicKey'].includes(request.method) && !batch) throw deny();
    if (request.method === 'session.init') {
      if (args.length !== 3 || !(args[0] instanceof TxTree) || !(args[1] instanceof Uint8Array) ||
          Buffer.from(args[1]).toString('hex') !== batch!.scriptRoot || typeof args[2] !== 'bigint' || String(args[2]) !== batch!.sharedAmount ||
          signingDigest(encodeSigningValue(args[0])) !== batch!.treeDigest) throw deny();
    } else if (request.method === 'session.aggregatedNonces') {
      if (args.length !== 2 || typeof args[0] !== 'string' || !batch!.transactionIds.includes(args[0]) || !(args[1] instanceof Map) || !args[1].size || args[1].size > 100) throw deny();
      for (const [key, value] of args[1]) {
        if (typeof key !== 'string' || !batch!.cosignerKeys.includes(key) || !value || Object.keys(value).join() !== 'pubNonce' || !(value.pubNonce instanceof Uint8Array) || value.pubNonce.length !== 66) throw deny();
        nonceAggregate([value.pubNonce]); // Validate public nonce curve encoding before claiming/signing.
      }
    } else if (args.length !== 0) throw deny();
    return batch;
  };
  const claimFor = (plan: Plan) => ({ operationId: plan.operationId, exposureSats: plan.exposureSats, exposureId: plan.reservationId,
    transactionId: plan.reservationId, inputs: [...plan.sourceOutpoints], settlementPolicy: true as const });
  const issuePlan = (binding: SettlementBinding, registerProof: Transaction, context: TrustedSettlementContext, session?: { sessionDraft: string; sessionPublicKey: string; bitcoinScript: string }) => {
      const validated = validateSettlementIntent(registerProof, context);
      if (validated.kind !== 'register') throw deny();
      const proofSet = [validated.proof, ...(['delete', 'get-pending-tx'] as const).map(type => {
        const proof = Intent.create({ type, expire_at: 0 }, [...context.inputs]);
        validateSettlementIntent(proof, context);
        return proof;
      })];
      const reservationId = signingDigest(['bis-settlement-reservation-v1', authority, binding, validated.proof.id, validated.sourceOutpoints]);
      const payload: Plan = { ...binding, purpose: domain, expires: now() + 600000, reservationId,
        sourceOutpoints: validated.sourceOutpoints, exposureSats: validated.exposureSats, proofs: proofSet.map(encode), ...session,
        ...(session ? { finalization: { sources: encodeSigningValue(settlementFinalizationSources(context.inputs, context.bitcoinScript, context.arkadeScript)), dustAmount: String(context.dustAmount) } } : {}) };
      const token = seal(domain, payload);
      read(token, binding);
      return token;
  };
  return {
    plan: issuePlan,
    async operationPlan(binding: SettlementBinding, draft: Transaction, context: TrustedSettlementContext) {
      // Always validate the placeholder with the Game key, never a caller's
      // declared session key. The server alone derives the actual session key.
      const canonical = validateSettlementIntent(draft, { ...context, sessionPublicKey: undefined });
      if (canonical.kind !== 'register') throw deny();
      const identity = settlementSessionIdentity(secret, binding, canonical.proof);
      const sessionPublicKey = Buffer.from(await identity.compressedPublicKey()).toString('hex');
      const message = JSON.parse(new TextDecoder().decode(RawPSBTV0.decode(canonical.proof.toPSBT(0)).global.genericSignedMessage));
      const outputs = Array.from({ length: canonical.proof.outputsLength }, (_, index) => canonical.proof.getOutput(index));
      const actual = Intent.create({ ...message, cosigners_public_keys: message.cosigners_public_keys.length ? [sessionPublicKey] : [] }, [...context.inputs], outputs);
      const plan = issuePlan(binding, actual, { ...context, sessionPublicKey }, { sessionDraft: encode(canonical.proof), sessionPublicKey, bitcoinScript: Buffer.from(context.bitcoinScript).toString('hex') });
      return { plan, sessionPublicKey };
    },
    async sessionIdentity(planToken: string, binding: SettlementBinding) {
      const plan = read(planToken, binding);
      if (!plan.sessionDraft || !plan.sessionPublicKey) throw deny();
      const identity = settlementSessionIdentity(secret, binding, decode(plan.sessionDraft));
      if (Buffer.from(await identity.compressedPublicKey()).toString('hex') !== plan.sessionPublicKey) throw deny();
      return { identity, registration: decode(plan.proofs[0]), reservationId: plan.reservationId };
    },
    batchPlan(planToken: string, binding: SettlementBinding, candidate: Parameters<typeof validateSettlementBatch>[0], operator: { network: GameNetwork; publicKey: string; forfeitPublicKey: string; batchExpiry: bigint; forfeitScript?: string }) {
      const plan = read(planToken, binding);
      if (!plan.sessionDraft || !plan.sessionPublicKey || operator.network !== binding.network) throw deny();
      const registration = decode(plan.proofs[0]);
      const boardingOutpoints = plan.sourceOutpoints.filter((_point, index) => {
        const script = registration.getInput(index + 1).witnessUtxo?.script;
        return script && Buffer.from(script).toString('hex') === plan.bitcoinScript;
      });
      const checked = validateSettlementBatch(candidate, { network: binding.network, registration, sessionPublicKey: plan.sessionPublicKey,
        operatorPublicKey: operator.publicKey, forfeitPublicKey: operator.forfeitPublicKey, batchExpiry: operator.batchExpiry, boardingOutpoints });
      const cosignerKeys = [...new Set([...candidate.tree.iterator()].flatMap(node => getArkPsbtFields(node.root, 0, CosignerPublicKey).map(item => Buffer.from(item.key.slice(1)).toString('hex'))))];
      const batchDigest = signingDigest([checked.commitmentId, checked.treeDigest, checked.scriptRoot, checked.sharedAmount]);
      const batch = { ...binding, purpose: batchDomain, expires: plan.expires, planDigest: signingDigest(planToken), reservationId: plan.reservationId, batchDigest,
        treeDigest: checked.treeDigest, scriptRoot: checked.scriptRoot, sharedAmount: checked.sharedAmount, transactionIds: [...checked.transactionIds], cosignerKeys,
        commitmentId: checked.commitmentId, ...(operator.forfeitScript ? { forfeitScript: operator.forfeitScript } : {}) };
      const token = seal(batchDomain, batch); readBatch(token, planToken, plan, binding); return token;
    },
    authorizeFinalization(planToken: string, batchToken: string, request: unknown, binding: SettlementBinding) {
      try {
        const plan = read(planToken, binding); finalizationRequest(planToken, plan, batchToken, request, binding);
        return seal(finalizationGrantDomain, { ...binding, purpose: finalizationGrantDomain, expires: now() + 60000, planDigest: signingDigest(planToken), batchTokenDigest: signingDigest(batchToken), requestDigest: signingDigest(request) });
      } catch { throw deny(); }
    },
    verifyFinalization(grantToken: string, planToken: string, batchToken: string, request: unknown, binding: SettlementBinding) {
      try {
        const grant = open(finalizationGrantDomain, grantToken, 4096); scope(grant, binding, 60000);
        if (grant.purpose !== finalizationGrantDomain || grant.planDigest !== signingDigest(planToken) || grant.batchTokenDigest !== signingDigest(batchToken) || grant.requestDigest !== signingDigest(request)) throw deny();
        const plan = read(planToken, binding), batch = finalizationRequest(planToken, plan, batchToken, request, binding);
        return { ...claimFor(plan), finalizationPolicy: true as const, settlementBatch: { reservationId: plan.reservationId, digest: batch.batchDigest } };
      } catch { throw deny(); }
    },
    authorizeSession(planToken: string, batchToken: string | undefined, request: unknown, binding: SettlementBinding) {
      try {
        const plan = read(planToken, binding); sessionRequest(planToken, plan, batchToken, request, binding);
        return seal(sessionGrantDomain, { ...binding, purpose: sessionGrantDomain, expires: now() + 60000, planDigest: signingDigest(planToken), batchTokenDigest: signingDigest(batchToken ?? null), requestDigest: signingDigest(request) });
      } catch { throw deny(); }
    },
    verifySession(grantToken: string, planToken: string, batchToken: string | undefined, request: unknown, binding: SettlementBinding) {
      try {
        const grant = open(sessionGrantDomain, grantToken, 4096); scope(grant, binding, 60000);
        if (grant.purpose !== sessionGrantDomain || grant.planDigest !== signingDigest(planToken) || grant.batchTokenDigest !== signingDigest(batchToken ?? null) || grant.requestDigest !== signingDigest(request)) throw deny();
        const plan = read(planToken, binding), batch = sessionRequest(planToken, plan, batchToken, request, binding);
        return { ...claimFor(plan), sessionPolicy: true as const, sessionPublicKey: plan.sessionPublicKey!,
          ...(batch ? { settlementBatch: { reservationId: plan.reservationId, digest: batch.batchDigest } } : {}) };
      } catch { throw deny(); }
    },
    authorize(planToken: string, request: unknown, binding: SettlementBinding) {
      try {
        const plan = read(planToken, binding); requestProof(plan, request);
        return seal(grantDomain, { ...binding, purpose: grantDomain, expires: now() + 60000, planDigest: signingDigest(planToken), requestDigest: signingDigest(request) });
      } catch { throw deny(); }
    },
    verify(grantToken: string, planToken: string, request: unknown, binding: SettlementBinding) {
      try {
        const grant = open(grantDomain, grantToken, 4096); scope(grant, binding, 60000);
        if (grant.purpose !== grantDomain || grant.planDigest !== signingDigest(planToken) || grant.requestDigest !== signingDigest(request)) throw deny();
        const plan = read(planToken, binding); requestProof(plan, request);
        return claimFor(plan);
      } catch { throw deny(); }
    },
  };
}
