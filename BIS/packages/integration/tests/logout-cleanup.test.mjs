import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingLogoutOperations, clearBrowserPreferences } from '../src/core/logout-cleanup.ts';

function memory(entries = []) {
  const data = new Map(entries);
  return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
}
test('player logout preserves game wallet boarding recovery, including additional operations', () => {
  const keys = ['bis-signet-boarding-operation-v1:game', 'bis-signet-boarding-operation-v1:game:operation:two'];
  const storage = memory([
    ['bis-game-wallet-boarding-owner:game', '1'],
    ...keys.map(key => [key, JSON.stringify({id:key,profileId:'game',status:'pending'})]),
    ['bis-signet-boarding-operation-v1:player', JSON.stringify({id:'player',profileId:'player',status:'succeeded'})],
  ]);
  assert.equal(pendingLogoutOperations(storage).count, 0);
  clearBrowserPreferences(storage);
  for (const key of keys) assert.ok(storage.getItem(key));
  assert.equal(storage.getItem('bis-signet-boarding-operation-v1:player'),null);
});
test('counts all pending operations, deduplicates legacy journals, excludes completed operations', () => {
  const transfer = JSON.stringify({id:'one',profileId:'a',status:'pending'});
  const storage = memory([
    ['bis-signet-boarding-operation-v1', transfer],
    ['bis-signet-boarding-operation-v1:a', transfer],
    ['bis-signet-send-operation-v1:b', JSON.stringify({id:'two',profileId:'b',status:'pending'})],
    ['bis-signet-mints-v1:a', JSON.stringify({operations:[{request:{operationId:'three'},status:'pending'},{request:{operationId:'four'},status:'succeeded'}]})],
    ['unrelated', 'private host value'],
  ]);
  assert.equal(pendingLogoutOperations(storage).count, 3);
  const before = pendingLogoutOperations(storage).fingerprint;
  storage.setItem('bis-signet-send-operation-v1:b', JSON.stringify({id:'replacement',profileId:'b',status:'pending'}));
  assert.notEqual(pendingLogoutOperations(storage).fingerprint, before);
});
test('clears only BIS-owned web storage and verifies removal', () => {
  const storage = memory([['bis-signet-send-operation-v1:a',JSON.stringify({id:'done',profileId:'a',status:'succeeded'})],['bis.integration-demo.preview-scale','1'],['other-app','keep']]);
  clearBrowserPreferences(storage);
  assert.equal(storage.length,1);
  assert.equal(storage.getItem('other-app'),'keep');
  assert.throws(()=>clearBrowserPreferences({...memory([['bis.integration-demo.preview-scale','1']]), removeItem:()=>{}}));
});

test('logout clears unresolved transfer and cancellation records for player accounts', () => {
  for(const profileId of ['current-player','previous-player']) {
    const key=`bis-signet-boarding-operation-v1:${profileId}`;
    const raw=JSON.stringify({id:'unresolved',profileId,status:'pending',phase:'registered',cancellation:{status:'pending'}});
    const storage=memory([[key,raw],['bis.integration-demo.preview-scale','1']]);
    assert.doesNotThrow(()=>clearBrowserPreferences(storage));
    assert.equal(storage.getItem(key),null);
    assert.equal(storage.length,0);
  }
});
test('unreadable operation data does not silently become zero pending', () => {
  assert.throws(()=>pendingLogoutOperations(memory([['bis-signet-send-operation-v1:a','broken']])));
});

 test('logout clears unreadable recovery journals and preferences', () => {
  const storage=memory([['bis-signet-send-operation-v1:a','broken'],['bis.integration-demo.preview-scale','1']]);
  assert.doesNotThrow(()=>clearBrowserPreferences(storage));
  assert.equal(storage.getItem('bis-signet-send-operation-v1:a'),null);
  assert.equal(storage.getItem('bis.integration-demo.preview-scale'),null);
});

test('logout clears continuation and reservation records but preserves separate game wallet records', () => {
  const storage=memory([
    ['bis-signet-continuations-v1:player','unreadable'],
    ['bis-signet-wallet-operations-v2:player','unreadable'],
    ['bis-signet-burn-operation-v1:player:burn','unreadable'],
    ['bis-signet-mints-v1:player','unreadable'],
    ['bis-game-wallet-send-owner:game','1'],
    ['bis-signet-wallet-operations-v2:game','keep'],
    ['bis-signet-send-operation-v1:game','keep'],
    ['other-app','keep'],
  ]);
  clearBrowserPreferences(storage);
  assert.equal(storage.length,4);
  assert.equal(storage.getItem('bis-signet-wallet-operations-v2:game'),'keep');
  assert.equal(storage.getItem('bis-signet-send-operation-v1:game'),'keep');
  assert.equal(storage.getItem('other-app'),'keep');
});
