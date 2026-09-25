import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseVersion, validateTransition, validateVersion } from './check-release-version.mjs';

test('active published release surfaces are synchronized', async () => {
  const result = await validateReleaseVersion();
  assert.equal(result.version, '0.0.8');
});

test('accepts the initial baseline and valid patch transitions', () => {
  assert.equal(validateVersion('0.0.1'), 1);
  assert.doesNotThrow(() => validateTransition('0.0.1', '0.0.2'));
});

test('rejects invalid release shapes and non-sequential transitions', () => {
  for (const version of ['1.0.0', '0.1.1', '0.0.0', '0.0.1-beta']) {
    assert.throws(() => validateVersion(version), /Release/);
  }
  for (const [previous, current] of [['0.0.1', '0.0.1'], ['0.0.1', '0.0.3'], ['0.0.2', '0.0.1'], ['0.0.9', '0.1.0']]) {
    assert.throws(() => validateTransition(previous, current), /advance|Release/);
  }
});
