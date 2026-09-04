import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('D2a selects Receive only for active accounts and preserves other story routes', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { selectAccountStory } = await server.ssrLoadModule('/packages/integration-demo/src/admin/selectAccountStory.ts');
    for (const [id, active, expected] of [
      ['D2a', true, ['account', 'receive']], ['D2a', false, ['account']],
      ['A1', true, ['button']], ['A4', true, ['account']], ['D4', true, ['account', 'transfer']],
    ]) {
      const calls = [];
      const session = {
        context: { getState: () => ({ hasProfile: active, phase: active ? 'active' : 'idle' }), openAccountDialog: () => calls.push('account'), openAccountReceive: () => calls.push('receive'), openAccountTransfer: () => calls.push('transfer') },
        ui: { showAccountButton: () => calls.push('button') },
      };
      selectAccountStory(id, session);
      assert.deepEqual(calls, expected);
    }
    selectAccountStory('D2a', null);
  } finally { await server.close(); }
});
