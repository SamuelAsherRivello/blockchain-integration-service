import { observe } from './observations.mjs';
import { readinessTarget, boundedObservation } from './readiness.mjs';
import { readLogoutCount } from './browser-public.mjs';
import { fail } from './errors.mjs';

export async function ownedReadiness(owner, request, adapters = {}) {
  const allowed = ['command', 'live', 'role', 'expect', 'bitcoin', 'arkade'];
  if (!request || request.command !== 'status' || request.live !== true ||
      Object.keys(request).some(key => !allowed.includes(key)) ||
      request.role !== undefined && !['player', 'game'].includes(request.role)) fail('invalid-readiness-request');
  readinessTarget(request); // Validate before touching vault or browser.
  const signal = AbortSignal.timeout(45000);
  let before;
  try { before = await boundedObservation(() => owner.inspect(), signal); }
  catch {
    await owner.close();
    fail('owned-readiness-context-unavailable');
  }
  if (before.mode !== 'owned' || owner.loggedOut || owner.closed) fail('owned-readiness-context-unavailable');
  const { application, pair } = owner.registration;
  const account = owner.registration[request.role ?? 'player'];
  const pending = async () => {
    await owner.inspect();
    return readLogoutCount(owner.page);
  };
  let result;
  try {
    result = await boundedObservation(() => observe(owner.vault, { account: account.label, network: pair.network,
      expect: request.expect, bitcoin: request.bitcoin, arkade: request.arkade }, { ...adapters, pending: adapters.pending ?? pending }), signal);
    await boundedObservation(() => owner.inspect(), signal);
  } catch {
    await owner.close();
    fail('owned-readiness-context-unavailable');
  }
  return { ...result, mode: 'owned', app: application.app, origin: application.origin,
    journalScope: 'selected-application-all-retained-wallets-and-networks' };
}
