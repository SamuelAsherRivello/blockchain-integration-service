import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceGameInventoryAddress as address } from '../../src/client/inventory-layer/inventory-source.ts';
test('eligible session inventory uses the Game Wallet rather than the published default',()=>{
  const input={registeredAddress:'published',playerProfileId:'player',gameProfileId:'game',sessionAddress:'owned',network:'signet',gameNetwork:'signet'};
  assert.equal(address(input),'owned');
  assert.equal(address({...input,sessionAddress:'replacement'}),'replacement');
  assert.equal(address({...input,network:'mutinynet'}),'published');
  assert.equal(address({...input,gameProfileId:undefined}),'published');
  assert.equal(address({...input,playerProfileId:undefined}),'published');
  assert.equal(address({...input,sessionAddress:undefined}),undefined);
});
