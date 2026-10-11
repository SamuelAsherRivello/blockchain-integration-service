import { createHash } from 'node:crypto';
import { Operations } from './operations.mjs';
import { fail } from './errors.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const terminal = new Set(['settled', 'failed', 'cancelled']);
const names = new Set(['mint-delivery', 'burn', 'contract-claim', 'contract-refund']);
const token = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value);
export function validateGuardedScenario(request) {
  const allowed = ['command', 'scenario', 'operation', ...(request?.scenario === 'mint-delivery' ? ['destination'] :
    request?.scenario === 'burn' ? ['assetId', 'quantity'] : ['contractId'])];
  if (!request || request.command !== 'run' || !names.has(request.scenario) ||
      !/^[a-z][a-z0-9-]{0,47}$/.test(request.operation ?? '') || Object.keys(request).some(key => !allowed.includes(key)) ||
      (request.scenario === 'mint-delivery' && !['player', 'game'].includes(request.destination)) ||
      (request.scenario === 'burn' && (!/^[a-f0-9]{68}$/.test(request.assetId ?? '') ||
        !/^[1-9][0-9]{0,19}$/.test(request.quantity ?? '') || BigInt(request.quantity) > 18446744073709551615n)) ||
      (request.scenario.startsWith('contract-') && !token(request.contractId))) fail('invalid-guarded-scenario');
  return request;
}

// Production readers validate their own records. Only this public projection
// crosses the browser boundary; contract recovery secrets never enter the runner.
export async function publicAssetOperations(owner, kind) {
  const { pair, player, game } = owner.registration;
  return owner.page.evaluate(async ({ kind, network, profileId }) => {
    const base = '/BIS/packages/integration/src/client/state-layer-core/';
    if (kind === 'burn') {
      const { readBurnRecords } = await import(`${base}burning.ts`);
      return readBurnRecords(profileId, network).map(row => ({ id: row.id, assetId: row.request.assetId,
        quantity: row.request.quantity, status: row.status, transactionId: row.transactionId }));
    }
    const { readAssetRecords } = await import(`${base}assets.ts`);
    const { readAssetDeliveryRecords } = await import(`${base}asset-delivery.ts`);
    const deliveries = readAssetDeliveryRecords(profileId, network);
    return readAssetRecords(profileId, network).map(row => {
      const delivery = deliveries.find(item => item.id === `${row.request.operationId}-delivery`);
      return { id: row.request.operationId, name: row.request.name, ticker: row.request.ticker,
        amount: row.request.amount, decimals: row.request.decimals, status: row.status,
        assetId: row.asset?.assetId, quantity: row.asset?.quantity, transactionId: row.transactionId,
        ...(delivery ? { delivery: { id: delivery.id, assetId: delivery.request.assetId,
          quantity: delivery.request.quantity, recipient: delivery.request.recipient,
          status: delivery.status, transactionId: delivery.transactionId } } : {}) };
    });
  }, { kind, network: pair.network, profileId: kind === 'burn' ? player.profileId : game.profileId });
}

export function matchingAssetOperation(rows, operation, request) {
  if (!Array.isArray(rows) || rows.length > 1000) fail('scenario-journal-unavailable');
  const matching = rows.filter(row => token(row?.id) &&
    (operation.providerId ? row.id === operation.providerId : !operation.intent.priorProviderIds.includes(hash(row.id))) &&
    (request.scenario === 'burn' ? row.assetId === request.assetId && row.quantity === request.quantity :
      row.name === `BIS test ${request.operation}` && row.ticker === 'BISTEST' && row.amount === '1' && row.decimals === 0));
  if (matching.length > 1) fail('scenario-journal-ambiguous');
  return matching[0];
}

async function report(owner, screen) {
  await owner.navigate(screen);
  await owner.page.locator('.bis-collection[aria-busy="false"]').waitFor();
  return owner.page.getByLabel(`${screen} raw data preview`, { exact: true }).inputValue();
}
export function parseContractReport(text) {
  if (typeof text !== 'string' || text.length > 1000000) fail('scenario-contract-unavailable');
  if (!text.trim()) return [];
  return text.split('\n\n').map(block => {
    const field = key => block.split('\n').find(line => line.startsWith(`${key}: `))?.slice(key.length + 2);
    const row = { id: field('Contract ID'), network: field('Network'), role: field('Role'),
      amountSats: Number(field('Amount')?.replace(/ sats$/, '')), financial: field('Funds'),
      evidence: field('Evidence'), operationId: field('Operation'), transactionId: field('Current transaction') };
    if (!token(row.id) || !['Signet', 'Mutinynet'].includes(row.network) || !['player', 'game'].includes(row.role) ||
        !Number.isSafeInteger(row.amountSats) || row.amountSats <= 0) fail('scenario-contract-unavailable');
    return row;
  });
}
async function contracts(owner) { return parseContractReport(await report(owner, 'Contracts')); }
async function selectContract(owner, request) {
  const rows = await contracts(owner), index = rows.findIndex(row => row.id === request.contractId);
  if (index < 0) fail('scenario-contract-not-found');
  await owner.page.locator('.bis-collection-list .bis-collection-item').nth(index).click();
  await owner.page.getByRole('heading', { name: 'Contract Details', exact: true }).waitFor();
  return rows[index];
}
async function stage(owner, request) {
  if (request.scenario === 'mint-delivery') {
    if (owner.registration.application.app !== 'admin') fail('scenario-requires-admin');
    await owner.accountMenu();
    await owner.page.locator('.bis-card').last().getByRole('button', { name: 'Back', exact: true }).click();
    await owner.page.getByRole('button', { name: /^C\.G\.1\. Mint Asset & Send$/ }).click();
    await owner.page.getByRole('heading', { name: 'Mint Asset', exact: true }).waitFor();
    await owner.page.getByLabel('Destination', { exact: true }).selectOption(request.destination);
    await owner.page.getByLabel('Name *', { exact: true }).fill(`BIS test ${request.operation}`);
    await owner.page.getByLabel('Ticker *', { exact: true }).fill('BISTEST');
    await owner.page.getByLabel('Amount *', { exact: true }).fill('1');
    await owner.page.getByLabel('Decimals', { exact: true }).fill('0');
    await owner.page.getByLabel('Icon URL', { exact: true }).fill('');
    await owner.page.waitForFunction(() => {
      const output = document.querySelector('#mint-console');
      return output && output.textContent !== 'Checking destination…';
    }, undefined, { timeout: 20000 });
    return;
  }
  if (request.scenario === 'burn') {
    const text = await report(owner, 'Assets');
    const blocks = text.trim() ? text.split('\n\n') : [];
    const index = blocks.findIndex(block => block.split('\n').includes(`Asset ID: ${request.assetId}`));
    if (index < 0 || !blocks[index].split('\n').includes(`Owned quantity (base units): ${request.quantity}`)) fail('scenario-asset-mismatch');
    await owner.page.locator('.bis-collection-list .bis-collection-item').nth(index).click();
    await owner.page.getByRole('button', { name: 'Burn', exact: true }).click();
    await owner.page.getByRole('dialog', { name: 'Confirmation', exact: true }).waitFor();
  } else await selectContract(owner, request);
}
async function confirm(owner, request) {
  // Account layers can be temporarily absent while Admin's mint dialog is open.
  await owner.validateRegistration();
  const url = new URL(owner.page.url()), app = owner.registration.application;
  if (url.origin !== app.origin || url.pathname !== app.path ||
      (app.app === 'game' && url.search !== app.search)) fail('scenario-context-mismatch');
  if (request.scenario === 'mint-delivery') {
    // The prepared production target rechecks wallet identity/network on submit.
    // Verify the public draft too, including after a prepared-operation restart.
    for (const [label, value] of [['Destination', request.destination], ['Name *', `BIS test ${request.operation}`],
      ['Ticker *', 'BISTEST'], ['Amount *', '1'], ['Decimals', '0'], ['Icon URL', '']])
      if (await owner.page.getByLabel(label, { exact: true }).inputValue() !== value) fail('scenario-draft-mismatch');
  } else {
    if ((await owner.inspect()).mode !== 'owned') fail('scenario-owned-session-required');
    const text = await owner.page.getByLabel(request.scenario === 'burn' ? 'Asset details' : 'Contract', { exact: true }).inputValue();
    if (request.scenario === 'burn' ? !text.split('\n').includes(`Asset ID: ${request.assetId}`) ||
      !text.split('\n').includes(`Owned quantity (base units): ${request.quantity}`) :
      !text.split('\n').includes(`Contract ID: ${request.contractId}`)) fail('scenario-draft-mismatch');
  }
  const name = request.scenario === 'mint-delivery' ? 'Mint' : request.scenario === 'burn' ? 'OK' :
    request.scenario === 'contract-claim' ? 'Claim' : 'Refund to game';
  const button = request.scenario === 'burn' ? owner.page.getByRole('dialog', { name: 'Confirmation', exact: true }).getByRole('button', { name, exact: true }) :
    owner.page.getByRole('button', { name, exact: true });
  if (!await button.isEnabled()) fail('scenario-product-guard-refused');
  await button.click();
}

export async function runGuardedScenario(owner, request, adapters = {}) {
  validateGuardedScenario(request);
  let inspection;
  try { inspection = await owner.inspect(); }
  catch {
    // A busy Admin mint dialog has no Account layer. Recovery may only inspect
    // the saved original action; this exception must never create/confirm one.
    const original = request.scenario === 'mint-delivery' ?
      (await new Operations(owner.vault).list()).find(row => row.intent.id === request.operation) : undefined;
    if (!original || original.state === 'prepared' || owner.closed || owner.registration?.application.app !== 'admin' ||
        !await owner.page.getByRole('heading', { name: 'Mint Asset', exact: true }).isVisible()) fail('scenario-context-unavailable');
    await owner.validateRegistration();
    const url = new URL(owner.page.url()), app = owner.registration.application;
    if (url.origin !== app.origin || url.pathname !== app.path) fail('scenario-context-mismatch');
    inspection = { mode: 'owned' };
  }
  if (inspection.mode !== 'owned') fail('scenario-owned-session-required');
  const { player, game, pair, application } = owner.registration;
  const kind = request.scenario === 'mint-delivery' ? 'mint' : request.scenario === 'burn' ? 'burn' : request.scenario.slice(9);
  const account = ['mint', 'refund'].includes(kind) ? game : player;
  const target = kind === 'mint' && request.destination === 'player' ?
    { account: player.label, profileId: player.profileId, generation: player.generation } : undefined;
  const recipient = kind === 'mint' ? `sample:${request.operation}:${request.destination}:${player.profileId}` :
    kind === 'burn' ? `${request.assetId}:${request.quantity}` : request.contractId;
  const ledger = adapters.ledger ?? new Operations(owner.vault);
  const finish = async result => {
    if (kind === 'mint' && !adapters.confirm) {
      // Closing a completed/unknown UI result retains its production journal.
      // An active submission keeps the normal disabled Close guard and its page.
      try {
        if (typeof owner.page.waitForFunction === 'function') await owner.page.waitForFunction(() => {
          const button = document.querySelector('button[aria-label="Close Mint Asset"]');
          return !button || !button.disabled;
        }, undefined, { timeout: 5000 });
        const close = owner.page.getByRole('button', { name: 'Close Mint Asset', exact: true });
        if (await close.count() && await close.isEnabled()) await close.click();
      } catch { /* Preserve the busy dialog; a later run only reconciles it. */ }
    }
    return result;
  };
  const read = () => kind === 'claim' || kind === 'refund' ? (adapters.contracts ?? contracts)(owner) :
    (adapters.records ?? publicAssetOperations)(owner, kind);
  let operation = (await ledger.list()).find(row => row.intent.id === request.operation);
  if (operation) {
    const i = operation.intent;
    if (i.kind !== kind || i.profileId !== account.profileId || i.generation !== account.generation ||
        i.network !== pair.network || i.sourceOrigin !== application.origin || i.recipient !== recipient ||
        JSON.stringify(i.target) !== JSON.stringify(target)) fail('operation-intent-conflict');
  } else {
    const prior = await read();
    if (!Array.isArray(prior) || prior.some(row => !token(row.id))) fail('scenario-journal-unavailable');
    await (adapters.stage ?? stage)(owner, request);
    const contract = ['claim', 'refund'].includes(kind) ? prior.find(row => row.id === request.contractId) : undefined;
    if (['claim', 'refund'].includes(kind) && (!contract || contract.network !== (pair.network === 'signet' ? 'Signet' : 'Mutinynet') ||
        contract.role !== (kind === 'claim' ? 'player' : 'game') || contract.financial !== 'funded')) fail('scenario-contract-mismatch');
    operation = await ledger.prepare({ id: request.operation, account: account.label, profileId: account.profileId,
      generation: account.generation, network: pair.network, kind, recipient, amountSats: contract?.amountSats ?? 0,
      feeSats: null, sourceOrigin: application.origin, priorProviderIds: prior.map(row => hash(row.id)), ...(target ? { target } : {}) });
  }
  if (terminal.has(operation.state)) return finish({ operation, readiness: operation.state === 'settled' ? 'scenario-verified' : 'incomplete' });
  const match = rows => ['claim', 'refund'].includes(kind) ? rows.find(row => row.id === request.contractId &&
    row.network === (pair.network === 'signet' ? 'Signet' : 'Mutinynet') && row.role === (kind === 'claim' ? 'player' : 'game') &&
    row.amountSats === operation.intent.amountSats && !['funding', 'funded'].includes(row.financial)) : matchingAssetOperation(rows, operation, request);
  if (operation.state === 'prepared') {
    // A prepared retry may have lost its dialog; do not recreate a UI request.
    operation = await ledger.submit(request.operation, async () => {
      await (adapters.confirm ?? confirm)(owner, request);
      for (let attempt = 0; attempt < 20; attempt++) {
        const row = match(await read());
        if (row) return { providerId: ['claim', 'refund'].includes(kind) ? row.operationId : row.id };
        await (adapters.pause ?? (ms => owner.page.waitForTimeout(ms)))(250);
      }
      fail('scenario-acknowledgement-unavailable');
    });
  }
  try {
    const row = match(await read());
    if (row) {
      let settled = false;
      if (kind === 'burn') settled = row.status === 'succeeded' && /^[a-f0-9]{64}$/.test(row.transactionId ?? '');
      if (kind === 'mint') settled = row.status === 'succeeded' && /^[a-f0-9]{68}$/.test(row.assetId ?? '') && row.quantity === '1' &&
        (request.destination === 'game' || row.delivery?.assetId === row.assetId && row.delivery.quantity === '1' &&
          row.delivery.recipient === owner.expected.player.arkadeAddress && row.delivery.status === 'succeeded' && /^[a-f0-9]{64}$/.test(row.delivery.transactionId ?? ''));
      if (['claim', 'refund'].includes(kind)) settled = row.financial === (kind === 'claim' ? 'claimed' : 'refunded') &&
        row.evidence === 'verified receipt' && /^[a-f0-9]{64}$/.test(row.transactionId ?? '');
      const providerId = ['claim', 'refund'].includes(kind) ? row.operationId : row.id;
      if (token(providerId)) operation = await ledger.reconcile(request.operation, async record => ({ id: request.operation,
        fingerprint: record.fingerprint, providerId, outcome: settled ? 'settled' : 'pending', verified: settled }));
      return finish({ operation, readiness: operation.state === 'settled' ? 'scenario-verified' : 'pending',
        ...(/^[a-f0-9]{68}$/.test(row.assetId ?? '') ? { assetId: row.assetId } : {}),
        ...(/^[a-f0-9]{64}$/.test(row.transactionId ?? '') ? { transactionId: row.transactionId } : {}) });
    }
  } catch { return finish({ operation, readiness: 'pending', reason: 'scenario-evidence-unavailable' }); }
  return finish({ operation, readiness: 'pending', reason: 'original-operation-unresolved' });
}
