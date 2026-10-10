import { createServer } from 'vite';
import { parseArgs } from 'node:util';
import { developmentConfig, packageRoutes } from './dev-config.mjs';

const { values } = parseArgs({ options: { port: { type: 'string', default: '5174' }, strictPort: { type: 'boolean' } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
let activePort = port;
let server;
while (!server) {
  const candidate = await createServer(developmentConfig({ port: activePort }));
  try {
    await candidate.listen();
    server = candidate;
  } catch (error) {
    await candidate.close();
    const addressInUse = error?.code === 'EADDRINUSE' || /port \d+ is already in use/i.test(error?.message ?? '');
    if (!addressInUse) throw error;
    activePort += 1;
  }
}
console.log('\nBIS packages — one Vite server:\n');
for (const { label, route } of packageRoutes) console.log(`  ${label}: http://127.0.0.1:${activePort}${route}`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.close();
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
