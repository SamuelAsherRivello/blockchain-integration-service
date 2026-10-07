import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const portFlagIndex = process.argv.indexOf('--port')
const port = portFlagIndex === -1 ? 'default' : process.argv[portFlagIndex + 1]

export default defineConfig({
  // Each locally served deck runs Vite's dependency optimizer independently.
  // A port-specific cache prevents one deck from invalidating another deck's
  // optimized dependency metadata while both are running behind the launcher.
  cacheDir: fileURLToPath(new URL(`./node_modules/.vite/slidev-${port}`, import.meta.url)),
  // Slidev's nested yaml dependency can retain an invalid optimized-dependency
  // entry after a deck recovery, yielding Vite's 504 "Outdated Optimize Dep"
  // response and a blank presentation. Serving it as a normal module keeps the
  // independently cached deck previews stable.
  optimizeDeps: {
    exclude: ['@slidev/cli/node_modules/@slidev/client/node_modules/yaml'],
  },
  resolve: {
    alias: {
      '@shikijs/vitepress-twoslash/client': fileURLToPath(new URL('./setup/twoslash-noop.ts', import.meta.url)),
    },
  },
  plugins: [
    {
      name: 'acknowledge-slidev-navigation-updates',
      configureServer(server) {
        const guardPreviewWrites = (request, response, next) => {
          const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

          // Keep navigation state out of the presentation source. The slide
          // editor's /__slidev/slides/<n>.json endpoint is intentionally not
          // guarded: browser editing must be able to save the deck.
          if (request.method === 'POST' && (
            pathname === '/@server-reactive/nav'
            || pathname === '/@server-ref/nav'
            // Vite can receive the configured Slidev base on a direct or
            // proxied request before its own base normalization runs.
            || pathname.endsWith('/@server-reactive/nav')
            || pathname.endsWith('/@server-ref/nav')
          )) {
            response.statusCode = 204
            response.end()
            return
          }

          if (request.method === 'POST'
            && pathname !== '/__slidev/slides'
            && !pathname.startsWith('/__slidev/slides/')) {
            response.statusCode = 204
            response.end()
            return
          }

          next()
        }

        // Register ahead of Slidev's navigation-state middleware without
        // intercepting the slide editor's source-save endpoint.
        server.middlewares.stack.unshift({ route: '', handle: guardPreviewWrites })
      },
    },
  ],
})
