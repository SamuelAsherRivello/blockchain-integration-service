import { createRoot } from 'react-dom/client';
import { GameWalletLogin } from '../../../integration/src/client/ui-layer-react/GameWalletLogin';
import { PendingOperations } from '../../../integration/src/client/ui-layer-react/PendingOperationDialog';
import '@bis/integration/style.css';

const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const host = document.getElementById('host')!;
const result = document.getElementById('result')!;
const listeners = new Set<() => void>();
const state = {status:'ready', selectionVersion:0, playerConnected:true, profileId:undefined as string | undefined, addresses: undefined as {arkadeAddress:string;bitcoinAddress:string} | undefined, balance: undefined as {availableSats:number;totalSats:number;bitcoinSats:number;arkadeSats:number} | undefined, message: undefined as string | undefined};
let imported = '';
let address = 'tark1game-wallet-fixture';
let copied = '';
let releaseLogout = () => {};
let releaseImport = () => {};
const wallet = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  getState: () => state,
  async importWallet(value: string) { imported = value; await new Promise<void>(resolve => { releaseImport = resolve; }); state.profileId = 'game-wallet-fixture'; state.addresses = {arkadeAddress:address, bitcoinAddress:'tb1game-wallet-fixture'}; state.balance = {availableSats:1234,totalSats:1234,bitcoinSats:0,arkadeSats:1234}; listeners.forEach(listener => listener()); return true; },
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
    Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{readText:async() => phrase, writeText:async(value:string) => { copied = value; }}});
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
    check(host.querySelector('.bis-pending-dialog h2')?.textContent === 'Logging in...', 'Restore shows the blocking login loader');
    check(button('⚡ Restore Wallet').disabled, 'Restore remains disabled while login is pending');
    releaseImport(); await tick(); await tick();
    check(imported === phrase && host.textContent?.includes('Game wallet configured.'), 'Restore delegates only to Game Wallet import');
    const arkadeField = host.querySelector<HTMLInputElement>('input[aria-label="Arkade address"]');
    const balanceField = host.querySelector<HTMLInputElement>('input[aria-label="Arkade balance"]');
    check(arkadeField?.value === address, 'Selected Game Wallet Arkade address is visible');
    check(balanceField?.value === '1,234 sats', 'Selected Game Wallet Arkade balance is visible');
    check(!!host.querySelector('button[aria-label="Copy Arkade address"]'), 'Arkade address has a Copy action');
    check((arkadeField?.getBoundingClientRect().bottom ?? 0) <= (balanceField?.getBoundingClientRect().top ?? 0), 'Arkade balance appears below address');
    check((balanceField?.getBoundingClientRect().bottom ?? 0) <= button('Log Out Game Wallet').getBoundingClientRect().top, 'Arkade balance appears above logout');
    state.status = 'loading'; listeners.forEach(listener => listener()); await tick();
    check(host.querySelector<HTMLInputElement>('input[aria-label="Arkade address"]')?.value === address, 'Arkade address remains visible while refreshing');
    check(host.querySelector<HTMLInputElement>('input[aria-label="Arkade balance"]')?.value === '1,234 sats', 'Arkade balance remains visible while refreshing');
    state.addresses = undefined; listeners.forEach(listener => listener()); await tick();
    check(!!host.querySelector<HTMLInputElement>('input[aria-label="Arkade address"]') && !!host.querySelector('button[aria-label="Copy Arkade address"]'), 'Arkade address layout remains visible while address is pending');
    check(host.querySelector<HTMLInputElement>('input[aria-label="Arkade balance"]')?.value === '1,234 sats', 'Arkade balance remains visible while address is pending');
    state.status = 'ready'; state.addresses = {arkadeAddress:address, bitcoinAddress:'tb1game-wallet-fixture'}; listeners.forEach(listener => listener()); await tick();
    button('Copy Arkade address').click(); await tick();
    check(copied === address, 'Copy uses the complete Arkade address');
    button('Log Out Game Wallet').click(); await tick();
    check(button('Log Out Game Wallet').disabled && host.querySelector('.bis-pending-dialog h2')?.textContent === 'Logging out...', 'Logout shows the blocking loader');
    check(host.querySelectorAll('.bis-pending-dialog').length === 1, 'Logout uses one loader');
    releaseLogout(); await tick(); await tick(); await tick(); await tick();
    check(!!button('⚡ Create Wallet') && !host.querySelector('.bis-pending-dialog'), 'Logout returns to the unconfigured start');
    result.textContent = 'PASS: shared compact twelve-word Game Wallet recovery, fitting actions, and logout loader.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'Game Wallet restore checks'}`; }
};
if (new URLSearchParams(location.search).has('run')) document.getElementById('run')!.click();
