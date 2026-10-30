import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actOnTreasureContract,
  checkTreasureContract,
  startTreasureContract,
  treasureContractState,
  treasurePlayerReadiness,
  treasureProfileReadiness,
  treasureStartRequest,
} from '../src/client/treasure-demo-runtime.ts';

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    revision: 0, version: 'test', disposed: false,
    account: { visible: false, hasProfile: true, phase: 'active', network: 'signet',
      playerWallet: { profileId: 'player-profile', network: 'signet' },
      gameWallet: { profileId: 'game-profile', network: 'signet' } },
    capabilities: { items: { available: false, reason: '' }, assetMinting: { available: false, reason: '' }, contracts: { available: true, reason: '' }, payments: { available: false, reason: '' } },
    equipment: {}, continuations: [], rewards: [], contracts: { status: 'ready', contracts: [] },
    ...overrides,
  } as any;
}

function contract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-reference', offerSessionId: 'contract-session', sessionId: 'contract-session',
    scope: { network: 'signet', operator: 'operator', playerId: 'player-profile', gameId: 'game-profile', exclusivityKey: 'treasure' },
    purpose: 'treasureLTO', hostReference: 'treasure:contract-session', amountSats: 1_000,
    startedAt: 1_800_000_000_000, expiresAt: 1_800_000_090_000, validationMode: 'browser-policy-v1',
    financial: 'funded', approved: true, eligibility: 'within-window', canClaim: true, canReject: true, canRefund: false,
    ...overrides,
  } as any;
}

test('wallet readiness validates Player and Game Wallet roles without storing session state', () => {
  assert.equal(treasureProfileReadiness(snapshot(), 'signet').ready, true);
  const noGame = snapshot({ account: { ...snapshot().account, gameWallet: undefined } });
  assert.equal(treasureProfileReadiness(noGame, 'signet').ready, false);
  assert.equal(treasurePlayerReadiness(noGame, 'signet').ready, true);
  assert.equal(treasureProfileReadiness(snapshot({ account: { ...snapshot().account, gameWallet: { profileId: 'player-profile', network: 'signet' } } }), 'signet').ready, true);
  assert.equal(treasureProfileReadiness(snapshot(), 'mutinynet').ready, false);
});

test('Check selects the unresolved offer while retaining older terminal history', async () => {
  const prior = contract({id:'prior', financial:'claimed', startedAt:100});
  const current = contract({id:'current', startedAt:200});
  const service = {checkContractsAsync: async () => ({status:'ready', contracts:[prior,current]})};
  assert.equal((await checkTreasureContract(service as any, snapshot(), 'signet')).contract?.id, 'current');
  const ambiguous = {checkContractsAsync: async () => ({status:'ready', contracts:[current,contract({id:'second'})]})};
  assert.equal((await checkTreasureContract(ambiguous as any, snapshot(), 'signet')).status, 'unknown');
});

test('Check asks BIS to reconcile Treasure contracts and reports only matching wallet-pair state', async () => {
  let filter: unknown;
  const service = { checkContractsAsync: async (value: unknown) => {
    filter = value;
    return { status: 'ready', contracts: [contract({ purpose: 'conditional-vault' }), contract({ scope: { ...contract().scope, gameId: 'other-game' } }), contract()] };
  } };
  const checked = await checkTreasureContract(service as any, snapshot(), 'signet');
  assert.deepEqual(filter, { purpose: 'treasureLTO', exclusivityKey: 'treasure', gameId: 'game-profile', includeResolved: true });
  assert.equal(checked.status, 'claimable');
  assert.equal(checked.contract?.id, 'contract-reference');
});

test('Check exposes unavailable operator evidence and does not infer contract state', async () => {
  const checked = await checkTreasureContract({ checkContractsAsync: async () => ({ status: 'unavailable', contracts: [] }) } as any, snapshot(), 'signet');
  assert.equal(checked.status, 'unavailable');
  assert.match(checked.message, /evidence is unavailable/);
});

test('Start checks current BIS state before starting and creates a mode-bound offer only when no unresolved offer exists', async () => {
  const calls: unknown[] = [];
  const service = {
    checkContractsAsync: async () => ({ status: 'ready', contracts: [] }),
    startContractAsync: async (request: unknown) => { calls.push(request); return { status: 'pending' }; },
  };
  const result = await startTreasureContract(service as any, snapshot(), 'signet', 'browser-policy-v1');
  assert.equal(result.status, 'pending');
  assert.equal(calls.length, 1);
  const request = calls[0] as any;
  assert.equal(request.purpose, 'treasureLTO');
  assert.equal(request.validationMode, 'browser-policy-v1');
  assert.match(request.hostReference, /^treasure:/);
  assert.equal(request.expiresAt, (Math.floor(request.startedAt / 1_000) + 90) * 1_000);
});

test('Start returns the existing unresolved contract instead of creating another one', async () => {
  let starts = 0;
  const existing = contract();
  const result = await startTreasureContract({
    checkContractsAsync: async () => ({ status: 'ready', contracts: [existing] }),
    startContractAsync: async () => { starts++; return { status: 'pending' }; },
  } as any, snapshot(), 'signet', 'browser-policy-v1');
  assert.equal(result.status, 'already-taken');
  assert.equal(result.contract?.id, existing.id);
  assert.equal(starts, 0);
});

test('Claim and Reject always query current state before requesting an eligible contract action', async () => {
  const calls: string[] = [];
  const service = {
    checkContractsAsync: async () => { calls.push('check'); return { status: 'ready', contracts: [contract()] }; },
    claimContractAsync: async (id: string) => { calls.push(`claim:${id}`); return { status: 'pending', contract: contract({ financial: 'claiming', canClaim: false }) }; },
    rejectContractAsync: async (id: string) => { calls.push(`reject:${id}`); return { status: 'pending', contract: contract({ financial: 'refunding', canReject: false }) }; },
  };
  const claimed = await actOnTreasureContract(service as any, snapshot(), 'signet', 'claim');
  const rejected = await actOnTreasureContract(service as any, snapshot(), 'signet', 'reject');
  assert.deepEqual(calls, ['check', 'claim:contract-reference', 'check', 'reject:contract-reference']);
  assert.equal(claimed.result?.contract?.financial, 'claiming');
  assert.equal(rejected.result?.contract?.financial, 'refunding');
});

test('Claim does not submit when the operator says the offer is not eligible', async () => {
  let claims = 0;
  const response = await actOnTreasureContract({ checkContractsAsync: async () => ({ status: 'ready', contracts: [contract({ eligibility: 'expired', canClaim: false, canReject: false })] }), claimContractAsync: async () => { claims++; return { status: 'pending' }; } } as any, snapshot(), 'signet', 'claim');
  assert.equal(response.check.status, 'expired');
  assert.equal(response.result, undefined);
  assert.equal(claims, 0);
});

test('state summary uses current contract financial and eligibility state', () => {
  assert.equal(treasureContractState(contract()), 'claimable');
  assert.equal(treasureContractState(contract({ financial: 'claimed' })), 'claimed');
  assert.equal(treasureContractState(contract({ financial: 'refunded' })), 'rejected');
  assert.equal(treasureContractState(contract({ financial: 'failed' })), 'no-offer');
  assert.equal(treasureContractState(contract({ financial: 'failed', recoveryRequired: true })), 'unknown');
  assert.equal(treasureContractState(contract({ financial: 'funded', eligibility: 'expired' })), 'expired');
});

test('request creation includes a unique offer reference without browser persistence', () => {
  const request = treasureStartRequest('browser-policy-v1', 1_800_000_000_000, 'fixture-id');
  assert.equal(request.offerSessionId, 'fixture-id');
  assert.equal(request.hostReference, 'treasure:fixture-id');
  assert.equal(request.expiresAt, 1_800_000_090_000);
});
