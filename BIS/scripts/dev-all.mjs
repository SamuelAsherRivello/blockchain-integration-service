import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { developmentConfig } from './dev-config.mjs';
import { projectRunConfig, validateProjectRunConfig } from './project-run-config.mjs';

const config = validateProjectRunConfig(projectRunConfig);
const { values } = parseArgs({ options: { host: { type: 'string', default: '127.0.0.1' }, port: { type: 'string', default: String(config.preferredPort) }, faucetPort: { type: 'string', default: process.env.FAUCET_PORT ?? '5190' }, strictPort: { type: 'boolean' }, 'no-hmr': { type: 'boolean' } } });
const port = Number(values.port ?? config.preferredPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
let activePort = port;
const faucetPort = Number(values.faucetPort);
if (!Number.isInteger(faucetPort) || faucetPort < 1 || faucetPort > 65535) throw new Error('Faucet port must be an integer from 1 to 65535.');
const serverConfig = developmentConfig({ port: activePort, faucetPort });
serverConfig.server.host = values.host;
if (values['no-hmr']) serverConfig.server.hmr = false;
const server = await createServer(serverConfig);
await server.listen();
const faucetPackage = resolve(fileURLToPath(new URL('../packages/prototype-faucet/', import.meta.url)));
let faucetApi;
try {
  await fetch(`http://127.0.0.1:${faucetPort}/api/faucet/health`, { signal: AbortSignal.timeout(500) });
} catch {
  faucetApi = spawn(process.execPath, ['--experimental-eventsource', '--env-file-if-exists=.env.local', 'src/server/server.mjs'], {
    cwd: faucetPackage,
    env: { ...process.env, FAUCET_PORT: String(faucetPort) },
    stdio: 'inherit',
  });
}
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
