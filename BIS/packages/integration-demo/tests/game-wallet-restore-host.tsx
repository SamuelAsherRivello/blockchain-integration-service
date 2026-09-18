import { createRoot } from 'react-dom/client';
import { GameWalletLogin } from '../../integration/src/ui/GameWalletLogin';
import { PendingOperations } from '../../integration/src/ui/PendingOperationDialog';
import '@bis/integration/style.css';

const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const host = document.getElementById('host')!;
const result = document.getElementById('result')!;
const listeners = new Set<() => void>();
const state = {status:'ready', selectionVersion:0, playerConnected:true, profileId:undefined as string | undefined, message: undefined as string | undefined};
let imported = '';
let releaseLogout = () => {};
const wallet = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  getState: () => state,
  async importWallet(value: string) { imported = value; state.profileId = 'game-wallet-fixture'; listeners.forEach(listener => listener()); return true; },
  async logout() { await new Promise<void>(resolve => { releaseLogout = resolve; }); state.profileId = undefined; listeners.forEach(listener => listener()); },
} as Parameters<typeof GameWalletLogin>[0]['wallet'];
const root = createRoot(host);
root.render(<PendingOperations><div className="bis-layer bis-layer-open"><section className="bis-card"><h2>Game Wallet Login</h2><p>Set the wallet used by this game’s contracts.</p><GameWalletLogin wallet={wallet} onBack={() => undefined} /></section></div></PendingOperations>);
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const button = (name: string) => [...host.querySelectorAll('button')].find(item => item.textContent?.trim() === name || item.getAttribute('aria-label') === name)!;

document.getElementById('run')!.onclick = async () => {
  result.textContent = 'Running';
  try {
    await tick();
    Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{readText:async() => phrase}});
    check(!!button('⚡ Create Wallet') && !!button('⚡ Restore Wallet'), 'Exact Game Wallet start actions');
    const actions = [...host.querySelectorAll<HTMLElement>('.bis-account-actions button')];
    check(actions[0].getBoundingClientRect().top === actions[1].getBoundingClientRect().top, 'Create and Restore share one row');
    button('⚡ Restore Wallet').click(); await tick();
    const inputs = [...host.querySelectorAll<HTMLInputElement>('.bis-word-input input')];
    const card = host.querySelector<HTMLElement>('.bis-card')!;
    check(inputs.length === 12, 'Game Wallet uses the shared twelve-word grid');
    check(!host.querySelector('textarea'), 'No Game Wallet recovery textarea remains');
    check(host.textContent?.includes('Never use a real wallet’s phrase.'), 'Shared recovery warning');
    check(button('Paste from Clipboard').getAttribute('aria-label') === 'Paste from Clipboard', 'Shared paste action');
    check(button('Show seed words').getAttribute('aria-pressed') === 'false', 'Words initially hidden');
    check(inputs[0].closest<HTMLElement>('.bis-word')!.getBoundingClientRect().height < 32, 'Compact two-input row');
    check(card.scrollHeight <= card.clientHeight + 1, 'No recovery-card scrollbar');
    check([...host.querySelectorAll<HTMLElement>('.bis-button')].every(item => item.scrollWidth <= item.clientWidth + 1), 'BIS button labels fit');
    button('Paste from Clipboard').click(); await tick();
    check(!button('⚡ Restore Wallet').disabled, 'Valid phrase enables Game Wallet restore');
    button('⚡ Restore Wallet').click(); await tick();
    check(imported === phrase && host.textContent?.includes('Game wallet configured.'), 'Restore delegates only to Game Wallet import');
    button('Log Out Game Wallet').click(); await tick();
    check(button('Log Out Game Wallet').disabled && host.querySelector('.bis-pending-dialog h2')?.textContent === 'Logging out...', 'Logout shows the blocking loader');
    check(host.querySelectorAll('.bis-pending-dialog').length === 1, 'Logout uses one loader');
    releaseLogout(); await tick(); await tick(); await tick(); await tick();
    check(!!button('⚡ Create Wallet') && !host.querySelector('.bis-pending-dialog'), 'Logout returns to the unconfigured start');
    result.textContent = 'PASS: shared compact twelve-word Game Wallet recovery, fitting actions, and logout loader.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'Game Wallet restore checks'}`; }
};
if (new URLSearchParams(location.search).has('run')) document.getElementById('run')!.click();
