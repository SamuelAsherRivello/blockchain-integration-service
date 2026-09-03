import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import '@bis/integration/style.css';

// Isolated UI fixture: no real wallet, clipboard writes, or persisted account.
const context = createContext({
  load: async () => ({ account: null, generation: 0 }),
  save: async () => {}, reset: async () => {}, subscribe: () => () => {},
}, async () => ({ phrase: 'not-a-wallet', profileId: 'copy-test' }));
const host = document.getElementById('host')!;
const ui = createBisUi(context);
ui.mount(host);
await context.ready();
context.openAccountDialog();
await context.createAccount();
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
function assert(value: unknown, message: string) { if (!value) throw Error(message); }
document.getElementById('run')!.onclick = async () => {
  const result = document.getElementById('result')!;
  let calls = 0, fail = false;
  let releaseCopy: (() => void) | undefined;
  let delayCopy = false;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async () => { calls++; if (delayCopy) await new Promise<void>(resolve => { releaseCopy = resolve; }); if (fail) throw Error('denied'); },
  } });
  try {
    const button = host.querySelector<HTMLButtonElement>('.bis-copy-button')!;
    const indicator = () => button.querySelector('.bis-copy-indicator')!;
    assert(button && indicator(), 'unchecked indicator exists inside copy button');
    assert(!indicator().classList.contains('bis-copy-indicator-checked'), 'initially unchecked');
    for (let i = 1; i <= 3; i++) {
      button.click(); await tick();
      assert(calls === i && indicator().classList.contains('bis-copy-indicator-checked'), 'repeated copy stays checked');
      assert(getComputedStyle(indicator()).backgroundColor === 'rgb(23, 128, 82)', 'success is green');
      assert(!host.querySelector('.bis-copy-status'), 'no separate success line');
    }
    const label = button.textContent;
    const color = getComputedStyle(button).color;
    const background = getComputedStyle(button).backgroundColor;
    delayCopy = true;
    button.click(); await tick();
    assert(button.textContent === label, 'repeat copy keeps button text unchanged while pending');
    assert(getComputedStyle(button).color === color && getComputedStyle(button).backgroundColor === background, 'repeat copy keeps button colors unchanged while pending');
    button.click(); await tick();
    assert(calls === 4, 'pending copy ignores duplicate clicks');
    releaseCopy!(); await tick(); delayCopy = false;
    fail = true; button.click(); await tick();
    assert(host.querySelector('.bis-copy-status')?.textContent?.includes('Could not copy'), 'failure remains actionable');
    fail = false; button.click(); await tick();
    assert(indicator().classList.contains('bis-copy-indicator-checked') && !host.querySelector('.bis-copy-status'), 'retry succeeds');
    result.textContent = 'PASS: unchecked/green check, repeat copy has stable text and colors, duplicate guard, failure and retry.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'copy checks'}`; }
};
