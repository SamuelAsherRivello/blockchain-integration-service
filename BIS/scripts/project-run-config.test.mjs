import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRunConfig, validateProjectRunConfig } from './project-run-config.mjs';

test('project run configuration is a valid shared-server contract', () => {
  assert.equal(validateProjectRunConfig(projectRunConfig), projectRunConfig);
  assert.equal(projectRunConfig.command, 'npm run dev');
  assert.equal(projectRunConfig.serverMode, 'shared');
  assert.equal(projectRunConfig.preferredPort, 5174);
  assert.deepEqual(projectRunConfig.routes.map(route => route.label), [
    'BIS - Admin',
    'BIS - Marketplace',
    'BIS - Onboarding',
    'Prototype Faucet',
    'BIS - Integration',
  ]);
});

test('single-server projects can declare one entry point', () => {
  const config = {
    command: 'npm run dev',
    serverMode: 'single',
    preferredPort: 5174,
    routes: [{ label: 'Example', route: '/' }],
  };
  assert.equal(validateProjectRunConfig(config), config);
});
