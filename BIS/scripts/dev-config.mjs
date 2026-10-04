import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const packageRoutes = [
  { label: 'BIS Admin', route: '/admin/', directory: 'integration-admin' },
  { label: 'BIS Marketplace', route: '/marketplace/', directory: 'marketplace' },
  { label: 'Onboarding Spike', route: '/onboarding/', directory: 'prototype-onboarding' },
  { label: 'Integration README', route: '/integration/', directory: 'integration', readme: true },
];
const readmes = new Set(['/README.md', ...packageRoutes.map(app => `/BIS/packages/${app.directory}/${app.directory}-package-readme.md`)]);
const isFile = async path => (await stat(path).catch(() => undefined))?.isFile() ?? false;

function headingAnchors() {
  return tree => {
    const counts = new Map();
    const text = node => node.type === 'text' ? node.value : (node.children ?? []).map(text).join('');
    const visit = node => {
      if (/^h[1-6]$/.test(node.tagName ?? '')) {
        const base = text(node).toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').trim().replace(/ /g, '-');
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        node.properties = { ...node.properties, id: `${base}${count ? `-${count}` : ''}` };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

async function readmeHtml(path) {
  const source = await readFile(resolve(root, `.${path}`), 'utf8');
  const base = path.slice(0, path.lastIndexOf('/') + 1);
  const content = renderToStaticMarkup(createElement(Markdown, { remarkPlugins: [remarkGfm], rehypePlugins: [headingAnchors] }, source));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><title>${path === '/README.md' ? 'BIS' : path.split('/').at(-2)} README</title><style>
    body{max-width:960px;margin:40px auto;padding:0 24px;font:16px/1.6 system-ui,sans-serif;color:#202735;background:#fafbfc}
    a{color:#165dc5}pre{padding:16px;background:#eef1f5;overflow:auto}code{font-size:.9em}img{max-width:100%}table{border-collapse:collapse}td,th{padding:8px;border:1px solid #ccd2db}
  </style></head><body><main>${content}</main></body></html>`;
}

function packageEntries() {
  return {
    name: 'bis-package-entries',
    enforce: 'pre',
    // Supply a package-specific public base during shared development only.
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/');
      const app = packageRoutes.find(app => normalized.startsWith(`${root.replaceAll('\\', '/')}BIS/packages/${app.directory}/`));
      if (app && /\.[cm]?[jt]sx?(?:\?|$)/.test(id)) {
        const updated = code.replace(/import\.meta\.env(?:\?\.|\.)BASE_URL\b/g, JSON.stringify(app.route));
        if (updated !== code) return { code: updated, map: null };
      }
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          const url = new URL(request.url ?? '/', 'http://localhost');
          const path = decodeURIComponent(url.pathname);
          if (path.includes('\\') || path.split('/').includes('..')) { response.statusCode = 400; response.end('Invalid path'); return; }
          const redirect = target => { response.statusCode = 302; response.setHeader('Location', target + url.search); response.end(); };
          if (path === '/') return redirect('/README.md');
          for (const app of packageRoutes) if (path === app.route.slice(0, -1)) return redirect(app.route);
          if (path === '/book' || path === '/book/' || path === '/book.html') return redirect('/admin/book.html');
          if (path === '/admin/book' || path === '/admin/book/') return redirect('/admin/book.html');
          if (path === '/documentation/user-stories' || path === '/documentation/user-stories/' || path === '/BIS/documentation/user-stories' || path === '/BIS/documentation/user-stories/') return redirect('/admin/documentation/user-stories/');
          // Never redirect Vite's raw Markdown imports.
          if (path === '/BIS/documentation/User Story Diagrams.md' && !url.search) return redirect('/admin/documentation/user-stories/');
          const readme = path === '/integration/' ? '/BIS/packages/integration/integration-package-readme.md' : path;
          if (readmes.has(readme) && !url.search) {
            const html = await server.transformIndexHtml(path, await readmeHtml(readme));
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(html);
            return;
          }
          if (path === '/favicon.png') { request.url = '/BIS/packages/integration-admin/public/favicon.png' + url.search; return next(); }
          for (const app of packageRoutes) {
            const directory = `/BIS/packages/${app.directory}/`;
            const prefix = path.startsWith(app.route) ? app.route : path.startsWith(directory) ? directory : undefined;
            if (!prefix || app.readme) continue;
            const tail = path.slice(prefix.length);
            const physical = resolve(root, `.${directory}`, tail);
            const publicFile = resolve(root, `.${directory}`, 'public', tail);
            if (await isFile(publicFile)) request.url = `${directory}public/${tail}${url.search}`;
            else if ((await stat(physical).catch(() => undefined))?.isDirectory()) {
              if (!path.endsWith('/')) return redirect(path + '/');
              if (!(await isFile(resolve(physical, 'index.html')))) { response.statusCode = 404; response.end('Not found'); return; }
              request.url = `${directory}${tail}index.html${url.search}`;
            } else if (await isFile(physical)) request.url = `${directory}${tail}${url.search}`;
            else { response.statusCode = 404; response.end('Not found'); return; }
            break;
          }
          next();
        } catch (error) { next(error); }
      });
      server.watcher.on('change', file => {
        if ([...readmes].some(path => resolve(root, `.${path}`) === resolve(file))) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export function developmentConfig({ port = 5174 } = {}) {
  return {
    configFile: false,
    root,
    appType: 'mpa',
    publicDir: false,
    plugins: [packageEntries()],
    server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root] } },
    optimizeDeps: { entries: packageRoutes.filter(app => !app.readme).map(app => `BIS/packages/${app.directory}/index.html`) },
  };
}
