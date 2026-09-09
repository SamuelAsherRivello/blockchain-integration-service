import test from 'node:test';
import assert from 'node:assert/strict';
import { SingleKey, ConditionMultisigTapscript, MultisigTapscript, VtxoScript } from '@arkade-os/sdk';
import { buildLtoScript } from '../src/arkade/lto-script.ts';

const keys = await Promise.all([1,2,3].map(() => SingleKey.fromRandomBytes().xOnlyPublicKey()));
const params = { playerKey:keys[0], gameKey:keys[1], operatorKey:keys[2], secretHash:new Uint8Array(32).fill(8), exitDelay:512n };
test('LTO binds claim to player and secret, refund to game, and both to the operator', () => {
  const result=buildLtoScript(params);
  const claim=ConditionMultisigTapscript.decode(result.claim);
  const refund=MultisigTapscript.decode(result.refund);
  assert.deepEqual(claim.params.pubkeys,[keys[0],keys[2]]);
  assert.deepEqual(refund.params.pubkeys,[keys[1],keys[2]]);
  assert.equal(result.script.scripts.length,4);
  assert.deepEqual(VtxoScript.decode(result.script.encode()).pkScript,result.script.pkScript);
  assert.notDeepEqual(buildLtoScript({...params,secretHash:new Uint8Array(32).fill(9)}).script.pkScript,result.script.pkScript);
});
test('LTO rejects missing identity separation and malformed parameters', () => {
  for(const override of [{gameKey:keys[0]},{operatorKey:keys[1]},{secretHash:new Uint8Array(0)},{playerKey:new Uint8Array(31)},{exitDelay:0n}]) {
    assert.throws(()=>buildLtoScript({...params,...override}));
  }
});
