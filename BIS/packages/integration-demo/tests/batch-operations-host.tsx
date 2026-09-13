import { createRoot } from 'react-dom/client';
import { BatchOperationsPanel } from '../src/admin/BatchOperationsPanel';
import '@bis/integration/style.css';

const host = document.getElementById('host')!;
const result = document.getElementById('result')!;
let root = createRoot(host);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settle = async () => { await tick(); await tick(); };
const check = (ok: unknown, message: string) => { if (!ok) throw Error(message); };

document.getElementById('run')!.onclick = async () => {
  const entries: unknown[] = [];
  root.render(<BatchOperationsPanel onLog={entry => entries.push(entry)} />);
  await settle();
  try {
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
    const clear = buttons.find(button => button.textContent === 'Clear Last Batch')!;
    const start = buttons.find(button => button.textContent === 'Start New Batch')!;
    check(host.textContent?.includes('04. Batch Operations'), 'Exact section title');
    check(buttons.indexOf(clear) < buttons.indexOf(start), 'Requested button order');
    check(clear.disabled && !start.disabled, 'Initial local state needs no wallet');
    start.click(); start.click(); await settle();
    check(entries.length === 1 && clear.disabled === false, 'One first batch despite same-turn duplicate');
    start.click(); await settle();
    check(entries.length === 2, 'Start replaces the previous local batch');
    clear.click(); await settle();
    check(entries.length === 3 && clear.disabled, 'Clear removes only the local batch');
    check(JSON.stringify(entries).includes('local') && !JSON.stringify(entries).match(/wallet|asset|address|remote/i), 'Feedback remains local-only');
    root.unmount();
    root = createRoot(host);
    root.render(<BatchOperationsPanel onLog={entry => entries.push(entry)} />);
    await settle();
    check([...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Clear Last Batch')!.disabled, 'Reload-equivalent remount has no local batch');
    result.textContent = 'PASS: exact Batch Operations controls, local start/replace/clear, duplicate guard, no-wallet state, and local-only feedback.';
  } catch (error) {
    result.textContent = `FAIL: ${error instanceof Error ? error.message : 'Batch Operations checks'}`;
  }
};
