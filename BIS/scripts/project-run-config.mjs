/**
 * Standard project-run contract consumed by the run skills and launcher.
 *
 * `serverMode: 'shared'` means one server exposes multiple routes. A project
 * with one entry point can use `serverMode: 'single'` and one route. Projects
 * may customize this file; callers must read the current values rather than
 * assuming every package gets its own Vite process.
 */
import { packageRoutes } from './dev-config.mjs';

export const projectRunConfig = {
  command: 'npm run dev',
  serverMode: 'shared',
  preferredPort: 5174,
  routes: packageRoutes.map(({ label, route, readme = false }) => ({ label, route, readme })),
};

export function validateProjectRunConfig(config = projectRunConfig) {
  if (!['single', 'shared'].includes(config.serverMode)) throw new Error('serverMode must be single or shared.');
  if (!Number.isInteger(config.preferredPort) || config.preferredPort < 1 || config.preferredPort > 65535) {
    throw new Error('preferredPort must be a valid TCP port.');
  }
  if (!Array.isArray(config.routes) || config.routes.length < 1) throw new Error('routes must contain at least one entry.');
  const routes = new Set();
  for (const route of config.routes) {
    if (!route.label || !route.route?.startsWith('/')) throw new Error('Each route needs a label and absolute route.');
    if (routes.has(route.route)) throw new Error(`Duplicate route: ${route.route}`);
    routes.add(route.route);
  }
  if (config.serverMode === 'single' && config.routes.length !== 1) throw new Error('single mode must expose exactly one route.');
  return config;
}

validateProjectRunConfig();
