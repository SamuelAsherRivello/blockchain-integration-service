import assert from 'node:assert/strict';
import test from 'node:test';
import { developmentConfig } from '../../../scripts/dev-config.ts';

test('shared and isolated preview ports cannot replace one another\'s optimized diagram cache', () => {
  const shared = developmentConfig({ port: 5174 });
  const isolated = developmentConfig({ port: 6018 });
  assert.notEqual(shared.cacheDir, isolated.cacheDir);
  assert.match(shared.cacheDir.replaceAll('\\', '/'), /\/output\/vite-cache\/5174$/);
  assert.ok(shared.optimizeDeps.exclude.includes('mermaid'));
  assert.ok(isolated.optimizeDeps.exclude.includes('mermaid'));
});
