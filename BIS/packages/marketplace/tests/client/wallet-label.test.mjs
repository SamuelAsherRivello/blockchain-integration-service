import test from 'node:test';
import assert from 'node:assert/strict';
import {walletAddressLabel} from '../../src/client/marketplace-layer/wallet-label.ts';

test('address labels distinguish ready, selected loading, unavailable, and disconnected',()=>{
  assert.deepEqual(walletAddressLabel({address:'tark1-player-address',selected:true}),{text:'tark1-p…ddress',title:'tark1-player-address'});
  assert.equal(walletAddressLabel({selected:true}).text,'Loading…');
  assert.equal(walletAddressLabel({selected:false,loading:true}).text,'Loading…');
  assert.equal(walletAddressLabel({selected:true,unavailable:true}).text,'Unavailable');
  assert.equal(walletAddressLabel({selected:false}).text,'Not connected');
});
