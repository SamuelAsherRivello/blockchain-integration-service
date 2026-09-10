import { createRoot } from 'react-dom/client';
import { GameWalletLogin } from '../../integration/src/ui/GameWalletLogin';
import '@bis/integration/style.css';

const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const host = document.getElementById('host')!;
const result = document.getElementById('result')!;
const listeners = new Set<() => void>();
const state = {status:'ready', selectionVersion:0, profileId:undefined as string | undefined};
let imported = '';
const wallet = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  getState: () => state,
  async importWallet(value: string) { imported = value; state.profileId = 'game-wallet-fixture'; listeners.forEach(listener => listener()); return true; },
} as Parameters<typeof GameWalletLogin>[0]['wallet'];
const root = createRoot(host);
root.render(<div className="bis-layer bis-layer-open"><section className="bis-card"><h2>Game Wallet Login</h2><p>Set the wallet used by this game’s contracts.</p><GameWalletLogin wallet={wallet} onBack={() => undefined} /></section></div>);
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const button = (name: string) => [...host.querySelectorAll('button')].find(item => item.textContent?.trim() === name || item.getAttribute('aria-label') === name)!;

document.getElementById('run')!.onclick = async () => {
  result.textContent = 'Running';
  try {
    Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{readText:async() => phrase}});
    button('⚡ Restore Game Wallet').click(); await tick();
    const inputs = [...host.querySelectorAll<HTMLInputElement>('.bis-word-input input')];
    const card = host.querySelector<HTMLElement>('.bis-card')!;
    check(inputs.length === 12, 'Game Wallet uses the shared twelve-word grid');
    check(!host.querySelector('textarea'), 'No Game Wallet recovery textarea remains');
    check(host.textContent?.includes('Never use a real wallet’s phrase.'), 'Shared recovery warning');
    check(button('Paste from Clipboard').getAttribute('aria-label') === 'Paste from Clipboard', 'Shared paste action');
    check(button('Show seed words').getAttribute('aria-pressed') === 'false', 'Words initially hidden');
    check(getComputedStyle(inputs[0]).fontSize === getComputedStyle(inputs[1]).fontSize, 'Inputs retain one font');
    check(inputs[0].closest<HTMLElement>('.bis-word')!.getBoundingClientRect().height < 32, 'Compact two-input row');
    check(card.scrollHeight <= card.clientHeight + 1, 'No recovery-card scrollbar');
    button('Paste from Clipboard').click(); await tick();
    check(!button('⚡ Restore Game Wallet').disabled, 'Valid phrase enables Game Wallet restore');
    button('⚡ Restore Game Wallet').click(); await tick();
    check(imported === phrase && host.textContent?.includes('Game wallet configured.'), 'Restore delegates only to Game Wallet import');
    result.textContent = 'PASS: shared compact twelve-word Game Wallet recovery entry.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'Game Wallet restore checks'}`; }
};
