import {defineConfig} from 'vite';
// Keep browser-fixture optimization separate from test-created Vite servers.
export default defineConfig({
  cacheDir:'node_modules/.vite-wallet-subscription',
  optimizeDeps:{entries:['tests/wallet-subscription.html']},
  server:{host:'127.0.0.1',hmr:{port:24777}},
});
