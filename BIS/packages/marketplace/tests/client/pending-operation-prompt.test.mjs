import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('Marketplace composes the shared BIS prompt for preparation and foreground trades', async () => {
  const [app, integrationIndex, dialog, style] = await Promise.all([
    text('src/client/marketplace-layer/App.tsx'),
    text('../integration/src/index.ts'),
    text('../integration/src/client/ui-layer-react/PendingOperationDialog.tsx'),
    text('src/client/ui-layer-react/style.css'),
  ]);
  assert.match(integrationIndex, /export \{ PendingOperations, usePendingNotice \} from '\.\/client\/ui-layer-react\/PendingOperationDialog';/);
  assert.match(app, /PendingOperations/);
  assert.match(app, /usePendingNotice/);
  assert.match(app, /export function App\(\)\{return <PendingOperations className="marketplace-pending-runtime"><MarketplaceContent\/><\/PendingOperations>;\}/);
  assert.match(app, /function MarketplaceContent\(\)\{/);
  assert.match(app, /const \[operationLabel,setOperationLabel\]=useState<string>\(\);/);
  assert.match(app, /usePendingNotice\(loadingPromptVisible,operationLabel\?\?'Loading\.\.\.',inventoryError\?\?operationError/);
  assert.doesNotMatch(app, /Payment confirmed; completing item delivery/);
  assert.doesNotMatch(app, /checkoutLabel/);
  assert.match(app, /readLocalMarketplaceCheckouts\(\)\.find\(record=>record\.status==='pending'\)/);
  assert.match(app, /setOperationLabel\(undefined\),3000\)/);
  assert.match(app, /if\(!pendingCheckout\|\|!checkoutHasBeenSubmitted\)return;/);
  assert.match(dialog, /\{failed\?'Error':current\.info\?\.title\?\?displayLabel\}/);
  assert.match(dialog, /\{failed \? <><div className="bis-pending-error-field">/);
  assert.match(dialog, /<CopyFieldLabel label="Message" copied=\{errorCopy\.status === 'copied'\} disabled=\{errorCopy\.status === 'copying'\} onCopy=\{\(\)=>void errorCopy\.copy\(\)\} \/>/);
  assert.match(dialog, /<div id=\{description\} className="bis-pending-error-value" role="textbox" aria-readonly="true" tabIndex=\{0\}>\{current\.error\}<\/div>/);
  assert.match(dialog, /current\.errorAction\?\.run\(\) \?\? current\.dismiss\(\)/);
  assert.match(dialog, /useLayoutEffect\(\(\) => \(\) => register\?\.\(id\), \[register, id\]\)/);
  assert.match(dialog, /const PENDING_NOTICE_GAP_GRACE_MS = 250/);
  assert.match(dialog, /data-closing=\{!active && !retained \|\| undefined\}/);
  assert.doesNotMatch(app, /Operation unavailable/);
  assert.match(app, /setOperationLabel\(direction==='buy'\?'Buying\.\.\.':'Selling\.\.\.'\);/);
  assert.match(app, /finally \{window\.clearTimeout\(loadingTimer\);setOperationLabel\(undefined\);\}/);
  assert.match(app, /await Promise\.all\(\[gameWallet\.refresh\(\),\.\.\.inventorySources\.map\(source=>inventory\.retry\(source\)\)\]\);/);
  assert.doesNotMatch(app, /funds-backdrop|funds-dialog|Reconcile checkout/);
  assert.match(style, /\.marketplace-pending-runtime \{ z-index: 100; \}/);
  assert.match(style, /\.marketplace-pending-runtime \.bis-pending-backdrop \{ z-index: 60; \}/);
});
