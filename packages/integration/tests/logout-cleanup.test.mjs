import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingLogoutOperations, clearBrowserPreferences } from '../src/core/logout-cleanup.ts';

function memory(entries = []) {
  const data = new Map(entries);
  return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
}
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
  const storage = memory([['bis-signet-send-operation-v1:a','{}'],['bis.integration-demo.preview-scale','1'],['other-app','keep']]);
  clearBrowserPreferences(storage);
  assert.equal(storage.length,1);
  assert.equal(storage.getItem('other-app'),'keep');
  assert.throws(()=>clearBrowserPreferences({...memory([['bis-signet-mints-v1:a','{}']]), removeItem:()=>{}}));
});
test('unreadable operation data does not silently become zero pending', () => {
  assert.throws(()=>pendingLogoutOperations(memory([['bis-signet-send-operation-v1:a','broken']])));
});
