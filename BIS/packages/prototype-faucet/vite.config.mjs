import { defineConfig } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFaucetApiLifecycle } from './src/shared/faucet-api-lifecycle.mjs';

function faucetApiPlugin() {
  const packageRoot = fileURLToPath(new URL('.', import.meta.url));
  const lifecycle = createFaucetApiLifecycle({
    apiPort: Number(process.env.FAUCET_PORT ?? 5190),
    packageRoot,
    processPath: process.execPath,
    env: process.env,
    spawnImpl: spawn,
  });
  return {
    name: 'prototype-faucet-api',
    async configureServer(server) {
      try {
        await lifecycle.start();
      } catch (error) {
        console.error(error?.message ?? 'The local faucet API could not be started or reached.');
      }
      server.httpServer?.once('close', () => lifecycle.close());
    },
  };
}

export default defineConfig({
  plugins: [faucetApiPlugin()],
  server: {
    proxy: { '/api/faucet': { target: `http://127.0.0.1:${Number(process.env.FAUCET_PORT ?? 5190)}` } },
  },
});
