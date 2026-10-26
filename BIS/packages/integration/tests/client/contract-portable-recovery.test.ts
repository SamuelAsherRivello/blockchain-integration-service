import test from 'node:test';
import assert from 'node:assert/strict';
import {SingleKey,DefaultVtxo,RestIndexerProvider,MnemonicIdentity,Transaction,VtxoScript} from '@arkade-os/sdk';
import {hex,base64} from '@scure/base';
import {exportContractRecovery,decryptContractRecovery,mergeContractRecovery} from '../../src/client/state-layer-core/contract-portable-recovery.ts';
import {createContractStorage} from '../../src/client/state-layer-core/contract-storage.ts';
import {emptyContractLedger,startLto,finishContractOperation,presentContract} from '../../src/client/state-layer-core/contracts.ts';
import {buildLtoScript} from '../../src/client/wallet-layer-arkade/lto-script.ts';
import {reconcileLtoSpend} from '../../src/client/wallet-layer-arkade/lto-contract.ts';
import {createLtoService} from '../../src/client/state-layer-core/lto-service.ts';
import {testLocks} from './locks-fixture.ts';
import {observeOtherLtoSpend} from '../../src/client/wallet-layer-arkade/lto-observed-spend.ts';

const password='public test password, not used by wallets';
const scope={network:'signet',playerId:'player',gameId:'game'};
const keys=await Promise.all([1,2,3].map(async n=>hex.encode(await SingleKey.fromHex(n.toString(16).padStart(64,'0')).xOnlyPublicKey())));
async function fixture(){
  const [playerKey,gameKey,operatorKey]=keys,secretHex='12'.repeat(32);
  const defaults={serverPubKey:hex.decode(operatorKey),csvTimelock:{type:'seconds',value:512n}};
  const playerScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(playerKey)});
  const gameScript=new DefaultVtxo.Script({...defaults,pubKey:hex.decode(gameKey)});
  const built=buildLtoScript({playerKey:hex.decode(playerKey),gameKey:hex.decode(gameKey),operatorKey:hex.decode(operatorKey),
    secretHash:new Uint8Array(await crypto.subtle.digest('SHA-256',hex.decode(secretHex))),exitDelay:512n});
  const now=Date.now(),request={id:'contract',sessionId:'session',operationId:'fund',purpose:'treasureLTO',hostReference:'run',
    amountSats:1000,startedAt:now,expiresAt:now+90_000,scope:{...scope,operator:'https://signet.arkade.sh',exclusivityKey:'treasure'}};
  const ledger=startLto(emptyContractLedger(),request,now).ledger;
  ledger.contracts=[finishContractOperation(ledger.contracts[0],{operationId:'fund',kind:'fund',outcome:'confirmed'})];
  const recovery={playerKey,gameKey,operatorKey,secretHex,exitDelay:'512',playerScript:hex.encode(playerScript.encode()),
    gameScript:hex.encode(gameScript.encode()),contractScript:hex.encode(built.script.encode()),
    fundingOutput:{txid:'ab'.repeat(32),vout:0,value:1000}};
  return {document:{version:1,revision:0,ledger,recovery:{contract:recovery}},script:hex.encode(built.script.pkScript)};
}
function storage(){let saved;return createContractStorage({read:async()=>structuredClone(saved),
  write:async(value,revision)=>{if((saved?.revision??0)!==revision)throw Error('conflict');saved=structuredClone(value);}});}

test('portable encryption restores on independent storage, contains no plaintext and uses fresh salt/IV',async()=>{
  const {document}=await fixture(),source=storage();const saved=await source.save(document);
  const file=await exportContractRecovery(saved,scope,password),other=await exportContractRecovery(saved,scope,password);
  assert.notEqual(file,other);assert.equal(file.includes(password),false);assert.equal(file.includes(document.recovery.contract.secretHex),false);
  assert.equal(file.includes(document.recovery.contract.playerKey),false);
  const decoded=await decryptContractRecovery(file,scope,password),target=storage();
  const merged=mergeContractRecovery(await target.load(),decoded,scope);
  const imported=await target.save(merged),record=imported.ledger.contracts[0];
  assert.equal(record.recoveryRequired,true);assert.equal(presentContract(record,Date.now()).canClaim,false);
  assert.deepEqual(imported.recovery.contract,document.recovery.contract);
  assert.deepEqual(await source.load(),saved);
  const repeated=mergeContractRecovery(imported,decoded,scope);
  assert.deepEqual(repeated,imported);
});

test('wrong password, network, participant, changed ciphertext and unsupported parameters fail closed',async()=>{
  const {document}=await fixture(),file=await exportContractRecovery(document,scope,password);
  await assert.rejects(decryptContractRecovery(file,scope,password+'wrong'),/could not be verified/);
  await assert.rejects(decryptContractRecovery(file,{...scope,network:'mutinynet'},password));
  await assert.rejects(decryptContractRecovery(file,{...scope,playerId:'other'},password));
  const e=JSON.parse(file);
  for(const patch of [{version:2},{iterations:1},{cipher:'none'},{iv:'AA=='},
    {ciphertext:(e.ciphertext[0]==='A'?'B':'A')+e.ciphertext.slice(1)},{unknown:'value'}])
    await assert.rejects(decryptContractRecovery(JSON.stringify({...e,...patch}),scope,password));
  await assert.rejects(exportContractRecovery(document,scope,'short'));
});

test('unknown secret fields cannot enter an export, and oversized input is rejected',async()=>{
  const {document}=await fixture();
  await assert.rejects(exportContractRecovery({...document,recovery:{contract:{...document.recovery.contract,phrase:'must never export'}}},scope,password));
  await assert.rejects(decryptContractRecovery(' '.repeat(8_000_001),scope,password));
});

test('an old backup cannot overwrite a newer local operation, immutable terms or conflicting slot',async()=>{
  const {document}=await fixture(),file=await exportContractRecovery(document,scope,password);
  const incoming=await decryptContractRecovery(file,scope,password);
  const local=structuredClone(document);
  local.ledger.contracts[0]={...local.ledger.contracts[0],financial:'unknown',operation:{id:'claim',kind:'claim',submission:'unknown'}};
  assert.throws(()=>mergeContractRecovery(local,incoming,scope));
  assert.throws(()=>mergeContractRecovery({...document,recovery:{contract:{...document.recovery.contract,secretHex:'ab'.repeat(32)}}},incoming,scope));
  const conflict=structuredClone(incoming);conflict.ledger.contracts[0].id='other';conflict.ledger.attempts[0].contractId='other';
  conflict.recovery={other:conflict.recovery.contract};
  assert.throws(()=>mergeContractRecovery(document,conflict,scope));
});

test('imported funded output needs exact fresh evidence, and a competing device spend remains blocked',async t=>{
  const {document,script}=await fixture(),file=await exportContractRecovery(document,scope,password);
  const imported=mergeContractRecovery({version:1,revision:0,ledger:emptyContractLedger(),recovery:{}},await decryptContractRecovery(file,scope,password),scope);
  const record=imported.ledger.contracts[0],r=imported.recovery.contract;
  let coin={...r.fundingOutput,script,isSpent:true,spentBy:'cd'.repeat(32)},calls=0;
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected test network');});
  t.mock.method(RestIndexerProvider.prototype,'getVtxos',async()=>{calls++;return {vtxos:[coin]};});
  assert.equal((await reconcileLtoSpend(record,r)).record.recoveryRequired,true);
  coin={...r.fundingOutput,script,isSpent:false};
  const verified=await reconcileLtoSpend(record,r);assert.equal(verified.record.recoveryRequired,false);
  assert.equal(presentContract(verified.record,Date.now()).canClaim,true);assert.equal(calls,2);
  coin={...coin,script:'5120'+'ef'.repeat(32)};
  assert.equal((await reconcileLtoSpend(record,r)).record.recoveryRequired,true);
});

test('reset cannot erase unresolved recovery, including an imported record',async()=>{
  const {document}=await fixture(),s=storage();const saved=await s.save(document);
  await assert.rejects(s.reset(),/remain reserved/);assert.deepEqual(await s.load(),saved);
});

test('public controller imports only the selected keys, reserves before use and performs no financial work',async t=>{
  const {document}=await fixture(),file=await exportContractRecovery(document,scope,password),target=storage();
  const values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:testLocks()}});
  const identities=[1,2].map(n=>SingleKey.fromHex(n.toString(16).padStart(64,'0')));
  t.mock.method(MnemonicIdentity,'fromMnemonic',phrase=>identities[phrase==='test-player'?0:1]);
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected test network');});
  let work=0;
  const context={getState:()=>({profileId:'player',phase:'active',network:'signet'}),refreshBalance:async()=>{},showToast:()=>{work++;}};
  const gameWallet={getState:()=>({profileId:'game',status:'ready',network:'signet'}),refresh:async()=>{}};
  const deps={storage:target,playerStorage:{load:async()=>({account:{profileId:'player',phrase:'test-player',network:'signet'}})},
    gameStorage:{load:async()=>({profileId:'game',phrase:'test-game',network:'signet'}),dispose(){}},poll:false,
    prepare:async()=>{work++;throw Error();},submit:async()=>{work++;throw Error();},
    reconcile:async(record,recovery)=>{work++;return {record,recovery};},resume:async()=>{work++;throw Error();}};
  const service=createLtoService({context,gameWallet},deps);
  await service.importRecovery(file,password);
  const imported=await target.load();assert.equal(imported.ledger.contracts[0].recoveryRequired,true);
  assert.ok([...values.values()].some(v=>v.includes('"pending":true')));
  assert.equal(work,0);
  assert.equal((await service.claim('contract')).status,'unavailable');assert.equal(work,0);
  const projected=await service.checkContractsAsync();assert.equal(projected.contracts[0].evidence,'local record');
  assert.equal(projected.contracts[0].canClaim,false);
  const exported=await service.exportRecovery(password);assert.ok((await decryptContractRecovery(exported,scope,password)).recovery.contract);
  const before=await target.load();
  t.mock.method(MnemonicIdentity,'fromMnemonic',()=>identities[1]);
  await assert.rejects(service.importRecovery(file,password),/wallet keys/);
  assert.deepEqual(await target.load(),before);
  service.dispose({endSessions:false});
});

test('another device refund is recognized only through the original contract/checkpoint/payout chain',async t=>{
  const {document,script}=await fixture(),record=document.ledger.contracts[0],r=document.recovery.contract;
  const destination=hex.encode(VtxoScript.decode(hex.decode(r.gameScript)).pkScript);
  async function observed(unrelated=false,asset=false,pendingClaim=false){
    const cp=new Transaction();cp.addInput({txid:unrelated?'cd'.repeat(32):r.fundingOutput.txid,index:0,witnessUtxo:{amount:1000n,script:hex.decode(script)}});
    cp.addOutput({amount:1000n,script:hex.decode('5120'+'ef'.repeat(32))});cp.addOutput({amount:0n,script:hex.decode('51024e73')});
    const tx=new Transaction();tx.addInput({txid:cp.id,index:0,witnessUtxo:{amount:1000n,script:cp.getOutput(0).script}});
    tx.addOutput({amount:1000n,script:hex.decode(destination)});
    const coins=[{...r.fundingOutput,script,isSpent:true,spentBy:cp.id,arkTxId:tx.id},
      {txid:tx.id,vout:0,value:1000,script:destination,...(asset?{assets:[{assetId:'ab'.repeat(34),amount:1n}]}:{})}];
    const provider={getVtxos:async()=>({vtxos:coins}),getVirtualTxs:async()=>({txs:[cp,tx].map(t=>base64.encode(t.toPSBT()))})};
    if(pendingClaim){
      t.mock.method(RestIndexerProvider.prototype,'getVtxos',provider.getVtxos);
      t.mock.method(RestIndexerProvider.prototype,'getVirtualTxs',provider.getVirtualTxs);
      const original={...record,financial:'unknown',operation:{id:'old-claim',kind:'claim',submission:'unknown'}};
      const recovery={...r,spend:{operationId:'old-claim',transactionId:'00'.repeat(32),inputs:[r.fundingOutput],
        destinationScript:hex.encode(VtxoScript.decode(hex.decode(r.playerScript)).pkScript),amountSats:1000}};
      return reconcileLtoSpend(original,recovery);
    }
    return observeOtherLtoSpend(provider,record,r,script);
  }
  const result=await observed();assert.equal(result.record.financial,'refunded');
  assert.equal(result.record.operation.submission,'confirmed');assert.ok(result.record.operation.id.startsWith('observed:'));
  assert.equal(JSON.parse(result.recovery.observedPrevious).operation.id,record.operation.id);
  assert.equal(result.recovery.fundingOutput.txid,r.fundingOutput.txid);
  assert.equal(await observed(true),undefined);assert.equal(await observed(false,true),undefined);
  const competed=await observed(false,false,true);
  assert.equal(competed.record.financial,'refunded');
  assert.equal(JSON.parse(competed.recovery.observedPrevious).operation.id,'old-claim');
  assert.equal(JSON.parse(competed.recovery.observedPrevious).spend.transactionId,'00'.repeat(32));
});
