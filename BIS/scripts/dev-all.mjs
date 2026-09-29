import { createServer } from 'vite';
import { parseArgs } from 'node:util';
import { developmentConfig, packageRoutes } from './dev-config.mjs';

const { values } = parseArgs({ options: { port: { type: 'string', default: '5174' }, strictPort: { type: 'boolean' } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
const server = await createServer(developmentConfig({ port }));
try {
  await server.listen();
} catch (error) {
  await server.close();
  throw error;
}
console.log('\nBIS packages — one Vite server:\n');
for (const { label, route } of packageRoutes) console.log(`  ${label}: http://127.0.0.1:${port}${route}`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.close();
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
