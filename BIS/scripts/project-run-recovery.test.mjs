import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { developmentConfig } from './dev-config.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Skills may be installed project-locally or relocated to the agent's global
// library. They are optional developer tooling, not a shipped app dependency.
const skillRoot = [
  join(root,'.agents','skills','ai-skills-project-run-start'),
  join(root,'.agents','skills','ai-skills-run','ai-skills-project-run-start'),
  join(homedir(),'.agents','skills','ai-skills-project-run-start'),
].find(directory=>existsSync(join(directory,'run-project.ps1'))&&existsSync(join(directory,'SKILL.md')));

test('installed run helper contains the recovery contract', {skip:!skillRoot && 'Optional project-run skill is not installed on this host.'}, async () => {
  const helper = await readFile(join(skillRoot,'run-project.ps1'), 'utf8');
  const skill = await readFile(join(skillRoot,'SKILL.md'), 'utf8');
  assert.match(helper, /npm run dev -- --host 127\.0\.0\.1 --port \$candidate/);
  assert.match(helper, /Get-ListeningPids/);
  assert.match(helper, /netstat\.exe/);
  assert.match(helper, /Test-RouteHealth/);
  assert.match(helper, /-not \$listeners\.Count/);
  assert.match(helper, /Test-StableServer/);
  assert.match(helper, /project-run\.json/);
  assert.doesNotMatch(helper, /if \(\$listener -or \$diagnostics -match 'Project run mode:'\)/);
  assert.match(helper, /EADDRINUSE/);
  assert.match(helper, /host-verification-pending/);
  assert.match(skill, /preserve unrelated listeners/i);
  assert.match(skill, /fallback/);
  assert.match(skill, /sidecar/);
});

test('development proxy honors the selected faucet sidecar port', () => {
  const config = developmentConfig({ port: 5200, faucetPort: 5290 });
  assert.equal(config.server.proxy['/prototype-faucet/api/faucet'].target, 'http://127.0.0.1:5290');
});

assert.ok(root);
