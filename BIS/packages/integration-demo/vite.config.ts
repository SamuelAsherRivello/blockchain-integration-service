import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));
const documentationRoute = '/documentation/user-stories/';
const legacyDocumentationPath = '/BIS/documentation/user-stories';

function documentationRedirects() {
  return {
    name: 'bis-documentation-redirects',
    configureServer(server: { middlewares: { use: (handler: (request: { url?: string }, response: { statusCode: number; setHeader: (name: string, value: string) => void; end: () => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const legacyFile = !url.pathname.startsWith('/@fs/') && decodeURIComponent(url.pathname).endsWith('/BIS/documentation/User Story Diagrams.md');
        if (url.pathname !== legacyDocumentationPath && url.pathname !== `${legacyDocumentationPath}/` && !legacyFile) return next();
        response.statusCode = 302;
        response.setHeader('Location', `${documentationRoute}${url.search}`);
        response.end();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/blockchain-integration-service/admin/' : '/',
  build: {
    rollupOptions: {
      input: {
        admin: resolve(packageRoot, 'index.html'),
        documentation: resolve(packageRoot, 'documentation/user-stories/index.html'),
      },
    },
  },
  plugins: [documentationRedirects()],
}));
