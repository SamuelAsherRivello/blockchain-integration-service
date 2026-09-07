import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from '../src/App';
import { createContext } from '../../integration/src/core/context';
import { assetBaseUnits } from '../../integration/src/core/assets';
import type { BisAsset, BisContext, BisListAssetsResult, BisMintAssetResult } from '@bis/integration';
import '../src/style.css';

// Page-local replacement only: never read, clear, or mutate real browser storage.
// App's actual SplitWorkspace/GamePreview preferences also stay in this map.
const memoryStorage = new Map<string, string>();
Object.defineProperty(window, 'localStorage', { configurable: true, value: {
  get length() { return memoryStorage.size; }, key: (index: number) => [...memoryStorage.keys()][index] ?? null,
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => { memoryStorage.set(key, String(value)); },
  removeItem: (key: string) => { memoryStorage.delete(key); }, clear: () => memoryStorage.clear(),
} });
const publicProfileId = 'fixture-app-public-profile';
const asset: BisAsset = { assetId: 'c'.repeat(64) + '0000', name: 'Achievement: Level 1', ticker: 'LVL1', quantity: '1', decimals: 0,
  iconUrl: 'https://samuelasherrivello.github.io/blockchain-integration-service/assets/achievements/v1/level-1-trophy.png' };
let connected = true;
let generation = 0;
let storageResets = 0;
let listCalls = 0;
let mintCalls = 0;
let active: BisContext;
type Scenario = 'holdings' | 'empty' | 'error' | 'held';
let scenario: Scenario = 'holdings';
let pendingRelease: (() => void) | undefined;
const scenarioSelect = document.getElementById('app-scenario') as HTMLSelectElement;
scenarioSelect.onchange = () => { scenario = scenarioSelect.value as Scenario; };
const hold = () => new Promise<void>(resolve => { pendingRelease = resolve; });
function releaseHeld() { const release = pendingRelease; pendingRelease = undefined; release?.(); }
document.getElementById('release-app-pending')!.onclick = releaseHeld;

function contextFactory() {
  const context = createContext({
    load: async () => ({ generation, account: connected ? { phrase: 'fixture-only-not-a-recovery-phrase', profileId: publicProfileId } : null }),
    save: async () => { throw Error('Account creation is outside this isolated fixture'); },
    reset: async () => { connected = false; generation++; storageResets++; },
    subscribe: () => () => {},
  }, async () => { throw Error('Account creation is outside this isolated fixture'); }, async () => publicProfileId,
  async () => { throw Error('Account restoration is outside this isolated fixture'); },
  async () => ({ availableSats: 1000, totalSats: 1000, bitcoinSats: 0, arkadeSats: 1000 }),
  async () => { throw Error('Funding is outside this isolated fixture'); },
  async () => { throw Error('Address reads are outside this isolated fixture'); },
  async () => {});
  context.getPendingAssetMint = async () => context.getState().hasProfile
    ? { status: 'success', profileId: publicProfileId, request: null }
    : { status: 'error', code: 'account-required', message: 'An active account is required.' };
  context.listAssets = async (): Promise<BisListAssetsResult> => {
    listCalls++;
    const wasConnected = context.getState().hasProfile;
    const selected = scenario;
    if (selected === 'held') await hold();
    if (!wasConnected) return { status: 'error', code: 'account-required', message: 'An active account is required.' };
    if (selected === 'error') return { status: 'error', code: 'unavailable', message: 'Assets are unavailable. Try again.' };
    return { status: 'success', profileId: publicProfileId, assets: selected === 'empty' ? [] : [asset] };
  };
  context.mintAsset = async request => {
    mintCalls++;
    if (scenario === 'held') await hold();
    const result: BisMintAssetResult = !context.getState().hasProfile
      ? { status: 'error', code: 'account-required', message: 'An active account is required.' }
      : { status: 'minted', profileId: publicProfileId, operationId: request.operationId,
          asset: { ...asset, name: request.name, ticker: request.ticker, decimals: request.decimals, quantity: assetBaseUnits(request.amount, request.decimals).toString(),
            ...(request.iconUrl ? { iconUrl: request.iconUrl } : {}) } };
    return result;
  };
  active = context;
  return context;
}
const root = createRoot(document.getElementById('root')!);
root.render(<App contextFactory={contextFactory} />);

// Programmatic fixture clicks need an explicit React event boundary. Otherwise a
// synchronously returned callback can increment counters before pending UI renders.
const clickAdmin = (label: string) => flushSync(() => adminButton(label).click());
const afterRender = () => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
async function until(check: () => boolean, message: string) {
  for (let count = 0; count < 150; count++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw Error(message);
}
const assert = (condition: unknown, message: string) => { if (!condition) throw Error(message); };
const adminButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('.admin-panel button')].find(button => button.textContent?.includes(label))!;
const consoleElement = () => document.querySelector<HTMLTextAreaElement>('[aria-label="Console output"]')!;
const consoleValue = () => consoleElement().value;
const setScenario = (value: Scenario) => { scenario = value; scenarioSelect.value = value; };
async function list() {
  const previous = listCalls;
  clickAdmin('List Assets');
  await until(() => listCalls === previous + 1 && !adminButton('List Assets').disabled, 'list callback did not finish');
}
async function reset() {
  const previous = storageResets;
  const previousContext = active;
  clickAdmin('Reset Client');
  await until(() => storageResets === previous + 1 && active !== previousContext && active.getState().phase === 'idle'
    && consoleValue() === '' && !adminButton('List Assets').disabled, 'actual Reset Client did not clear Console');
}
const runButton = document.getElementById('run-console-checks') as HTMLButtonElement;
runButton.onclick = async () => {
  const result = document.getElementById('fixture-result')!;
  runButton.disabled = true;
  result.textContent = 'Running checks against the actual App and its Console.';
  try {
    // Remount into a new isolated fixture identity state, leaving real storage untouched.
    connected = true; generation++; storageResets = 0; listCalls = 0; mintCalls = 0; setScenario('holdings');
    const previousContext = active;
    flushSync(() => root.render(<App key={generation} contextFactory={contextFactory} />));
    await until(() => !!active && active !== previousContext && active.getState().phase === 'active' && !adminButton('List Assets')?.disabled, 'fixture account not ready');
    const preview = () => document.querySelector('[aria-label="Runtime Preview"]')!.innerHTML;
    const initialPreview = preview();
    assert(consoleValue() === '', 'fresh App mount must start with empty Console');
    setScenario('held');
    clickAdmin('List Assets');
    await until(() => !!pendingRelease && consoleValue().includes('"status": "pending"'), 'pending list progress missing');
    assert(adminButton('Mint Asset').disabled && adminButton('List Assets').disabled, 'asset actions must disable while the read is pending');
    releaseHeld();
    await until(() => consoleValue().includes('"status": "success"') && !adminButton('List Assets').disabled, 'success after pending missing');
    assert(consoleValue().includes(asset.assetId) && consoleValue().includes('"quantity": "1"'), 'actual Console must show the full public holding');
    assert(mintCalls === 0 && ![...memoryStorage.keys()].some(key => /mint|boarding|send|reservation/.test(key)), 'listing must not create mint or transaction reservation state');
    assert(preview() === initialPreview, 'Admin asset listing changed Runtime Preview');
    setScenario('empty'); await list();
    assert(consoleValue().includes('"assets": []'), 'empty list must remain an explicit successful array');
    setScenario('error'); await list();
    assert(consoleValue().includes('Assets are unavailable. Try again.'), 'safe error missing from actual Console');
    assert(!consoleValue().includes('fixture-only-not-a-recovery-phrase'), 'Console included private fixture input');
    setScenario('holdings');
    const direct = await active.listAssets();
    assert(direct.status === 'success' && direct.assets[0].assetId === asset.assetId, 'UI-free public callback parity failed');
    for (let index = 0; index < 53; index++) await list();
    assert((consoleValue().match(/^List Assets$/gm) ?? []).length === 100, 'actual App history is not bounded to 100 entries');
    assert(!consoleValue().includes('Assets are unavailable. Try again.'), 'old Console entries were not evicted');
    assert(consoleElement().scrollHeight > consoleElement().clientHeight, 'long Console output must scroll');
    consoleElement().scrollTop = consoleElement().scrollHeight;
    assert(consoleElement().scrollTop > 0, 'Console scrolling failed');
    setScenario('held');
    clickAdmin('List Assets');
    await until(() => !!pendingRelease, 'held stale list missing');
    await reset();
    releaseHeld(); await afterRender();
    assert(consoleValue() === '', 'an obsolete pre-reset client result repopulated the Console');
    assert(storageResets === 1 && !connected, 'reset must touch only fixture account storage');
    setScenario('holdings'); await list();
    assert(consoleValue().includes('"code": "account-required"'), 'no-account public list error missing');
    // Read errors must not enter runtime Account flows or modify preview composition.
    assert(preview() === initialPreview, 'Console operation/reset altered preview composition');
    result.textContent = 'PASS: actual App pending/success Console sequence, full holdings, empty arrays, safe/no-account errors, 100-entry retention, scrolling, reset clearing, obsolete list result suppression, unchanged Runtime Preview, and UI-free callback parity. Synthetic callback results only; no adapter or live mint claim.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'App Console checks'}`; }
  finally { runButton.disabled = false; }
};
