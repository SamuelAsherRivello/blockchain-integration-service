import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {hex} from '@scure/base';
import {buildTreasureScript,treasureDeadlineSeconds} from '../../src/client/wallet-layer-arkade/treasure-script.ts';
import {buildStagedTreasureScript,treasureStagedBranches} from '../../src/client/wallet-layer-arkade/treasure-staged-script.ts';
import {stagedFixture,decode} from './treasure-staged-fixture.ts';

test('v3 is a distinct immutable artifact while the original v2 vector stays byte committed',async()=>{
  const f=await stagedFixture(),v2=buildTreasureScript(f.binding.terms),v3=f.built;
  assert.equal(hex.encode(v2.script.pkScript),'51209584a0280b2a8bd7e080e98c23967c4ad85f493c73254b63e5eaef785d2d9f4e');
  assert.equal(hex.encode(v3.script.pkScript),'5120301e93314424db0c4594be0e906c0a34d9016499bb83ad5fae38bdb4e49f22f3');
  assert.equal(v3.artifactVersion,3);assert.equal(Object.isFrozen(v3),true);
  assert.equal(v3.program.name,'BISTreasureV3');assert.match(new TextDecoder().decode(v3.args.scope),/bis:treasure:v3/);
  assert.deepEqual(v2.program.functions.claim.tapscript.signers,['$operator','$player']);
  assert.deepEqual(v3.script.functionByName('exit')!.leafScript,v2.script.functionByName('exit')!.leafScript);
  for(let offset=0;offset<1000;offset++){
    const start=1_800_000_000_000+offset,deadline=treasureDeadlineSeconds(start)*1000;
    assert.ok(deadline<=start+90000&&deadline>start+89000);
  }
});

test('all v3 branches order the explicit tweaked emulator before their original ordinary actors',async()=>{
  const f=await stagedFixture(),t=f.binding.terms;
  for(const branch of treasureStagedBranches){
    const leaf=f.built.script.functionByName(branch)!;
    assert.equal(leaf.def.tapscript!.emulator,null);
    assert.deepEqual(leaf.def.tapscript!.signers[1],{tweak:'$emulator',fn:branch});
    const actors=branch==='claim'?[t.player]:branch==='refund'?[t.game]:[t.player,t.game];
    assert.equal(hex.encode(leaf.signerKeys[0]),t.operator);
    assert.deepEqual(leaf.signerKeys.slice(2).map(key=>hex.encode(key)),actors);
    assert.equal(new Set(leaf.signerKeys.map(key=>hex.encode(key))).size,actors.length+2);
  }
  for(const change of [{network:'signet' as const},{offerSessionId:'offer-b'},{hostReference:'run-b'},{startedAtMs:t.startedAtMs+1},
    {playerDestination:t.game},{gameDestination:t.player},{exitDelay:4096}])
    assert.notDeepEqual(buildStagedTreasureScript({...t,...change}).script.pkScript,f.built.script.pkScript);
  for(const change of [{player:t.game},{exitDelay:513},{hostReference:' run'},{emulator:'00'}])
    assert.throws(()=>buildStagedTreasureScript({...t,...change}));
});

const vm='output/tools/conditional-vault/emulator/conditional-vault-vm-clock.exe';
test('actual local VM checks 36 v3 deadline, principal and destination boundaries',
  {skip:existsSync(vm)?false:'Pinned local VM executable not provisioned; no VM qualification is inferred'},async()=>{
  const cases:unknown[]=[],expected:boolean[]=[];
  for(const branch of treasureStagedBranches){
    const f=await stagedFixture(branch),destination='5120'+(branch==='claim'?f.binding.terms.playerDestination:f.binding.terms.gameDestination);
    for(const now of [f.deadlineMs/1000-1,f.deadlineMs/1000,f.deadlineMs/1000+1]){
      const good={script:hex.encode(f.leaf.arkadeScript!),inputAmount:1000,inputs:1,now,
        outputs:[{script:destination,amount:1000},{script:hex.encode(decode(f.binding.original.arkTx).getOutput(1).script!),amount:0},{script:'51024e73',amount:0}]};
      cases.push(good);expected.push(branch==='refund'?now>=f.deadlineMs/1000:now<f.deadlineMs/1000);
      cases.push({...good,inputAmount:999});expected.push(false);
      cases.push({...good,outputs:[{script:'5120'+f.binding.terms.emulator,amount:1000},...good.outputs.slice(1)]});expected.push(false);
    }
  }
  const result=spawnSync(vm,['-test.run=^TestBISConditionalVaultClockFixtures$','-test.v'],{input:JSON.stringify(cases),encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.error,undefined);assert.equal(result.status,0);
  const raw=/BIS_RESULTS=(\[[^\r\n]+\])/.exec(result.stdout)?.[1];assert.ok(raw);
  assert.deepEqual(JSON.parse(raw),expected);assert.equal(cases.length,36);
});
