import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Ramps,ArkAddress} from '@arkade-os/sdk';
test('installed SDK full boarding never mixes Bitcoin inputs and Bitcoin outputs',async()=>{
 const own=new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark').encode();
 let captured;
 const facade={getAddress:async()=>own,getBoardingAddress:async()=>'bitcoin-change',settle:async params=>{captured=params;return 'captured-only';}};
 const coins=[{txid:'a'.repeat(64),vout:0,value:10001}];
 await new Ramps(facade).onboard({txFeeRate:'0',intentFee:{}},coins,10001n);
 assert.deepEqual(captured.outputs,[{address:own,amount:10001n}]);
 assert.deepEqual(captured.inputs,coins);
});
