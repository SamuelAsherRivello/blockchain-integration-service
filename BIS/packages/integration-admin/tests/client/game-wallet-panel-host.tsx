import { createRoot } from 'react-dom/client';
import { AdminGameWalletView } from '../../src/client/admin-layer/GameWalletPanel';
import '@bis/integration/style.css';

const result = document.getElementById('result')!;
const details = document.getElementById('details')!;
const host = document.getElementById('host')!;
const listeners = new Set<() => void>();
let state: any = {
  status: 'empty', selectionVersion: 0, playerConnected: false,
  message: 'Connect a Player Wallet before using the Game Wallet.',
};
const unavailableState = {
  status: 'unavailable', selectionVersion: 1, profileId: 'fixture-game-wallet', playerConnected: true,
  addresses: { arkadeAddress: 'tark1fixture', bitcoinAddress: 'tb1fixture' },
  message: 'Game wallet reads unavailable. Use Details to retry.', readStatus: 'wallet-read',
};
let refreshes = 0;
const controller: any = {
  getState: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  async refresh() {
    refreshes += 1;
    state = { ...state, status: 'ready', balance: { availableSats: 321, totalSats: 321, bitcoinSats: 0, arkadeSats: 321 }, message: undefined, readStatus: undefined };
    listeners.forEach(listener => listener());
    return state;
  },
  async checkLiveBoardingState() { return 'unknown'; },
  getPlayerPaymentBlockReason: () => 'Ready',
  getPlayerPaymentBalance: () => '321 sats',
};

createRoot(host).render(<AdminGameWalletView controller={controller} mode="board" onOpenDeveloper={() => undefined} onDetails={value => { details.textContent = JSON.stringify(value); }} />);
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
const button = (name: string) => [...host.querySelectorAll('button')].find(item => item.textContent?.trim() === name)!;

document.getElementById('run')!.onclick = async () => {
  result.textContent = 'Running';
  try {
    await tick();
    if (details.textContent) throw Error('Disconnected startup wrote to the console');
    state = unavailableState;
    listeners.forEach(listener => listener());
    await tick();
    if (!details.textContent?.includes(unavailableState.message)) throw Error('Wallet read failure was not reported');
    button('Details').click();
    await tick();
    const report = JSON.parse(details.textContent || '{}');
    if (refreshes !== 1 || report.status !== 'ready' || report.readCategory !== undefined) throw Error('Details did not recover the synthetic read');
    if (!host.textContent?.includes('321')) throw Error('Recovered balance is not visible');
    result.textContent = 'PASS: quiet disconnected startup, unavailable Game Wallet read, Details retry, recovery, and sanitized category behavior.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'Game Wallet panel checks'}`; }
};
if (new URLSearchParams(location.search).has('run')) document.getElementById('run')!.click();
