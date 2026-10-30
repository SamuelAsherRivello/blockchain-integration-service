import { createHash } from 'node:crypto';
import { label, network, origin } from './arguments.ts';
import { verifiedInventory } from './inventory.ts';
import { fail } from './errors.ts';
import {findTestActor,actorSource,canonicalServerSource} from './server-actors.ts';
import {verifyBoardingNonSubmission,type BoardingNonSubmissionEvidence} from './boarding-non-submission.ts';

const kinds = new Set(['faucet', 'btc-send', 'arkade-send', 'swap-to-bitcoin', 'arkade-to-bitcoin-funding', 'onboard', 'mint', 'burn', 'claim', 'refund']);
const terminal = new Set(['settled', 'failed', 'cancelled']);
const token = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,300}$/.test(value);
const sats = value => Number.isSafeInteger(value) && value >= 0;
const fingerprint = intent => createHash('sha256').update(JSON.stringify(intent)).digest('hex');
const snapshot = record => structuredClone(record); // Never return a mutable vault object.

function canonicalIntent(input) {
  label(input?.id); label(input?.account); network(input?.network);
  if (!kinds.has(input.kind) || !/^[a-f0-9]{64}$/.test(input.profileId ?? '') ||
      !Number.isSafeInteger(input.generation) || input.generation < 1 ||
      !token(input.recipient) || !sats(input.amountSats) ||
      !(input.feeSats === null || sats(input.feeSats))) fail('invalid-operation-intent');
  // No arbitrary notes, provider objects, exception strings or recovery inputs.
  const sourceOrigin = input.sourceOrigin == null ? null : origin(input.sourceOrigin);
  if (input.priorProviderIds !== undefined && (!Array.isArray(input.priorProviderIds) || input.priorProviderIds.length > 1000 ||
      input.priorProviderIds.some(id => !/^[a-f0-9]{64}$/.test(id)) || new Set(input.priorProviderIds).size !== input.priorProviderIds.length)) fail('invalid-operation-intent');
  let swap;
  if (['swap-to-bitcoin','arkade-to-bitcoin-funding'].includes(input.kind)) {
    if (!sats(input.netSats) || input.netSats === 0 || !sats(input.feeSats) || input.netSats + input.feeSats !== input.amountSats ||
        !/^[a-f0-9]{64}$/.test(input.quoteFingerprint ?? '') || !sats(input.quoteExpiresAt) || input.quoteExpiresAt === 0 ||
        !Array.isArray(input.priorOperationIds) || input.priorOperationIds.length > 1000 ||
        input.priorOperationIds.some(id => !token(id)) || new Set(input.priorOperationIds).size !== input.priorOperationIds.length ||
        !/^tb1p[a-z0-9]{20,100}$/.test(input.recipient)) fail('invalid-swap-intent');
    swap = { netSats: input.netSats, quoteFingerprint: input.quoteFingerprint, quoteExpiresAt: input.quoteExpiresAt,
      priorOperationIds: [...input.priorOperationIds].sort() };
  } else if (['netSats', 'quoteFingerprint', 'quoteExpiresAt', 'priorOperationIds'].some(key => input[key] !== undefined)) fail('invalid-operation-intent');
  let onboarding;
  if (input.kind === 'onboard') {
    // Capture the eligible original Bitcoin inputs before a funded identity is
    // restored into a page that can submit automatically. Neither a balance nor
    // an intermediate whole-input Arkade receipt describes the half-onboard intent.
    if (input.percent !== 50 || !Array.isArray(input.capturedInputs) ||
        !input.capturedInputs.length || input.capturedInputs.length > 1000) fail('invalid-onboarding-intent');
    const inputs = input.capturedInputs.map(coin => {
      if (!/^[a-f0-9]{64}$/.test(coin?.txid ?? '') || !sats(coin.vout) || coin.vout > 0xffffffff ||
          !sats(coin.value) || coin.value === 0) fail('invalid-onboarding-intent');
      return { txid: coin.txid, vout: coin.vout, value: coin.value };
    }).sort((a, b) => a.txid.localeCompare(b.txid) || a.vout - b.vout);
    const total = inputs.reduce((sum, coin) => sum + coin.value, 0);
    if (new Set(inputs.map(coin => `${coin.txid}:${coin.vout}`)).size !== inputs.length ||
        !sats(total) || input.amountSats === 0 || Math.floor(total / 2) !== input.amountSats)
      fail('invalid-onboarding-intent');
    onboarding = { percent: 50, capturedInputs: inputs };
  } else if (input.percent !== undefined || input.capturedInputs !== undefined) fail('invalid-operation-intent');
  let target;
  if (input.target !== undefined) {
    const value = input.target;
    if (!['arkade-send', 'mint','arkade-to-bitcoin-funding','claim','refund'].includes(input.kind) || !value || Object.keys(value).some(key => !['account', 'profileId', 'generation','serverSource'].includes(key)) ||
        !/^[a-f0-9]{64}$/.test(value.profileId ?? '') || !Number.isSafeInteger(value.generation) || value.generation < 1)
      fail('invalid-operation-target');
    label(value.account);
    target = { account: value.account, profileId: value.profileId, generation: value.generation,
      ...(value.serverSource===undefined?{}:{serverSource:canonicalServerSource(value.serverSource,input.network,value.profileId)}) };
  }
  if(input.kind==='arkade-to-bitcoin-funding'&&(!target||target.profileId===input.profileId))fail('invalid-operation-target');
  return { id: input.id, account: input.account, profileId: input.profileId,
    generation: input.generation, network: input.network, kind: input.kind,
    recipient: input.recipient, amountSats: input.amountSats, feeSats: input.feeSats, sourceOrigin,
    ...(input.priorProviderIds === undefined ? {} : { priorProviderIds: [...input.priorProviderIds].sort() }),
    ...onboarding, ...swap, ...(target ? { target } : {}),
    ...(input.serverSource===undefined?{}:{serverSource:canonicalServerSource(input.serverSource,input.network,input.profileId)}) };
}
function rows(state) {
  if (state.operations === undefined) state.operations = [];
  if (!Array.isArray(state.operations)) fail('operation-ledger-invalid');
  const ids = new Set();
  for (const record of state.operations) {
    const intent = canonicalIntent(record.intent);
    if (ids.has(intent.id) || record.fingerprint !== fingerprint(intent) ||
        !['prepared', 'submitting', 'pending', 'unknown', ...terminal].includes(record.state) ||
        (record.providerId !== undefined && !token(record.providerId))) fail('operation-ledger-invalid');
    ids.add(intent.id);
  }
  return state.operations;
}
function find(state, id) {
  const record = rows(state).find(row => row.intent.id === id);
  if (!record) fail('operation-not-found');
  return record;
}
function authorized(state, intent) {
  const account = findTestActor(state,intent.account);
  if (!account || account.profileId !== intent.profileId || account.generation !== intent.generation)
    fail('operation-identity-changed');
  if(JSON.stringify(actorSource(account))!==JSON.stringify(intent.serverSource)||account.server&&account.network!==intent.network)fail('operation-source-changed');
  if (!account.grant?.active || !account.grant.networks?.includes(intent.network)) fail('test-grant-unavailable');
  if (account.reportedPending?.[intent.network]) fail('external-onboarding-unreconciled');
  if (intent.target) {
    const target = findTestActor(state,intent.target.account);
    if (!target || target.profileId !== intent.target.profileId || target.generation !== intent.target.generation)
      fail('operation-target-changed');
    if(JSON.stringify(actorSource(target))!==JSON.stringify(intent.target.serverSource)||target.server&&target.network!==intent.network)fail('operation-target-changed');
    if (!target.grant?.active || !target.grant.networks?.includes(intent.network)) fail('test-target-grant-unavailable');
    if (target.reportedPending?.[intent.network]) fail('external-onboarding-unreconciled');
  }
}

// Persist in the existing encrypted, locked, atomic vault. Adapters submit only
// after the submitting marker has committed; even a crash before acknowledgement
// leaves a reservation. Unknown results must be reconciled, never auto-retried.
export class Operations {
  constructor(vault) { this.vault = vault; }
  async prepare(input) {
    const intent = canonicalIntent(input), hash = fingerprint(intent);
    return this.vault.transaction(async state => {
      await verifiedInventory(state);
      authorized(state, intent);
      const records = rows(state), existing = records.find(row => row.intent.id === intent.id);
      if (existing) {
        if (existing.fingerprint !== hash) fail('operation-intent-conflict');
        return snapshot(existing);
      }
      // Conservatively reserve the entire identity/network across applications.
      // Product input reservations still run; this does not replace them.
      const involved = [intent.profileId, intent.target?.profileId].filter(Boolean);
      if (records.some(row => !terminal.has(row.state) && row.intent.network === intent.network &&
          [row.intent.profileId, row.intent.target?.profileId].some(profile => involved.includes(profile)))) fail('operation-scope-pending');
      const now = new Date().toISOString();
      const record = { intent, fingerprint: hash, state: 'prepared', createdAt: now, updatedAt: now };
      records.push(record);
      return snapshot(record);
    });
  }
  async list() {
    return this.vault.transaction(state => rows(state).map(snapshot));
  }
  async submit(id, send) {
    label(id);
    if (typeof send !== 'function') fail('operation-adapter-required');
    const claim = await this.vault.transaction(async state => {
      await verifiedInventory(state);
      const record = find(state, id);
      authorized(state, record.intent);
      if (record.state !== 'prepared') return { send: false, record: snapshot(record) };
      record.state = 'submitting'; record.updatedAt = new Date().toISOString();
      return { send: true, record: snapshot(record) };
    });
    if (!claim.send) return claim.record;
    let providerId;
    try {
      const result = await send(snapshot(claim.record));
      if (!token(result?.providerId)) fail('operation-acknowledgement-invalid');
      providerId = result.providerId;
    } catch {
      // Never persist an exception that could carry recovery input or request data.
      return this.vault.transaction(state => {
        const record = find(state, id);
        if (record.state === 'submitting') { record.state = 'unknown'; record.updatedAt = new Date().toISOString(); }
        return snapshot(record);
      });
    }
    return this.vault.transaction(state => {
      const record = find(state, id);
      if (record.fingerprint !== claim.record.fingerprint || record.state !== 'submitting') fail('operation-state-changed');
      record.providerId = providerId;
      record.state = 'pending'; record.updatedAt = new Date().toISOString();
      return snapshot(record);
    });
  }
  async reconcile(id, observe) {
    label(id);
    if (typeof observe !== 'function') fail('operation-adapter-required');
    const before = await this.vault.transaction(state => snapshot(find(state, id)));
    if (terminal.has(before.state) || before.state === 'prepared') return before;
    // Adapters supply bounded, read-only provider/recipient observations. Acknowledgement
    // is never settlement. The original id/fingerprint scopes lookup after lost responses.
    let evidence;
    try { evidence = await observe(snapshot(before)); }
    catch { return before; }
    if (evidence?.id !== id || evidence.fingerprint !== before.fingerprint ||
        !['pending', 'settled', 'failed'].includes(evidence.outcome) || !token(evidence.providerId) ||
        (before.providerId !== undefined && before.providerId !== evidence.providerId) ||
        (evidence.outcome !== 'pending' && evidence.verified !== true)) fail('operation-evidence-mismatch');
    return this.vault.transaction(state => {
      const record = find(state, id);
      if (record.fingerprint !== before.fingerprint || record.state !== before.state ||
          record.updatedAt !== before.updatedAt) fail('operation-state-changed');
      record.providerId = evidence.providerId;
      record.state = evidence.outcome; record.updatedAt = new Date().toISOString();
      if (evidence.feeSats !== undefined) {
        if (!sats(evidence.feeSats)) fail('operation-evidence-mismatch');
        record.observedFeeSats = evidence.feeSats;
      }
      return snapshot(record);
    });
  }
  /** Add independently observed wire-fee evidence to a settled operation without changing its intent or outcome. */
  async reconcileObservedFee(id, observe) {
    label(id);
    if (typeof observe !== 'function') fail('operation-adapter-required');
    const before = await this.vault.transaction(state => snapshot(find(state, id)));
    if (before.state !== 'settled' || !before.providerId) fail('fee-reconciliation-unavailable');
    if (before.observedFeeSats !== undefined) return before;
    let evidence;
    try { evidence = await observe(snapshot(before)); }
    catch { return before; }
    const safe = value => Number.isSafeInteger(value) && value >= 0;
    if (evidence?.id !== id || evidence.fingerprint !== before.fingerprint || evidence.providerId !== before.providerId ||
        evidence.outcome !== 'settled' || evidence.verified !== true || !safe(evidence.inputSats) ||
        !safe(evidence.outputSats) || !safe(evidence.feeSats) || evidence.inputSats - evidence.outputSats !== evidence.feeSats)
      fail('operation-evidence-mismatch');
    return this.vault.transaction(state => {
      const record = find(state, id);
      if (record.fingerprint !== before.fingerprint || record.state !== 'settled' || record.providerId !== before.providerId ||
          record.observedFeeSats !== undefined) fail('operation-state-changed');
      record.observedFeeSats = evidence.feeSats;
      record.feeEvidence = { kind: 'verified-transaction-fee', transactionId: before.providerId,
        inputSats: evidence.inputSats, outputSats: evidence.outputSats, feeSats: evidence.feeSats,
        verifiedAt: new Date().toISOString() };
      return snapshot(record);
    });
  }
  async cancelPrepared(id) {
    label(id);
    return this.vault.transaction(state => {
      const record = find(state, id);
      if (record.state !== 'prepared') fail('submitted-operation-cannot-cancel');
      record.state = 'cancelled'; record.updatedAt = new Date().toISOString();
      return snapshot(record);
    });
  }
  async reconcileGuardedBoardingNotSubmitted(id:string, observe:(record:any)=>Promise<BoardingNonSubmissionEvidence>) {
    label(id);
    const before=await this.vault.transaction(state=>snapshot(find(state,id)));
    if(before.state!=='unknown'||before.providerId!==undefined||typeof observe!=='function')fail('guarded-boarding-non-submission-unavailable');
    const evidence=await observe(before);
    return this.vault.transaction(state=>{
      const record=find(state,id);
      if(record.fingerprint!==before.fingerprint||record.state!==before.state||record.updatedAt!==before.updatedAt)fail('operation-state-changed');
      const run=state.serverLifecycleRuns?.[evidence.runId];
      const resolution=verifyBoardingNonSubmission(record,run,evidence,state);
      record.state='cancelled';record.updatedAt=new Date().toISOString();record.resolution=resolution;
      run.phase='not-submitted';run.originalReconciliations=1;run.nonSubmission=structuredClone(resolution);
      return snapshot(record);
    });
  }
  /** Test harness only. This is an explicit loss disposition, never verified network failure. */
  async abandonLostPrototypeFunding(id, authorization) {
    label(id);
    if(authorization!=='user-prototype-loss-policy-2026-10-21')fail('prototype-loss-authorization-required');
    return this.vault.transaction(async state=>{
      await verifiedInventory(state);
      const record=find(state,id);
      authorized(state,record.intent);
      if(record.state==='cancelled'&&record.resolution?.authorization===authorization)return snapshot(record);
      const runId=record.intent.id.endsWith('-fund')?record.intent.id.slice(0,-5):undefined;
      const run=runId?state.treasureAdminRuns?.[runId]:undefined;
      // Only this explicitly registered Admin prototype funding reservation is
      // eligible. Claims, refunds, ordinary sends and acknowledged funding are
      // never released by the user's sandbox-loss policy.
      const lostAdminFunding=record.intent.kind==='arkade-send'&&run&&
        run.network===record.intent.network&&run.game===record.intent.profileId&&
        run.origin===record.intent.sourceOrigin&&record.intent.recipient==='treasure:'+runId&&
        !run.contractId&&!run.receipts?.length&&!run.completedAt;
      if((record.intent.kind!=='faucet'&&!lostAdminFunding)||record.state!=='unknown'||record.providerId!==undefined)fail('prototype-funding-not-lost');
      record.state='cancelled';record.updatedAt=new Date().toISOString();
      record.resolution={kind:'user-authorized-abandonment',networkOutcome:'unknown',authorization,at:record.updatedAt};
      return snapshot(record);
    });
  }
}

