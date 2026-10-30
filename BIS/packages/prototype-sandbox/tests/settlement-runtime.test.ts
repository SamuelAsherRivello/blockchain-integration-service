import assert from 'node:assert/strict';
import test from 'node:test';
import type { SettleParams, Wallet } from '@arkade-os/sdk';
import { demoOnboardBitcoin } from '../src/client/settlement-runtime.ts';
import { DEFAULT_WALLET_1_ADDRESSES } from '../src/client/navigation.ts';

test('native SDK onboarding preparation captures terms without submitting and preserves wallet method receivers', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Offline preparation must not call a provider'));
  const input = { txid: 'a'.repeat(64), vout: 0, value: 1000 };
  const txid = 'b'.repeat(64);
  let settlements = 0;
  let streamCalls = 0;
  let registrations = 0;
  class SyntheticWallet {
    #addressReads = 0;
    dustAmount = 330;
    arkProvider = {
      getEventStream: async function* () { streamCalls++; },
      registerIntent: async () => { registrations++; return 'synthetic-intent'; },
    };
    async getAddress() {
      this.#addressReads++;
      return DEFAULT_WALLET_1_ADDRESSES.signet;
    }
    async getBoardingUtxos() { return [input]; }
    async settle(params: SettleParams) {
      settlements++;
      assert.equal(this.#addressReads, 1, 'native Ramps retains the real wallet receiver');
      assert.notEqual(this.arkProvider.registerIntent, originalRegister, 'the real settlement starts only after correlation is installed');
      assert.deepEqual(params.inputs, [input]);
      assert.deepEqual(params.outputs, [{ address: DEFAULT_WALLET_1_ADDRESSES.signet, amount: 1000n }]);
      return txid;
    }
  }
  const wallet = new SyntheticWallet();
  const originalRegister = wallet.arkProvider.registerIntent;
  const originalStream = wallet.arkProvider.getEventStream;
  const result = await demoOnboardBitcoin(wallet as unknown as Wallet, { txFeeRate: '0', intentFee: {} });
  assert.deepEqual(result, { status: 'settled', txid });
  assert.equal(settlements, 1, 'the native SDK preparation must not call the real settlement');
  assert.equal(registrations, 0);
  assert.equal(streamCalls, 0);
  assert.equal(wallet.arkProvider.registerIntent, originalRegister);
  assert.equal(wallet.arkProvider.getEventStream, originalStream);
});
