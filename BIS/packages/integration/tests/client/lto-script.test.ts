import test from 'node:test';
import assert from 'node:assert/strict';
import { SingleKey, ConditionMultisigTapscript, ConditionCSVMultisigTapscript, CSVMultisigTapscript, MultisigTapscript, VtxoScript } from '@arkade-os/sdk';
import {Script} from '@scure/btc-signer';
import { buildLtoScript } from '../../src/client/wallet-layer-arkade/lto-script.ts';

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

test('Sandbox same-wallet opt-in preserves the exact canonical four-leaf artifact',()=>{
 const sameWallet={...params,gameKey:params.playerKey};
 assert.throws(()=>buildLtoScript(sameWallet));assert.throws(()=>buildLtoScript({...sameWallet,prototypeSameWallet:false}));
 const result=buildLtoScript({...sameWallet,prototypeSameWallet:true}),conditionScript=Script.encode(['SHA256',params.secretHash,'EQUAL']),timelock={type:'seconds' as const,value:params.exitDelay};
 const canonical=new VtxoScript([
  ConditionMultisigTapscript.encode({conditionScript,pubkeys:[params.playerKey,params.operatorKey]}).script,
  MultisigTapscript.encode({pubkeys:[params.playerKey,params.operatorKey]}).script,
  ConditionCSVMultisigTapscript.encode({conditionScript,pubkeys:[params.playerKey],timelock}).script,
  CSVMultisigTapscript.encode({pubkeys:[params.playerKey],timelock}).script,
 ]);
 assert.deepEqual(result.script.encode(),canonical.encode());assert.deepEqual(result.script.pkScript,canonical.pkScript);
 const ordinary=buildLtoScript(params).script.encode();
 assert.deepEqual(buildLtoScript({...params,prototypeSameWallet:true}).script.encode(),ordinary);
 assert.deepEqual(buildLtoScript({...params,prototypeSameWallet:false}).script.encode(),ordinary);
});

test('Sandbox opt-in never relaxes operator separation, key sizes or explicit boolean scope',()=>{
 for(const override of [{operatorKey:params.playerKey},{operatorKey:params.gameKey},{playerKey:new Uint8Array(31)},{gameKey:new Uint8Array(33)},{operatorKey:new Uint8Array(0)},{secretHash:new Uint8Array(31)},{exitDelay:0n}])assert.throws(()=>buildLtoScript({...params,prototypeSameWallet:true,...override}));
 for(const prototypeSameWallet of ['true',1,null])assert.throws(()=>buildLtoScript({...params,gameKey:params.playerKey,prototypeSameWallet} as any));
});
