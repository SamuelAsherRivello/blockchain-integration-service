import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '..', '..');
export const inScopePackages = [
  'BIS/packages/integration/package.json',
  'BIS/packages/integration-demo/package.json',
  'BIS/packages/marketplace/package.json',
];
export const runtimeSources = [
  'BIS/packages/integration/src/client/ui-layer-react/AccountCard.tsx',
  'BIS/packages/integration-demo/src/client/ui-layer-react/App.tsx',
  'BIS/packages/marketplace/src/client/marketplace-layer/App.tsx',
];

const versionPattern = /^0\.0\.(\d+)$/;

export function validateVersion(version) {
  const match = versionPattern.exec(version);
  if (!match) throw new Error(`Release version must match 0.0.N; received ${version}.`);
  const patch = Number(match[1]);
  if (!Number.isSafeInteger(patch) || patch < 1) throw new Error(`Release patch must be at least 1; received ${version}.`);
  return patch;
}

export function validateTransition(previous, current) {
  const previousPatch = validateVersion(previous);
  const currentPatch = validateVersion(current);
  if (currentPatch !== previousPatch + 1) {
    throw new Error(`Release version must advance exactly one patch digit: ${previous} -> ${current}.`);
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));
}

async function readText(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

export async function validateReleaseVersion({ previousVersion } = {}) {
  const rootPackage = await readJson('package.json');
  const version = rootPackage.version;
  validateVersion(version);
  if (previousVersion) validateTransition(previousVersion, version);

  const packageVersions = new Map([['package.json', version]]);
  for (const relativePath of inScopePackages) {
    const manifest = await readJson(relativePath);
    if (manifest.version !== version) {
      throw new Error(`${relativePath} declares ${manifest.version}; expected ${version}.`);
    }
    packageVersions.set(relativePath, manifest.version);
  }

  const lockfile = await readJson('package-lock.json');
  if (lockfile.version !== version || lockfile.packages?.['']?.version !== version) {
    throw new Error('package-lock.json root metadata does not match the authoritative release version.');
  }
  for (const relativePath of inScopePackages) {
    const workspacePath = relativePath.replace(/\/package\.json$/, '').replaceAll('\\', '/');
    const entry = lockfile.packages?.[workspacePath];
    if (!entry || entry.version !== version) throw new Error(`package-lock.json is missing synchronized metadata for ${relativePath}.`);
  }
  for (const relativePath of ['BIS/packages/integration-demo/package.json', 'BIS/packages/marketplace/package.json']) {
    const manifest = await readJson(relativePath);
    if (manifest.dependencies?.['@bis/integration'] !== version) {
      throw new Error(`${relativePath} must depend on @bis/integration ${version}.`);
    }
  }

  const readme = await readText('README.md');
  for (const route of ['admin', 'marketplace']) {
    const marker = `/${route}/?v=${version}`;
    if (!readme.includes(marker)) throw new Error(`README.md is missing the ${route} cache-buster ${marker}.`);
  }
  for (const relativePath of runtimeSources) {
    const source = await readText(relativePath);
    if (!/from ['"](?:\.\.\/)+package\.json['"]/.test(source)) {
      throw new Error(`${relativePath} does not derive its displayed version from package metadata.`);
    }
  }
  return { version, packages: [...packageVersions.keys()] };
}

if (import.meta.main) {
  const previousIndex = process.argv.indexOf('--previous-version');
  const previousVersion = previousIndex === -1 ? undefined : process.argv[previousIndex + 1];
  if (previousIndex !== -1 && !previousVersion) throw new Error('--previous-version requires a version such as 0.0.1.');
  const result = await validateReleaseVersion({ previousVersion });
  console.log(`PASS release version ${result.version}`);
}
