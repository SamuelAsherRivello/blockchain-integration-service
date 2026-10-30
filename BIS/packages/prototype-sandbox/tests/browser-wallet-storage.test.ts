import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.PROTOTYPE_SANDBOX_URL ?? 'http://127.0.0.1:5174';

test('wallet state survives identity switching and stays independent between browser profiles', { timeout: 30000 }, async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const profile of ['browser-one', 'browser-two']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${origin}/prototype-sandbox/setup/`);
    const result = await page.evaluate(async profile => {
      const { demoCreateWalletStorage } = await import('/prototype-sandbox/src/client/wallet-storage.ts');
      const first = { descriptor: "tr([aabbccdd/86'/1'/0']public-key/0/*)" };
      const second = { descriptor: first.descriptor.replace('aabbccdd', '11223344') };
      const a = demoCreateWalletStorage('signet', first).walletRepository;
      const b = demoCreateWalletStorage('signet', second).walletRepository;
      const otherNetwork = demoCreateWalletStorage('mutinynet', first).walletRepository;
      const initial = await a.getWalletState();
      await a.saveWalletState({ ...(initial ?? {}), settings: { ...initial?.settings, testProfile: profile } });
      const blankIdentity = await b.getWalletState();
      const blankNetwork = await otherNetwork.getWalletState();
      await b.saveWalletState({ ...(blankIdentity ?? {}), settings: { testProfile: 'other-identity' } });
      const restored = await demoCreateWalletStorage('signet', first).walletRepository.getWalletState();
      return { initial: initial?.settings?.testProfile, blankIdentity: blankIdentity?.settings?.testProfile, blankNetwork: blankNetwork?.settings?.testProfile, restored: restored?.settings?.testProfile };
    }, profile);
    assert.equal(result.initial, undefined);
    assert.equal(result.blankIdentity, undefined);
    assert.equal(result.blankNetwork, undefined);
    assert.equal(result.restored, profile);
    await context.close();
  }
});
