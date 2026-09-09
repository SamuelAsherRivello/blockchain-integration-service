import test from 'node:test';
import assert from 'node:assert/strict';
import { createContractStorage } from '../src/core/contract-storage.ts';
import { emptyContractLedger, startLto } from '../src/core/contracts.ts';

const request = { scope: { network: 'signet', operator: 'operator', playerId: 'player', gameId: 'game', exclusivityKey: 'slot' }, id: 'contract', sessionId: 'session', operationId: 'fund', purpose: 'reward', hostReference: 'chest', amountSats: 1000, startedAt: 0, expiresAt: 90000 };
const recovery = { secretHex: '12'.repeat(32), playerKey: '23'.repeat(32), gameKey: '34'.repeat(32), operatorKey: '45'.repeat(32), exitDelay: '512', gameScript: '00', playerScript: '01', contractScript: '02' };
const document = () => ({ version: 1, revision: 0, ledger: startLto(emptyContractLedger(), request, 0).ledger, recovery: { contract: recovery } });
function backend() {
  let saved;
  return { async read() { return structuredClone(saved); }, async write(value, revision) { if ((saved?.revision ?? 0) !== revision) throw Error('conflict'); saved = structuredClone(value); }, peek() { return saved; }, corrupt(value) { saved = value; } };
}

test('asset change manifest survives encrypted reload and rejects invalid quantities',async()=>{
  const db=backend(),storage=createContractStorage(db),data=document();
  data.recovery.contract={...recovery,spend:{operationId:'fund',transactionId:'ab'.repeat(32),inputs:[{txid:'cd'.repeat(32),vout:0,value:53000}],destinationScript:'02',amountSats:1000,change:{script:'00',value:52000,assets:[{assetId:'ef'.repeat(34),amount:'9007199254740993'}]}}};
  const saved=await storage.save(data);
  assert.deepEqual((await createContractStorage(db).load()).recovery.contract.spend.change,saved.recovery.contract.spend.change);
  const invalid=document();invalid.recovery.contract=structuredClone(data.recovery.contract);
  invalid.recovery.contract.spend.change.assets[0].amount='-1';
  await assert.rejects(createContractStorage(backend()).save(invalid));
});

test('encrypted recovery survives a new storage instance without storing plaintext or extractable keys', async () => {
  const db = backend(), storage = createContractStorage(db);
  assert.deepEqual((await storage.load()).ledger, emptyContractLedger());
  const saved = await storage.save(document());
  assert.equal(saved.revision, 1);
  assert.equal(db.peek().key.extractable, false);
  assert.equal(JSON.stringify(db.peek()).includes(recovery.secretHex), false);
  assert.deepEqual(await createContractStorage(db).load(), saved);
});

test('stale writers cannot replace recovery or duplicate a reserved slot', async () => {
  const db = backend(), first = createContractStorage(db), other = createContractStorage(db);
  const old = await other.load();
  const saved = await first.save(document());
  await assert.rejects(other.save(old));
  assert.deepEqual(await first.load(), saved);
});

test('corrupt, unknown-version, and mismatched-revision envelopes fail closed', async () => {
  const db = backend(), storage = createContractStorage(db);
  await storage.save(document());
  const good = db.peek();
  for (const patch of [{ version: 2 }, { revision: 2 }, { encrypted: new ArrayBuffer(1) }]) {
    db.corrupt({ ...good, ...patch });
    await assert.rejects(storage.load());
  }
});

test('saving validates relationships, recovery material and financial state without replacing previous data', async () => {
  const db = backend(), storage = createContractStorage(db);
  const saved = await storage.save(document());
  for (const patch of [
    { version: 2 }, { recovery: {} }, { recovery: { contract: { ...recovery, secretHex: 'bad' } } },
    { ledger: { ...saved.ledger, attempts: [] } },
    { ledger: { ...saved.ledger, contracts: [{ ...saved.ledger.contracts[0], financial: 'claimed' }] } },
  ]) {
    await assert.rejects(storage.save({ ...saved, ...patch }));
    assert.deepEqual(await storage.load(), saved);
  }
});

test('additive records preserve earlier accounts and session attempts', async () => {
  const db = backend(), storage = createContractStorage(db);
  const saved = await storage.save(document());
  const second = startLto(saved.ledger, { ...request, id: 'other', scope: { ...request.scope, playerId: 'other-player' } }, 0);
  const updated = await storage.save({ ...saved, ledger: second.ledger, recovery: { ...saved.recovery, other: recovery } });
  const loaded = await storage.load();
  assert.equal(loaded.ledger.contracts.length, 2);
  assert.deepEqual(loaded, updated);
});

test('updates cannot replace established signing terms or reopen a terminal contract', async () => {
  const storage=createContractStorage(backend());
  const saved=await storage.save(document());
  for(const field of ['secretHex','playerKey','gameKey','operatorKey','exitDelay','gameScript','playerScript','contractScript']) {
    const changed=field==='exitDelay'?'1024':field.endsWith('Script')?'ff':'ff'.repeat(32);
    await assert.rejects(storage.save({...saved,recovery:{contract:{...recovery,[field]:changed}}}));
  }
  const record=saved.ledger.contracts[0];
  const terminal=await storage.save({...saved,ledger:{...saved.ledger,contracts:[{...record,financial:'failed',operation:{...record.operation,submission:'not-submitted'}}]}});
  await assert.rejects(storage.save({...terminal,ledger:saved.ledger}));
  assert.deepEqual(await storage.load(),terminal);
});
