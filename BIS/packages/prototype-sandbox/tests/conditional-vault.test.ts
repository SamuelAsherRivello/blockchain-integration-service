import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {CONDITIONAL_VAULT_AMOUNT,CONDITIONAL_VAULT_TARGET,conditionalVaultArtifact,rememberVaultDescriptor,demoReadConditionalVaultDescriptor,importConditionalVault} from '../src/client/conditional-vault.ts';
import {descriptorFixture} from '../../integration/tests/client/conditional-vault-descriptor.test.ts';
import {compileVaultDescriptor} from '../../integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts';
import {demoVaultResult} from '../src/client/vault-demo-runtime.ts';

function browser(){
 const values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
 Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{request:async(_key:string,use:()=>unknown)=>use()}});
 return values;
}
test('public metadata is isolated, recompiled and never grants financial success',async()=>{
 browser();const descriptor=await descriptorFixture('signet');
 await rememberVaultDescriptor(descriptor);
 assert.deepEqual(await demoReadConditionalVaultDescriptor('signet','conditional-vault-0000'),descriptor);
 assert.equal(await demoReadConditionalVaultDescriptor('mutinynet','conditional-vault-0000'),null);
 await assert.rejects(importConditionalVault(JSON.stringify(descriptor),'mutinynet'),/network-mismatch/);
 assert.equal(CONDITIONAL_VAULT_AMOUNT,1000n);assert.equal(CONDITIONAL_VAULT_TARGET,3);
 const artifact=JSON.parse(conditionalVaultArtifact(descriptor));
 const compiled=compileVaultDescriptor(descriptor);
 assert.deepEqual(artifact.stateScripts.map(s=>s.functions),JSON.parse(JSON.stringify(compiled.states.map(s=>s.functions))));
 for(const [index,state] of compiled.states.entries())assert.equal(artifact.stateScripts[index].tree,Buffer.from(state.script.encode()).toString('hex'));
});
test('legacy financial records remain intact and cannot become version-5 contracts',async()=>{
 const values=browser(),key='prototype-conditional-vault-network-v2:signet:conditional-vault-0000';
 values.set(key,'original legacy recovery data');
 await assert.rejects(demoReadConditionalVaultDescriptor('signet','conditional-vault-0000'),/legacy contract/);
 assert.equal(values.get(key),'original legacy recovery data');
});
test('source tabs render actual source imports and only Create exposes contract tabs',async()=>{
 const app=await readFile(new URL('../src/client/App.tsx',import.meta.url),'utf8');
 assert.match(app,/conditional-vault-program\.ts\?raw/);assert.match(app,/demoDefinition\(sourceId\)\.source/);
 assert.match(app,/Smart Contract \(Tapscript\)/);assert.match(app,/Smart Contract \(Compiled\)/);
 assert.match(await readFile(new URL('../src/client/vault-demo-runtime.ts',import.meta.url),'utf8'), /'Transaction fee: 0 sats'/);
 assert.doesNotMatch(app,/nonzero fee policies are blocked|vault-public-descriptor/);
 assert.match(app,/compiledSource=\{action === 'create'/);assert.match(app,/>Recover<\/button>/);
 assert.doesNotMatch(await readFile(new URL('../src/client/conditional-vault.ts',import.meta.url),'utf8'),/claimTxid|incrementTxids|findSpendableState/);
});
test('vault demos use a persisted vault selection separate from asset demos',async()=>{
 const app=await readFile(new URL('../src/client/App.tsx',import.meta.url),'utf8');
 const source=await readFile(new URL('../src/client/demos/conditional-vault-create.ts',import.meta.url),'utf8');
 assert.match(app,/demoGetInput\(network, 'vault-id'\)/);
 assert.match(app,/storageKey="vault-id"/);
 assert.match(source,/demoGetInput\(network, 'vault-id'\)/);
 assert.doesNotMatch(source,/demoGetInput\(network, 'asset-id'\)/);
});
test('each vault file calls its real operation and returns verified evidence',async()=>{
 for(const action of ['create','increment','check','claim'] as const){
  const source=await readFile(new URL(`../src/client/demos/conditional-vault-${action}.ts`,import.meta.url),'utf8');
  assert.deepEqual(source.match(/\/\/ (Arrange|Act|Assert)$/gm),['// Arrange','// Act','// Assert']);
  assert.match(source,new RegExp(`await demo${action[0].toUpperCase()+action.slice(1)}ConditionalVault\\(`));
  assert.match(source,/return demoVaultResult\(/);
  if(action==='increment'||action==='check')assert.doesNotMatch(source,/MnemonicIdentity|Wallet\.create/);
 }
});

test('vault receipts generate compiled source only when requested and preserve check success',async()=>{
 const descriptor=await descriptorFixture('signet');
 const inspection={descriptor,status:'locked' as const,progress:0,evidence:[]};
 const checked=demoVaultResult('signet','0000',{inspection},{checkOnly:true});
 assert.match(checked.output,/Success: true$/);
 assert.equal(Object.hasOwn(checked,'compiledSource'),false);
 const result={inspection,outcome:'verified' as const};
 const receipt=demoVaultResult('signet','0000',result);
 assert.match(receipt.output,/Success: true$/);
 assert.equal(Object.hasOwn(receipt,'compiledSource'),false);
 assert.equal(demoVaultResult('signet','0000',result,{includeCompiledSource:true}).compiledSource,conditionalVaultArtifact(descriptor));
});
