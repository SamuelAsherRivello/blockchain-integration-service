import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = resolve(packageRoot, '../../..');
const testsDirectory = resolve(packageRoot, 'tests');
const tests = readdirSync(testsDirectory)
  .filter(file => file.endsWith('.test.ts'))
  .sort()
  .filter(file => file !== 'local-browser.test.ts')
  .map(file => resolve(testsDirectory, file));
if (tests.length === 0) throw Error('No bis-server tests were found.');

const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: resolve(repositoryRoot, 'output/tool-cache/playwright') };
const run = args => {
  const result = spawnSync(process.execPath, args, { cwd: repositoryRoot, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw Error(`bis-server test runner failed: ${result.error.message}`);
  return result.status ?? 1;
};

let exitCode = run(['--test', ...tests]);
if (exitCode === 0) {
  for (const pattern of ['public Game Wallet view', 'Server banner and public wallet', 'manual login without server', 'private owner controls']) {
    const browserExit = run(['--test', '--test-concurrency=1', '--test-name-pattern', pattern, resolve(testsDirectory, 'local-browser.test.ts')]);
    if (browserExit !== 0) exitCode = browserExit;
  }
}
process.exitCode = exitCode;
