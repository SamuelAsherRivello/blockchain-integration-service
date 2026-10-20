import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { developmentConfig, packageRoutes } from './dev-config.ts';

test('one Vite server serves package applications, resources, and linked READMEs', async t => {
  const server = await createServer(developmentConfig({ port: 0 }));
  t.after(() => server.close());
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  async function get(path, type = 'text/html') {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get('content-type')?.includes(type), `${path}: ${response.headers.get('content-type')}`);
    return response.text();
  }

  const landing = await get('/');
  assert.match(landing, /<title>Blockchain Integration Service<\/title>/);
  assert.match(landing, /href="\.\/admin\/"/);
  assert.match(landing, /href="\.\/integration-marketplace\/"/);
  assert.match(landing, /<h2 id="apps-heading">Apps<\/h2>/);
  assert.match(landing, /<h2 id="prototypes-heading">Prototypes<\/h2>/);
  assert.match(landing, /<h2 id="other-heading">Other<\/h2>/);
  assert.equal((landing.match(/target="_blank"/g) ?? []).length, 8);

  for (const [path, title] of [['/admin/', 'BIS - Admin'], ['/integration-marketplace/', 'BIS - Marketplace'], ['/prototype-onboarding/', 'BIS - Prototype Onboarding'], ['/onboarding/', 'BIS - Prototype Onboarding'], ['/prototype-faucet/', 'BIS - Prototype Faucet']]) {
    const html = await get(path);
    assert.ok(html.includes(`<title>${title}</title>`));
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
    assert.ok(scripts.includes('/@vite/client'));
    const entry = scripts.find(src => src !== '/@vite/client');
    assert.ok(entry);
    await get(new URL(entry, origin + path).pathname, 'javascript');
  }
  const catalog = JSON.parse(await get('/integration-marketplace/catalog.json', 'application/json'));
  assert.equal(catalog.version, 2);
  assert.ok(catalog.games.some(game => game.gameId === 'stealth-and-steel'));
  for (const app of packageRoutes.filter(app => !app.readme)) {
    const favicon = await fetch(origin + app.route + 'favicon.png');
    if (app.directory === 'prototype-faucet' || app.directory === 'prototype-sandbox') assert.equal(favicon.status, 404, app.route + 'favicon.png');
    else {
      assert.equal(favicon.status, 200, app.route + 'favicon.png');
      assert.ok(favicon.headers.get('content-type')?.includes('image/png'));
    }
    assert.equal((await fetch(origin + app.route + 'missing.html')).status, 404);
  }
  await get('/admin/assets/achievements/v2/level-1-trophy.png', 'image/png');
  assert.match(await get('/admin/book/'), /The Courage to Be Disliked/);
  assert.match(await get('/admin/documentation/user-stories/'), /User Story Diagrams/);
  assert.match(await get('/BIS/documentation/User%20Story%20Diagrams.md?raw&import', 'javascript'), /export default/);
  const adminModule = await get('/admin/src/client/admin-layer/AdminPanel.tsx', 'javascript');
  assert.ok(adminModule.includes('/admin/'));
  const marketplaceModule = await get('/integration-marketplace/src/client/marketplace-layer/App.tsx', 'javascript');
  assert.ok(marketplaceModule.includes('/marketplace/'));

  const readme = await get('/integration/');
  assert.match(readme, /<link rel="icon" type="image\/png" href="\/favicon\.png">/);
  assert.match(readme, /<title>BIS - Integration<\/title>/);
  assert.match(readme, /<h1[^>]*>Integration package<\/h1>/);
  assert.match(readme, /<base href="\/BIS\/packages\/integration\/">/);
  assert.match(readme, /href="\.\.\/\.\.\/\.\.\/README.md"/);
  assert.doesNotMatch(readme, /<script[^>]+src="[^\"]*(?:bootstrap|main\.tsx)/);
  const main = await get('/README.md');
  assert.match(main, /External Packages/);
  assert.match(main, /Internal Packages/);
  for (const app of packageRoutes) {
    const path = `/BIS/packages/${app.directory}/${app.directory}-package-readme.md`;
    assert.ok(main.includes(`href="${path.slice(1)}"`));
    assert.match(await get(path), /href="\.\.\/\.\.\/\.\.\/README.md"/);
  }
  assert.match(await get('/BIS/packages/integration/integration-package-readme.md?raw&import', 'javascript'), /export default/);
  const sharedReadme = await get('/shared/');
  assert.match(sharedReadme, /<title>BIS - Shared<\/title>/);
  assert.match(sharedReadme, /<base href="\/BIS\/packages\/shared\/">/);
  for (const path of [
    '/BIS/packages/shared/.env.local', '/BIS/packages/shared/%2eenv.local?raw&import',
    '/shared/.env.local', '/prototype-faucet/.env.local', '/BIS/packages/shared/.env.local.backup',
  ]) assert.equal((await fetch(origin + path)).status, 403, 'private environment path must be denied');

  // Exercise the actual root launcher: it must select a new port when needed.
  const child = spawn(process.execPath, [fileURLToPath(new URL('./dev-all.ts', import.meta.url)), '--port', String(server.httpServer.address().port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(child.exitCode, null, output);
  assert.match(output, /Project run mode: shared; one Vite server/);
  const port = Number(output.match(/BIS - Admin: http:\/\/127\.0\.0\.1:(\d+)\/admin\//)?.[1]);
  assert.ok(port > 0 && port !== server.httpServer.address().port, output);
  const response = await fetch(`http://127.0.0.1:${port}/admin/`);
  assert.equal(response.status, 200);
});


