import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('public catalog contains only the versioned publisher trust anchor and no wallet secret fields', async () => {
  const catalog = JSON.parse(await text('public/catalog.json'));
  assert.equal(catalog.version, 2);
  assert.equal(catalog.gameId, 'stealth-and-steel');
  assert.equal(typeof catalog.gameWalletAddress, 'string');
  assert.equal('items' in catalog, false);
  assert.equal(Object.keys(catalog).sort().join(','), 'gameId,gameWalletAddress,version');
  assert.equal(JSON.stringify(catalog).match(/phrase|private|secret|seed/i), null);
});

test('public Marketplace uses a read-only address query and live local-sales action eligibility', async () => {
  const [app, inventory] = await Promise.all([text('src/App.tsx'), text('src/inventory.ts')]);
  assert.match(app, /fetch\(`\$\{import\.meta\.env\.BASE_URL\}catalog\.json`/);
  assert.match(app, /next\.version!==2/);
  assert.doesNotMatch(app, /next\.items/);
  assert.match(app, /beginLocalMarketplaceCheckout/);
  assert.match(app, /advanceLocalMarketplaceCheckout/);
  assert.match(app, /className="trade-action trade-action-buy" disabled=\{!salesEnabled\}/);
  assert.match(app, /className="trade-action trade-action-sell" disabled=\{!salesEnabled\}/);
  assert.doesNotMatch(app,/getBisMarketplaceTradingAvailability/);
  assert.match(inventory, /new RestIndexerProvider/);
  assert.doesNotMatch(inventory, /MnemonicIdentity|Wallet\.create|mint|send/i);
});

test('item detail uses the active local-sales session state in its upper-right action column', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /className="detail-actions"><button className="trade-action trade-action-buy" disabled=\{!salesEnabled\}/);
  assert.match(app, /id="sales-disabled-reason"/);
  assert.match(app, /Reconcile checkout/);
  assert.doesNotMatch(app, /Buying and selling are not enabled/);
});

test('item detail shows copyable generic and gameplay values without decimals or temporary release copy', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /Generic asset/);
  assert.match(app, /CopyableValueField label="Asset ID" value=\{selected\.assetId\} className="marketplace-detail-field marketplace-asset-id"/);
  assert.match(app, /CopyableValueField label="Ticker" value=\{selected\.ticker\} className="marketplace-detail-field"/);
  assert.match(app, /CopyableValueField label="Quantity" value=\{String\(selected\.quantity\)\} className="marketplace-detail-field"/);
  assert.doesNotMatch(app, /Decimals/);
  assert.match(app, /Gameplay metadata/);
  assert.match(app, /gameplayMetadata\(selected\)\.map\(stat=><CopyableValueField key=\{stat\.label\} label=\{stat\.label\} value=\{stat\.value\}/);
  assert.match(app, /item\.effectPercent/);
  assert.doesNotMatch(app, /Trading is not available/);
  assert.doesNotMatch(app, /later Marketplace account flow/);
});

test('item detail gives every metadata value the shared labeled, copyable field treatment', async () => {
  const [app, polish] = await Promise.all([text('src/App.tsx'), text('src/player-polish.css')]);
  assert.match(app, /@bis\/integration/);
  assert.match(polish, /\.detail \.marketplace-detail-field \{ display: flex; flex-wrap: wrap;/);
  assert.match(polish, /\.marketplace-detail-field \.bis-copy-field-heading/);
  assert.match(polish, /\.marketplace-detail-field input \{ width: 100%;/);
  assert.match(polish, /\.marketplace-detail-field \{[^}]*font: 600 13px\/1\.2 Inter/);
  assert.match(polish, /\.marketplace-detail-field \.bis-copy-field-heading \{ gap: 4px; font: inherit;/);
  assert.match(polish, /\.marketplace-detail-field input \{[^}]*font: inherit; text-align: left;/);
  assert.match(polish, /\.marketplace-gameplay-fields input \{ text-align: left;/);
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

test('Marketplace can refresh live Game Wallet inventory without changing publisher configuration', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, />Refresh listings<\/button>/);
  assert.match(app, /setInventoryRevision\(value=>value\+1\)/);
  assert.match(app, /\[inventoryAddress,inventoryRevision\]/);
});

test('Marketplace renders its Wallets and Instructions as left-aligned lists in one panel',async()=>{
  const app=await text('src/App.tsx');
  assert.match(app,/createBisContext\(\)/);assert.match(app,/createBisGameWallet/);assert.match(app,/createBisUi/);
  assert.match(app,/className="marketplace-info"/);assert.match(app,/This marketplace requires the player wallet for item display and items sales\./);
  assert.match(app,/<div className="marketplace-info-group"><h2>Wallets<\/h2><ul>/);assert.match(app,/Player Wallet:/);assert.match(app,/Game Wallet:/);
  assert.match(app,/<hr\/>/);assert.match(app,/<div className="marketplace-info-group"><h2>Instructions<\/h2><ol>/);assert.match(app,/Enable Item Listing:/);assert.match(app,/>Enabled<\/strong>/);
  assert.match(app,/const salesEnabled=Boolean\(playerState\.profileId&&gameState\.profileId&&playerState\.profileId!==gameState\.profileId\)/);
  assert.match(app,/Enable Item Sales: \{salesEnabled\?<><strong>Enabled<\/strong><\/>:'Disabled'\}/);
  assert.doesNotMatch(app,/>Enable Item Sales<\/button>/);assert.doesNotMatch(app,/upper-right Account button/);
  assert.doesNotMatch(app,/>Player Wallet Login<\/button>/);assert.doesNotMatch(app,/>Game Wallet Login<\/button>/);
  assert.match(app,/>My Items<\/button>/);
  assert.doesNotMatch(app,/recovery phrase|MnemonicIdentity|player-to-player/i);
});

test('Marketplace places version and project resources in the upper-right Signet bar', async () => {
  const [app, style, utilities] = await Promise.all([text('src/App.tsx'), text('src/style.css'), text('src/marketplace-utilities.css')]);
  assert.match(app, /Network: Signet/);
  assert.match(app, /className="marketplace-utilities"/);
  assert.match(app, /v\{version\}/);
  assert.match(app, /https:\/\/github\.com\/SamuelAsherRivello\/blockchain-integration-service/);
  assert.match(app, /https:\/\/docs\.arkadeos\.com\//);
  assert.match(style, /background:#fff0b8/);
  assert.match(style, /border-bottom:\.8px solid #e5b536/);
  assert.match(utilities, /\.marketplace-utilities\s*\{\s*position: absolute;\s*top: 0;\s*right: 18px/);
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

test('listing cards pair artwork and price with their identity, effect, and distinct poetic copy', async () => {
  const [app, style] = await Promise.all([text('src/App.tsx'), text('src/square-grid.css')]);
  for (const name of ['Shoes I', 'Shoes II', 'Shoes III', 'Dagger I', 'Dagger II', 'Dagger III', 'Shield I', 'Shield II', 'Shield III']) {
    assert.match(app, new RegExp(`'${name}'`));
  }
  assert.match(app, /function poeticQuoteFor\(item:BisEquipmentItem\)/);
  assert.match(app, /className="asset-card-identity"/);
  assert.match(app, /className="asset-card-title"/);
  assert.match(app, /className="asset-card-effect"/);
  assert.match(app, /className="poetic-quote"/);
  assert.match(style, /\.asset-card\{[\s\S]*?aspect-ratio:auto/);
  assert.match(style, /\.asset-card-identity\{display:flex/);
  assert.match(style, /\.poetic-quote\{[^}]*text-align:center/);
});

test('compact desktop keeps the full marketplace page dense enough for three small listing cards', async () => {
  const style = await text('src/square-grid.css');
  assert.match(style, /@media\(min-width:1100px\) and \(max-width:1600px\)/);
  assert.match(style, /\.marketplace-shell\{[\s\S]*?grid-template-columns:minmax\(390px,42%\) minmax\(0,1fr\)/);
  assert.match(style, /\.catalog-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(style, /\.asset-card\{min-height:190px;padding:12px/);
  assert.match(style, /\.list-art\{width:68px!important;height:68px!important/);
});

test('item detail is square, has upper-right actions, and has no internal scrollbar', async () => {
  const squareGrid = await text('src/square-grid.css');
  assert.match(squareGrid, /width:min\(640px,calc\(100vw - 40px\)\)/);
  assert.match(squareGrid, /\.detail\{[\s\S]*?aspect-ratio:1[\s\S]*?overflow:hidden/);
  assert.doesNotMatch(squareGrid, /\.detail\{[\s\S]*?overflow:auto/);
  assert.match(squareGrid, /\.detail-identity\{display:grid;grid-template-columns:150px minmax\(0,1fr\) 144px/);
  assert.match(squareGrid, /\.detail-actions\{align-self:stretch;display:flex;flex-direction:column/);
  assert.match(squareGrid, /\.trade-action-buy\{.*background:#487d66/);
  assert.match(squareGrid, /\.trade-action-sell\{.*background:#294650/);
  assert.match(squareGrid, /\.detail-actions \.trade-action:disabled\{.*cursor:not-allowed/);
  assert.doesNotMatch(squareGrid, /detail-footer|detail-status/);
});
