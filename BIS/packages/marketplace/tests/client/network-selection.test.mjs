import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('Marketplace derives every visible network route from the selected Player Wallet network', async () => {
  const [app, inventory] = await Promise.all([text('src/client/marketplace-layer/App.tsx'), text('src/client/inventory-layer/inventory.ts')]);

  assert.match(app, /const network=playerState\.network;/);
  assert.match(app, /createBisGameWallet\(\{playerProfileId:\(\)=>player\.getState\(\)\.profileId,playerNetwork:\(\)=>player\.getState\(\)\.network\}\)/);
  assert.match(app, /if\(!network\)\{setGameItems\(\[\]\);setIsGameInventoryLoading\(false\);return/);
  assert.match(app, /readPublicInventory\(inventoryAddress,controller\.signal,network\)/);
  assert.match(app, /Network: \{networkLabel\(network\)\}/);
  assert.match(app, /arkExplorerAssetUrl\(network,selected\.assetId\)/);
  assert.doesNotMatch(app, /Network: Signet/);
  assert.doesNotMatch(app, /explorer\.signet\.arkade\.sh/);

  assert.match(inventory, /readPublicInventory\(address: string, signal: AbortSignal, network: TestNetwork\)/);
  assert.match(inventory, /new RestIndexerProvider\(testNetwork\(network\)\.operator\)/);
  assert.doesNotMatch(inventory, /const operator = 'https:\/\/signet\.arkade\.sh'/);
});

test('the Admin demo gets its funding and explorer links from the active network registry', async () => {
  const [app, panel] = await Promise.all([
    readFile(new URL('../../../integration-demo/src/client/ui-layer-react/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../integration-demo/src/client/admin-layer/AdminPanel.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /const selectedNetwork=testNetwork\(network\);/);
  assert.match(app, /selectedNetwork\.faucetUrls/);
  assert.match(app, /selectedNetwork\.bitcoinExplorerAddressUrl/);
  assert.match(app, /network=\{state\?\.network\}/);
  assert.match(app, /fundAccount\(explorer = false\)/);
  assert.match(app, /const urls = explorer \? \['about:blank'\] : selectedNetwork\.faucetUrls;/);
  assert.match(app, /tabs\[0\]\.location\.href = selectedNetwork\.bitcoinExplorerAddressUrl\(address\);/);
  assert.doesNotMatch(app, /bitcoinsignetfaucet\.com|signetfaucet\.com|mempool\.space\/signet\/address/);
  assert.match(panel, /onFund\(\): void; onExplorer\(\): void;/);
  assert.doesNotMatch(panel, /Open Signet Faucet/);
});
