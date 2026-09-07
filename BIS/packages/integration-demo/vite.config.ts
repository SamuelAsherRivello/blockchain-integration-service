import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const legacyDocumentPath = '/@fs/' + fileURLToPath(new URL('../../documentation/User Story Diagrams.md', import.meta.url)).replaceAll('\\', '/');

export default defineConfig({
  base: './',
  plugins: [{
    name: 'legacy-documentation-redirect',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
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
