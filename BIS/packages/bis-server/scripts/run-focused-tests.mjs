import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const suite = process.argv[2];
const browserCache = resolve(root, '../../../output/tool-cache/playwright');
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserCache };
const run = (args) => {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw Error(`Focused test runner failed: ${result.error.message}`);
  return result.status ?? 1;
};

if (suite === 'focused') {
  process.exitCode = run(['--test', '--test-concurrency=1',
    'tests/deployment-preflight.test.ts', 'tests/signer.test.ts', 'tests/hosted.test.ts',
    'tests/player-authorization.test.ts', 'tests/client-selection.test.ts',
    'tests/settlement-authorization.test.ts', 'tests/settlement-hosted.test.ts',
    'tests/settlement-session-authorization.test.ts', 'tests/settlement-session-identity.test.ts',
    'tests/settlement-client.test.ts', 'tests/settlement-event-capture.test.ts',
    'tests/settlement-finalization-policy.test.ts', 'tests/settlement-batch-hosted.test.ts',
    'tests/settlement-intent-policy.test.ts']);
} else if (suite === 'browser') {
  const patterns = ['public Game Wallet view', 'Server banner and public wallet', 'manual login without server', 'private owner controls'];
  let exitCode = 0;
  for (const pattern of patterns) {
    exitCode ||= run(['--test', '--test-concurrency=1', '--test-name-pattern', pattern, 'tests/local-browser.test.ts']);
  }
  process.exitCode = exitCode;
} else throw Error('Choose the focused or browser test suite.');
