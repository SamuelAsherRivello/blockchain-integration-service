import { cp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const project = { projectId: 'prj_fB8jmOumMbfEabORTxeVxTysjXVx', orgId: 'team_WmJXbDRfQvVbFiB3uUicIoIR' };
await mkdir(resolve(root, '.vercel'), { recursive: true });
await writeFile(resolve(root, '.vercel/project.json'), `${JSON.stringify(project)}\n`);
await import('./build-deployment.ts');
await mkdir(resolve(root, 'api'), { recursive: true });
await mkdir(resolve(root, 'public'), { recursive: true });
await cp(resolve(root, 'dist/deployment/api/index.mjs'), resolve(root, 'api/index.mjs'));
await cp(resolve(root, 'dist/deployment/public/index.html'), resolve(root, 'public/index.html'));
