import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { developmentConfig } from './dev-config.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const helperPath = fileURLToPath(new URL('../../.agents/skills/ai-skills-project-run-start/run-project.ps1', import.meta.url));
const skillPath = fileURLToPath(new URL('../../.agents/skills/ai-skills-project-run-start/SKILL.md', import.meta.url));

test('run helper contains the recovery contract', async () => {
  const helper = await readFile(helperPath, 'utf8');
  const skill = await readFile(skillPath, 'utf8');
  assert.match(helper, /npm run dev -- --host 127\.0\.0\.1 --port \$candidate/);
  assert.match(helper, /Get-ListeningPids/);
  assert.match(helper, /netstat\.exe/);
  assert.match(helper, /EADDRINUSE/);
  assert.match(helper, /host-verification-pending/);
  assert.match(skill, /preserve unrelated listeners/);
  assert.match(skill, /fallback/);
  assert.match(skill, /sidecar/);
});

test('development proxy honors the selected faucet sidecar port', () => {
  const config = developmentConfig({ port: 5200, faucetPort: 5290 });
  assert.equal(config.server.proxy['/prototype-faucet/api/faucet'].target, 'http://127.0.0.1:5290');
});

assert.ok(root);
