import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const artifact = resolve(root, 'output', 'pages', 'deploy-separate-pages-demos', 'blockchain-integration-service');
const admin = resolve(root, 'BIS', 'packages', 'integration-demo', 'dist');
const marketplace = resolve(root, 'BIS', 'packages', 'marketplace', 'dist');

await rm(artifact, { recursive: true, force: true });
await mkdir(artifact, { recursive: true });
await Promise.all([
  cp(admin, resolve(artifact, 'admin'), { recursive: true }),
  cp(marketplace, resolve(artifact, 'marketplace'), { recursive: true }),
  cp(resolve(admin, 'assets'), resolve(artifact, 'assets'), { recursive: true }),
]);
console.log(artifact);
