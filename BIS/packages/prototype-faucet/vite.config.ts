import { defineConfig } from 'vite';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFaucetApiLifecycle } from './src/shared/faucet-api-lifecycle.ts';
import { readSharedEnvironment } from '../shared/src/server/environment.ts';
import { bisContentSecurityPolicy } from '../../scripts/content-security-policy.ts';

const apiPort = Number(readSharedEnvironment({ keys: ['FAUCET_PORT'], legacyFaucetFallback: true }).values.FAUCET_PORT || 5190);

function faucetApiPlugin() {
  const packageRoot = fileURLToPath(new URL('.', import.meta.url));
  const lifecycle = createFaucetApiLifecycle({
    apiPort,
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
  plugins: [bisContentSecurityPolicy(), faucetApiPlugin()],
  server: {
    proxy: { '/api/faucet': { target: `http://127.0.0.1:${apiPort}` } },
  },
});

