import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const artifactRoot = resolve(import.meta.dirname, '..', '..', 'output', 'pages', 'deploy-separate-pages-demos');
const mime = new Map([['.css', 'text/css'], ['.html', 'text/html'], ['.js', 'text/javascript'], ['.json', 'application/json'], ['.png', 'image/png'], ['.svg', 'image/svg+xml']]);
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
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
try {
  const admin = await browser.newPage();
  const adminResponse = await admin.goto(`${base}admin/`, { waitUntil: 'networkidle' });
  assert.equal(adminResponse?.status(), 200);
  await expectText(admin, 'Blockchain Integration Service - Demo');

  const marketplace = await browser.newPage();
  const marketplaceResponse = await marketplace.goto(`${base}marketplace/`, { waitUntil: 'networkidle' });
  assert.equal(marketplaceResponse?.status(), 200);
  await expectText(marketplace, 'Marketplace');
  const catalog = await marketplace.request.get(`${base}marketplace/catalog.json`);
  assert.equal(catalog.status(), 200);
  const artwork = await marketplace.request.get(`${base}assets/marketplace/v1/shoes-1.png`);
  assert.equal(artwork.status(), 200);
  console.log(`PASS ${base}admin/ and ${base}marketplace/`);
} finally {
  await browser.close();
  await new Promise(resolveServer => server.close(resolveServer));
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible' });
}
