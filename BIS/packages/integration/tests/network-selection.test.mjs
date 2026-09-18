import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestNetworkSession, isTestNetwork, testNetwork } from '../src/core/test-network.ts';
import { formatTransactionDetail, transactionExplorerUrl } from '../src/core/activity.ts';
import { formatTransferRecoveryReport } from '../src/core/boarding-status.ts';
import { operatorFor, requireNetwork } from '../src/arkade/account.ts';
import { inspectContractDocument } from '../src/core/lto-service.ts';
import { emptyContractLedger, startLto } from '../src/core/contracts.ts';

function localStorageFixture() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test('only Signet and Mutinynet are selectable and first use has no implicit network', () => {
  const storage = localStorageFixture();
  const session = createTestNetworkSession(storage);

  assert.equal(session.getSelected(), undefined);
  assert.equal(isTestNetwork('signet'), true);
  assert.equal(isTestNetwork('mutinynet'), true);
  for (const value of ['bitcoin', 'mainnet', 'testnet', 'regtest', '', undefined]) {
    assert.equal(isTestNetwork(value), false);
    assert.throws(() => session.select(value));
  }

  session.select('mutinynet');
  assert.equal(session.getSelected(), 'mutinynet');
  assert.equal(storage.getItem('bis:test-network:v1'), 'mutinynet');
  assert.equal(testNetwork('mutinynet').operator, 'https://mutinynet.arkade.sh');
});

test('corrupted browser preference is ignored rather than routed to an operator', () => {
  const storage = localStorageFixture();
  storage.setItem('bis:test-network:v1', 'mainnet');
  assert.equal(createTestNetworkSession(storage).getSelected(), undefined);
});

test('operator configuration is selected exactly and rejects a cross-network result', () => {
  assert.equal(operatorFor('signet'), 'https://signet.arkade.sh');
  assert.equal(operatorFor('mutinynet'), 'https://mutinynet.arkade.sh');
  assert.equal(testNetwork('signet').faucetUrl, 'https://signet.2nd.dev/');
  assert.equal(testNetwork('mutinynet').faucetUrl, 'https://faucet.mutinynet.com/');
  assert.equal(testNetwork('signet').explorerApiUrl, 'https://mempool.space/signet/api');
  assert.equal(testNetwork('mutinynet').explorerApiUrl, 'https://mempool.mutinynet.arkade.sh/api');
  const transactionId='a'.repeat(64);
  assert.equal(transactionExplorerUrl({id:'fixture',amountSats:1,direction:'Incoming',status:'Confirmed',identifier:transactionId},'mutinynet'), `https://mempool.mutinynet.arkade.sh/tx/${transactionId}`);
  assert.match(formatTransactionDetail({id:'fixture',amountSats:1,direction:'Incoming',status:'Confirmed',identifier:transactionId,bitcoin:{txid:transactionId}}, 'mutinynet'), /Network: Bitcoin Mutinynet \(test network\)/);
  assert.match(formatTransferRecoveryReport({status:'pending'}, 'mutinynet'), /Network: Mutinynet/);
  requireNetwork('mutinynet', 'mutinynet');
  assert.throws(() => requireNetwork('signet', 'mutinynet'), /mismatch/);
});

test('contract inspection uses the active player profile and Mutinynet operator', t => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  t.after(() => previousStorage ? Object.defineProperty(globalThis, 'localStorage', previousStorage) : Reflect.deleteProperty(globalThis, 'localStorage'));
  const created = startLto(emptyContractLedger(), {
    id: 'mutiny-contract', operationId: 'mutiny-fund', sessionId: 'mutiny-session', purpose: 'fixture', hostReference: 'fixture', amountSats: 1000,
    startedAt: 1, expiresAt: Date.now() + 60_000,
    scope: { network: 'mutinynet', operator: operatorFor('mutinynet'), playerId: 'mutiny-player', gameId: 'mutiny-game', exclusivityKey: 'fixture' },
  }, 1);
  const document = { version: 1, revision: 0, ledger: created.ledger, recovery: { 'mutiny-contract': {} } };

  assert.equal(inspectContractDocument(document, 'mutiny-player', {}, 'mutinynet').contracts.length, 1);
  assert.equal(inspectContractDocument(document, 'mutiny-player', {}, 'signet').contracts.length, 0);
  assert.equal(inspectContractDocument(document, 'another-player', {}, 'mutinynet').contracts.length, 0);
  assert.equal(inspectContractDocument(document, 'mutiny-player', { includeOtherNetworks: true }, 'signet').contracts.length, 1);
});
