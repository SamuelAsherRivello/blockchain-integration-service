import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireStartupLock, coordinateProject } from './project-run-coordination.ts';

const fixture = fileURLToPath(new URL('./fixtures/project-run-server.ts', import.meta.url));
const artifactRoot = fileURLToPath(new URL('../../output/tests/server-coordination/', import.meta.url));
const adjacentGameRoot = fileURLToPath(new URL('../../../blockchain-stealth-and-steel-game/', import.meta.url));
async function workspace() { await mkdir(artifactRoot, { recursive: true }); return mkdtemp(join(artifactRoot, 'case-')); }
async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function launch(t, root, port, moduleUrl, env = process.env) {
  const child = fork(fixture, [root, String(port), moduleUrl], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Fixture readiness timeout')), 10000);
    child.once('message', value => { clearTimeout(timer); resolve(value); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (code) reject(Error('Fixture exited ' + code)); });
  });
}

for (const [name, moduleUrl] of [
  ['BIS', new URL('./project-run-coordination.ts', import.meta.url).href],
  ['game', pathToFileURL(join(adjacentGameRoot, 'stealth-steel/tools/dev/project-run-coordination.mjs')).href],
]) {
  test(name + ' simultaneous starts create one server and preserve its original record on reuse',
    { skip: !existsSync(fileURLToPath(moduleUrl)) && 'Adjacent game checkout is optional.' }, async t => {
    const root = await workspace(), port = await freePort();
    const results = await Promise.all([launch(t, root, port, moduleUrl), launch(t, root, port, moduleUrl)]);
    assert.ok(results.every(result => result.ready));
    assert.deepEqual(results.map(result => result.reused).sort(), [false, true]);
    assert.equal(await readFile(join(root, 'starts.txt'), 'utf8'), 'started\n');
    const statePath = join(root, 'output/run-state/project-run.json');
    const original = await readFile(statePath, 'utf8');
    const reused = await launch(t, root, port, moduleUrl);
    assert.equal(reused.reused, true);
    assert.equal(await readFile(statePath, 'utf8'), original);
  });
}

test('startup lock waits without stealing and can be acquired after release', async () => {
  const root = await workspace();
  const release = await acquireStartupLock(root);
  await assert.rejects(acquireStartupLock(root, 100), /busy or stale/);
  await release();
  await (await acquireStartupLock(root, 100))();
});

test('run-helper lock handoff does not deadlock the child or release the parent lock', async t => {
  const root = await workspace(), port = await freePort();
  const directory = join(root, 'output/run-state');
  const release = await acquireStartupLock(directory);
  try {
    const ownerPath = join(directory, 'startup.lock/owner.json');
    const owner = JSON.parse(await readFile(ownerPath, 'utf8'));
    const result = await launch(t, root, port, new URL('./project-run-coordination.ts', import.meta.url).href,
      { ...process.env, PROJECT_RUN_LOCK_TOKEN: owner.token });
    assert.equal(result.ready, true);
    assert.equal(result.reused, false);
    assert.equal(JSON.parse(await readFile(ownerPath, 'utf8')).token, owner.token);
  } finally { await release(); }
});

test('noncanonical shared port fails before any server is created', async () => {
  let started = false;
  await assert.rejects(coordinateProject({ root: await workspace(), port: 5175, canonicalPort: 5174,
    routes: [], start: () => { started = true; } }), /fixed at 5174/);
  assert.equal(started, false);
});

test('isolated tests cannot occupy another project or service reservation', async () => {
  const root = await workspace();
  for (const port of [5174, 5176, 5190]) {
    await assert.rejects(coordinateProject({ root, port, canonicalPort: 5174, isolated: true,
      routes: [], start: () => assert.fail('Reserved port must never be bound') }), /reserved shared service port/);
  }
});

test('foreign listener is preserved and never replaced by a fallback', async () => {
  const foreign = createServer((req, res) => res.end('<title>Foreign application</title>'));
  await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
  const port = foreign.address().port;
  try {
    await assert.rejects(coordinateProject({ root: await workspace(), port, canonicalPort: port,
      routes: [{ label: 'Expected', route: '/' }], start: async () => { throw Error('EADDRINUSE'); } }), /EADDRINUSE/);
    assert.equal(await (await fetch('http://127.0.0.1:' + port)).text(), '<title>Foreign application</title>');
  } finally { await new Promise(resolve => foreign.close(resolve)); }
});

const helper = join(homedir(), '.agents/skills/ai-skills-project-run-start/run-project.ps1');
test('installed helper launches under its lock, reuses the coordinated child and preserves its record',
  { skip: process.platform !== 'win32' || !existsSync(helper), timeout: 60000 }, async t => {
    const root = await workspace(), port = await freePort();
    const moduleUrl = new URL('./project-run-coordination.ts', import.meta.url).href;
    await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, scripts: {
      dev: 'node "' + fixture + '" "' + root + '" ' + port + ' "' + moduleUrl + '"',
    } }));
    t.after(async () => {
      try {
        const record = JSON.parse(await readFile(join(root, 'output/run-state/project-run.json'), 'utf8'));
        const response = await fetch('http://127.0.0.1:' + port + '/__project_run_identity', { signal: AbortSignal.timeout(2000) });
        const identity = await response.json();
        if (record.projectRoot === root && record.instanceId === identity.instanceId && record.listenerPids.includes(identity.pid)) process.kill(identity.pid);
      } catch {}
    });
    const args = ['-NoProfile', '-File', helper, '-ProjectRoot', root, '-Port', String(port),
      '-RoutesJson', JSON.stringify([{ label: 'Coordination fixture', route: '/' }]), '-StableSamples', '1'];
    const execute = () => promisify(execFile)('pwsh', args, { windowsHide: true, timeout: 45000 });
    await Promise.all([execute(), execute()]);
    const statePath = join(root, 'output/run-state/project-run.json');
    const record = await readFile(statePath, 'utf8');
    await Promise.all([execute(), execute()]);
    assert.equal(await readFile(statePath, 'utf8'), record);
    assert.equal(await readFile(join(root, 'starts.txt'), 'utf8'), 'started\n');
  });
