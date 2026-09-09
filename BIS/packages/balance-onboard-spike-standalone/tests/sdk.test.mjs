import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Ramps,ArkAddress} from '@arkade-os/sdk';
test('installed SDK constructs exact half and Bitcoin change with the zero fee schedule',async()=>{
 const own=new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 let captured;
 const facade={getAddress:async()=>own,getBoardingAddress:async()=>'bitcoin-change',settle:async params=>{captured=params;return 'captured-only';}};
 const coins=[{txid:'a'.repeat(64),vout:0,value:10001}];
 await new Ramps(facade).onboard({txFeeRate:'0',intentFee:{}},coins,5000n);
 assert.deepEqual(captured.outputs,[{address:own,amount:5000n},{address:'bitcoin-change',amount:5001n}]);
 assert.deepEqual(captured.inputs,coins);
});
