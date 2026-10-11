import test from 'node:test';
import assert from 'node:assert/strict';
import {readCompleteContracts,withCompleteSnapshot} from '../../src/client/wallet-layer-arkade/complete-snapshot.ts';
const signal=()=>new AbortController().signal;
const contracts=[{script:'active',address:'a',state:'active'},{script:'inactive',address:'b',state:'inactive'}];
const coin=(txid,script='active')=>({txid,vout:0,value:1,script});
function manager(){return {getContracts:async()=>contracts,annotateVtxos:async coins=>coins};}
test('full live coverage includes inactive/recoverable contracts and starts at zero, not a retained cursor',async()=>{
  const queries=[];
  const snapshot=await readCompleteContracts(manager(),{getVtxos:async query=>{queries.push(query);return {vtxos:[coin('new','inactive')]};}},signal());
  assert.deepEqual(queries[0].scripts,['active','inactive']);assert.equal(queries[0].after,0);
  assert.equal(snapshot[0].vtxos.length,0);assert.equal(snapshot[1].vtxos[0].contractScript,'inactive');
});
test('pagination is complete and required later page failure cannot return a partial success',async()=>{
  let calls=0;
  const provider={getVtxos:async q=>{calls++;return {vtxos:[coin(String(q.pageIndex))],page:{current:q.pageIndex,next:q.pageIndex+1,total:2}};}};
  const result=await readCompleteContracts(manager(),provider,signal());assert.equal(result[0].vtxos.length,2);assert.equal(calls,2);
  provider.getVtxos=async q=>{if(q.pageIndex)throw Error('offline');return {vtxos:[coin('one')],page:{current:0,next:1,total:2}};};
  await assert.rejects(readCompleteContracts(manager(),provider,signal()),/offline/);
  for(const page of [{current:1,next:2,total:2},{current:0,next:0,total:2},{current:0,next:1,total:NaN}])await assert.rejects(readCompleteContracts(manager(),{getVtxos:async()=>({vtxos:[coin('one')],page})},signal()));
});
test('attempt failure followed by success recovers; old repository outputs and watcher status are not evidence',async()=>{
  let fail=true;
  const m={...manager(),getContractsWithVtxos:async()=>[{contract:contracts[0],vtxos:[coin('old-spent')]}]};
  const old=m.getContractsWithVtxos;
  const wallet={getContractManager:async()=>m,indexerProvider:{getVtxos:async()=>{if(fail)throw Error('required failed');return {vtxos:[]};}}};
  await assert.rejects(withCompleteSnapshot(wallet,signal(),async()=> 'must not publish'));
  assert.equal(m.getContractsWithVtxos,old);fail=false;
  const snapshot=await withCompleteSnapshot(wallet,signal(),async()=>m.getContractsWithVtxos());
  assert.ok(snapshot.every(row=>row.vtxos.length===0));assert.equal(m.getContractsWithVtxos,old);
  await assert.rejects(withCompleteSnapshot(wallet,signal(),async()=>{throw Error('boarding failed');}));assert.equal(m.getContractsWithVtxos,old);
});
