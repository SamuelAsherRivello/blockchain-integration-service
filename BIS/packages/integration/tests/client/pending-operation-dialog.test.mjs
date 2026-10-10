import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('public integration boundary exposes the shared accessible pending dialog', async () => {
  const [index, client, services, dialog, style] = await Promise.all([
    text('src/index.ts'),
    text('src/client/ui-layer-react/client.tsx'),
    text('src/client/integration-layer/bis-service.ts'),
    text('src/client/ui-layer-react/PendingOperationDialog.tsx'),
    text('src/client/ui-layer-react/overlay.css'),
  ]);
  assert.match(index, /export \{ PendingOperations, usePendingNotice \} from '\.\/client\/ui-layer-react\/PendingOperationDialog';/);
  assert.match(dialog, /export function PendingOperations\(\{children, overlay, className, hostLoading, onBisVisibilityChange\}/);
  assert.match(dialog, /const hostEntry: Notice \| undefined = hostPending \? \{label:'Loading \.\.\.',host:true,dismiss:\(\)=>\{\}\} : undefined;/);
  assert.match(dialog, /\[\.\.\.notices\.values\(\), \.\.\.\(hostEntry \? \[hostEntry\] : \[\]\)\]/);
  assert.match(client, /isLoadingUIVisible\(\) \{ return hostLoading; \}/);
  assert.match(client, /showLoadingUI\(\) \{ internal\.assertAlive\(\); setHostLoading\(true\); \}/);
  assert.match(client, /hideLoadingUI\(\) \{ setHostLoading\(false\); \}/);
  assert.match(services, /isLoadingUIVisible\(\) \{ return !this\.#disposed && this\.#ui\.isLoadingUIVisible\(\); \}/);
  assert.match(services, /showLoadingUI\(\) \{ this\.#assertAlive\(\); if \(!this\.isLoadingUIVisible\(\)\) this\.#ui\.showLoadingUI\(\); \}/);
  assert.match(services, /hideLoadingUI\(\) \{ if \(!this\.#disposed && this\.isLoadingUIVisible\(\)\) this\.#ui\.hideLoadingUI\(\); \}/);
  assert.match(dialog, /inert=\{open\}/);
  assert.match(dialog, /aria-hidden=\{open \|\| undefined\}/);
  assert.match(dialog, /aria-label="Pending Operation Dialog"/);
  assert.match(dialog, /event\.key==='Tab'/);
  assert.match(dialog, /\{failed\?'Error':current\.info\?\.title\?\?displayLabel\}/);
  assert.match(dialog, /<CopyFieldLabel label="Message"/);
  assert.match(dialog, /className="bis-pending-error-value" role="textbox" aria-readonly="true"/);
  assert.match(dialog, /useClipboardCopy\(\(\)=>current\?\.error, current\?\.error\)/);
  assert.doesNotMatch(dialog, /Operation unavailable/);
  assert.match(style, /\.bis-pending-backdrop \{ position: absolute; inset: 0; z-index: 20; display: grid; place-items: center;/);
  assert.match(style, /\.bis-pending-dialog \{ min-height: 100px; height: auto;/);
  assert.match(style, /\.bis-pending-error-value \{[^}]*align-items: center/);
  assert.match(style, /\.bis-pending-error-value \{[^}]*user-select: text/);
  assert.doesNotMatch(style, /\.bis-pending-dialog \{ height: 100px;/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\) \{ \.bis-bolt-spin \{ animation: none; \} \}/);
});
