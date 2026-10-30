import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { DEMO_FILES } from '../src/client/demo-files.ts';
import { SANDBOX_SHARED_FILE, sandboxSharedSourceUrl } from '../src/client/source-links.ts';

test('all 22 demos borrow supporting code once and use a real SDK value or public BIS operation', async () => {
  for (const demo of DEMO_FILES) {
    const source = await readFile(new URL(`../src/client/demos/${demo.file}`, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];$/gm)];
    const helperBackedSdkDemo = new Map([
      ['onboard-bitcoin.ts', ['settlement-runtime.ts', 'Ramps', 'preparationWallet'].join('|')],
      ['external-wallet-payment.ts', ['external-wallet-payment-runtime.ts', 'RestArkProvider', 'demoGetNetwork(network).operator'].join('|')],
    ]).get(demo.file);
    if (demo.file === 'treasure-hunt.ts') {
      assert.match(source, /from ['"]\.\.\/treasure-sdk\.ts['"]/);
      assert.match(source, /demoTreasureSdkAction\(wallet, network, treasure\.action\)/);
      assert.doesNotMatch(source, /treasure-demo-service|treasure-demo-runtime|BisService|startTreasureContract/);
      const runtime = await readFile(new URL('../src/client/treasure-sdk.ts', import.meta.url), 'utf8');
      assert.match(runtime, /from ['"]\.\.\/\.\.\/\.\.\/integration\/src\/client\/wallet-layer-arkade\/lto-script\.ts['"]/);
      assert.match(runtime, /wallet\.buildAndSubmitOffchainTx\(/);
      assert.match(runtime, /await signAndSubmitOffchainTx\(/);
      assert.doesNotMatch(runtime, /createBisService|startContractAsync|restoreGameWalletAsync/);
      continue;
    }
    assert.equal(imports.length, helperBackedSdkDemo ? 1 : 2, demo.file);
    assert.equal(imports[0]?.[2], '../sandbox-shared.ts', demo.file);
    if (helperBackedSdkDemo) {
      const [file, sdkValue, argument] = helperBackedSdkDemo.split('|');
      const helper = await readFile(new URL(`../src/client/${file}`, import.meta.url), 'utf8');
      assert.match(helper, new RegExp(`import\\s+\\{\\s*${sdkValue}\\s*\\}\\s+from\\s+['\"]@arkade-os/sdk['\"]`));
      assert.ok(helper.includes(`new ${sdkValue}(${argument})`), demo.file);
    } else {
      assert.equal(imports[1]?.[2], '@arkade-os/sdk', demo.file);
    }
    const runtime = stripTypeScriptTypes(source);
    if (helperBackedSdkDemo) continue;
    const sdk = [...runtime.matchAll(/^import\s+\{([^}]+)\}\s+from\s+['"]@arkade-os\/sdk['"];$/gm)][0];
    assert.ok(sdk, `${demo.file}: SDK import cannot be types only`);
    const body = runtime.replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];$/gm, '');
    for (const name of sdk[1].split(',').map(name => name.trim()).filter(Boolean)) {
      assert.match(body, new RegExp(`\\b${name}\\b`), `${demo.file}: ${name} must be used`);
    }
  }
});

test('teaching modules own the implementations invoked by existing callers', async () => {
  const wallet = await import('../src/client/demos/create-wallet.ts');
  assert.equal((await import('../src/client/demo-wallet.ts')).demoCreateWallet, wallet.demoCreateWallet);
  const mint = await import('../src/client/demos/mint-asset.ts');
  assert.equal((await import('../src/client/asset-mint.ts')).demoMintAsset, mint.demoMintAsset);
  const upgrade = await import('../src/client/demos/upgrade-asset.ts');
  assert.equal((await import('../src/client/asset-upgrade.ts')).demoExecuteAssetUpgrade, upgrade.demoExecuteAssetUpgrade);
  const events = await import('../src/client/demos/events.ts');
  assert.equal((await import('../src/client/wallet-events.ts')).observeWalletEvents, events.observeWalletEvents);
  const shared = await import('../src/client/sandbox-shared.ts');
  for (const job of ['demoMintAsset', 'demoExecuteAssetUpgrade', 'observeWalletEvents', 'demoCreateConditionalVault', 'demoIncrementConditionalVault', 'demoClaimConditionalVault']) {
    assert.equal(Object.hasOwn(shared, job), false, `${job} is not supporting code`);
  }
});

test('Setup links to the supporting source locally and on GitHub', async () => {
  const local = new URL(sandboxSharedSourceUrl(true), 'http://127.0.0.1:5174');
  assert.equal(local.searchParams.get('file'), SANDBOX_SHARED_FILE);
  assert.equal(sandboxSharedSourceUrl(false), `https://github.com/SamuelAsherRivello/blockchain-integration-service/blob/main/${SANDBOX_SHARED_FILE}`);
  const shared = await readFile(new URL('../src/client/sandbox-shared.ts', import.meta.url), 'utf8');
  assert.match(shared, /operation a page teaches lives in that page's source/);
});
