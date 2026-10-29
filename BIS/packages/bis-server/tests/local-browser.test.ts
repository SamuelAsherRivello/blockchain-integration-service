import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { developmentConfig } from '../../../scripts/dev-config.ts';
import { randomUUID } from 'node:crypto';
import { createHostedHandler } from '../src/server/hosted.ts';
import { createWalletPool } from '../src/server/wallet-pool.ts';
import type { SigningStore } from '../src/server/signing-store.ts';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// These browser-only transports are explicit fixture endpoints. Production CSP
// must not allow arbitrary HTTPS connections just to accommodate test routing.
test.beforeEach(t=>{
  const previous=process.env.BIS_CSP_CONNECT_ORIGINS;
  process.env.BIS_CSP_CONNECT_ORIGINS=[previous,'https://selection.fixture.test','https://owner.fixture.test'].filter(Boolean).join(' ');
  t.after(()=>{if(previous===undefined)delete process.env.BIS_CSP_CONNECT_ORIGINS;else process.env.BIS_CSP_CONNECT_ORIGINS=previous;});
});

test('public Game Wallet view selects funded slot 02 without owner login and retains it after reload', { timeout: 60000 }, async t => {
  const second = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
  const env = { BIS_OWNER_TOKEN: randomUUID() + randomUUID(), BIS_GAME_WALLET_SIGNET_01_MNEMONIC: mnemonic, BIS_GAME_WALLET_SIGNET_02_MNEMONIC: second, BIS_PUBLIC_PAYMENT_SIGNING: 'true', BIS_PUBLIC_SIGNING_NETWORKS: 'signet' };
  const reads: string[] = [], requests: any[] = [];
  const pool = createWalletPool(env, async wallet => { reads.push(wallet.slot); return {availableArkadeSats:wallet.slot==='02'?2000:0,availableBitcoinSats:20000}; });
  const wallets = await pool.publicWallets('signet'), expected = wallets.find(wallet => wallet.slot === '02')!;
  const store: SigningStore = { ping:async()=>{},consumePublicRequest:async()=>{},assetAllowed:async()=>false,
    claim:async()=>{throw Error('No financial signing in this browser test.');},complete:async()=>{throw Error('No financial signing in this browser test.');},session:async()=>{throw Error('No financial signing in this browser test.');} };
  const handler = createHostedHandler({env,pool,store});
  const config = developmentConfig({port:0,signerConfig:{enabled:false,network:'signet',gameId:'stealth-and-steel'}});
  config.cacheDir = `output/reports/bis-server/selection-browser-${process.pid}`;
  const server = await createServer(config); await server.listen(); t.after(()=>server.close());
  const browser = await chromium.launch({headless:true,...(process.env.BIS_PLAYWRIGHT_CHANNEL?{channel:process.env.BIS_PLAYWRIGHT_CHANNEL}:{})});
  t.after(()=>browser.close()); const page = await browser.newPage();
  await page.addInitScript(balances => { (globalThis as any).__bisSelectionBalances = balances; }, {[expected.profileId]:2000});
  await page.route('https://selection.fixture.test/api/bis/**',async route=>{
    const request=route.request(); requests.push({body:request.postDataJSON(),authorization:request.headers().authorization});
    const response=await handler(new Request(request.url(),{method:request.method(),headers:{...request.headers(),origin:'https://samuelasherrivello.github.io'},body:request.postData()??undefined}));
    await route.fulfill({status:response.status,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization'},body:await response.text()});
  });
  const url=new URL('/BIS/packages/bis-server/tests/fixtures/wallet-host.html?selection-test=1',server.resolvedUrls!.local[0]).href;
  await page.goto(url);
  await page.waitForFunction(profile=>Object.entries(localStorage).some(([key,value])=>key.startsWith('bis-game-server-profile-v1:')&&value===profile),expected.profileId);
  await page.getByText('Game wallet source: Server',{exact:true}).waitFor();
  assert.deepEqual(reads,['01','02']);
  assert.ok(requests.some(row=>row.body.requirement?.arkadeSats===1000));
  assert.equal(requests.some(row=>row.authorization),false);
  assert.equal(await page.getByRole('button',{name:/Restore Wallet/}).count(),0);
  await page.reload(); await page.getByText('Game wallet source: Server',{exact:true}).waitFor();
  assert.equal(requests.at(-1).body.profileId,expected.profileId);
  assert.match(await page.locator('.bis-version-label').innerText(),/Server/);
  assert.equal(JSON.stringify(requests).includes(env.BIS_OWNER_TOKEN),false);
});
for (const enabled of [true, false]) test(`same Vite server: ${enabled ? 'Server banner and public wallet' : 'manual login without server'}`, { timeout: 60000 }, async t => {
  const signerConfig = { mnemonic, enabled, network: 'signet' as const, gameId: 'stealth-and-steel' };
  const config = developmentConfig({ port: 0, signerConfig });
  config.cacheDir = `output/reports/bis-server/local-browser-${process.pid}-${enabled}`;
  const server = await createServer(config); await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ headless: true, ...(process.env.BIS_PLAYWRIGHT_CHANNEL ? { channel: process.env.BIS_PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const url = server.resolvedUrls!.local[0];
  await page.goto(new URL('/BIS/packages/bis-server/tests/fixtures/wallet-host.html', url).href);
  await page.getByRole('heading', { name: 'Game Wallet', exact: true }).waitFor();
  if (enabled) {
    await page.getByText('Game wallet source: Server', { exact: true }).waitFor();
    assert.match(await page.locator('.bis-version-label').innerText(), /Server/);
    assert.equal(await page.getByRole('button', { name: /Restore Wallet/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Log Out Game Wallet' }).count(), 0);
    const reconnect = page.waitForRequest(request => request.url().endsWith('/api/bis/connect') && request.method() === 'POST');
    await page.reload();
    const pinned = (await reconnect).postDataJSON();
    assert.match(pinned.profileId, /^[0-9a-f]{64}$/);
    await page.getByText('Game wallet source: Server', { exact: true }).waitFor();
    const remembered = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('bis-game-server-profile-v1:')).map(([, value]) => value));
    assert.deepEqual(remembered, [pinned.profileId]);
    signerConfig.enabled = false;
    await page.getByRole('button', { name: 'Retry server connection' }).click();
    await page.getByRole('button', { name: /Restore Wallet/ }).waitFor();
    assert.doesNotMatch(await page.locator('.bis-version-label').innerText(), /Server/);
    signerConfig.enabled = true;
    await page.getByRole('button', { name: 'Retry server connection' }).click();
    await page.getByText('Game wallet source: Server', { exact: true }).waitFor();
  } else {
    await page.getByRole('button', { name: /Restore Wallet/ }).waitFor();
    assert.doesNotMatch(await page.locator('.bis-version-label').innerText(), /Server/);
    assert.equal(await page.getByRole('button', { name: /Create Wallet/ }).isEnabled(), true);
  }
  for (const route of ['/admin/', '/integration-marketplace/', '/bis-server/']) assert.equal((await fetch(new URL(route, url))).status, 200, route);
  for (const route of ['/BIS/packages/bis-server/.env.local?raw', '/BIS/packages/bis-server/.ENV.LOCAL?raw', '/BIS/packages/bis-server/%2Eenv%2Elocal?raw', '/BIS/packages/bis-server/src/server/signer.ts?raw', '/@fs/D:/Documents/Projects/VC/Bitcoin/blockchain-integration-service/BIS/packages/bis-server/.env.local']) assert.equal((await fetch(new URL(route, url))).status, 403, route);
});

test('private owner controls connect, forget and reload without persisting credentials', { timeout: 60000 }, async t => {
  const config = developmentConfig({ port: 0, signerConfig: { enabled: false, network: 'signet', gameId: 'stealth-and-steel' } });
  config.cacheDir = `output/reports/bis-server/owner-browser-${process.pid}`;
  const server = await createServer(config); await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch({ headless: true, ...(process.env.BIS_PLAYWRIGHT_CHANNEL ? { channel: process.env.BIS_PLAYWRIGHT_CHANNEL } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const token = randomUUID() + randomUUID();
  const handler = createHostedHandler({ env: { BIS_OWNER_TOKEN: token, BIS_OWNER_SIGNING_NETWORKS: 'signet', BIS_GAME_WALLET_SIGNET_01_MNEMONIC: mnemonic } });
  await page.route('https://owner.fixture.test/api/bis/**', async route => {
    const request = route.request();
    const response = await handler(new Request(request.url(), { method: request.method(), headers: { ...request.headers(), origin: 'https://samuelasherrivello.github.io' }, body: request.postData() ?? undefined }));
    await route.fulfill({ status: response.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization' }, body: await response.text() });
  });
  const url = new URL('/BIS/packages/bis-server/tests/fixtures/wallet-host.html?owner-test=1', server.resolvedUrls!.local[0]).href;
  await page.goto(url);
  await page.getByText('Game server unavailable', { exact: true }).waitFor();
  await page.getByText('Operator owner access', { exact: true }).click();
  const input = page.getByLabel('Private owner token');
  assert.equal(await input.getAttribute('type'), 'password');
  await input.fill('too-short');
  await page.getByRole('button', { name: 'Connect owner access', exact: true }).click();
  await page.getByText('Use an owner token of at least 32 characters, not a recovery phrase.', { exact: true }).waitFor();
  await input.fill(token);
  await page.getByRole('button', { name: 'Connect owner access', exact: true }).click();
  await page.getByText('Game wallet source: Server', { exact: true }).waitFor();
  assert.equal(await input.inputValue(), '');
  assert.equal((await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).includes(token), false);
  await page.getByRole('button', { name: 'Forget owner access', exact: true }).click();
  await page.getByText('Game server unavailable', { exact: true }).waitFor();
  await input.fill(token);
  await page.getByRole('button', { name: 'Connect owner access', exact: true }).click();
  await page.getByText('Game wallet source: Server', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Game server unavailable', { exact: true }).waitFor();
  assert.doesNotMatch(await page.locator('.bis-version-label').innerText(), /Server/);
});
