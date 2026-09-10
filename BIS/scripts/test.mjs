import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Resolve from this script so tests always use the repository root as their cwd.
const root = fileURLToPath(new URL('../../', import.meta.url));
const result = spawnSync(process.execPath, [
  '--test',
  '--test-concurrency=1',
  '--test-force-exit',
  ...process.argv.slice(2),
  'BIS/packages/integration/tests/*.test.mjs',
  'BIS/packages/integration-demo/tests/*.test.mjs',
], { cwd: root, stdio: 'inherit' });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
