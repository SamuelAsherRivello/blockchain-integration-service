import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {SingleKey} from '@arkade-os/sdk';
import {hex} from '@scure/base';
import {buildTreasureScript} from '../../packages/integration/src/client/wallet-layer-arkade/treasure-script.ts';

// Explicitly invoked VM acceptance. Not part of credential-free default tests.
const [player,game,operator,emulator]=await Promise.all([1,2,3,4].map(async n=>
  hex.encode(await SingleKey.fromHex(n.toString(16).padStart(64,'0')).xOnlyPublicKey())));
test('BIS V2 emitted bytecode enforces time and payout in the pinned upstream VM',()=>{
  const cases=[],expected=[];
  for(const network of ['signet','mutinynet'] as const){
    const built=buildTreasureScript({network,offerSessionId:'offer-a',hostReference:'run-a',startedAtMs:1999999910000,
      player,game,operator,emulator,playerDestination:player,gameDestination:game,exitDelay:2048});
    for(const fn of built.script.compiled.filter(fn=>fn.arkadeScript)){
      const destination=fn.name==='claim'?player:game;
      for(const now of [1999999999,2000000000,2000000001,2000000120]){
        const base={script:hex.encode(fn.arkadeScript!),inputAmount:1000,inputs:1,now,outputs:[
          {script:'5120'+destination,amount:1000},{script:'6a',amount:0},{script:'51024e73',amount:0}]};
        cases.push(base);expected.push(fn.name==='refund'?now>=2000000000:now<2000000000);
        cases.push({...base,outputs:[{script:'5120'+emulator,amount:1000},...base.outputs.slice(1)]});expected.push(false);
        cases.push({...base,inputAmount:999});expected.push(false);
        cases.push({...base,inputs:2});expected.push(false);
        cases.push({...base,outputs:[...base.outputs,{script:'5120'+emulator,amount:1}]});expected.push(false);
        cases.push({...base,outputs:[{...base.outputs[0],amount:999},...base.outputs.slice(1)]});expected.push(false);
      }
    }
  }
  const vmRoot=process.env.TREASURE_VM_ROOT??resolve('output/tools/conditional-vault/emulator');
  for(let restart=0;restart<2;restart++){
    const result=spawnSync(resolve(vmRoot,'conditional-vault-vm-clock.exe'),
      ['-test.run=^TestBISConditionalVaultClockFixtures$','-test.v'],{
        input:JSON.stringify(cases),encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(result.status,0,result.error?.message??result.stderr);
    const encoded=/BIS_RESULTS=(\[[^\r\n]+\])/.exec(result.stdout)?.[1];
    assert.ok(encoded,result.stdout);assert.deepEqual(JSON.parse(encoded),expected);
  }
});
