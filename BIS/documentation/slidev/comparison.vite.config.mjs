import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { canonicalSlideRouteFor, editorOwnerForPath, landingLabelFor, landingService, livePreviewManifest, validateLivePreviewManifest, visiblePreviews } from './scripts/live-preview-manifest.mjs'

const statusFile = fileURLToPath(new URL('../../../output/logs/slidev-landing/current-status.json', import.meta.url))
const packageJson = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'))
const manifestCheck = validateLivePreviewManifest(livePreviewManifest, packageJson.scripts)
if (!manifestCheck.valid) throw new Error(`Invalid live preview manifest:\n${manifestCheck.errors.join('\n')}`)

const preventCache = (proxy) => {
  proxy.on('proxyRes', (response) => {
    response.headers['cache-control'] = 'no-store, max-age=0'
  })
}

const themePreview = (entry) => ({
  target: `http://localhost:${entry.port}`,
  changeOrigin: true,
  ws: true,
  configure: preventCache,
})

const navigationStateEndpoints = new Set([
  '/@server-reactive/nav',
  '/@server-ref/nav',
])
const isNavigationStateEndpoint = (pathname) => navigationStateEndpoints.has(pathname)
  || livePreviewManifest.some((entry) => [...navigationStateEndpoints]
    .some((endpoint) => pathname === `${entry.base.slice(0, -1)}${endpoint}`))

function editorServerForRequest(referer) {
  try {
    const pathname = new URL(referer).pathname
    return editorOwnerForPath(pathname)
  }
  catch {
    return null
  }
}

const landingLinks = async () => {
  const previews = await Promise.all(visiblePreviews().map(async (entry) => ({ entry, label: await landingLabelFor(entry) })))
  return Object.entries(Object.groupBy(previews, ({ entry }) => entry.group))
    .map(([group, entries]) => `<section aria-labelledby="${group.toLowerCase()}-heading"><h2 id="${group.toLowerCase()}-heading">${group}</h2>${entries.map(({ entry, label }) => `<a href="${canonicalSlideRouteFor(entry)}">${label}</a>`).join('')}</section>`)
    .join('')
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

// One local entry point for the three independently themed Slidev servers.
export default defineConfig({
  root: './launcher',
  plugins: [
    {
      name: 'manifest-backed-slidev-landing-and-status',
      async transformIndexHtml(html) {
        return html.replace('<!-- preview-links -->', await landingLinks())
      },
      configureServer(server) {
        server.middlewares.stack.unshift({ route: '', handle: async (request, response, next) => {
          const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
          if (pathname !== '/__slidev/preview-status.json') return next()
          try {
            const status = JSON.parse(await readFile(statusFile, 'utf8'))
            response.setHeader('content-type', 'application/json; charset=utf-8')
            response.setHeader('cache-control', 'no-store, max-age=0')
            response.end(JSON.stringify(status))
          }
          catch {
            response.statusCode = 503
            response.setHeader('content-type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ state: 'unavailable', message: 'The live preview supervisor has not written status.' }))
          }
        } })
      },
    },
    {
      name: 'acknowledge-proxied-slidev-navigation-updates',
      configureServer(server) {
        const guardPreviewWrites = (request, response, next) => {
          const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

          // Slidev writes reactive navigation state back to its markdown source.
          // A deck behind this proxy can issue either a root-relative or a
          // base-relative POST. The latter previously reached the master deck
          // and an unsuccessful source write terminated its Node process.
          if (request.method === 'POST' && (
            isNavigationStateEndpoint(pathname)
          )) {
            response.statusCode = 204
            response.end()
            return
          }

          // The browser editor is the sole supported source-writing API. Any
          // other POST is Slidev navigation/session state; acknowledging it
          // prevents it from reaching the parser's Markdown writer and taking
          // down a deck when Windows rejects that unrelated write.
          if (request.method === 'POST' && pathname !== '/__slidev/slides' && !pathname.startsWith('/__slidev/slides/')) {
            response.statusCode = 204
            response.end()
            return
          }

          next()
        }

        // Place the navigation-state guard before Vite's proxy middleware.
        server.middlewares.stack.unshift({ route: '', handle: async (request, response, next) => {
          const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
          if (pathname !== '/__slidev/slides' && !pathname.startsWith('/__slidev/slides/')) {
            guardPreviewWrites(request, response, next)
            return
          }

          try {
            const method = request.method ?? 'GET'
            const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(request)
            const owner = editorServerForRequest(request.headers.referer)
            if (!owner) {
              response.statusCode = 409
              response.setHeader('content-type', 'application/json; charset=utf-8')
              response.end(JSON.stringify({ error: 'SLIDEV_EDITOR_OWNER_UNKNOWN', message: 'Open the editor from a declared proxied deck route.' }))
              return
            }
            const contentType = request.headers['content-type']
            const upstream = await fetch(`http://localhost:${owner.port}${request.url}`, {
              method,
              headers: contentType ? { 'content-type': contentType } : undefined,
              body,
            })
            response.statusCode = upstream.status
            response.setHeader('cache-control', 'no-store, max-age=0')
            const responseContentType = upstream.headers.get('content-type')
            if (responseContentType) response.setHeader('content-type', responseContentType)
            response.end(Buffer.from(await upstream.arrayBuffer()))
          }
          catch (error) {
            next(error)
          }
        } })
      },
    },
  ],
  server: {
    host: 'localhost',
    proxy: {
      ...Object.fromEntries(livePreviewManifest.map((entry) => [entry.base.slice(0, -1), themePreview(entry)])),
    },
  },
})
