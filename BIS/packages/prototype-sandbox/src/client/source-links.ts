const directory = 'BIS/packages/prototype-sandbox/src/client/';
export const SOURCE_FILES = {
  app: directory + 'App.tsx',
  events: directory + 'events-demo-source.ts',
  upgrade: directory + 'asset-upgrade-demo-source.ts',
  vault: directory + 'conditional-vault-demo-source.ts',
};

export function demoSourceFile(sourceId: string) {
  if (sourceId === 'events-source') return SOURCE_FILES.events;
  if (sourceId === 'asset-upgrade-source') return SOURCE_FILES.upgrade;
  if (/^conditional-vault-(create|increment|claim|check)-source$/.test(sourceId)) return SOURCE_FILES.vault;
  return SOURCE_FILES.app;
}

export function demoSourceUrl(sourceId: string, development: boolean) {
  const file = demoSourceFile(sourceId);
  return development ? `/prototype-sandbox/source-view/?${new URLSearchParams({ file })}`
    : `https://github.com/SamuelAsherRivello/blockchain-integration-service/blob/main/${file}`;
}
