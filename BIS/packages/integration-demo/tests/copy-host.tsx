import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import '@bis/integration/style.css';

// Isolated UI fixture: no real wallet, clipboard writes, or persisted account.
const context = createContext({
  load: async () => ({ account: null, generation: 0 }),
  save: async () => {}, reset: async () => {}, subscribe: () => () => {},
}, async () => ({ phrase: '  '+Array.from({length:12},(_,i)=>`placeholder-${i}`).join('  \n')+'  ', profileId: 'copy-test' }));
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
    writeText: async (value:string) => { assert(value===Array.from({length:12},(_,i)=>`placeholder-${i}`).join(' '),'exact normalized copy'); calls++; if (delayCopy) await new Promise<void>(resolve => { releaseCopy = resolve; }); if (fail) throw Error('denied'); },
  } });
  try {
    assert(host.querySelector('h2')?.textContent==='Set Recovery Phrase','Set title');
    assert([...host.querySelectorAll('.bis-recovery-word')].every(word=>word.textContent?.startsWith('*')),'Setup initially masked');
    const eye=host.querySelector<HTMLButtonElement>('.bis-visibility-toggle')!;
    eye.click();await tick();assert(eye.getAttribute('aria-pressed')==='true','Setup reveals');
    eye.click();await tick();assert(eye.getAttribute('aria-pressed')==='false','Setup hides');
    for(const width of [280,360]) {
      host.style.width=`${width}px`;await tick();
      const heading=host.querySelector('.bis-recovery-heading h3')!.getBoundingClientRect();
      for(const icon of host.querySelectorAll('.bis-recovery-heading button')) {const bounds=icon.getBoundingClientRect();assert(Math.abs(bounds.top+bounds.height/2-heading.top-heading.height/2)<2,'Setup controls share a line');}
    }
    const button = host.querySelector<HTMLButtonElement>('.bis-copy-field-heading .bis-copy-icon')!;
    assert(host.querySelector('.bis-copy-field-heading h3')?.textContent === 'Seed words', 'seed words heading exists');
    assert(host.querySelector('.bis-recovery')?.previousElementSibling?.querySelector('h3')?.textContent === 'Seed words', 'heading directly precedes words');
    assert(!host.querySelector('.bis-actions .bis-copy-button'), 'separate copy button removed');
    const indicator = () => button.querySelector('svg')!;
    assert(button && indicator(), 'unchecked indicator exists inside copy button');
    assert(button.title !== 'Copied', 'initially unchecked');
    for (let i = 1; i <= 3; i++) {
      button.click(); await tick();
      assert(calls === i && button.title === 'Copied', 'repeated copy stays checked');
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
    assert(button.title === 'Copied' && !host.querySelector('.bis-copy-status'), 'retry succeeds');
    eye.click();await tick();context.closeAccount();await tick();context.openAccountDialog();await context.createAccount();await tick();
    assert(host.querySelector('.bis-visibility-toggle')?.getAttribute('aria-pressed')==='false','New setup resets mask');
    host.querySelector<HTMLButtonElement>('.bis-visibility-toggle')!.click();await tick();ui.unmount();ui.mount(host);await tick();
    assert(host.querySelector('.bis-visibility-toggle')?.getAttribute('aria-pressed')==='false','Setup remount resets mask');
    result.textContent = 'PASS: Seed words header, inline copy icon, no separate button, repeat copy, duplicate guard, failure and retry.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'copy checks'}`; }
};
