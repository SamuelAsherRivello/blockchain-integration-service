import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { projectRecipientPlugin } from './project-recipient.mjs';

const legacyDocumentPath = '/@fs/' + fileURLToPath(new URL('../../documentation/User Story Diagrams.md', import.meta.url)).replaceAll('\\', '/');

export default defineConfig({
  base: './',
  plugins: [projectRecipientPlugin(), {
    name: 'legacy-documentation-redirect',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const [pathname, ...query] = (request.url ?? '').split('?');
        if (pathname === '/BIS/documentation/user-stories/' || pathname === '/BIS/documentation/user-stories') {
          response.writeHead(302, { Location: '/documentation/user-stories/' + (query.length ? '?' + query.join('?') : '') });
          response.end();
          return;
        }
        if (request.url && !request.url.includes('?') && decodeURI(request.url) === legacyDocumentPath) {
          response.writeHead(302, { Location: '/documentation/user-stories/' });
          response.end();
          return;
        }
        next();
      });
    },
  }],
  build: { rollupOptions: { input: ['index.html', 'documentation/user-stories/index.html'] } },
});
