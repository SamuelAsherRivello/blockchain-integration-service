import test from 'node:test';
import assert from 'node:assert/strict';
import { createContextWithDependencies } from '../../src/client/state-layer-core/context.ts';
import { createArkadeContextDependencies } from '../../src/client/wallet-layer-arkade/context-dependencies.ts';

test('named wallet dependencies preserve the context lifecycle seam', async () => {
  const identity = {profileId:'dependency-profile',phrase:'dependency-only'};
  const dependencies = createArkadeContextDependencies({
    create: async () => identity,
    identifyAccount: async () => identity.profileId,
  });
  const storage = {
    load: async () => ({account:null,generation:0}),
    save: async () => {},
    reset: async () => {},
    subscribe: () => () => {},
  };
  const context = createContextWithDependencies(storage, dependencies);
  await context.readyAsync();
  await context.createAccount();
  await context.continueAccount();
  assert.equal(context.getState().profileId, identity.profileId);
  context.dispose();
});
