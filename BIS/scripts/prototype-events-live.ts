/** Explicit funded acceptance runner. Uses an ephemeral browser profile; never saves recovery material. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { Vault } from './test-wallets/vault.ts';
import { DEFAULT_WALLET_1_ADDRESSES } from '../packages/prototype-sandbox/src/client/navigation.ts';

const network = process.argv[2];
const connectionOnly = process.argv.includes('--connection-only');
if (!['signet', 'mutinynet'].includes(network)) throw new Error('Choose signet or mutinynet.');
const root = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';
const preview = new URL(root);
if (preview.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(preview.hostname) || preview.username || preview.password || preview.pathname !== '/' || preview.search || preview.hash) {
  throw new Error('Acceptance requires an exact loopback preview origin.');
}
const directory = new URL('../../output/reports/prototype-wallet-events/', import.meta.url);
await mkdir(directory, { recursive: true });
const report: any = { network, origin: root, startedAt: new Date().toISOString(), checks: [] };
// SDK diagnostics may contain private context. Only explicit public reports reach stdout.
const output = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`);
for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) console[method] = () => {};
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  await page.goto(`${root}/prototype-sandbox/demo-21/`);
  await page.getByRole('button', { name: 'Execute', exact: true }).waitFor();
  const address = DEFAULT_WALLET_1_ADDRESSES[network];
  await page.evaluate(({ network, address }) => {
    localStorage.setItem('network', network); localStorage.setItem(`${network}-wallet-1-address`, address);
  }, { network, address });
  await page.reload();
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  const popup = await opened;
  report.stage = 'listener-startup';
  await popup.getByRole('status').filter({ hasText: "I'm listening" }).waitFor({ timeout: 95000 });
  report.address = address;
  report.checks.push('live-listening'); output({ network, stage: 'live-listening', address });
  const events: any[] = [];
  report.events = events;
  await popup.exposeFunction('recordMonitorChange', (record: any) => { if (record.event) events.push(record); });
  await popup.evaluate(() => {
    const card = document.querySelector('.wallet-events-card')!;
    new MutationObserver(() => (window as any).recordMonitorChange({ event: card.getAttribute('data-event'), message: card.querySelector('[role="status"]')!.textContent, time: Date.now() })).observe(card, { attributes: true, childList: true, subtree: true });
  });
  // Protected vault returns approved identities to this process, never to reports.
  if (!connectionOnly) {
  const preferred = network === 'mutinynet' ? ['events-mutinynet'] : ['test-account-1', 'agent-game-1'];
  const accounts = await new Vault().transaction(state => state.accounts.filter(a => preferred.includes(a.label) && a.grant?.active && a.grant.networks.includes(network) && !a.reportedPending?.[network]).sort((a,b) => preferred.indexOf(a.label) - preferred.indexOf(b.label)).map(a => ({ label: a.label, phrase: a.phrase })));
  let chosen: any;
  for (const account of accounts) {
    await page.evaluate(({ network, phrase }) => localStorage.setItem(`${network}-wallet-2-mnemonic`, phrase), { network, phrase: account.phrase });
    await page.goto(`${root}/prototype-sandbox/demo-2/`);
    await page.getByRole('button', { name: 'Execute', exact: true }).click();
    await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('[aria-label="Demo output"]')?.value.includes('Success:'), undefined, { timeout: 65000 });
    const text = await page.getByRole('textbox', { name: 'Demo output', exact: true }).inputValue();
    const amount = Number(text.match(/Available: (\d+) sats/)?.[1] ?? 0);
    output({ network, stage: 'candidate-balance', label: account.label, available: amount });
    if (amount >= 500) { chosen = account; break; }
  }
  if (!chosen) throw new Error('No approved candidate has at least 500 spendable sats.');
  report.senderLabel = chosen.label;
  for (const [demo, label] of [[4, 'payment'], [7, 'mint'], [8, 'asset']] as const) {
    await page.goto(`${root}/prototype-sandbox/demo-${demo}/`);
    await page.getByRole('button', { name: 'Execute', exact: true }).click();
    await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('[aria-label="Demo output"]')?.value.includes('Success:'), undefined, { timeout: 90000 });
    const text = await page.getByRole('textbox', { name: 'Demo output', exact: true }).inputValue();
    report.checks.push({ label, result: text }); output({ network, stage: label, result: text });
    if (!text.includes('Success: true')) throw new Error(`${label} did not succeed.`);
    if (label === 'mint') continue;
    const txid = text.match(/Transaction ID: ([a-f0-9]{64})/)?.[1];
    if (!txid) throw new Error(`${label} did not return a transaction ID.`);
    await popup.waitForFunction(id => document.querySelector('.wallet-events-card')?.getAttribute('data-event')?.includes(id), txid, { timeout: 45000 });
    const message = await popup.getByRole('status').textContent();
    const animation = await popup.evaluate(() => document.querySelector('.wallet-events-card')!.getAnimations().map(a => a.effect?.getTiming()));
    report.checks.push({ label: `${label}-notification`, message, animation });
    if (label === 'asset' && !message?.includes('asset')) throw new Error('Asset event was not displayed.');
    await popup.screenshot({ path: new URL(`${network}-${label}.png`, directory).pathname.replace(/^\/(\w:)/, '$1') });
    await popup.getByRole('status').filter({ hasText: "I'm listening" }).waitFor({ timeout: 15000 });
    report.checks.push(`${label}-reset`);
  }
  report.transfersComplete = true;
  }
  report.stage = 'disconnect';
  await context.setOffline(true);
  await popup.waitForFunction(() => document.querySelector('.wallet-events-card')?.getAttribute('data-status') !== "I'm listening . . .", undefined, { timeout: 90000 });
  report.stage = 'reconnect';
  await context.setOffline(false);
  await popup.getByRole('status').filter({ hasText: "I'm listening" }).waitFor({ timeout: 95000 });
  report.checks.push('disconnect-reconnect');
  report.events = events; report.complete = true;
} catch (error) {
  // Errors from this runner contain stage labels only; do not serialize SDK errors or browser storage.
  report.complete = false;
  report.failure = error instanceof Error && /^(No approved|payment did|mint did|asset did|Asset event)/.test(error.message) ? error.message : 'Browser acceptance did not reach its expected state.';
} finally {
  await browser.close();
  await writeFile(new URL(`${network}-${connectionOnly ? 'connection' : 'live'}.json`, directory), JSON.stringify(report, null, 2));
  output(report);
}
if (!report.complete) process.exitCode = 1;
