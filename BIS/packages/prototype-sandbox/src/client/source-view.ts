import { DEMO_FILES } from './demo-files.ts';
import { demoSourceFile, SANDBOX_SHARED_FILE } from './source-links.ts';
import './source-view.css';

// Only raw imports. Reading a file never imports its executable module.
const raw = import.meta.glob<string>('./demos/*.ts', { query: '?raw', import: 'default' });
const supporting = import.meta.glob<string>('./sandbox-shared.ts', { query: '?raw', import: 'default' });
const sources = { ...Object.fromEntries(DEMO_FILES.map(demo => [demoSourceFile(demo.id), raw['./demos/' + demo.file]])), [SANDBOX_SHARED_FILE]: supporting['./sandbox-shared.ts'] };
const file = new URLSearchParams(location.search).get('file') ?? '';
const content = document.getElementById('source-content')!;
if (!import.meta.env.DEV || !Object.hasOwn(sources, file)) {
  content.textContent = 'Source unavailable. Open a source link from a sandbox demo.';
} else {
  document.title = `Source: ${file.split('/').at(-1)}`;
  document.getElementById('source-title')!.textContent = file;
  try { content.textContent = await sources[file](); }
  catch { content.textContent = 'Could not load this source file. Check the Vite server and reload.'; }
}
