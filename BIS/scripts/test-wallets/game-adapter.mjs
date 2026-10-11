import { fail } from './errors.mjs';

export const gameAdapter = Object.freeze({
  app: 'game',
  path: '/blockchain-stealth-and-steel-game/',
  search: '?muteMusic=true&muteSFX=true',
  provenance: Object.freeze({
    packageName: '@bis/integration',
    version: '0.0.20',
    artifactSha256: '4de67c29df5ebdd25e8f47b30eac9c7ad5f0d602e3f4b94f57f18989672e6329',
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
