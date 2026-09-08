import { createContext } from '../../integration/src/core/context';
import { version } from '../../integration/package.json';

const built = new URLSearchParams(location.search).has('built');
const { createBisUi, createBisContext } = built ? await import('../../integration/dist/integration.js') : await import('@bis/integration');
if (built) await import('../../integration/dist/integration.css');
else await import('@bis/integration/style.css');
const host = document.getElementById('host')!;
const result = document.getElementById('result')!;
const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const check = (ok: boolean, message: string) => { if (!ok) throw Error(message); };
let cleanup = () => {};
document.getElementById('run')!.onclick = async () => {
  try {
    for (const active of (built ? [false] : [false, true])) {
      cleanup();
      const account = { phrase: 'isolated-placeholder', profileId: '1234567890abcdef' };
      const context = built ? createBisContext() : createContext({ load: async () => active ? { account, generation: 0 } : { account: null, generation: 0 }, save: async () => { throw Error('Unexpected write'); }, reset: async () => {}, subscribe: () => () => {} }, undefined, async () => account.profileId);
      const ui = createBisUi(context);
      ui.mount(host);
      cleanup = () => { ui.unmount(); context.dispose(); };
      await context.ready(); context.openAccountDialog(); await tick();
      const card = host.querySelector<HTMLElement>('.bis-card')!;
      const network = host.querySelector<HTMLElement>('.bis-network-text')!;
      const label = host.querySelector<HTMLElement>('.bis-version-label')!;
      check(label.textContent === `BIS: v${version}`, 'Package version');
      check(getComputedStyle(label).textTransform === 'none' && Number(getComputedStyle(label).opacity) === .3, 'Faded lowercase version');
      for (const width of [360, 280, 240]) {
        host.style.width = `${width}px`;
        for (const text of [`BIS: v${version}`, 'BIS: v12.123.456']) {
          label.textContent = text; await tick();
          const c = card.getBoundingClientRect(), n = network.getBoundingClientRect(), v = label.getBoundingClientRect();
          check(Math.abs((n.left + n.right - c.left - c.right) / 2) < 1, `Centered at ${width}`);
          check(v.left > n.right && v.right <= c.right, `Fits at ${width}`);
          check(card.scrollWidth <= card.clientWidth, `No overflow at ${width}`);
        }
      }
      label.textContent = `BIS: v${version}`;
      host.style.width = '360px';
      const filler = document.createElement('div'); filler.style.height = '1200px'; card.append(filler);
      await tick();
      const strip = host.querySelector<HTMLElement>('.bis-network-label')!;
      const top = strip.getBoundingClientRect().top;
      card.scrollTop = 100; await tick();
      check(Math.abs(strip.getBoundingClientRect().top - top) < 1, 'Sticky header');
      filler.remove(); card.scrollTop = 0;
    }
    result.textContent = `PASS: ${built ? 'built library' : 'development source'} v${version}; 360/280/240px, longer version, centering, fade, overflow and sticky header.`;
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : error}`; }
};




