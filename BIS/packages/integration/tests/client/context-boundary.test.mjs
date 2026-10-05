import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function assertNoArkadeRuntimeImport(source) {
  const runtimeImport = /^\s*import\s+(?!type\s).*from\s+['"][^'"]*wallet-layer-arkade\//m;
  assert.doesNotMatch(source, runtimeImport, 'context core must receive wallet operations through its dependency contract');
}

test('context core rejects direct Arkade runtime imports while allowing type-only contracts', () => {
  assert.throws(() => assertNoArkadeRuntimeImport("import { createAccount } from '../wallet-layer-arkade/account.ts';"));
  assertNoArkadeRuntimeImport("import type { AccountSecret } from '../wallet-layer-arkade/account.ts';");
  const source = readFileSync(new URL('../../src/client/state-layer-core/context.ts', import.meta.url), 'utf8');
  assertNoArkadeRuntimeImport(source);
});
