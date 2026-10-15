import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.FAUCET_LIVE_TEST_URL;
const network = process.env.FAUCET_LIVE_TEST_NETWORK;
const enabled = Boolean(baseUrl && network);

function realIdentifier(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

async function readBalance() {
  const response = await fetch(`${baseUrl}/api/faucet/balance?network=${encodeURIComponent(network)}`);
  const body = await response.json();
  assert.equal(response.ok, true, `live balance read failed: ${body.message ?? response.status}`);
  return body;
}

test('healthy live faucet exposes real transaction evidence and spendable Arkade balance', { skip: !enabled }, async () => {
  let balance = await readBalance();
  if (Number(balance.available ?? 0) <= 0 && Number(balance.total ?? 0) > 0) {
    const response = await fetch(`${baseUrl}/api/faucet/onboard`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ network }) });
    const body = await response.json();
    assert.equal(response.ok, true, `live onboarding failed: ${body.message ?? response.status}`);
    balance = await readBalance();
  }

  assert.ok(Number(balance.available ?? 0) > 0, `expected positive available balance, got ${balance.available}`);
  const history = Array.isArray(balance.history) ? balance.history : [];
  assert.ok(history.length > 0, 'expected public transaction history');
  assert.ok(history.some(entry => {
    const key = entry?.key ?? {};
    return realIdentifier(key.arkTxid) || realIdentifier(key.commitmentTxid) || realIdentifier(key.boardingTxid);
  }), 'expected a real 64-hex transaction identifier in public history');
  assert.doesNotMatch(JSON.stringify(balance), /mnemonic|private.?key|seed|recovery/i);
});

