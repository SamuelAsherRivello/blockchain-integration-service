import {readFile, writeFile, access} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ArkAddress} from '@arkade-os/sdk';

export async function saveProjectRecipient(body, paths) {
  if (!body || Object.keys(body).length !== 1 || typeof body.address !== 'string' || !body.address.startsWith('tark1')) throw Error('Public Signet address required.');
  ArkAddress.decode(body.address);
  const contents = JSON.stringify({continueRecipient:body.address}, null, 2) + '\n';
  // Check all destinations before changing either project's configuration.
  for (const path of paths) await access(dirname(path));
  for (const path of paths) {
    const previous = await readFile(path,'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return ''; });
    if (previous !== contents) await writeFile(path, contents);
  }
}

export function projectRecipientPlugin() {
  const paths = [
    fileURLToPath(new URL('./src/game-wallet-public.json', import.meta.url)),
    fileURLToPath(new URL('../../../../../BabylonJS/babylon-lite-stealth-grid/STEALTH_STEEL/src/runtime/integration/game-wallet-public.json', import.meta.url)),
  ];
  return {
    name:'save-public-game-wallet-recipient',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url !== '/__bis/game-wallet-recipient') return next();
        response.setHeader('Content-Type','application/json');
        // Browser writes must originate from this exact local development UI.
        let origin;
        try { origin = new URL(request.headers.origin); } catch { /* Reject missing origin. */ }
        if (request.method !== 'POST' || !origin || origin.host !== request.headers.host ||
          !['localhost','127.0.0.1','[::1]'].includes(origin.hostname) ||
          !request.headers['content-type']?.startsWith('application/json')) {
          response.writeHead(403); response.end('{"error":"Local admin request required."}'); return;
        }
        try {
          let body = '';
          for await (const chunk of request) {
            body += chunk;
            if (body.length > 1024) throw Error('Request too large.');
          }
          await saveProjectRecipient(JSON.parse(body), paths);
          response.end('{"saved":true}');
        } catch {
          response.writeHead(400); response.end('{"error":"Public address could not be saved to both projects."}');
        }
      });
    },
  };
}
