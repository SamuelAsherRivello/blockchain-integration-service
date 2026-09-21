import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

test('public integration boundary exposes the shared accessible pending dialog', async () => {
  const [index, dialog, style] = await Promise.all([
    text('src/index.ts'),
    text('src/ui/PendingOperationDialog.tsx'),
    text('src/ui/overlay.css'),
  ]);
  assert.match(index, /export \{ PendingOperations, usePendingNotice \} from '.\/ui\/PendingOperationDialog';/);
  assert.match(dialog, /export function PendingOperations\(\{children, overlay, className\}/);
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
