import { defineConfig } from 'vite'

const themePreview = (port) => ({
  target: `http://localhost:${port}`,
  changeOrigin: true,
  ws: true,
  configure: (proxy) => {
    proxy.on('proxyRes', (response) => {
      response.headers['cache-control'] = 'no-store, max-age=0'
    })
  },
})

// One local entry point for the three independently themed Slidev servers.
export default defineConfig({
  root: './launcher',
  plugins: [
    {
      name: 'acknowledge-proxied-slidev-navigation-updates',
      configureServer(server) {
        server.middlewares.use('/@server-reactive/nav', (request, response, next) => {
          if (request.method === 'POST') {
            response.statusCode = 204
            response.end()
            return
          }

          next()
        })
      },
    },
  ],
  server: {
    host: 'localhost',
    proxy: {
      '/slidev/seriph': themePreview(3042),
      '/slidev/apple-basic': themePreview(3043),
      '/slidev/dracula': themePreview(3044),
      '/slidev/template': themePreview(3045),
      '/slidev/modrian-template-1': themePreview(3046),
      '/slidev/modrian-template-2': themePreview(3047),
      '/slidev/modrian-template-3': themePreview(3048),
      '/slidev/modrian-template': themePreview(3049),
      '/slidev/blockchain-for-game': themePreview(3051),
      // Slidev's dev-only navigation state is requested from the origin root.
      // The Blockchain preview is served below a proxy prefix, so forward the
      // root request to the deck's actual dev-server route.
      '/@server-reactive/nav': {
        target: 'http://localhost:3051',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => `/slidev/blockchain-for-game${path}`,
      },
    },
  },
})
