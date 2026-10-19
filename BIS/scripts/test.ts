import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {readdirSync} from 'node:fs';

// Resolve from this script so tests always use the repository root as their cwd.
const root = fileURLToPath(new URL('../../', import.meta.url));
const result = spawnSync(process.execPath, [
  '--test',
  '--test-concurrency=1',
  '--test-force-exit',
  ...process.argv.slice(2),
  'BIS/packages/integration/tests/client/*.test.ts',
  'BIS/packages/integration-admin/tests/client/*.test.ts',
  'BIS/packages/integration-marketplace/tests/client/*.test.ts',
  'BIS/scripts/*.test.ts',
  'BIS/packages/shared/tests/*.test.ts',
  ...readdirSync(new URL('../packages/prototype-sandbox/tests/',import.meta.url)).filter(name=>name.endsWith('.test.ts')&&!name.startsWith('browser-')).map(name=>`BIS/packages/prototype-sandbox/tests/${name}`),
], { cwd: root, stdio: 'inherit' });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

