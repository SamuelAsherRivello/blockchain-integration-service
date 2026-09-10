import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

const adminUrl = new URL('../src/admin/', import.meta.url);

async function loadDialog() {
  const source = await readFile(new URL('AdminDialogFullscreen.tsx', adminUrl), 'utf8');
  const { code } = await transformWithOxc(source, 'AdminDialogFullscreen.tsx', {
    jsx: { runtime: 'automatic' },
  });
  const moduleText = code
    .replace(/import\s+["']\.\/admin-dialog-fullscreen\.css["'];?/, '')
    .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
    .replace('"react"', JSON.stringify(import.meta.resolve('react')));
  return {
    source,
    component: (await import(`data:text/javascript,${encodeURIComponent(moduleText)}`)).AdminDialogFullscreen,
  };
}

test('shared Admin dialog renders a labeled upper-right X with guarded closing', async () => {
  const { source, component: AdminDialogFullscreen } = await loadDialog();
  const html = renderToStaticMarkup(createElement(AdminDialogFullscreen, {
    title: 'Reusable Workflow',
    closeDisabled: true,
    onClose() {},
    children: createElement('p', null, 'Workflow-owned content'),
  }));

  assert.match(html, /<dialog[^>]*class="admin-dialog-fullscreen"[^>]*aria-labelledby="admin-dialog-/);
  assert.match(html, /<h2[^>]*>Reusable Workflow<\/h2><button[^>]*aria-label="Close Reusable Workflow"[^>]*disabled=""[^>]*>X<\/button>/);
  assert.match(html, /Workflow-owned content/);
  assert.doesNotMatch(html, /←|mint-/);
  assert.match(source, /showModal\(\)/);
  assert.match(source, /preventDefault\(\)/);
  assert.match(source, /if \(!closeDisabled\) onClose\(\)/);
  assert.match(source, /document\.activeElement instanceof HTMLElement/);
  assert.match(source, /queueMicrotask/);
  assert.match(source, /focusTarget\?\.isConnected/);
});

test('shared Admin dialog uses the exact viewport margins and internal scrolling', async () => {
  const css = await readFile(new URL('admin-dialog-fullscreen.css', adminUrl), 'utf8');
  assert.match(css, /width:\s*50vw/);
  assert.match(css, /height:\s*80dvh/);
  assert.match(css, /margin:\s*10dvh 25vw/);
  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.doesNotMatch(css, /max-width:\s*720px|calc\(100vw - 32px\)/);
});

test('Mint Asset uses the shared shell and orders Quick fill, Preview, Form, action, console', async () => {
  const source = await readFile(new URL('MintAssetDialog.tsx', adminUrl), 'utf8');
  const quickFill = source.indexOf('>Quick fill<');
  const preview = source.indexOf('>Preview<');
  const form = source.indexOf('>Form<');
  const action = source.indexOf('className="mint-submit"');
  const consoleOutput = source.indexOf('className="mint-console"');

  assert.match(source, /import \{ AdminDialogFullscreen \} from '\.\/AdminDialogFullscreen'/);
  assert.match(source, /<AdminDialogFullscreen\b/);
  assert.doesNotMatch(source, /<dialog\b|mint-back|←|mint-header/);
  assert.ok(quickFill >= 0 && quickFill < preview, 'Quick fill precedes Preview');
  assert.ok(preview < form, 'Preview precedes Form');
  assert.ok(form < action, 'Form precedes the primary action');
  assert.ok(action < consoleOutput, 'the primary action precedes console output');
  assert.match(source, /<output[^>]*className="mint-console"[^>]*role="status"/);
  for (const message of [
    'Checking destination…',
    'Minting asset…',
    'Asset minted. The result is in Admin Console.',
    'Mint to the',
  ]) assert.match(source, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Mint Asset pairs Destination with Control Asset and previews a non-blank icon URL', async () => {
  const source = await readFile(new URL('MintAssetDialog.tsx', adminUrl), 'utf8');
  const css = await readFile(new URL('assets.css', adminUrl), 'utf8');
  const rowStart = source.indexOf('mint-control-row');
  const destination = source.indexOf('>Destination<', rowStart);
  const controlAsset = source.indexOf('>Control Asset<', rowStart);

  assert.ok(rowStart >= 0, 'the compact control row exists');
  assert.ok(destination > rowStart && destination < controlAsset, 'Destination precedes Control Asset in the same row');
  assert.match(css, /\.mint-control-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(source, /form\.iconUrl\?\.trim\(\)\s*\?\s*<img[^>]*className="mint-preview-icon"[^>]*src=\{form\.iconUrl\}/s);
  assert.match(source, /:\s*<span className="mint-avatar"/s);
  assert.match(css, /\.mint-summary\s*\{[^}]*width:\s*100%[^}]*height:\s*64px/s);
  assert.match(css, /\.mint-preview-icon\s*\{[^}]*object-fit:\s*contain/s);
});

test('Mint Asset puts Clear first and restores a fresh default draft without changing Destination', async () => {
  const source = await readFile(new URL('MintAssetDialog.tsx', adminUrl), 'utf8');
  const clear = source.indexOf('>Clear<');
  const firstPreset = source.indexOf('achievementPresets.map');

  assert.ok(clear >= 0 && clear < firstPreset, 'Clear precedes achievement presets');
  assert.match(source, /function createDefaultMintDraft\(\)[^{]*\{[^}]*operationId:\s*crypto\.randomUUID\(\)[^}]*name:\s*'an asset'[^}]*ticker:\s*'ASSET'[^}]*amount:\s*'1'[^}]*decimals:\s*0[^}]*iconUrl:\s*''/s);
  assert.match(source, /useState<BisMintAssetRequest>\(createDefaultMintDraft\)/);
  assert.match(source, /onClick=\{\(\) => \{\s*setForm\(createDefaultMintDraft\(\)\);\s*setResult\(undefined\);\s*\}\}>Clear<\/button>/s);
  assert.doesNotMatch(source, /onClick=\{\(\) => \{[^}]*setDestination\([^}]*\}\}>Clear/s);
});
