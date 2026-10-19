import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVaultCapability} from '../../integration/src/client/wallet-layer-arkade/conditional-vault-capability.ts';
const key=Buffer.from('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798','hex');
for(const network of ['signet','mutinynet'] as const)test(`${network}: sub-dust covenant funding fails before emulator access or submission`,async()=>{
 let emulatorCalls=0;
 const dependencies={ark:{getInfo:async()=>({network,signerPubkey:`02${key.toString('hex')}`,unilateralExitDelay:2048n,vtxoMinAmount:1n,vtxoMaxAmount:-1n,dust:1001n,fees:{txFeeRate:'0',intentFee:{}}})},
 indexer:{getVtxos:async()=>{throw Error('must not query');}},emulatorInfo:async()=>{emulatorCalls++;throw Error('must not trust');}};
 await assert.rejects(inspectVaultCapability(network,key,dependencies as never),/principal-below-taproot-dust/);
 assert.equal(emulatorCalls,0);
});
