import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { developmentConfig } from './dev-config.ts';
import { projectRunConfig, validateProjectRunConfig } from './project-run-config.ts';
import { acquireStartupLock, coordinateProject, identityMiddleware } from './project-run-coordination.ts';

const config = validateProjectRunConfig(projectRunConfig);
const { values } = parseArgs({ options: { host: { type: 'string', default: '127.0.0.1' }, port: { type: 'string', default: String(config.preferredPort) }, faucetPort: { type: 'string', default: String(config.faucetPort) }, strictPort: { type: 'boolean' }, isolated: { type: 'boolean' }, 'no-hmr': { type: 'boolean' } } });
const port = Number(values.port ?? config.preferredPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
const faucetPort = Number(values.faucetPort);
if (!Number.isInteger(faucetPort) || faucetPort < 1 || faucetPort > 65535) throw new Error('Faucet port must be an integer from 1 to 65535.');
if (!values.isolated && faucetPort !== config.faucetPort) throw new Error('The shared faucet API port is fixed at 5190.');
const result = await coordinateProject({
  root: fileURLToPath(new URL('../../', import.meta.url)), port, canonicalPort: config.preferredPort,
  routes: config.routes, isolated: values.isolated === true,
  start: async identity => {
    const serverConfig = developmentConfig({ port, faucetPort });
    serverConfig.server.host = values.host;
    serverConfig.server.strictPort = true;
    if (values['no-hmr']) serverConfig.server.hmr = false;
    serverConfig.plugins.push({ name: 'project-run-identity', configureServer(candidate) {
      candidate.middlewares.use(identityMiddleware(identity));
    } });
    const candidate = await createServer(serverConfig);
    try { await candidate.listen(); return candidate; }
    catch (error) { await candidate.close(); throw error; }
  },
});
if (result.reused) process.exit(0);
const server = result.server;
const activePort = result.port;
const faucetPackage = resolve(fileURLToPath(new URL('../packages/prototype-faucet/', import.meta.url)));
let faucetApi;
const releaseFaucetLock = await acquireStartupLock(resolve(fileURLToPath(new URL('../../output/run-state/', import.meta.url)), `sidecar-${faucetPort}`));
try {
  const checkFaucet = async () => {
    const response = await fetch(`http://127.0.0.1:${faucetPort}/api/faucet/health`, { signal: AbortSignal.timeout(1500) });
    const health = await response.json();
    if (!response.ok || health.status !== 'ok' || !['signet','mutinynet'].every(network => health.networks?.includes(network))) {
      throw new Error('Existing faucet API is unhealthy or has the wrong identity. It was preserved.');
    }
  };
  try { await checkFaucet(); }
  catch (error) {
    if (error.cause?.code !== 'ECONNREFUSED') throw error;
    faucetApi = spawn(process.execPath, ['--experimental-eventsource', 'src/server/server.ts'], {
      cwd: faucetPackage,
      env: { ...process.env, FAUCET_PORT: String(faucetPort) },
      stdio: 'inherit',
    });
    let spawnError;
    faucetApi.once('error', error => { spawnError = error; });
    const deadline = Date.now() + 10000;
    for (;;) {
      if (spawnError || faucetApi.exitCode !== null) throw new Error('New faucet API failed to start.');
      try { await checkFaucet(); break; }
      catch (error) { if (Date.now() >= deadline) throw error; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
} catch (error) {
  // Only this new frontend is closed. Never terminate an existing API.
  await server.close();
  throw error;
} finally { await releaseFaucetLock(); }
console.log(`\nProject run mode: ${config.serverMode}; one Vite server\n`);
for (const { label, route } of config.routes) console.log(`  ${label}: http://127.0.0.1:${activePort}${route}`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  faucetApi?.kill();
  await server.close();
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);


