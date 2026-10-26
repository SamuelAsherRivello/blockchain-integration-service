import test from 'node:test';
import assert from 'node:assert/strict';
import { createWalletPool } from '../src/server/wallet-pool.ts';
import { walletCandidates, loadSignerEnvironment, readPrivateEnvironment } from '../src/server/environment.ts';

const phrases = [
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  'legal winner thank year wave sausage worth useful legal winner thank yellow',
  'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
];
const values = Object.fromEntries(['SIGNET', 'MUTINYNET'].flatMap(network => phrases.map((phrase, index) => [`BIS_GAME_WALLET_${network}_0${index + 1}_MNEMONIC`, phrase])));

test('hosted Preview uses only Preview-prefixed signer and Redis secrets', () => {
  const production = {
    VERCEL_ENV: 'preview', BIS_OWNER_TOKEN: 'production-owner', BIS_SIGNING_DAILY_CAP_SATS: '10000',
    UPSTASH_REDIS_REST_TOKEN: 'production-redis', ...values,
  };
  const preview = readPrivateEnvironment({ hosted: true, env: {
    ...production,
    BIS_PREVIEW_OWNER_TOKEN: 'preview-owner',
    BIS_PREVIEW_UPSTASH_REDIS_REST_TOKEN: 'preview-redis',
    BIS_PREVIEW_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[0],
  } });
  assert.equal(preview.BIS_OWNER_TOKEN, 'preview-owner');
  assert.equal(preview.UPSTASH_REDIS_REST_TOKEN, 'preview-redis');
  assert.equal(preview.BIS_SIGNING_DAILY_CAP_SATS, undefined);
  assert.equal(preview.BIS_GAME_WALLET_SIGNET_01_MNEMONIC, phrases[0]);
  assert.equal(preview.BIS_GAME_WALLET_SIGNET_02_MNEMONIC, undefined);
  assert.equal(walletCandidates('signet', preview).length, 1);

  const isolated = readPrivateEnvironment({ hosted: true, env: production });
  assert.equal(isolated.BIS_OWNER_TOKEN, undefined);
  assert.equal(isolated.UPSTASH_REDIS_REST_TOKEN, undefined);
  assert.deepEqual(walletCandidates('signet', isolated), []);
});

test('Production ignores Preview-prefixed configuration', () => {
  const production = readPrivateEnvironment({ hosted: true, env: {
    VERCEL_ENV: 'production', BIS_OWNER_TOKEN: 'production-owner',
    BIS_PREVIEW_OWNER_TOKEN: 'preview-owner', BIS_PREVIEW_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[0],
    BIS_GAME_WALLET_SIGNET_01_MNEMONIC: phrases[1],
  } });
  assert.equal(production.BIS_OWNER_TOKEN, 'production-owner');
  assert.equal(production.BIS_GAME_WALLET_SIGNET_01_MNEMONIC, phrases[1]);
});

test('six private slots are separate per network and retain priority', () => {
  for (const network of ['signet', 'mutinynet'] as const) {
    assert.deepEqual(walletCandidates(network, values).map(wallet => wallet.slot), ['01', '02', '03']);
    assert.ok(walletCandidates(network, values).every(wallet => wallet.network === network));
  }
  const config = loadSignerEnvironment({ env: values, hosted: true });
  assert.equal(Object.keys(config.walletEnvironment!).length, 6);
  assert.equal(walletCandidates('signet', { ...values, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: '' })[0].slot, '02');
  assert.throws(() => walletCandidates('bitcoin' as never, values), /unsupported/);
});

test('first eligible balance wins; on-chain BTC is not Arkade-spendable sats', async () => {
  const visited: string[] = [];
  const pool = createWalletPool(values, async wallet => {
    visited.push(`${wallet.network}:${wallet.slot}`);
    return wallet.slot === '01' ? { availableArkadeSats: 0, availableBitcoinSats: 20000 } : { availableArkadeSats: 5000, availableBitcoinSats: 0 };
  });
  assert.equal((await pool.select('signet', { arkadeSats: 1000 })).slot, '02');
  assert.deepEqual(visited, ['signet:01', 'signet:02']);
  assert.equal((await pool.select('mutinynet', { bitcoinSats: 1000 })).slot, '01');
  assert.equal((await pool.select('signet')).slot, '01');
  assert.equal((await pool.original('signet', (await pool.select('signet')).profileId)).slot, '01');
  await assert.rejects(pool.select('signet', { arkadeSats: 10000 }), /No game wallet meets/);
  await assert.rejects(pool.select('signet', { arkadeSats: -1 }), /Invalid/);
});

test('malformed, blank, unknown-balance and insufficient candidates fall back without leaking recovery inputs', async () => {
  const pool = createWalletPool({ ...values, BIS_GAME_WALLET_SIGNET_01_MNEMONIC: 'private-invalid-input' }, async wallet => {
    if (wallet.slot === '02') throw Error('network offline');
    return { availableArkadeSats: 2000, availableBitcoinSats: 0 };
  });
  const selected = await pool.select('signet', { arkadeSats: 1000 });
  assert.equal(selected.slot, '03');
  const publicWallets = await pool.publicWallets('signet');
  assert.equal(JSON.stringify(publicWallets).includes('mnemonic'), false);
  assert.equal(JSON.stringify(publicWallets).includes(phrases[2]), false);
  await assert.rejects(pool.original('signet', 'unknown'), /Original game wallet/);
  await assert.rejects(createWalletPool({}).select('mutinynet'), /No valid game wallet/);
});

test('original wallet never changes after balance drain or cancellation', async () => {
  let drained = false;
  const pool = createWalletPool(values, async wallet => ({ availableArkadeSats: drained && wallet.slot === '01' ? 0 : 2000, availableBitcoinSats: 0 }));
  const original = await pool.select('mutinynet', { arkadeSats: 1000 });
  drained = true;
  assert.equal((await pool.select('mutinynet', { arkadeSats: 1000 })).slot, '02');
  assert.equal((await pool.original('mutinynet', original.profileId)).slot, '01');
  await assert.rejects(pool.select('signet', {}, AbortSignal.abort()));
});
test('an unresponsive balance provider cannot prevent a bounded fallback', async () => {
  // Keep the event loop alive while testing AbortSignal.timeout's unref timer.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const pool = createWalletPool(values, async wallet => wallet.slot === '01' ? new Promise(() => {}) : { availableArkadeSats: 1000, availableBitcoinSats: 0 }, 10);
    assert.equal((await pool.select('signet', { arkadeSats: 1000 })).slot, '02');
  } finally { clearTimeout(keepAlive); }
});

test('mint and boarding selection use fresh SDK minima in their own balance domains', async () => {
  const visited: string[] = [];
  const pool = createWalletPool(values, async wallet => {
    visited.push(wallet.slot);
    return { availableArkadeSats: wallet.slot === '01' ? 500 : 2000, availableBitcoinSats: wallet.slot === '01' ? 900 : 3000, mintMinimumSats: 546, boardingMinimumSats: 1000 };
  });
  assert.equal((await pool.select('signet', {purpose:'mint'})).slot,'02');
  assert.deepEqual(visited,['01','02']); visited.length=0;
  assert.equal((await pool.select('signet', {purpose:'boarding'})).slot,'02');
  assert.deepEqual(visited,['01','02']);
  const unknown = createWalletPool(values, async () => ({availableArkadeSats:100000,availableBitcoinSats:100000}));
  await assert.rejects(unknown.select('signet',{purpose:'mint'}),/No game wallet meets/);
  await assert.rejects(unknown.select('signet',{purpose:'boarding'}),/No game wallet meets/);
  await assert.rejects(pool.select('signet',{purpose:'unknown' as never}),/Invalid wallet purpose/);
});

test('excluded Player profiles are skipped before balance reads, including identity-only selection', async () => {
  const reads:string[]=[];
  const pool=createWalletPool(values,async wallet=>{reads.push(wallet.slot);return {availableArkadeSats:2000,availableBitcoinSats:2000};});
  const first=(await pool.publicWallets('signet'))[0];
  assert.equal((await pool.select('signet',{excludedProfiles:[first.profileId]})).slot,'02');
  assert.deepEqual(reads,[]);
  assert.equal((await pool.select('signet',{arkadeSats:1000,excludedProfiles:[first.profileId]})).slot,'02');
  assert.deepEqual(reads,['02']);
  await assert.rejects(pool.select('signet',{excludedProfiles:['invalid']}),/Invalid excluded/);
});

test('asset selection requires spendable holdings, SDK carrier minimum and exact bigint quantities', async () => {
  const assetId='ab'.repeat(34),quantity='9007199254740993';
  const pool=createWalletPool(values,async wallet=>({availableArkadeSats:wallet.slot==='01'?100000:2000,availableBitcoinSats:100000,mintMinimumSats:546,
    assets:wallet.slot==='01'?{}:{[assetId]:wallet.slot==='02'?'9007199254740994':quantity}}));
  assert.equal((await pool.select('signet',{purpose:'asset',asset:{assetId,quantity}})).slot,'02');
  assert.equal((await pool.select('signet',{purpose:'asset',asset:{assetId,quantity,exact:true}})).slot,'03');
  const unavailable=createWalletPool(values,async()=>({availableArkadeSats:100000,availableBitcoinSats:100000,mintMinimumSats:546}));
  await assert.rejects(unavailable.select('signet',{purpose:'asset',asset:{assetId,quantity:'1'}}),/No game wallet meets/);
  await assert.rejects(pool.select('signet',{purpose:'asset',asset:{assetId,quantity:'0'}}),/Invalid asset requirement/);
  await assert.rejects(pool.select('signet',{purpose:'asset'}),/Asset requirement missing/);
});
