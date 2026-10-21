import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEMOS, HOME_PATH, SETUP_PATH, getActiveDemo, isHomePath, isSetupPath, sandboxBasePath } from '../src/client/navigation.ts';

const packageRoot = new URL('../', import.meta.url);

test('sandbox navigation preserves the deployed Pages prefix without changing local routes', () => {
  for (const base of ['/', './', '/prototype-sandbox/']) assert.equal(sandboxBasePath(base), '/prototype-sandbox/');
  assert.equal(sandboxBasePath('/blockchain-integration-service/prototype-sandbox/'), '/blockchain-integration-service/prototype-sandbox/');
});

test('each prototype-sandbox route has an entry document and a route contract', async () => {
  const routes = [HOME_PATH, SETUP_PATH, ...DEMOS.map(demo => demo.path)];
  assert.equal(new Set(routes).size, routes.length);

  for (const route of routes) {
    const directory = route === HOME_PATH
      ? '.'
      : route.replace('/prototype-sandbox/', '').replace(/\/$/, '');
    const entry = new URL(`${directory === '.' ? '' : `${directory}/`}index.html`, packageRoot);
    await access(entry);
    const html = await readFile(entry, 'utf8');
    assert.match(html, /<main id="root"><\/main>/, route);
  }

  assert.equal(isHomePath(HOME_PATH), true);
  assert.equal(isSetupPath(SETUP_PATH), true);
  for (const demo of DEMOS) assert.equal(getActiveDemo(demo.path), demo.number, demo.path);
});
