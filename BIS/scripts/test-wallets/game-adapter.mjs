import { fail } from './errors.mjs';

export const gameAdapter = Object.freeze({
  app: 'game',
  path: '/blockchain-stealth-and-steel-game/',
  search: '?muteMusic=true&muteSFX=true',
  provenance: Object.freeze({
    packageName: '@bis/integration',
    version: '0.0.21',
    artifactSha256: '7418bdb7f0c6b51774d950a08c3613df296217957347829426e361f1c18e90b6',
    evidencePath: 'stealth-steel/vendor/BIS_PROVENANCE.md',
  }),
});

const trustedPredecessor = Object.freeze({
  packageName:'@bis/integration', version:'0.0.21',
  artifactSha256:'7418bdb7f0c6b51774d950a08c3613df296217957347829426e361f1c18e90b6',
  evidencePath:'stealth-steel/vendor/BIS_PROVENANCE.md',
});
const sameProvenance = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === Object.keys(expected).length && Object.keys(expected).every(key => value[key] === expected[key]);

// Pure internal test seam. Production configuration always uses the compiled
// adapter; no CLI request can supply a destination version, hash or descriptor.
export function reconcileGameRegistration(application, selectedOrigin, current = gameAdapter) {
  if (!application || application.app !== 'game' || application.origin !== selectedOrigin ||
      application.path !== gameAdapter.path || application.search !== gameAdapter.search ||
      current.app !== 'game' || current.path !== gameAdapter.path || current.search !== gameAdapter.search)
    fail('game-registration-upgrade-refused');
  if (sameProvenance(application.provenance, current.provenance)) return application;
  if (current.provenance.version !== '0.0.22' || !sameProvenance(application.provenance, trustedPredecessor) ||
      current.provenance.packageName !== trustedPredecessor.packageName ||
      current.provenance.evidencePath !== trustedPredecessor.evidencePath ||
      !/^[a-f0-9]{64}$/.test(current.provenance.artifactSha256)) fail('game-registration-upgrade-refused');
  return {...application, provenance:{...current.provenance}};
}

export function gameUrl(application) {
  if (!application || application.app !== gameAdapter.app || application.path !== gameAdapter.path || application.search !== gameAdapter.search)
    fail('game-adapter-invalid');
  return `${application.origin}${gameAdapter.path}${gameAdapter.search}`;
}

export function verifyGameProvenance(text) {
  if (typeof text !== 'string') return false;
  const p = gameAdapter.provenance;
  return text.includes(`Package: ${p.packageName} ${p.version}`) &&
    text.includes(`SHA-256: ${p.artifactSha256}`);
}

export function assertGameProvenance(text) {
  if (!verifyGameProvenance(text)) fail('game-provenance-unavailable');
  return { ...gameAdapter.provenance };
}
