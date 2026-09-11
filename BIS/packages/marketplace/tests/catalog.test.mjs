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
  assert.match(app, /className="trade-action trade-action-buy" disabled=\{!canBuy\}/);
  assert.match(app, /className="trade-action trade-action-sell" disabled=\{!canSell\}/);
  assert.doesNotMatch(app,/getBisMarketplaceTradingAvailability/);
  assert.match(inventory, /new RestIndexerProvider/);
  assert.doesNotMatch(inventory, /MnemonicIdentity|Wallet\.create|mint|send/i);
});

test('Marketplace enables exactly the action offered by the selected owner only after both local wallet sessions are active', async () => {
  const [app, style] = await Promise.all([text('src/App.tsx'), text('src/square-grid.css')]);
  assert.match(app, /const gameOwnsSelected=Boolean\(selected&&gameItems\?\.some\(item=>item\.assetId===selected\.assetId\)\)/);
  assert.match(app, /const playerOwnsSelected=Boolean\(selected&&playerItems\.some\(item=>item\.assetId===selected\.assetId\)\)/);
  assert.match(app, /const canBuy=salesEnabled&&gameOwnsSelected&&!checkoutIsPending;/);
  assert.match(app, /const canSell=salesEnabled&&playerOwnsSelected&&!checkoutIsPending;/);
  assert.match(app, /disabled=\{!canBuy\}/);
  assert.match(app, /disabled=\{!canSell\}/);
  assert.match(app, /player\.getSendSpendable\(true\)/);
  assert.match(app, /player\.quoteAccountSend\(recipient,amountSats,true\)/);
  assert.match(app, /gameWallet\.getPlayerPaymentBalance\(\)/);
  assert.match(app, /const \[operationError,setOperationError\]=useState<string>\(\);/);
  assert.match(app, /setOperationError\(`Insufficient \$\{walletName\} balance/);
  assert.match(app, /walletName=direction==='buy'\?'Player Wallet':'Game Wallet'/);
  assert.match(app, /Insufficient \$\{walletName\} balance/);
  assert.match(style, /\.trade-action-sell\{background:#487d66/);
});

test('Marketplace restores the pending exact-item checkout after a page reload', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /readLocalMarketplaceCheckouts\(\)\.find\(record=>record\.status==='pending'&&record\.request\.assetId===selected\.assetId\)/);
  assert.doesNotMatch(app, /checkout-status|Checkout complete\.|Checkout recovery status/);
});

test('item detail uses the active local-sales session state and never asks users to reconcile checkout', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /className="detail-actions"><button className="trade-action trade-action-buy" disabled=\{!canBuy\}/);
  assert.match(app, /id="sales-disabled-reason"/);
  assert.doesNotMatch(app, /Reconcile checkout|pending checkout\. Reconcile|awaiting fresh ownership confirmation/);
  assert.match(app, /setTimeout\(run,2500\)/);
  assert.match(app, /title=\{checkoutIsPending\?'Pending transaction':undefined\}/);
  assert.match(app, /className="trade-action trade-action-sell" disabled=\{!canSell\} title=\{checkoutIsPending\?'Pending transaction':undefined\}/);
  assert.doesNotMatch(app, /Buying and selling are not enabled/);
});

test('Marketplace opens a separate Blockchain Benefits dialog from the clickable before link', async () => {
  const [app, polish] = await Promise.all([text('src/App.tsx'), text('src/player-polish.css')]);
  assert.match(app, /const \[isBenefitsOpen,setIsBenefitsOpen\]=useState\(false\)/);
  assert.match(app, /className="benefits-trigger" onClick=\{\(\)=>setIsBenefitsOpen\(true\)\}\>before<\/button>/);
  assert.match(app, /isBenefitsOpen&&<div className="backdrop blockchain-benefits-backdrop"/);
  assert.match(app, /className="detail blockchain-benefits-dialog" role="dialog" aria-modal="true" aria-labelledby="blockchain-benefits-title"/);
  assert.match(app, /<h2 id="blockchain-benefits-title">Blockchain Benefits<\/h2>/);
  assert.match(app, /const blockchainBenefitsImageUrl = 'https:\/\/github\.com\/SamuelAsherRivello\/blockchain-integration-service\/blob\/main\/BIS\/documentation\/bitcoin-ark-arkade-bis-game\.png\?raw=1';/);
  assert.match(app, /<img className="blockchain-benefits-image" src=\{blockchainBenefitsImageUrl\} width="2161" height="728" alt="Bitcoin Ark Arkade BIS game" \/>/);
  assert.doesNotMatch(app, /className="blockchain-benefits-category">Marketplace<\/p>/);
  for (const heading of ['Account / Wallet', 'Assets', 'Contracts', 'Marketplace', 'Payments']) {
    assert.match(app, new RegExp(`<strong>${heading}<\\/strong>`));
  }
  assert.match(app, /<strong>Account \/ Wallet<\/strong>[\s\S]*<strong>Assets<\/strong>[\s\S]*<strong>Contracts<\/strong>[\s\S]*<strong>Marketplace<\/strong>[\s\S]*<strong>Payments<\/strong>/);
  assert.match(app, /Players securely trade a Dagger III between wallets\./);
  assert.match(app, /aria-label="Close Blockchain Benefits"/);
  assert.match(polish, /\.benefits-trigger/);
  assert.match(polish, /\.blockchain-benefits-image \{[^}]*aspect-ratio: 2161 \/ 728[^}]*max-height: 210px/);
  assert.doesNotMatch(polish, /\.blockchain-benefits-dialog \{[^}]*(?:width|aspect-ratio|overflow|padding):/);
  assert.match(polish, /\.marketplace-benefits-list li \{[^}]*padding: 12px 0/);
  assert.match(polish, /\.marketplace-benefits-list li \{[^}]*grid-template-columns: 136px minmax\(0, 1fr\); gap: 8px/);
});

test('item detail provides the selected valid Arkade asset with a bottom explorer action', async () => {
  const [app, squareGrid] = await Promise.all([text('src/App.tsx'), text('src/square-grid.css')]);
  assert.match(app, /const explorerUrl=selected&&\/\^\[a-f0-9\]\{68\}\$\/i\.test\(selected\.assetId\)\?`https:\/\/explorer\.signet\.arkade\.sh\/asset\/\$\{selected\.assetId\}`:undefined/);
  assert.match(app, /className="detail-explorer-action" disabled=\{!explorerUrl\}/);
  assert.match(app, /window\.open\(explorerUrl, '_blank', 'noopener,noreferrer'\)/);
  assert.match(app, />Open On Explorer<\/button>/);
  assert.match(squareGrid, /\.detail-explorer-action\{[\s\S]*?width:100%/);
});

test('item detail identity shows only the selected item name and formatted sats price', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /<div><h2 id="item-title">\{selected\.name\}<\/h2><strong>\{selected\.priceSats\.toLocaleString\(\)\} sats<\/strong><\/div>/);
  assert.doesNotMatch(app, /<p className="eyebrow">\{selected\.family\} · TIER \{selected\.tier\}<\/p>/);
  assert.doesNotMatch(app, /<p className="detail-effect">\{selected\.effect\}<\/p>/);
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

test('Marketplace opens with the Game Wallet, Stealth & Steel, and all item types selected', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /const \[owner,setOwner\]=useState<'all'\|'game'\|'player'>\('game'\)/);
  assert.match(app, /\[game,setGame\]=useState<'all'\|'stealth-and-steel'>\('stealth-and-steel'\)/);
  assert.match(app, /\[type,setType\]=useState<'all'\|'speed'\|'offense'\|'defense'>\('all'\)/);
});

test('Marketplace derives item identity, price, and artwork from fresh chain asset metadata',async()=>{
  const [app,inventory]=await Promise.all([text('src/App.tsx'),text('src/inventory.ts')]);
  assert.match(inventory,/getAssetDetails\(assetId\)/);assert.match(app,/map\(classifyBisEquipmentAsset\)/);
  assert.match(app,/src=\{item\.iconUrl\}/);assert.match(app,/item\.priceSats\.toLocaleString\(\)/);
  assert.doesNotMatch(app,/artworkFor|assets\/equipment|item\.artwork/);
  assert.match(app,/Image unavailable/);
});

test('Marketplace refreshes Game Wallet inventory after a completed checkout without exposing a manual refresh control', async () => {
  const app = await text('src/App.tsx');
  assert.doesNotMatch(app, />Refresh listings<\/button>/);
  assert.match(app, /setInventoryRevision\(value=>value\+1\)/);
  assert.match(app, /\[inventoryAddress,inventoryRevision\]/);
});

test('Marketplace delegates visible Marketplace loading to the shared pending prompt', async () => {
  const app = await text('src/App.tsx');
  assert.match(app, /const \[isCatalogLoading,setIsCatalogLoading\]=useState\(true\)/);
  assert.match(app, /const \[isGameInventoryLoading,setIsGameInventoryLoading\]=useState\(true\)/);
  assert.match(app, /const isMarketplaceLoading=isCatalogLoading\|\|isGameInventoryLoading/);
  assert.match(app, /setIsGameInventoryLoading\(true\)/);
  assert.match(app, /setIsGameInventoryLoading\(false\)/);
  assert.match(app, /usePendingNotice\(isMarketplaceLoading\|\|!!operationLabel/);
  assert.doesNotMatch(app, /isMarketplaceLoading&&owner!=='player'\?'Loading\.\.\.'/);
  assert.match(app, /:'No freshly verified equipment matches these filters\.'/);
});

test('Marketplace renders its Wallets and Instructions as left-aligned lists in one panel',async()=>{
  const app=await text('src/App.tsx');
  assert.match(app,/createBisContext\(\)/);assert.match(app,/createBisGameWallet/);assert.match(app,/createBisUi/);
  assert.match(app,/className="marketplace-info"/);assert.match(app,/This marketplace requires the player wallet for item display and items sales\./);assert.match(app,/In production the game wallet will be controlled by the server\. However, for this simple POC, you must also login the game wallet which has balance and has any items to display\./);
  assert.match(app,/<div className="marketplace-info-group"><h2>Wallets<\/h2><ul>/);assert.match(app,/Player Wallet:/);assert.match(app,/Game Wallet:/);
  assert.match(app,/<hr\/>/);assert.match(app,/<div className="marketplace-info-group"><h2>Instructions<\/h2><ol>/);assert.match(app,/Enable Item Listing: <strong title="Requirement complete: the Game Wallet is logged in and has items to display\.">Enabled ℹ️<\/strong>/);
  assert.match(app,/const salesEnabled=Boolean\(playerState\.profileId&&gameState\.profileId&&playerState\.profileId!==gameState\.profileId\)/);
  assert.match(app,/Enable Item Sales: \{salesEnabled\?<><strong title="Requirement complete: different Player and Game Wallets are logged in\.">Enabled ℹ️<\/strong><\/>:<span title="Requirement: log in to different Player and Game Wallets from Account\.">Disabled ℹ️<\/span>\}/);
  assert.doesNotMatch(app,/>Enable Item Sales<\/button>/);assert.doesNotMatch(app,/upper-right Account button/);
  assert.doesNotMatch(app,/>Player Wallet Login<\/button>/);assert.doesNotMatch(app,/>Game Wallet Login<\/button>/);
  assert.match(app,/>Player Wallet<\/button>/);
  assert.doesNotMatch(app,/recovery phrase|MnemonicIdentity|player-to-player/i);
});

test('Marketplace requirement tooltip targets use the pointer cursor', async () => {
  const polish = await text('src/player-polish.css');
  assert.match(polish, /\.marketplace-info-group li strong\[title\],\.marketplace-info-group li span\[title\]\{cursor:pointer\}/);
});

test('Marketplace places version and project resources in the Signet bar without device-specific presentation logic', async () => {
  const [app, utilities, redesign] = await Promise.all([text('src/App.tsx'), text('src/marketplace-utilities.css'), text('src/marketplace-redesign.css')]);
  assert.match(app, /<div className="network-banner">\s*<span role="status">Network: Signet<\/span>\s*<div className="marketplace-utilities" role="navigation" aria-label="Marketplace resources">/);
  assert.match(app, /v\{version\}/);
  assert.match(app, /https:\/\/github\.com\/SamuelAsherRivello\/blockchain-integration-service/);
  assert.match(app, /https:\/\/docs\.arkadeos\.com\//);
  assert.match(redesign, /\.marketplace-page \.network-banner\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);[\s\S]*?padding: 0 clamp\(12px, 2vw, 18px\);[\s\S]*?background: #fff0ba/);
  assert.match(redesign, /\.marketplace-page \.marketplace-utilities\s*\{[\s\S]*?position: static;/);
  assert.match(utilities, /\.marketplace-utilities\s*\{\s*position: absolute;/);
  assert.doesNotMatch(app, /devicePixelRatio/);
});

test('Marketplace confines scrolling to an always-visible catalog grid while retaining fluid layout primitives', async () => {
  const [app, style, grid, redesign] = await Promise.all([text('src/App.tsx'), text('src/style.css'), text('src/square-grid.css'), text('src/marketplace-redesign.css')]);
  assert.match(app, /className="marketplace-sidebar"/);
  assert.match(app, /className="catalog-scroll"/);
  assert.match(style, /html, body, #root \{ height: 100%; \}/);
  assert.match(style, /body \{ margin: 0; overflow: hidden; \}/);
  assert.match(redesign, /\.marketplace-page\s*\{[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden;/);
  assert.match(redesign, /\.marketplace-page \.marketplace-shell\s*\{[\s\S]*?display: flex;[\s\S]*?flex-wrap: nowrap;[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/);
  assert.match(redesign, /\.marketplace-page \.marketplace-shell\s*\{[\s\S]*?padding: clamp\(16px, 1\.8vw, 28px\) clamp\(12px, 1\.5vw, 18px\)/);
  assert.match(redesign, /\.marketplace-page \.wallet-strip\s*\{[\s\S]*?margin-top: clamp\(14px, 2\.2vw, 25px\);/);
  assert.match(redesign, /\.marketplace-page \.catalog-scroll\s*\{[\s\S]*?padding: 2px 0 18px 2px;[\s\S]*?overflow-y: scroll;[\s\S]*?overscroll-behavior: contain;[\s\S]*?scrollbar-gutter: stable;/);
  assert.match(redesign, /\.marketplace-page \.catalog-grid\s*\{\s*grid-template-columns: repeat\(auto-fit, minmax/);
  assert.doesNotMatch(`${style}\n${grid}\n${redesign}`, /@media\s*\(\s*(?:min|max)-(?:width|height)/);
});

test('closed BIS account launcher remains in the Marketplace upper-right without intercepting the catalog', async () => {
  const [app, style, launcherStyle] = await Promise.all([
    text('src/App.tsx'),
    text('src/style.css'),
    text('src/account-launcher.css'),
  ]);
  assert.match(app, /className="marketplace-bis-host"/);
  assert.match(style, /\.marketplace-bis-host \.bis-runtime \{ pointer-events: none; \}/);
  assert.match(style, /\.marketplace-bis-host \.bis-layer \{ place-items: start end;/);
  assert.match(launcherStyle, /\.marketplace-bis-host \.bis-layer:not\(\.bis-layer-open\)\s*\{[\s\S]*?padding: clamp\(/);
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

test('fluid Marketplace catalog uses compact square cells instead of a breakpoint-specific grid', async () => {
  const redesign = await text('src/marketplace-redesign.css');
  assert.match(redesign, /\.marketplace-page \.catalog-grid\s*\{\s*grid-template-columns: repeat\(auto-fit, minmax/);
  assert.match(redesign, /\.marketplace-page \.asset-card\s*\{[\s\S]*?aspect-ratio: 1;[\s\S]*?min-height: 0;/);
  assert.match(redesign, /\.marketplace-page \.list-art\s*\{\s*width: clamp\(42px/);
  assert.doesNotMatch(redesign, /@media\s*\(\s*(?:min|max)-(?:width|height)/);
});

test('Marketplace popup sheets stay compact at the measured browser viewport', async () => {
  const [squareGrid, redesign] = await Promise.all([text('src/square-grid.css'), text('src/marketplace-redesign.css')]);
  assert.match(redesign, /\.marketplace-page \.detail\s*\{[\s\S]*?width: min\(30rem, calc\(100vw - clamp\(24px, 6vw, 56px\)\)\);[\s\S]*?max-height: calc\(100dvh - clamp\(24px, 6vw, 56px\)\);[\s\S]*?aspect-ratio: auto;[\s\S]*?overflow-y: auto;/);
  assert.match(redesign, /\.marketplace-page \.detail-identity\s*\{[\s\S]*?grid-template-columns: clamp\(76px, 8vw, 100px\) minmax\(0, 1fr\);/);
  assert.match(redesign, /\.marketplace-page \.detail-actions\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(redesign, /\.marketplace-page \.blockchain-benefits-dialog\s*\{[\s\S]*?width: min\(31rem, calc\(100vw - clamp\(24px, 6vw, 56px\)\)\);[\s\S]*?aspect-ratio: auto;[\s\S]*?overflow: hidden;[\s\S]*?padding: clamp\(12px, 1\.4vw, 16px\);/);
  assert.match(redesign, /\.marketplace-page \.blockchain-benefits-image \{ width: 100%; height: auto; max-height: none; margin-bottom: 8px; \}/);
  assert.match(redesign, /\.marketplace-page \.blockchain-benefits-dialog h2 \{ max-width: none; white-space: nowrap;/);
  assert.match(redesign, /\.marketplace-page \.marketplace-benefits-list li \{[\s\S]*?padding: 5px 0;[\s\S]*?font-size: 12px;[\s\S]*?line-height: 1\.3;/);
  assert.doesNotMatch(redesign, /@media\s*\(\s*(?:min|max)-(?:width|height)/);
  assert.match(squareGrid, /\.trade-action-buy\{.*background:#487d66/);
  assert.match(squareGrid, /\.trade-action-sell\{.*background:#487d66/);
  assert.match(squareGrid, /\.detail-actions \.trade-action:disabled\{.*cursor:not-allowed/);
  assert.doesNotMatch(squareGrid, /detail-footer|detail-status/);
});
