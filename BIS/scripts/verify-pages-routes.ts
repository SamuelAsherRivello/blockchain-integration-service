// This module is plain TypeScript: Node's built-in type stripping does not load .tsx files.
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
import { DEMOS } from '../packages/prototype-sandbox/src/client/navigation.ts';

const artifactRoot = resolve(import.meta.dirname, '..', '..', 'output', 'pages', 'deploy-separate-pages-demos');
const legacyRoutes = JSON.parse(await readFile(new URL('./slidev-legacy-routes.json', import.meta.url), 'utf8'));
const releaseVersion = JSON.parse(await readFile(resolve(import.meta.dirname, '..', '..', 'package.json'), 'utf8')).version;
const mime = new Map([['.css', 'text/css'], ['.html', 'text/html'], ['.js', 'text/javascript'], ['.json', 'application/json'], ['.png', 'image/png'], ['.svg', 'image/svg+xml']]);
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/blockchain-presentations/')) {
      response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Redirect target</title>');
      return;
    }
    const candidate = resolve(artifactRoot, `.${normalize(pathname)}`);
    if (!candidate.startsWith(artifactRoot)) throw Error('outside artifact');
    const file = (await stat(candidate)).isDirectory() ? join(candidate, 'index.html') : candidate;
    await access(file);
    response.writeHead(200, { 'content-type': mime.get(extname(file)) ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolveServer => server.listen(0, '127.0.0.1', resolveServer));
const address = server.address();
if (!address || typeof address === 'string') throw Error('Unable to start Pages artifact server.');
const base = `http://127.0.0.1:${address.port}/blockchain-integration-service/`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext();
let blockedProviderRequests = 0;
await context.route('**/*', route => {
  if (new URL(route.request().url()).origin === new URL(base).origin) return route.continue();
  blockedProviderRequests++;
  return route.abort('blockedbyclient');
});
await context.routeWebSocket('**', socket => socket.close());
const demoNumbers = DEMOS.map(demo => demo.number).sort((a, b) => a - b);
assert.equal(new Set(demoNumbers).size, demoNumbers.length);
for (const required of [22, 23, 24, 25]) assert.ok(demoNumbers.includes(required), `missing Treasure page ${required}`);
try {
  const admin = await context.newPage();
  const adminResponse = await admin.goto(`${base}admin/`, { waitUntil: 'networkidle' });
  assert.equal(adminResponse?.status(), 200);
  await expectText(admin, 'Blockchain Integration Service - Demo');
  await expectText(admin, `v${releaseVersion}`);

  const marketplace = await context.newPage();
  const marketplaceResponse = await marketplace.goto(`${base}marketplace/`, { waitUntil: 'networkidle' });
  assert.equal(marketplaceResponse?.status(), 200);
  await expectText(marketplace, 'Marketplace');
  await expectText(marketplace, `v${releaseVersion}`);
  const catalog = await marketplace.request.get(`${base}marketplace/catalog.json`);
  assert.equal(catalog.status(), 200);
  const artwork = await marketplace.request.get(`${base}assets/marketplace/v1/shoes-1.png`);
  assert.equal(artwork.status(), 200);
  const legacyMarketplaceResponse = await marketplace.goto(`${base}integration-marketplace/`, { waitUntil: 'networkidle' });
  assert.equal(legacyMarketplaceResponse?.status(), 200);
  await expectText(marketplace, 'Marketplace');
  await expectText(marketplace, `v${releaseVersion}`);
  const sandbox = await context.newPage();
  const sandboxResponse = await sandbox.goto(`${base}prototype-sandbox/demo-21/`);
  assert.equal(sandboxResponse?.status(), 200);
  await expectText(sandbox, 'BIS - Prototype Sandbox - Events');
  const navigation = sandbox.getByRole('navigation');
  const links = await navigation.locator('a[href]').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
  assert.ok(links.includes('/blockchain-integration-service/prototype-sandbox/setup/'));
  assert.ok(links.includes('/blockchain-integration-service/prototype-sandbox/'));
  assert.deepEqual([...new Set(links.filter(link => link?.includes('/demo-')))].sort(),
    demoNumbers.filter(number => number !== 21).map(number => `/blockchain-integration-service/prototype-sandbox/demo-${number}/`).sort(),
    'every registered demo except the active Events page must have a navigation link');
  assert.ok(links.every(link => link?.startsWith('/blockchain-integration-service/prototype-sandbox/')));
  const opened = sandbox.waitForEvent('popup');
  await sandbox.getByRole('button', { name: 'Execute', exact: true }).click();
  const monitor = await opened;
  await monitor.getByRole('status').waitFor();
  assert.ok(new URL(monitor.url()).pathname.endsWith('/blockchain-integration-service/prototype-sandbox/events-monitor/'));
  assert.equal(await monitor.locator('.wallet-events-front .wallet-events-network').textContent(), '(Signet)');
  for (const demo of demoNumbers) {
    const response = await sandbox.goto(`${base}prototype-sandbox/demo-${demo}/`);
    assert.equal(response?.status(), 200, `Sandbox demo ${demo}`);
    assert.match(await sandbox.getByRole('link', { name: 'Open source file', exact: true }).getAttribute('href') ?? '', /^https:\/\/github.com\/SamuelAsherRivello\/blockchain-integration-service\/blob\/main\//);
    await sandbox.getByRole('tab', { name: 'Diagram', exact: true }).click();
    await sandbox.locator('.sandbox-diagram-canvas svg').waitFor();
  }
  await sandbox.goto(`${base}prototype-sandbox/setup/`);
  assert.equal(monitor.isClosed(), false, 'monitor survives navigation');
  await monitor.close();
  await expectText(sandbox, 'Wallet 1');
  await sandbox.goto(`${base}prototype-sandbox/`);
  await expectText(sandbox, 'Prototype Sandbox');
  console.log(`PASS deployed-prefix Sandbox navigation, Setup, Home and all ${demoNumbers.length} diagrams, including Treasure pages 22-25`);
  const stagedRoot = resolve(artifactRoot, 'blockchain-integration-service');
  await access(resolve(stagedRoot, 'slidev', 'index.html'));
  for (const [deck, count] of Object.entries(legacyRoutes.decks)) {
    await access(resolve(stagedRoot, 'slidev', deck, 'index.html'));
    for (let slide = 1; slide <= count; slide++) {
      await access(resolve(stagedRoot, 'slidev', deck, String(slide), 'index.html'));
    }
  }
  const redirects = await context.newPage();
  const deck = 'blockchain-for-game-designers';
  for (const [oldRoute, newRoute] of [
    ['slidev/', ''],
    [`slidev/${deck}/`, `${deck}/`],
    [`slidev/${deck}/29/`, `${deck}/29/#/29`],
    [`slidev/${deck}/#/29?v=0.0.4`, `${deck}/29/#/29?v=0.0.4`],
  ]) {
    await redirects.goto(`${base}${oldRoute}`, { waitUntil: 'domcontentloaded' });
    await redirects.waitForURL(`${new URL(base).origin}/blockchain-presentations/${newRoute}`);
  }
  console.log(`PASS ${base}admin/, ${base}marketplace/, legacy integration-marketplace/ and ${base}prototype-sandbox/demo-21/`);
  console.log(`PASS ${Object.keys(legacyRoutes.decks).length} Slidev deck redirect trees and legacy URL forms`);
  console.log(`PASS static route verification with no provider traffic forwarded; ${blockedProviderRequests} external requests blocked. This does not verify wallet operations.`);
} finally {
  await browser.close();
  await new Promise(resolveServer => server.close(resolveServer));
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible' });
}
