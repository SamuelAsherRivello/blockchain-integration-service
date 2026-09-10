import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('public catalog contains the exact nine game equipment entries and no wallet secret fields', async () => {
  const catalog = JSON.parse(await text('public/catalog.json'));
  assert.equal(catalog.version, 1);
  assert.equal(catalog.gameId, 'stealth-and-steel');
  assert.equal(catalog.items.length, 9);
  assert.deepEqual(catalog.items.map(item => item.name), ['Shoes I','Shoes II','Shoes III','Dagger I','Dagger II','Dagger III','Shield I','Shield II','Shield III']);
  assert.equal(JSON.stringify(catalog).match(/phrase|private|secret|seed/i), null);
});

test('public Marketplace uses a read-only address query and proof-gated trade actions', async () => {
  const [app, inventory] = await Promise.all([text('src/App.tsx'), text('src/inventory.ts')]);
  assert.match(app, /fetch\('\/catalog\.json'/);
  assert.match(app, /<button disabled title=\{trading\.message\}>Buy<\/button>/);
  assert.match(app, /<button disabled title=\{trading\.message\}>Sell<\/button>/);
  assert.match(app,/getBisMarketplaceTradingAvailability/);
  assert.match(inventory, /new RestIndexerProvider/);
  assert.doesNotMatch(inventory, /MnemonicIdentity|Wallet\.create|mint|send/i);
});

test('item detail shows generic asset fields and game effect metadata without temporary release copy', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /Generic asset/);
  assert.match(app, /Ticker/);
  assert.match(app, /Decimals/);
  assert.match(app, /Gameplay metadata/);
  assert.match(app, /Speed/);
  assert.match(app, /Offense/);
  assert.match(app, /Defense/);
  assert.match(app, /item\.effectPercent/);
  assert.doesNotMatch(app, /Trading is not available/);
  assert.doesNotMatch(app, /later Marketplace account flow/);
});

test('catalog filters game and nonzero gameplay metadata independently', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /aria-label="Game"/);
  assert.match(app, /Stealth &amp; Steel/);
  assert.match(app, /aria-label="Type"/);
  assert.match(app, />Speed<\/button>/);
  assert.match(app, />Offense<\/button>/);
  assert.match(app, />Defense<\/button>/);
  assert.match(app, /stat\.value!==['"]0['"]/);
});

test('Marketplace derives item identity, price, and artwork from fresh chain asset metadata',async()=>{
  const [app,inventory]=await Promise.all([text('src/App.tsx'),text('src/inventory.ts')]);
  assert.match(inventory,/getAssetDetails\(assetId\)/);assert.match(app,/map\(classifyBisEquipmentAsset\)/);
  assert.match(app,/src=\{item\.iconUrl\}/);assert.match(app,/item\.priceSats\.toLocaleString\(\)/);
  assert.doesNotMatch(app,/artworkFor|assets\/equipment|item\.artwork/);
  assert.match(app,/Image unavailable/);
});

test('Marketplace delegates Player and Game Wallet login to production BIS surfaces',async()=>{
  const app=await text('src/App.tsx');
  assert.match(app,/createBisContext\(\)/);assert.match(app,/createBisGameWallet/);assert.match(app,/createBisUi/);
  assert.match(app,/>Player Wallet Login<\/button>/);assert.match(app,/>Game Wallet Login<\/button>/);
  assert.match(app,/Session Game Wallet override/);assert.match(app,/Registered Game Wallet/);assert.match(app,/>My Items<\/button>/);
  assert.doesNotMatch(app,/recovery phrase|MnemonicIdentity|player-to-player/i);
});

test('Marketplace uses the BIS Signet banner wording and version treatment', async () => {
  const [app, style] = await Promise.all([text('src/App.tsx'), text('src/style.css')]);
  assert.match(app, /Network: Signet/);
  assert.match(app, /BIS: v\{version\}/);
  assert.match(style, /background:#fff0b8/);
  assert.match(style, /border-bottom:\.8px solid #e5b536/);
  assert.match(style, /\.version-label\{position:absolute;left:100%;top:50%/);
});

test('desktop Marketplace confines scrolling to the compact catalog grid', async () => {
  const [app, style] = await Promise.all([text('src/App.tsx'), text('src/style.css')]);
  assert.match(app, /className="marketplace-sidebar"/);
  assert.match(app, /className="catalog-scroll"/);
  assert.match(style, /body\{margin:0;overflow:hidden\}/);
  assert.match(style, /\.catalog-scroll\{min-height:0;flex:1 1 auto;overflow-y:auto/);
});

test('closed BIS account launcher sits 10px from the upper-right of the white content area without intercepting the catalog', async () => {
  const [app, style, launcherStyle] = await Promise.all([
    text('src/App.tsx'),
    text('src/style.css'),
    text('src/account-launcher.css'),
  ]);
  assert.match(app, /className="marketplace-bis-host"/);
  assert.match(style, /\.marketplace-bis-host \.bis-runtime\{[^}]*pointer-events:none/);
  assert.match(style, /\.marketplace-bis-host \.bis-layer\{[^}]*place-items:start end/);
  assert.match(launcherStyle, /\.marketplace-bis-host \.bis-layer\s*\{[^}]*padding:\s*43px 10px 10px/);
});

test('equipment artwork containers stay square when card content flexes at browser zoom', async () => {
  const squareGrid = await text('src/square-grid.css');
  assert.match(squareGrid, /\.art\{[^}]*flex:0 0 auto/);
  assert.match(squareGrid, /\.art\{[^}]*aspect-ratio:1\s*\/\s*1/);
});
