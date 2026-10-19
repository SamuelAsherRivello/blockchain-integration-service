import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {CONDITIONAL_VAULT_AMOUNT,CONDITIONAL_VAULT_TARGET,conditionalVaultArtifact,rememberVaultDescriptor,readStoredConditionalVault,importConditionalVault} from '../src/client/conditional-vault.ts';
import {descriptorFixture} from '../../integration/tests/client/conditional-vault-descriptor.test.ts';
import {compileVaultDescriptor} from '../../integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts';
import {conditionalVaultDemoSource} from '../src/client/conditional-vault-demo-source.ts';
function browser(){
 const values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
 Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{request:async(_key:string,use:()=>unknown)=>use()}});
 return values;
}
test('public metadata is isolated, recompiled and never grants financial success',async()=>{
 browser();const descriptor=await descriptorFixture('signet');
 await rememberVaultDescriptor(descriptor);
 assert.deepEqual(await readStoredConditionalVault('signet','conditional-vault-0000'),descriptor);
 assert.equal(await readStoredConditionalVault('mutinynet','conditional-vault-0000'),null);
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
 await assert.rejects(readStoredConditionalVault('signet','conditional-vault-0000'),/legacy contract/);
 assert.equal(values.get(key),'original legacy recovery data');
});
test('source tabs render actual source imports and only Create exposes contract tabs',async()=>{
 const app=await readFile(new URL('../src/client/App.tsx',import.meta.url),'utf8');
 assert.match(app,/conditional-vault-program\.ts\?raw/);assert.match(app,/source=\{conditionalVaultDemoSource\(action\)\}/);
 assert.match(app,/Smart Contract \(Tapscript\)/);assert.match(app,/Smart Contract \(Compiled\)/);
 assert.match(app,/'Transaction fee: 0 sats'/);
 assert.doesNotMatch(app,/nonzero fee policies are blocked|vault-public-descriptor/);
 assert.match(app,/compiledSource=\{action === 'create'/);assert.match(app,/>Recover<\/button>/);
 assert.doesNotMatch(await readFile(new URL('../src/client/conditional-vault.ts',import.meta.url),'utf8'),/claimTxid|incrementTxids|findSpendableState/);
});
test('vault demos use a persisted vault selection separate from asset demos',async()=>{
 const app=await readFile(new URL('../src/client/App.tsx',import.meta.url),'utf8');
 const source=await readFile(new URL('../src/client/conditional-vault-demo-source.ts',import.meta.url),'utf8');
 assert.match(app,/vaultSelectionStorageKey\(network\)/);
 assert.match(app,/storageKey="vault-id"/);
 assert.match(source,/localStorageGetItem\('vault-id'\)/);
 assert.doesNotMatch(source,/localStorageGetItem\('asset-id'\)/);
});
test('each displayed vault example has Arrange, Act and Assert with success logged last',()=>{
 for(const action of ['create','increment','check','claim'] as const){
  const source=conditionalVaultDemoSource(action);
  assert.deepEqual(source.match(/^\/\/ (Arrange|Act|Assert)$/gm),['// Arrange','// Act','// Assert']);
  const assertion=source.split('// Assert')[1];
  assert.match(assertion,/console\.log\('Demo:/);
  assert.ok(assertion.indexOf("console.log('Demo:")<assertion.indexOf("console.log('Network:'"));
  assert.ok(source.endsWith("console.log('Success:', success)"));
  assert.match(source,new RegExp(`await ${action}ConditionalVault\\(`));
  if(action==='increment'||action==='check')assert.doesNotMatch(source,/MnemonicIdentity|Wallet\.create/);
 }
});
