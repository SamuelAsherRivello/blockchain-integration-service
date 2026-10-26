import test from 'node:test';
import assert from 'node:assert/strict';
import { MnemonicIdentity, DefaultVtxo } from '@arkade-os/sdk';
import { marketplacePaymentEvidence } from '../../integration/src/client/wallet-layer-arkade/app-marketplace-evidence.ts';
import { writeAssetDeliveryRecord } from '../../integration/src/client/state-layer-core/asset-delivery.ts';
import { beginLocalMarketplaceCheckout, advanceLocalMarketplaceCheckout } from '../../integration/src/client/state-layer-core/marketplace-checkout.ts';

const game = MnemonicIdentity.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', { isMainnet: false });
const player = MnemonicIdentity.fromMnemonic('legal winner thank year wave sausage worth useful legal winner thank yellow', { isMainnet: false });
const operator = await player.xOnlyPublicKey();
const script = async (identity: typeof game) => new DefaultVtxo.Script({ pubKey: await identity.xOnlyPublicKey(), serverPubKey: operator, csvTimelock: { type: 'seconds', value: 1024n } });
const own = await script(game), recipient = await script(player);
const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');

async function fixture(t: any) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), rows = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    get length() { return rows.size; }, key: (index: number) => [...rows.keys()][index] ?? null,
    getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => rows.set(key, value), removeItem: (key: string) => rows.delete(key),
  } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete (globalThis as any).localStorage; });
  const account = { profileId: 'game-profile', network: 'signet' as const, server: { endpoint: 'https://example.test/api/bis/', publicKey: hex(await game.compressedPublicKey()), gameId: 'stealth-and-steel' } };
  const inputs = [{ txid: '11'.repeat(32), vout: 0 }], paymentId = '22'.repeat(32), assetId = '33'.repeat(34);
  const request = { id: crypto.randomUUID(), direction: 'buy' as const, game: { profileId: account.profileId, address: own.address('tark', operator).encode() }, player: { profileId: 'player-profile', address: recipient.address('tark', operator).encode() }, assetId, quantity: '1', priceSats: 1000 };
  await advanceLocalMarketplaceCheckout(beginLocalMarketplaceCheckout(request), { pay: async () => ({ status: 'succeeded', transactionId: paymentId }), deliver: async () => ({ status: 'pending' }) });
  writeAssetDeliveryRecord({ version: 1, id: request.id, profileId: account.profileId, network: account.network, request: { operationId: request.id, assetId, quantity: '1', recipient: request.player.address }, status: 'pending', inputs,
    inputAssets: [{ assetId, quantity: '1' }], senderScript: hex(own.pkScript), recipientScript: hex(recipient.pkScript), sourceQuantity: '1' });
  return { account, inputs, paymentId, rows, request };
}

test('private delivery hint uses the exact persisted checkout, role, network and selected inputs', async t => {
  const f = await fixture(t);
  assert.equal(marketplacePaymentEvidence(f.account, f.inputs, 'player-profile'), f.paymentId);
  assert.equal(marketplacePaymentEvidence(f.account, [{ txid: '44'.repeat(32), vout: 0 }], 'player-profile'), undefined);
  assert.equal(marketplacePaymentEvidence({ ...f.account, network: 'mutinynet' }, f.inputs, 'player-profile'), undefined);
  assert.equal(marketplacePaymentEvidence(f.account, f.inputs, undefined), undefined);
  assert.throws(() => marketplacePaymentEvidence(f.account, f.inputs, 'another-player'), /evidence changed/);
  assert.equal(marketplacePaymentEvidence(f.account, f.inputs, 'player-profile'), f.paymentId, 'reading a local hint cannot consume server authority');
});

test('missing payment evidence or changed checkout scope stops local delivery hint preparation', async t => {
  const f = await fixture(t), key = 'bis-local-marketplace-checkout-v1:' + f.request.id;
  const original = f.rows.get(key)!;
  for (const patch of [{ paymentTransactionId: undefined }, { phase: 'payment-submitted' }, { request: { ...f.request, quantity: '2' } }, { request: { ...f.request, game: { ...f.request.game, address: f.request.player.address } } }]) {
    f.rows.set(key, JSON.stringify({ ...JSON.parse(original), ...patch }));
    assert.throws(() => marketplacePaymentEvidence(f.account, f.inputs, 'player-profile'), /evidence changed|recovery data/);
  }
});
