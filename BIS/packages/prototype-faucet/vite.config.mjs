import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: { '/api/faucet': { target: 'http://127.0.0.1:5190' } },
  },
});
