import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('Marketplace composes the shared BIS prompt for preparation and foreground trades', async () => {
  const [app, integrationIndex, dialog, style] = await Promise.all([
    text('src/App.tsx'),
    text('../integration/src/index.ts'),
    text('../integration/src/ui/PendingOperationDialog.tsx'),
    text('src/style.css'),
  ]);
  assert.match(integrationIndex, /export \{ PendingOperations, usePendingNotice \} from '.\/ui\/PendingOperationDialog';/);
  assert.match(app, /PendingOperations/);
  assert.match(app, /usePendingNotice/);
  assert.match(app, /export function App\(\)\{return <PendingOperations className="marketplace-pending-runtime"><MarketplaceContent\/><\/PendingOperations>;\}/);
  assert.match(app, /function MarketplaceContent\(\)\{/);
  assert.match(app, /const \[operationLabel,setOperationLabel\]=useState<string>\(\);/);
  assert.match(app, /usePendingNotice\(isMarketplaceLoading\|\|!!operationLabel,operationLabel\?\?'Loading\.\.\.',operationError,\(\)=>setOperationError\(undefined\)\);/);
  assert.match(dialog, /\{failed\?'Error':current\.info\?\.title\?\?displayLabel\}/);
  assert.match(dialog, /\{failed \? <>\<p id=\{description\}\>\{current\.error\}\<\/p\>\<button className="bis-button" onClick=\{\(\)=>current\.dismiss\(\)\}\>OK\<\/button\>\<\/>/);
  assert.doesNotMatch(app, /Operation unavailable/);
  assert.match(app, /setOperationLabel\(direction==='buy'\?'Buying\.\.\.':'Selling\.\.\.'\);/);
  assert.match(app, /finally \{setOperationLabel\(undefined\);\}/);
  assert.match(app, /await Promise\.all\(\[equipment\.refresh\(\),gameWallet\.refresh\(\)\]\);/);
  assert.doesNotMatch(app, /funds-backdrop|funds-dialog|Reconcile checkout/);
  assert.match(style, /\.marketplace-pending-runtime \{ z-index: 100; \}/);
  assert.match(style, /\.marketplace-pending-runtime \.bis-pending-backdrop \{ z-index: 60; \}/);
});
