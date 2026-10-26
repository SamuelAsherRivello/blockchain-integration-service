import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const destination = resolve(root, 'dist/deployment');
await mkdir(resolve(destination, 'api'), { recursive: true });
// Only server imports reachable from this entry are bundled. No environment
// substitution, private file copying, source maps, static catch-all or Pages UI.
await build({ entryPoints: [resolve(root, 'src/server/vercel.ts')], outfile: resolve(destination, 'api/index.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node24', sourcemap: false, logLevel: 'warning', banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" } });
const packageJson = { name: 'bis-server-deployment', private: true, type: 'module', engines: { node: '24.x' } };
await writeFile(resolve(destination, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n');
await writeFile(resolve(destination, 'vercel.json'), JSON.stringify({ framework: null, buildCommand: '', outputDirectory: 'public', functions: { 'api/index.mjs': { maxDuration: 30 } }, rewrites: [{ source: '/api/bis/:path*', destination: '/api/index' }] }, null, 2) + '\n');
await mkdir(resolve(destination, 'public'), { recursive: true });
await writeFile(resolve(destination, 'public/index.html'), '<!doctype html><title>bis-server</title><p>BIS signing service. See /api/bis/health for readiness. A healthy deployment is not proof of enabled public signing.</p>\n');
// CLI project selection is explicit and verified before invoking this build.
const project = JSON.parse(await readFile(resolve(root, '.vercel/project.json'), 'utf8'));
if (project.projectId !== 'prj_fB8jmOumMbfEabORTxeVxTysjXVx' || project.orgId !== 'team_WmJXbDRfQvVbFiB3uUicIoIR') throw Error('Unexpected Vercel deployment target.');
await mkdir(resolve(destination, '.vercel'), { recursive: true });
await writeFile(resolve(destination, '.vercel/project.json'), JSON.stringify(project, null, 2) + '\n');
console.log('Built isolated bis-server deployment under BIS/packages/bis-server/dist/deployment.');
