import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

test('new and restored account candidates do not require a retained contract snapshot',async t=>{
  const key=`__bisCandidateFixture${process.pid}`;
  const originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
  let candidateReads=0,retainedSnapshotReads=0;
  const candidate=async(signal,network,session)=>{
    signal.throwIfAborted();
    if(session){retainedSnapshotReads++;throw Error('Unrelated complete contract snapshot unavailable.');}
    candidateReads++;
    return {profileId:'unit-candidate',phrase:'unit-only-placeholder',network};
  };
  const fixture={create:candidate,restore:(_phrase,signal,network,session)=>candidate(signal,network,session),
    context:{subscribe:()=>()=>{},getState:()=>({phase:'idle'})}};
  globalThis[key]=fixture;
  const mocks=new Map([
    ['/wallet-layer-arkade/account.ts',`export const createAccount=(...args)=>globalThis.${key}.create(...args);export const restoreAccount=(...args)=>globalThis.${key}.restore(...args);`],
    ['/wallet-layer-arkade/context-dependencies.ts','export const createArkadeContextDependencies=overrides=>overrides;'],
    ['/state-layer-core/context.ts',`export const createContextWithDependencies=(_storage,dependencies,options)=>{const f=globalThis.${key};f.dependencies=dependencies;f.options=options;return f.context;};`],
  ]);
  const server=await createServer({configFile:false,appType:'custom',
    cacheDir:`output/tests/client/account-candidate-${process.pid}`,optimizeDeps:{noDiscovery:true,include:[]},
    server:{middlewareMode:true,hmr:false,watch:{ignored:['**/output/**']}},
    plugins:[{name:'unit-only-account-candidate',enforce:'pre',load(id){
      for(const [suffix,code] of mocks)if(id.replaceAll('\\','/').endsWith(suffix))return code;
    }}],
  });
  t.after(async()=>{
    delete globalThis[key];
    if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);else delete globalThis.localStorage;
    await server.close();
  });
  const {createBisContext}=await server.ssrLoadModule('/BIS/packages/integration/src/client/wallet-layer-arkade/context-composition.ts');
  createBisContext();
  for(const network of ['signet','mutinynet']){
    fixture.options.selectNetwork(network);
    const signal=new AbortController().signal;
    assert.equal((await fixture.dependencies.create(signal)).network,network);
    assert.equal((await fixture.dependencies.restore('unit-only-placeholder',signal)).network,network);
  }
  assert.equal(candidateReads,4);
  assert.equal(retainedSnapshotReads,0);
});
