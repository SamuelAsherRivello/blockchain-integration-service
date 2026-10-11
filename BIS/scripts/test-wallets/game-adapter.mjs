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
