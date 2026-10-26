import test from 'node:test';
import assert from 'node:assert/strict';
import {base64} from '@scure/base';
import {assertTreasurePsbtEquivalent,decodeTreasurePsbtMaps,encodeTreasurePsbtMaps,assertTreasureSignatureRetention,mergeTreasurePsbtSignatures} from '../../src/client/wallet-layer-arkade/treasure-psbt-equivalence.ts';
import {stagedFixture,signFixtureEmulator} from './treasure-staged-fixture.ts';

const maps=(encoded:string)=>decodeTreasurePsbtMaps(encoded,1,3).map(entries=>entries.map(entry=>({key:entry.key.slice(),value:entry.value.slice()})));
test('raw v3 PSBT equivalence preserves global, proprietary, unknown and every input/output field',async()=>{
  const f=await stagedFixture(),original=f.binding.original.arkTx;
  for(const index of [0,1,2,3,4]){
    const changed=maps(original);changed[index].push({key:new Uint8Array([0xfc,1,0x61,1]),value:new Uint8Array([1,2])},{key:new Uint8Array([0xfa]),value:new Uint8Array([3])});
    const retained=encodeTreasurePsbtMaps(changed);
    assert.doesNotThrow(()=>assertTreasurePsbtEquivalent(encodeTreasurePsbtMaps(changed.map(entries=>[...entries].reverse())),retained,1,3));
    assert.throws(()=>assertTreasurePsbtEquivalent(original,retained,1,3));
    changed[index].at(-1)!.value[0]^=1;
    assert.throws(()=>assertTreasurePsbtEquivalent(encodeTreasurePsbtMaps(changed),retained,1,3));
  }
  const signed=signFixtureEmulator(f).signedArkTx;
  assert.doesNotThrow(()=>assertTreasurePsbtEquivalent(signed,original,1,3));
  assert.throws(()=>assertTreasureSignatureRetention(signed,original,1,3));
  const merged=mergeTreasurePsbtSignatures(original,signed,original,1,3);
  assert.doesNotThrow(()=>assertTreasureSignatureRetention(signed,merged,1,3));
  assert.equal(merged,mergeTreasurePsbtSignatures(original,signed,original,1,3));
});

test('raw parser rejects duplicate keys, malformed signatures, trailing maps and noncanonical framing',async()=>{
  const f=await stagedFixture(),original=f.binding.original.arkTx;
  for(const index of [0,1,2]){
    const changed=maps(original);const entry=changed[index][0]??{key:new Uint8Array([0xfa]),value:new Uint8Array()};
    if(!changed[index].length)changed[index].push(entry);changed[index].push(entry);
    assert.throws(()=>decodeTreasurePsbtMaps(encodeTreasurePsbtMaps(changed),1,3));
  }
  const changed=maps(original);changed[1].push({key:new Uint8Array([0x14,1]),value:new Uint8Array(64)});
  assert.throws(()=>decodeTreasurePsbtMaps(encodeTreasurePsbtMaps(changed),1,3));
  const raw=base64.decode(original),extra=new Uint8Array(raw.length+1);extra.set(raw);
  assert.throws(()=>decodeTreasurePsbtMaps(base64.encode(extra),1,3));
  assert.throws(()=>decodeTreasurePsbtMaps(original+'\n',1,3));
  assert.throws(()=>decodeTreasurePsbtMaps(original,0,3));
  const signed=maps(signFixtureEmulator(f).signedArkTx),conflict=maps(signFixtureEmulator(f).signedArkTx);
  conflict[1].find(({key})=>key[0]===0x14)!.value[0]^=1;
  assert.throws(()=>mergeTreasurePsbtSignatures(original,encodeTreasurePsbtMaps(signed),encodeTreasurePsbtMaps(conflict),1,3));
});
