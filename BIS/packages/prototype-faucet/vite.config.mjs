import { defineConfig } from 'vite';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

function faucetApiPlugin() {
  let faucetApi;
  return {
    name: 'prototype-faucet-api',
    async configureServer(server) {
      const port = Number(process.env.FAUCET_PORT ?? 5190);
      try {
        await fetch(`http://127.0.0.1:${port}/api/faucet/health`, { signal: AbortSignal.timeout(500) });
        return;
      } catch {
        faucetApi = spawn(process.execPath, ['--experimental-eventsource', '--env-file-if-exists=.env.local', 'src/server/server.mjs'], {
          cwd: resolve(process.cwd()),
          env: { ...process.env, FAUCET_PORT: String(port) },
          stdio: 'inherit',
        });
      }
      server.httpServer?.once('close', () => faucetApi?.kill());
    },
  };
}

export default defineConfig({
  plugins: [faucetApiPlugin()],
  server: {
    proxy: { '/api/faucet': { target: 'http://127.0.0.1:5190' } },
  },
});
