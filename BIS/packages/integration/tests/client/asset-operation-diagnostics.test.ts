import test from 'node:test';
import assert from 'node:assert/strict';
import { assetDiagnostic, assetDiagnosticCode, diagnoseAssetFailure } from '../../src/client/state-layer-core/asset-operation-diagnostics.ts';

test('diagnostics map actionable reasons without exposing provider text', () => {
  assert.equal(assetDiagnosticCode('unavailable', 'reserved-inputs'), 'reserved-inputs');
  assert.equal(assetDiagnosticCode('unavailable', 'provider'), 'provider-unavailable');
  assert.equal(assetDiagnosticCode('insufficient-funds'), 'insufficient-spendable-funds');
  const diagnostic = assetDiagnostic({ phase: 'mint', code: 'unavailable', hint: 'provider', profileId: 'p', operationId: 'op', network: 'signet' });
  assert.deepEqual(diagnostic, {
    phase: 'mint', code: 'provider-unavailable', message: 'The selected network provider could not verify current wallet state.',
    profileId: 'p', operationId: 'op', network: 'signet', recoverable: true, submitted: false,
  });
  assert.ok(!JSON.stringify(diagnostic).includes('private provider exception'));
  const hostile = diagnoseAssetFailure({ phase: 'listing', error: new Error('mnemonic=secret private sdk payload'), profileId: 'p' });
  assert.equal(hostile.code, 'provider-unavailable');
  assert.equal(hostile.message, 'The selected network provider could not verify current wallet state.');
  assert.ok(!JSON.stringify(hostile).includes('mnemonic'));
});

test('unknown results are recoverable and preserve the original operation identity', () => {
  const diagnostic = assetDiagnostic({ phase: 'catalog', code: 'outcome-unknown', operationId: 'stable-op', itemName: 'Shoes I' });
  assert.equal(diagnostic.code, 'outcome-unknown');
  assert.equal(diagnostic.submitted, true);
  assert.equal(diagnostic.recoverable, true);
  assert.equal(diagnostic.operationId, 'stable-op');
  assert.equal(diagnostic.itemName, 'Shoes I');
});
