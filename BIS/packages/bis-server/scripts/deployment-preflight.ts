/** Read-only validation for sanitized Vercel/Redis inspection evidence.
 * This deliberately accepts names and public profile IDs only; never pass
 * environment values, access tokens, mnemonics or private signing material.
 */
export type DeploymentPreflightSnapshot = {
  schemaVersion: 1;
  project: {
    id: string; organizationId: string; name: string; plan: string; rootDirectory: string;
    withinFreeTier: boolean; functionInvocationsUsed: number; functionInvocationsLimit: number; quotaExceeded: boolean;
  };
  preview: {
    url: string; target: string; state: string; runtime: string; protectionEnabled: boolean;
    bundleSha256: string; environmentNames: string[];
    identities: { signet: string; mutinynet: string };
    operationCapSats: number; dailyCapSats: number;
    publicSigning: boolean;
  };
  production: { environmentNames: string[]; identities: { signet: string; mutinynet: string } };
  storage: {
    provider: string; plan: string; status: string; autoUpgrade: boolean; prodPack: boolean; eviction: boolean;
    monthlyCommandsUsed: number; freeMonthlyCommandLimit: number; quotaExceeded: boolean;
  };
};

const projectId = 'prj_fB8jmOumMbfEabORTxeVxTysjXVx';
const organizationId = 'team_WmJXbDRfQvVbFiB3uUicIoIR';
const productionEnvironmentGroups = [
  ['BIS_OWNER_TOKEN'], ['BIS_SIGNING_DAILY_CAP_SATS'], ['BIS_SIGNING_OPERATION_CAP_SATS'],
  ['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL'], ['UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN'],
  // The Vercel deployment defaults its game ID to `stealth-and-steel`.
  ...(['SIGNET', 'MUTINYNET'] as const).flatMap(network => ['01', '02', '03'].map(slot => [`BIS_GAME_WALLET_${network}_${slot}_MNEMONIC`])),
];
const previewEnvironmentGroups = productionEnvironmentGroups.map(group => group.map(name =>
  name.startsWith('BIS_') ? `BIS_PREVIEW_${name.slice(4)}` : `BIS_PREVIEW_${name}`));
const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown): value is string => typeof value === 'string';
const profile = (value: unknown): value is string => string(value) && /^[a-f0-9]{64}$/i.test(value);
function hasCredentialFields(value: unknown): boolean {
  const pending: unknown[] = [value];
  let visited = 0;
  while (pending.length) {
    if (++visited > 10_000) return true;
    const current = pending.pop();
    if (Array.isArray(current)) {
      if (current.length > 10_000) return true;
      pending.push(...current);
    } else if (current !== null && typeof current === 'object') {
      const entries = Object.entries(current);
      if (entries.length > 10_000) return true;
      for (const [key, child] of entries) {
        if (/(?:token|mnemonic|secret|credential|password|privatekey|seedphrase|environmentvalues)/i.test(key)) return true;
        pending.push(child);
      }
    }
  }
  return false;
}

/** Returns only stable check identifiers; never echoes snapshot values. */
export function checkDeploymentPreflight(value: unknown, expectedBundleSha256: string): string[] {
  const root = asRecord(value), project = asRecord(root.project), preview = asRecord(root.preview);
  const previewIdentities = asRecord(preview.identities), production = asRecord(root.production);
  const productionIdentities = asRecord(production.identities), storage = asRecord(root.storage);
  const previewNames = Array.isArray(preview.environmentNames) ? preview.environmentNames.filter(string) : [];
  const productionNames = Array.isArray(production.environmentNames) ? production.environmentNames.filter(string) : [];
  const checks: [string, boolean][] = [
    ['snapshot-schema', root.schemaVersion === 1],
    ['no-credential-fields', !hasCredentialFields(root)],
    ['project-target', project.id === projectId && project.organizationId === organizationId && project.name === 'bis-server' && project.rootDirectory === 'BIS/packages/bis-server'],
    ['free-vercel-plan', project.plan === 'hobby'],
    ['within-free-vercel-quota', project.withinFreeTier === true && Number.isSafeInteger(project.functionInvocationsUsed) &&
      Number(project.functionInvocationsUsed) >= 0 && Number.isSafeInteger(project.functionInvocationsLimit) &&
      Number(project.functionInvocationsLimit) > 0 && Number(project.functionInvocationsUsed) <= Number(project.functionInvocationsLimit) && project.quotaExceeded === false],
    ['ready-node24-preview', preview.target === 'preview' && preview.state === 'READY' && preview.runtime === 'nodejs24.x' &&
      string(preview.url) && /^https:\/\/bis-server-[a-z0-9-]+\.vercel\.app$/.test(preview.url) && preview.url !== 'https://bis-server-rho.vercel.app'],
    ['preview-protected', preview.protectionEnabled === true],
    ['reviewed-bundle', string(preview.bundleSha256) && /^[a-f0-9]{64}$/i.test(preview.bundleSha256) && preview.bundleSha256.toLowerCase() === expectedBundleSha256.toLowerCase()],
    ['required-preview-environment-names', previewEnvironmentGroups.every(group => group.some(name => previewNames.includes(name)))],
    ['required-production-environment-names', productionEnvironmentGroups.every(group => group.some(name => productionNames.includes(name)))],
    ['separate-test-identities', profile(previewIdentities.signet) && profile(previewIdentities.mutinynet) &&
      profile(productionIdentities.signet) && profile(productionIdentities.mutinynet) &&
      new Set([previewIdentities.signet, previewIdentities.mutinynet, productionIdentities.signet, productionIdentities.mutinynet]).size === 4],
    ['approved-test-caps', Number.isSafeInteger(preview.operationCapSats) && Number(preview.operationCapSats) > 0 && Number(preview.operationCapSats) <= 5_000 &&
      Number.isSafeInteger(preview.dailyCapSats) && Number(preview.dailyCapSats) > 0 && Number(preview.dailyCapSats) <= 10_000],
    ['public-signing-remains-disabled', preview.publicSigning === false],
    ['free-redis-no-upgrade', storage.provider === 'upstash-redis' && storage.plan === 'free' && storage.status === 'ready' &&
      storage.autoUpgrade === false && storage.prodPack === false && storage.eviction === false],
    ['within-free-redis-quota', Number.isSafeInteger(storage.monthlyCommandsUsed) && Number(storage.monthlyCommandsUsed) >= 0 &&
      Number.isSafeInteger(storage.freeMonthlyCommandLimit) && Number(storage.freeMonthlyCommandLimit) > 0 &&
      Number(storage.monthlyCommandsUsed) <= Number(storage.freeMonthlyCommandLimit) && storage.quotaExceeded === false],
  ];
  return checks.filter(([, passed]) => !passed).map(([name]) => name);
}
