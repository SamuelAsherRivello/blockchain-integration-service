import test from 'node:test';
import assert from 'node:assert/strict';
import {ArkAddress} from '@arkade-os/sdk';
import {watchGameWalletEvents} from '../src/arkade/game-wallet-events.ts';
test('script event triggers one change callback and abort unsubscribes',async()=>{
 const address=new ArkAddress(new Uint8Array(32).fill(1),new Uint8Array(32).fill(2),'tark');
 const abort=new AbortController();let updates=0,removed=0;
 const provider={subscribeForScripts:async scripts=>{assert.deepEqual(scripts,[Buffer.from(address.pkScript).toString('hex')]);return 'fixture';},
  getSubscription:async function*(id,signal){assert.equal(id,'fixture');assert.equal(signal,abort.signal);yield {};},
  unsubscribeForScripts:async id=>{assert.equal(id,'fixture');removed++;}};
 await watchGameWalletEvents(address.encode(),abort.signal,async()=>{updates++;abort.abort();},provider);
 assert.equal(updates,1);assert.equal(removed,1);
});
