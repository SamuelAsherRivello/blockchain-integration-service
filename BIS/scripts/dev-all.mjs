import { createServer } from 'vite';
import { parseArgs } from 'node:util';
import { developmentConfig } from './dev-config.mjs';
import { projectRunConfig, validateProjectRunConfig } from './project-run-config.mjs';

const config = validateProjectRunConfig(projectRunConfig);
const { values } = parseArgs({ options: { port: { type: 'string', default: String(config.preferredPort) }, strictPort: { type: 'boolean' } } });
const port = Number(values.port ?? config.preferredPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
let activePort = port;
const server = await createServer(developmentConfig({ port: activePort }));
await server.listen();
console.log(`\nProject run mode: ${config.serverMode}; one Vite server\n`);
for (const { label, route } of config.routes) console.log(`  ${label}: http://127.0.0.1:${activePort}${route}`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.close();
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
