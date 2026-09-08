import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBisContext, createBisUi, type BisContext, type BisToastOptions } from '@bis/integration';
import { createContext } from '../../integration/src/core/context';
import { BisView } from '../../integration/src/ui/client';
import '@bis/integration/style.css';

const host = document.getElementById('runtime')!;
let context: BisContext, ui: ReturnType<typeof createBisUi>, strictRoot: Root | undefined;
let hostClicks = 0;
function teardown() {
  if (strictRoot) { strictRoot.unmount(); strictRoot = undefined; }
  ui?.unmount(); context?.dispose();
}
function fresh(mode: 'public' | 'pending' | 'error' | 'strict' = 'public') {
  teardown();
  // The normal host uses only the public factory. Error/pending cases use isolated storage.
  context = mode === 'pending' || mode === 'error' ? createContext({
    load: () => mode === 'pending' ? new Promise(() => {}) : Promise.reject(new Error('Fixture unavailable')),
    save: async () => { throw Error('Unexpected save'); }, reset: async () => { throw Error('Unexpected reset'); }, subscribe: () => () => {},
  }) : createBisContext();
  ui = createBisUi(context);
  if (mode === 'strict') {
    context.showToast('StrictMode queued before mount');
    strictRoot = createRoot(host);
    strictRoot.render(<StrictMode><BisView context={context} /></StrictMode>);
  } else ui.mount(host);
  if (mode === 'pending' || mode === 'error') context.openAccountDialog();
}
fresh();
const show = (message: string, options?: BisToastOptions) => context.showToast(message, options);
document.getElementById('show')!.onclick = () => show('Independent host notification.');
document.getElementById('long')!.onclick = () => show('Five-second notification.', {durationMs: 5000});
document.getElementById('image')!.onclick = () => show('Level 1 trophy image preview.', {imageUrl: '/assets/achievements/v2/level-1-trophy.png'});
document.getElementById('repeat')!.onclick = () => { for (let i = 0; i < 3; i++) show('Repeated notification.'); };
document.getElementById('account')!.onclick = () => context.openAccountDialog();
document.getElementById('unmount')!.onclick = () => ui.unmount();
document.getElementById('mount')!.onclick = () => ui.mount(host);
document.getElementById('dispose')!.onclick = () => context.dispose();
document.getElementById('pending')!.onclick = () => fresh('pending');
document.getElementById('error')!.onclick = () => fresh('error');
document.getElementById('fresh')!.onclick = () => fresh();
document.getElementById('underlying')!.onclick = () => { document.getElementById('result')!.textContent = `Host action ${++hostClicks}`; };
Object.assign(window, {toastFixture: {
  show, fresh, unmount: () => ui.unmount(), mount: () => ui.mount(host), dispose: () => context.dispose(),
  openAccount: () => context.openAccountDialog(), closeAccount: () => context.closeAccount(),
}});
