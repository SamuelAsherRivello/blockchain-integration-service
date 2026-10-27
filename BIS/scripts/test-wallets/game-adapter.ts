import { fail } from './errors.ts';

export const gameAdapter = Object.freeze({
  app: 'game',
  path: '/blockchain-stealth-and-steel-game/',
  search: '?muteMusic=true&muteSFX=true',
  provenance: Object.freeze({
    packageName: '@bis/integration',
    version: '0.0.29',
    artifactSha256: '3617a257a9d1e48084d9e845d9d911747735d3dff9dcd6f4bb9fb0d51d89aff6',
    evidencePath: 'stealth-steel/vendor/BIS_PROVENANCE.md',
  }),
});

const trustedPredecessors = Object.freeze([
  Object.freeze({
  packageName:'@bis/integration', version:'0.0.21',
  artifactSha256:'7418bdb7f0c6b51774d950a08c3613df296217957347829426e361f1c18e90b6',
  evidencePath:'stealth-steel/vendor/BIS_PROVENANCE.md',
  }),
  Object.freeze({
    packageName:'@bis/integration', version:'0.0.28',
    artifactSha256:'6b318fb45a778ac8e136716e30ef63f89e036d65d8abb3ef2ab87f7352f23a46',
    evidencePath:'stealth-steel/vendor/BIS_PROVENANCE.md',
  }),
]);
const trustedCandidate = Object.freeze({
  packageName:'@bis/integration', version:'0.0.29',
  artifactSha256:'3617a257a9d1e48084d9e845d9d911747735d3dff9dcd6f4bb9fb0d51d89aff6',
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
  if (!trustedPredecessors.some(previous => sameProvenance(application.provenance, previous)) ||
      !sameProvenance(current.provenance, trustedCandidate)) fail('game-registration-upgrade-refused');
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

