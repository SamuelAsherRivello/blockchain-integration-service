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
    },
  },
})
