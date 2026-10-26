import { createServer } from 'node:http';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

const [root, portText, moduleUrl] = process.argv.slice(2);
const { coordinateProject, identityMiddleware } = await import(moduleUrl);
try {
  const result = await coordinateProject({ root, port: Number(portText), canonicalPort: Number(portText),
    routes: [{ label: 'Coordination fixture', route: '/' }], timeoutMs: 3000,
    start: async identity => {
      await appendFile(join(root, 'starts.txt'), 'started\n');
      const identify = identityMiddleware(identity);
      const httpServer = createServer((req, res) => identify(req, res, () => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<title>Coordination fixture</title>');
      }));
      await new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(Number(portText), '127.0.0.1', resolve); });
      return { httpServer, close: () => new Promise(resolve => httpServer.close(resolve)) };
    },
  });
  process.send?.({ ready: true, reused: result.reused, pid: process.pid });
  if (result.reused) process.exit(0);
} catch (error) { process.send?.({ ready: false, error: error.message }); process.exit(1); }
