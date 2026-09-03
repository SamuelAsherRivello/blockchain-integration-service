import { createContext } from '../../integration/src/core/context';
import { createBisUi } from '@bis/integration';
import '@bis/integration/style.css';

const host = document.getElementById('host')!;
const result = document.getElementById('result')!;
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
const check = (ok: unknown, message: string) => { if (!ok) throw Error(message); };
let cleanup = () => {};
document.getElementById('run')!.onclick = async () => {
  cleanup();
  result.textContent = 'Running';
  const account = { phrase: 'isolated-placeholder', profileId: '1234567890abcdef' };
  let balance!: (value: { availableSats: number; totalSats: number }) => void;
  const context = createContext({ load: async () => ({ account, generation: 0 }), save: async () => { throw Error('Unexpected write'); }, reset: async () => {}, subscribe: () => () => {} }, undefined, async () => account.profileId, undefined,
    () => new Promise(resolve => { balance = resolve; }), undefined,
    async () => { throw Error('Details must not request addresses'); });
  const ui = createBisUi(context);
  ui.mount(host);
  cleanup = () => { ui.unmount(); context.dispose(); };
  try {
    await context.ready(); context.openAccountDialog(); context.openAccountDetails(); await tick();
    const fields = Array.from(host.querySelectorAll('input'));
    check(fields.length === 2, 'Only the two balance fields must exist before values load');
    check(host.querySelector('.bis-network-label')?.textContent === 'Network: Signet', 'Network label appears at the top of Account Details');
    check(!Array.from(host.querySelectorAll('label')).some(label => label.textContent?.includes('Network')), 'Network is not repeated in the details fields');
    const card = host.querySelector('.bis-card')!;
    const bounds = () => JSON.stringify([card.getBoundingClientRect().height, ...Array.from(host.querySelectorAll('input, .bis-actions button')).map(node => node.getBoundingClientRect().top)]);
    const loadingBounds = bounds();
    const stable = () => {
      check(fields.every((field, index) => host.querySelectorAll('input')[index] === field), 'Fields must not remount');
      check(bounds() === loadingBounds, 'Dialog and controls must not shift');
      check(card.scrollWidth <= card.clientWidth, 'No horizontal overflow');
    };
    check(!host.querySelector('[aria-label="Arkade address"]'), 'Addresses belong to Receive');
    balance({ availableSats: 1000, totalSats: 1500 }); await tick(); stable();
    check(fields[0].value === '1,000 sats', 'Values populated');
    const refreshing = context.refreshBalance(); await tick(); stable();
    check(fields[0].value === 'Loading...', 'Refresh clears stale values');
    balance({ availableSats: 0, totalSats: 0 });  await refreshing; await tick(); stable();
    const retry = context.refreshBalance(); await tick(); stable();
    balance({ availableSats: 0, totalSats: 0 }); await retry; await tick(); stable();
    result.textContent = 'PASS: stable fields and geometry during loading, values and refresh.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'layout checks'}`; }
};
