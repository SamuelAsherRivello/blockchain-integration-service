import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stageSlidevLegacyRedirects } from './stage-slidev-redirects.ts';

const root = resolve(import.meta.dirname, '..', '..');
const artifact = resolve(root, 'output', 'pages', 'deploy-separate-pages-demos', 'blockchain-integration-service');
const admin = resolve(root, 'BIS', 'packages', 'integration-admin', 'dist');
const marketplace = resolve(root, 'BIS', 'packages', 'integration-marketplace', 'dist');
const sandbox = resolve(root, 'BIS', 'packages', 'prototype-sandbox', 'dist');
const landingPage = resolve(root, 'index.html');

await rm(artifact, { recursive: true, force: true });
await mkdir(artifact, { recursive: true });
await Promise.all([
  cp(landingPage, resolve(artifact, 'index.html')),
  cp(admin, resolve(artifact, 'admin'), { recursive: true }),
  cp(marketplace, resolve(artifact, 'integration-marketplace'), { recursive: true }),
  cp(sandbox, resolve(artifact, 'prototype-sandbox'), { recursive: true }),
  cp(resolve(admin, 'assets'), resolve(artifact, 'assets'), { recursive: true }),
]);
await stageSlidevLegacyRedirects(artifact);
console.log(artifact);

