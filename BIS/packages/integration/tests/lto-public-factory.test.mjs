import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createContractStorage} from '../src/core/contract-storage.ts';
import {markContractSubmission,finishContractOperation} from '../src/core/contracts.ts';
import {testLocks} from './locks-fixture.mjs';

test('public LTO factory creates and claims by default; explicit rollback keeps recovery',async t=>{
  t.mock.method(globalThis,'fetch',async()=>assert.fail('Public factory test attempted external network'));
  t.mock.method(globalThis,'setInterval',()=>0);t.mock.method(globalThis,'clearInterval',()=>{});
  const values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
  const locks=testLocks();let activeLocks=0;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:(name,options,work)=>locks.request(name,options,async lock=>{if(lock)activeLocks++;try{return await work(lock);}finally{if(lock)activeLocks--;}})}}});
  async function idle(){for(let i=0;i<200;i++){await new Promise(resolve=>setTimeout(resolve,5));if(!activeLocks)return;}assert.fail('Mutation lock did not release');}
  Object.defineProperty(globalThis,'document',{configurable:true,value:new EventTarget()});
  let envelope;
  const storage=createContractStorage({read:async()=>structuredClone(envelope),write:async(next,revision)=>{assert.equal(envelope?.revision??0,revision);envelope=structuredClone(next);}});
  const calls=[],toasts=[],storageErrors=[];
  const dependencies={storage:{load:()=>storage.load(),save:async(...args)=>{try{return await storage.save(...args);}catch(error){storageErrors.push(error.message);throw error;}}},playerStorage:{load:async()=>({account:{profileId:'player'}})},gameStorage:{load:async()=>({profileId:'game'}),dispose(){}},
    prepare:async()=>({secretHex:'12'.repeat(32),playerKey:'23'.repeat(32),gameKey:'34'.repeat(32),operatorKey:'45'.repeat(32),exitDelay:'512',gameScript:'00',playerScript:'01',contractScript:'02'}),
    reconcile:async(record,recovery)=>({record,recovery}),resume:async(record,recovery)=>({record,recovery}),
    submit:async(record,recovery,account,commit,current)=>{
      assert.ok(current());calls.push(record.operation.kind);
      record=markContractSubmission(record,record.operation.id,Date.now());await commit(record,recovery);
      record=finishContractOperation(record,{operationId:record.operation.id,kind:record.operation.kind,outcome:'confirmed'});
      if(record.operation.kind==='fund')recovery={...recovery,fundingOutput:{txid:'ab'.repeat(32),vout:0,value:1000}};
      await commit(record,recovery);return {record,recovery};
    }};
  // Replace only storage/provider boundaries, retaining the actual public factory
  // and lifecycle implementation. No signer or simulated adapter reaches the app.
  const fixture=Symbol.for('bis.lto.public-factory.test');globalThis[fixture]=dependencies;
  const prefix="const d=globalThis[Symbol.for('bis.lto.public-factory.test')];";
  const stubs={
    '/arkade/account.ts':'export const SIGNET_OPERATOR="https://signet.arkade.sh";',
    '/core/contract-storage.ts':prefix+'export const createContractStorage=()=>d.storage;',
    '/core/account-storage.ts':prefix+'export const createAccountStorage=()=>d.playerStorage;',
    '/core/game-wallet-storage.ts':prefix+'export const createGameWalletStorage=()=>d.gameStorage;',
    '/arkade/lto-contract.ts':prefix+'export const prepareLtoRecovery=d.prepare,submitLtoSpend=d.submit,reconcileLtoSpend=d.reconcile,resumeLtoFinalization=d.resume;'
  };
  const server=await createServer({configFile:false,plugins:[{name:'isolated-lto-boundaries',enforce:'pre',load(id){return Object.entries(stubs).find(([suffix])=>id.replaceAll('\\','/').endsWith(suffix))?.[1];}}],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
  try {
    const {createBisLto}=await server.ssrLoadModule('/BIS/packages/integration/src/core/lto-service.ts');
    const context={getState:()=>({profileId:'player',phase:'active'}),showToast:message=>toasts.push(message),refreshBalance:async()=>{}};
    const gameWallet={getState:()=>({profileId:'game',status:'ready'}),refresh:async()=>{}};
    const request=sessionId=>({sessionId,hostReference:sessionId,purpose:'treasureLTO',exclusivityKey:'treasure',amountSats:1000,startedAt:Date.now(),expiresAt:Date.now()+90000});
    const service=createBisLto({context,gameWallet});await idle();
    const funded=await service.start(request('claim'));
    assert.equal(funded.status,'confirmed');
    await idle();
    assert.equal((await service.claim(funded.contract.id)).status,'pending');
    async function settled(id,state){for(let i=0;i<100;i++){if((await storage.load()).ledger.contracts.find(record=>record.id===id)?.financial===state)return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail(JSON.stringify({calls,storageErrors,records:(await storage.load()).ledger.contracts.map(({financial,ended,operation})=>({financial,ended,operation}))}));}
    await settled(funded.contract.id,'claimed');
    await idle();
    const second=await service.start(request('refund'));assert.equal(second.status,'confirmed');
    await idle();
    const rollback=createBisLto({context,gameWallet,creationEnabled:false});
    await idle();
    assert.equal((await rollback.start(request('disabled'))).status,'unavailable');await idle();
    assert.equal((await rollback.checkContracts()).contracts.length,1);
    await rollback.endSession('refund');await settled(second.contract.id,'refunded');
    assert.deepEqual(calls,['fund','claim','fund','refund']);
    assert.ok(toasts.some(message=>message.includes('claim confirmed')));
    service.dispose();rollback.dispose();
  } finally {await server.close();delete globalThis[fixture];}
});
