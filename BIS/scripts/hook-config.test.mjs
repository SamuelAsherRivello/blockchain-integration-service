import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('Windows advisory hooks normalize the Impeccable exit code', async () => {
  const config = JSON.parse(await readFile(`${root}/.codex/hooks.json`, 'utf8'));
  const hooks = config.hooks;
  const commands = [
    hooks.PostToolUse[0].hooks[0].commandWindows,
    hooks.Stop[0].hooks[0].commandWindows,
  ];

  for (const command of commands) {
    assert.match(command, /^call\s+\.agents[\\/]skills[\\/]impeccable[\\/]scripts[\\/]impeccable\.cmd\s+hook\s+&\s+exit\s+\/b\s+0\s*$/i);
  }
});
