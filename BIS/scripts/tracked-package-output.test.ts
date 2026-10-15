import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('package output directories contain no tracked artifacts', () => {
  const tracked = execFileSync('git', ['ls-files', 'BIS/packages'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((path) => /^BIS\/packages\/[^/]+\/output\//.test(path));

  assert.deepEqual(tracked, []);
});
