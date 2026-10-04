import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@shikijs/vitepress-twoslash/client': fileURLToPath(new URL('./setup/twoslash-noop.ts', import.meta.url)),
    },
  },
})
