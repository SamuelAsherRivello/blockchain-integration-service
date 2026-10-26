import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectTreasureDirectPolicy} from '../../src/client/wallet-layer-arkade/treasure-direct-policy.ts';
const info={network:'mutinynet',signerPubkey:'02'+'11'.repeat(32),fees:{txFeeRate:'0',
  intentFee:{offchainInput:"inputType == 'vtxo' && now() - birth < 86400.0 ? amount * 0.002 : 0.0"}},
  dust:330n,vtxoMinAmount:1n,vtxoMaxAmount:-1n};
test('direct treasure policy separates SubmitTx fees from unqualified intent fees',()=>{
  assert.equal(inspectTreasureDirectPolicy('mutinynet',info).route,'direct-only');
  assert.notEqual(inspectTreasureDirectPolicy('mutinynet',info).fingerprint,
    inspectTreasureDirectPolicy('mutinynet',{...info,fees:{...info.fees,intentFee:{offchainInput:'0'}}}).fingerprint);
});
test('direct treasure policy rejects unknown or nonzero direct fees and incompatible limits',()=>{
  for(const change of [{network:'signet'},{fees:{txFeeRate:'0.1'}},{fees:{txFeeRate:''}},{fees:{txFeeRate:'fee()'}},
    {fees:undefined},{vtxoMinAmount:1001n},{vtxoMaxAmount:999n},{dust:1001n},{dust:-1n}])
    assert.throws(()=>inspectTreasureDirectPolicy('mutinynet',{...info,...change}));
});
