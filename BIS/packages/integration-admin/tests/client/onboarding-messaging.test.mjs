import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('onboarding copy follows readiness and keeps the requested line break', async () => {
  const source = await readFile(new URL('../../../integration/src/client/ui-layer-react/AccountOnboarding.tsx', import.meta.url), 'utf8');
  assert.match(source, /done\?<p>Your account is already funded and ready to use\.<\/p>:<p>You must fund the account per step 2\.<br \/>Then wait for onboarding to finish\.<\/p>/);
  assert.doesNotMatch(source, /Otherwise sit back and wait for completion/);
});

test('onboarding does not surface the shared transient balance error', async () => {
  const source = await readFile(new URL('../../../integration/src/client/ui-layer-react/client.tsx', import.meta.url), 'utf8');
  const fixture = await readFile(new URL('./onboarding-host.tsx', import.meta.url), 'utf8');
  assert.match(source, /!onboarding && !assets && !activity && data\?\.status === 'unavailable'/);
  assert.match(fixture, /balanceUnavailable=true/);
  assert.match(fixture, /Balances could not be loaded/);
  assert.match(fixture, /Onboarding hides transient balance error/);
});
