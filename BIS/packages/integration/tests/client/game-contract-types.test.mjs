import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('public game contract accepts the complete host and rejects private/missing/mutable channels', () => {
  const compiler = fileURLToPath(new URL('../../../../../node_modules/typescript/bin/tsc', import.meta.url));
  const fixture = fileURLToPath(new URL('../fixtures/tsconfig.game-contract.json', import.meta.url));
  const result = spawnSync(process.execPath, [compiler, '--project', fixture], { encoding: 'utf8', timeout: 60000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
