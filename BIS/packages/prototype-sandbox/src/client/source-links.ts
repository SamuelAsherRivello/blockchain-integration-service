import { DEMO_FILES } from './demo-files.ts';

const directory = 'BIS/packages/prototype-sandbox/src/client/demos/';
export const SOURCE_FILES: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(DEMO_FILES.map(demo => [demo.id, directory + (demo.sourceFile ?? demo.file)])));
export const RUNTIME_FILES: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(DEMO_FILES.map(demo => [demo.id, directory + demo.file])));
export const SANDBOX_SHARED_FILE = 'BIS/packages/prototype-sandbox/src/client/sandbox-shared.ts';

export function demoSourceFile(sourceId: string) {
  if (!Object.hasOwn(SOURCE_FILES, sourceId)) throw new Error('Unknown demo source: ' + sourceId);
  return SOURCE_FILES[sourceId];
}

export function demoRuntimeFile(sourceId: string) {
  if (!Object.hasOwn(RUNTIME_FILES, sourceId)) throw new Error('Unknown demo source: ' + sourceId);
  return RUNTIME_FILES[sourceId];
}

export function demoSourceUrl(sourceId: string, development: boolean) {
  const file = demoSourceFile(sourceId);
  return sourceFileUrl(file, development);
}

export function sandboxSharedSourceUrl(development: boolean) {
  return sourceFileUrl(SANDBOX_SHARED_FILE, development);
}

function sourceFileUrl(file: string, development: boolean) {
  return development ? `/prototype-sandbox/source-view/?${new URLSearchParams({ file })}`
    : `https://github.com/SamuelAsherRivello/blockchain-integration-service/blob/main/${file}`;
}
