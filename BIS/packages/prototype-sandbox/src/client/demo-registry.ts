import { DEMO_FILES } from './demo-files.ts';
import { demoRuntimeFile } from './source-links.ts';
import type { DemoContext, DemoResult } from './demo-runtime.ts';

type DemoModule = { runDemo: (context: DemoContext) => Promise<DemoResult> | DemoResult };
const modules = import.meta.glob<DemoModule>('./demos/*.ts', { eager: true });
const sources = import.meta.glob<string>('./demos/*.ts', { eager: true, query: '?raw', import: 'default' });

export const DEMO_REGISTRY = Object.freeze(Object.fromEntries(DEMO_FILES.map(demo => {
  const path = './demos/' + demo.file;
  const sourcePath = './demos/' + (demo.sourceFile ?? demo.file);
  if (typeof modules[path]?.runDemo !== 'function' || typeof sources[sourcePath] !== 'string') throw new Error('Incomplete demo: ' + demo.id);
  return [demo.id, Object.freeze({ run: modules[path].runDemo, source: sources[sourcePath], file: demoRuntimeFile(demo.id) })];
})));

export function demoDefinition(sourceId: string) {
  if (!Object.hasOwn(DEMO_REGISTRY, sourceId)) throw new Error('Unknown demo: ' + sourceId);
  return DEMO_REGISTRY[sourceId];
}
