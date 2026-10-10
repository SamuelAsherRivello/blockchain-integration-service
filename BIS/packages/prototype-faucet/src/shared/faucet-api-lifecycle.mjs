export function createFaucetApiLifecycle({
  apiPort = 5190,
  packageRoot,
  processPath,
  env = {},
  fetchImpl = fetch,
  spawnImpl,
  waitMs = 250,
  attempts = 20,
} = {}) {
  let child;
  let ownsChild = false;

  async function healthy() {
    try {
      const response = await fetchImpl(`http://127.0.0.1:${apiPort}/api/faucet/health`, { signal: AbortSignal.timeout(500) });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function start() {
    if (await healthy()) return { started: false };
    child = spawnImpl(processPath, ['--experimental-eventsource', '--env-file-if-exists=.env.local', 'src/server/server.mjs'], {
      cwd: packageRoot,
      env: { ...env, FAUCET_PORT: String(apiPort) },
      stdio: 'inherit',
    });
    ownsChild = true;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (await healthy()) return { started: true };
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    close();
    throw new Error('The local faucet API could not be started or reached.');
  }

  function close() {
    if (ownsChild) child?.kill();
    child = undefined;
    ownsChild = false;
  }

  return Object.freeze({ healthy, start, close });
}
