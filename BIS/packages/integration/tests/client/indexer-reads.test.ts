import test from 'node:test';
import assert from 'node:assert/strict';
import {shareIndexerReads} from '../../src/client/wallet-layer-arkade/indexer-reads.ts';

test('temporary providers share simultaneous identical reads, never completed snapshots or another operator',async()=>{
  let calls=0,release;
  const waiting=new Promise(resolve=>{release=resolve;});
  const provider=()=>shareIndexerReads({getVtxos:async()=>{calls++;await waiting;return {vtxos:[]};}},'https://one.example');
  const a=provider(),b=provider(),other=shareIndexerReads({getVtxos:async()=>{calls++;return {vtxos:[]};}},'https://other.example');
  const first=a.getVtxos({scripts:['a']}),second=b.getVtxos({scripts:['a']});
  await other.getVtxos({scripts:['a']});assert.equal(calls,2);release();await Promise.all([first,second]);
  await a.getVtxos({scripts:['a']});assert.equal(calls,3);
});
test('failure releases shared work for a new explicit read',async()=>{
  let calls=0;
  const p=shareIndexerReads({getVtxos:async()=>{if(++calls===1)throw Error('offline');return {vtxos:[]};}},'https://failure.example');
  await assert.rejects(p.getVtxos({scripts:['b']}),/offline/);
  assert.deepEqual(await p.getVtxos({scripts:['b']}),{vtxos:[]});assert.equal(calls,2);
});
