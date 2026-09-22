import test from 'node:test';
import assert from 'node:assert/strict';
import { readContractReservations } from '../src/core/contract-reservations.ts';

function storage(values = {}) {
  const data = new Map(Object.entries(values));
  return {getItem(key) { return data.get(key) ?? null; }, setItem(key,value) { data.set(key,value); }};
}

test('contract reservations remain isolated by network and carry scope metadata', () => {
  const signet = {id:'signet-contract',playerId:'player',gameId:'game',pending:true};
  const mutinynet = {id:'mutinynet-contract',playerId:'player',gameId:'game',pending:true,network:'mutinynet',operator:'https://mutinynet.arkade.sh'};
  const db = storage({
    'bis-signet-contract-reservations-v1': JSON.stringify({version:1,contracts:[signet]}),
    'bis-mutinynet-contract-reservations-v2': JSON.stringify({version:1,contracts:[mutinynet]}),
  });
  assert.deepEqual(readContractReservations('signet',db), [signet]);
  assert.deepEqual(readContractReservations('mutinynet',db), [mutinynet]);
});

test('legacy Signet reservations are never read as Mutinynet reservations', () => {
  const db = storage({'bis-signet-contract-reservations-v1': JSON.stringify({version:1,contracts:[{id:'legacy',playerId:'p',gameId:'g',pending:true}]})});
  assert.equal(readContractReservations('signet',db).length, 1);
  assert.deepEqual(readContractReservations('mutinynet',db), []);
});
