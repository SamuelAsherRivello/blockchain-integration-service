import { createRoot } from 'react-dom/client';
import { useClipboardCopy, type ClipboardCopy } from '../../integration/src/ui/useClipboardCopy';
import { useQuoteExpiry } from '../../integration/src/ui/useQuoteExpiry';
import { CopyFieldLabel } from '../../integration/src/ui/CopyFieldLabel';
import { AdminPanel } from '../src/admin/AdminPanel';
import '@bis/integration/style.css';

const host = document.getElementById('host')!, result = document.getElementById('result')!;
const root = createRoot(host), tick = () => new Promise(resolve => setTimeout(resolve, 30));
const check = (ok: unknown, message: string) => { if (!ok) throw Error(message); };
let control: ClipboardCopy;
function Fixture({ value, scope, disabled = false, expiresAt }: { value: string; scope: string; disabled?: boolean; expiresAt?: number }) {
  control = useClipboardCopy(() => value, scope, disabled);
  const expired = useQuoteExpiry(expiresAt);
  return <><CopyFieldLabel label="Fixture" copied={control.hasCopied} disabled={disabled} onCopy={() => void control.copy()} /><output>{control.status}:{expired ? 'expired' : 'valid'}</output></>;
}
document.getElementById('run')!.onclick = async () => {
  result.textContent = 'Running';
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  let calls = 0, denied = false, delayed = false, copied = '';
  const releases: Array<() => void> = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => {
    calls++; copied = value;
    if (delayed) await new Promise<void>(resolve => releases.push(resolve));
    if (denied) throw Error('denied');
  } } });
  const render = async (value: string, scope = value, disabled = false, expiresAt?: number) => { root.render(<Fixture value={value} scope={scope} disabled={disabled} expiresAt={expiresAt} />); await tick(); };
  try {
    await render('A'); check(calls === 0, 'No automatic write');
    await control.copy(); await tick(); check(copied === 'A' && control.status === 'copied' && control.hasCopied, 'Exact successful write');
    denied = true; await control.copy(); await tick(); check(control.status === 'failed' && control.hasCopied, 'Failure retains per-session prior success');
    denied = false; await control.copy(); await tick(); check(control.status === 'copied', 'Retry');
    delayed = true; const before = calls, old = control.copy(); void control.copy(); await tick(); check(calls === before + 1, 'Synchronous duplicate guard');
    await render('B'); await render('A'); releases.shift()!(); await old; await tick(); check(control.status === 'idle' && !control.hasCopied, 'A B A ignores stale result');
    const prior = control.copy(); await tick(); await render('A', 'new-session'); const next = control.copy(); await tick();
    releases.shift()!(); await prior; await tick(); check(control.status === 'copying', 'Old session cannot clear new request');
    releases.shift()!(); await next; await tick(); check(control.status === 'copied', 'Current session completes');
    const unmounted = control.copy(); await tick(); root.render(<div />); await tick(); await render('A');
    releases.shift()!(); await unmounted; await tick(); check(control.status === 'idle' && !control.hasCopied, 'Unmount clears feedback');
    delayed = false; await render('B', 'B', true); const count = calls; await control.copy(); check(calls === count, 'Disabled copy');
    await render('B', 'B', false, Date.now() + 100); check(host.querySelector('output')?.textContent?.endsWith('valid'), 'Fresh quote');
    await new Promise(resolve => setTimeout(resolve, 120)); check(host.querySelector('output')?.textContent?.endsWith('expired'), 'Expiry timer');
    await render('B', 'B', false, Date.now() + 60000); check(host.querySelector('output')?.textContent?.endsWith('valid'), 'Fresh quote resets expiry');
    await render('B'); check(host.querySelector('output')?.textContent?.endsWith('valid'), 'No quote clears expiry');
    const actions: string[] = [];
    const admin = (open: boolean) => <AdminPanel selected="A2" accountOpen={open} canReset={false} onSelect={id => actions.push(id)} onReset={() => {}} canFund={false} funding={false} onFund={() => {}} onExplorer={() => {}} onMint={() => actions.push('C1')} onListAssets={() => actions.push('C4')} assetBusy={false} consoleOutput="" onContinue={() => actions.push('B1')} />;
    root.render(admin(false)); await tick();
    const story = (id: string) => [...host.querySelectorAll<HTMLButtonElement>('.story-button')].find(button => button.firstElementChild?.textContent === id)!;
    check(story('A2').getAttribute('aria-pressed') === 'true' && !!story('A2').querySelector('.story-arrow'), 'Mapped selection and arrow');
    for (const id of ['A1', 'B1', 'C1', 'C4']) story(id).click();
    check(actions.join('|') === 'A1|B1|C1|C4', 'Correct callbacks');
    check(!story('C1').hasAttribute('aria-pressed') && !story('C1').querySelector('.story-arrow'), 'Special actions retain presentation');
    root.render(admin(true)); await tick(); check(['A1', 'B1', 'C1', 'C4'].every(id => story(id).disabled), 'Account disables story actions');
    result.textContent = 'PASS: clipboard exact copy/denial/retry/duplicates, A B A, session replacement, unmount, disabled actions; quote expiry/reset; Admin story presentation and callbacks.';
  } catch (error) { result.textContent = `FAIL: ${error instanceof Error ? error.message : 'component checks'}`; }
  finally { root.render(<div />); if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
};
