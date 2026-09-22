import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('B.P.3 selects Receive only for active accounts and preserves other story routes', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { selectAccountStory } = await server.ssrLoadModule('/BIS/packages/integration-demo/src/admin/selectAccountStory.ts');
    for (const [id, active, expected] of [
      ['B.P.3', true, ['account', 'receive']], ['B.P.3', false, ['account']],
      ['B.P.5', true, ['account', 'send']], ['B.P.5', false, ['account']],
      ['A.P.1', true, ['button']], ['A.P.4', true, ['account']], ['B.P.7', true, ['account', 'transfer']], ['B.P.8', true, ['account', 'onboarding']], ['E.P.1', true, ['account', 'activity']],
    ]) {
      const calls = [];
      const session = {
        context: { getState: () => ({ hasProfile: active, phase: active ? 'active' : 'idle' }), openAccountDialog: () => calls.push('account'), openAccountReceive: () => calls.push('receive'), openAccountSend: () => calls.push('send'), openAccountTransfer: () => calls.push('transfer'), openAccountOnboarding: () => calls.push('onboarding'), openAccountActivity: () => calls.push('activity') },
        ui: { showAccountButton: () => calls.push('button') },
      };
      selectAccountStory(id, session);
      assert.deepEqual(calls, expected);
    }
    selectAccountStory('B.P.3', null);
  } finally { await server.close(); }
});
