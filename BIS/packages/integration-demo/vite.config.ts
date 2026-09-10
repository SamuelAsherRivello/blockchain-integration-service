import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { isVerifiedMarketplaceCatalog } from './src/admin/marketplace-catalog.ts';

const catalogPath = resolve(import.meta.dirname, '../marketplace/public/catalog.json');
function marketplaceCatalogPublisher(): Plugin {
  return { name:'bis-marketplace-catalog-publisher', configureServer(server) { server.middlewares.use('/__bis-marketplace-catalog', async (request, response) => {
    if (request.method === 'GET') { response.setHeader('content-type','application/json'); response.end(await readFile(catalogPath)); return; }
    if (request.method !== 'POST') { response.statusCode=405; response.end(); return; }
    let body=''; for await (const part of request) body += part;
    try { const catalog=JSON.parse(body); if (!isVerifiedMarketplaceCatalog(catalog)) throw Error(); await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8'); response.statusCode=204; response.end(); }
    catch { response.statusCode=400; response.end('Verified nine-item catalog required.'); }
  }); }};
}
export default defineConfig({plugins:[marketplaceCatalogPublisher()]});
