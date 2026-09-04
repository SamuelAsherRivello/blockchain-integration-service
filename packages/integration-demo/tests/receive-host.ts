import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import '@bis/integration/style.css';

const host = document.getElementById('host')!;
const result = document.getElementById('result')!;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const check = (ok: unknown, message: string) => { if (!ok) throw Error(message); };
const wait = async (predicate: () => boolean) => { const end = Date.now() + 3000; while (!predicate()) { if (Date.now() > end) throw Error('UI timeout'); await tick(); } };
let cleanup = () => {};
document.getElementById('run')!.onclick = async () => {
  cleanup(); result.textContent = 'Running isolated checks';
  const account = { phrase: 'isolated-placeholder', profileId: 'isolated-profile' };
  const addresses = { arkadeAddress: 'tark1' + 'a'.repeat(150), bitcoinAddress: 'tb1p' + 'b'.repeat(58) };
  let fail = false, denyCopy = false, copied = '';
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { if (denyCopy) throw Error('denied'); copied = value; } } });
  const context = createContext({ load: async () => ({ account, generation: 0 }), save: async () => { throw Error('Unexpected write'); }, reset: async () => { throw Error('Unexpected reset'); }, subscribe: () => () => {} }, undefined, async () => account.profileId, undefined, undefined, undefined, async () => { await tick(); if (fail) throw Error('private failure'); return addresses; });
  const ui = createBisUi(context); ui.mount(host);
  cleanup = () => { ui.unmount(); context.dispose(); if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); };
  const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const value = (label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!.value;
  try {
    await context.ready(); context.openAccountDialog(); context.openAccountReceive();
    await wait(() => context.getState().addresses.status === 'ready'); await tick();
    for (const [label, address] of [['Arkade address', addresses.arkadeAddress], ['Bitcoin address', addresses.bitcoinAddress]]) {
      check(value(label) === address, 'Full address'); button(`Copy ${label}`).click();
      await wait(() => !!host.textContent?.includes(`${label} copied.`)); check(copied === address, 'Exact independent copy');
    }
    denyCopy = true; button('Copy Bitcoin address').click();
    await wait(() => !!host.textContent?.includes('Could not copy.'));
    check(!host.textContent?.includes('Bitcoin address copied.'), 'No false success');
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Bitcoin address"]')!;
    input.focus(); check(input.selectionEnd === input.value.length, 'Manual selection fallback');
    fail = true; const refreshing = context.refreshBalance();
    check(context.getState().addresses.status === 'loading', 'Loading state');
    await refreshing; await tick();
    check(value('Arkade address') === 'Addresses unavailable' && button('Copy Arkade address').disabled && button('Copy Bitcoin address').disabled, 'No stale copy on failure');
    fail = false; await context.refreshBalance(); await tick(); check(value('Bitcoin address') === addresses.bitcoinAddress, 'Refresh recovery');
    context.closeAccount(); await tick(); check(!host.querySelector('input[aria-label="Arkade address"]'), 'Back clears view');
    context.openAccountReceive(); await wait(() => context.getState().addresses.status === 'ready'); await tick();
    check(!host.querySelector('.bis-invoice') && !host.textContent?.includes('Invoice'), 'Deferred invoice UI is hidden');
    const card = host.querySelector<HTMLElement>('.bis-card')!;
    check(card.scrollWidth <= card.clientWidth, 'No horizontal overflow');
    result.textContent = 'PASS: both exact copies, denial/manual fallback, loading, Refresh failure/retry, Back/re-entry, unavailable defaults, portrait layout. Isolated fixtures only.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'Receive checks'}`; }
};
