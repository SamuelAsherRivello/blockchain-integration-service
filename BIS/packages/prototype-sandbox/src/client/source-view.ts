import { SOURCE_FILES } from './source-links.ts';
import './source-view.css';

// An allowlist, not an arbitrary filesystem reader. Raw imports never execute the demo.
const sources = {
  [SOURCE_FILES.app]: () => import('./App.tsx?raw'),
  [SOURCE_FILES.events]: () => import('./events-demo-source.ts?raw'),
  [SOURCE_FILES.upgrade]: () => import('./asset-upgrade-demo-source.ts?raw'),
  [SOURCE_FILES.vault]: () => import('./conditional-vault-demo-source.ts?raw'),
};
const file = new URLSearchParams(location.search).get('file') ?? '';
const content = document.getElementById('source-content')!;
if (!import.meta.env.DEV || !Object.hasOwn(sources, file)) {
  content.textContent = 'Source unavailable. Open a source link from a sandbox demo.';
} else {
  document.title = `Source: ${file.split('/').at(-1)}`;
  document.getElementById('source-title')!.textContent = file;
  try { content.textContent = (await sources[file]()).default; }
  catch { content.textContent = 'Could not load this source file. Check the Vite server and reload.'; }
}
