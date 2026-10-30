import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';

test('Mint Asset keeps AssetID, rejects a network duplicate without a local mapping, and blocks failed checks', { timeout: 45000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('https://**/*', route => route.abort());
  await page.goto(`${origin}/prototype-sandbox/demo-7/`);
  const selector = page.getByRole('combobox', { name: 'AssetID', exact: true });
  await selector.selectOption('0001');
  await page.evaluate(async () => {
    const { demoSetInput } = await import('/prototype-sandbox/src/client/navigation.ts');
    demoSetInput('signet', 'wallet-2-mnemonic', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    // Patch the very same SDK module imported by the Vite-served wallet factory.
    const factory = await (await fetch('/prototype-sandbox/src/client/demos/create-wallet.ts')).text();
    const sdkUrl = factory.match(/from "([^"]+sdk[^\"]+)"/)?.[1];
    if (!sdkUrl) throw new Error('Wallet SDK import was not found.');
    const { Wallet } = await import(sdkUrl);
    const state = (window as any).mintFixture = { issueCalls: 0, historyCalls: 0, fail: false, metadata: undefined };
    const assetId = 'a'.repeat(64) + '0000';
    const script = '5120' + '22'.repeat(32);
    Wallet.create = async () => ({
      identity: { xOnlyPublicKey: async () => new Uint8Array(32).fill(17) },
      restore: async () => {},
      getContractManager: async () => ({ refreshVtxos: async () => {}, getContracts: async () => [{ script }] }),
      getVtxos: async () => [],
      indexerProvider: { getVtxos: async () => {
        state.historyCalls++;
        if (state.fail) throw new Error('network unavailable');
        return { vtxos: state.metadata ? [{ script, txid: assetId.slice(0, 64), assets: [{ assetId, amount: '1' }], isSpent: true }] : [], page: { current: 1, next: state.metadata ? 1 : 0, total: state.metadata ? 1 : 0 } };
      } },
      assetManager: {
        issue: async request => { state.issueCalls++; state.metadata = request.metadata; return { assetId, arkTxId: assetId.slice(0, 64) }; },
        getAssetDetails: async () => ({ assetId, metadata: state.metadata, supply: 1n }),
      },
      dispose: async () => {},
    });
  });
  const execute = page.locator('.sandbox-demo button.sandbox-action-button').last();
  const output = page.getByRole('textbox', { name: 'Demo output' });
  await execute.click();
  await page.waitForFunction(() => (document.querySelector('textarea[aria-label="Demo output"]') as HTMLTextAreaElement)?.value.endsWith('Success: true'));
  assert.match(await output.inputValue(), /AssetID: 0001/);
  await page.evaluate(async () => {
    const { demoSetInput } = await import('/prototype-sandbox/src/client/navigation.ts');
    demoSetInput('signet', 'asset-id-0001', '');
    demoSetInput('signet', 'asset-id-0001-level', '');
  });
  await execute.click();
  await page.waitForFunction(() => (document.querySelector('textarea[aria-label="Demo output"]') as HTMLTextAreaElement)?.value.includes('already exists'));
  assert.match(await output.inputValue(), /Success: false$/);
  assert.equal(await page.evaluate(() => (window as any).mintFixture.issueCalls), 1);
  await page.evaluate(() => { window.open = ((url: string) => { (window as any).explorerOpened = url; return null; }) as typeof window.open; });
  const explorer = page.getByRole('button', { name: 'Open on Explorer', exact: true });
  assert.equal(await explorer.isEnabled(), true);
  await explorer.click();
  assert.equal(await page.evaluate(() => (window as any).explorerOpened), `https://explorer.signet.arkade.sh/asset/${'a'.repeat(64)}0000`);
  await page.evaluate(() => { (window as any).mintFixture.fail = true; });
  await execute.click();
  await page.waitForFunction(() => (document.querySelector('textarea[aria-label="Demo output"]') as HTMLTextAreaElement)?.value.includes('Unable to verify'));
  assert.match(await output.inputValue(), /No mint was submitted/);
  assert.match(await output.inputValue(), /Success: false$/);
  assert.equal(await page.evaluate(() => (window as any).mintFixture.issueCalls), 1);
  assert.equal(await page.evaluate(() => (window as any).mintFixture.historyCalls), 3);
  assert.equal(await explorer.isDisabled(), true);
});
