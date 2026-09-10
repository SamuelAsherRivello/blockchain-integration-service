import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';

async function loadAdmin() {
    const source = await readFile(new URL('../src/admin/AdminPanel.tsx', import.meta.url), 'utf8');
    const { code } = await transformWithOxc(source, 'AdminPanel.tsx', { jsx: { runtime: 'automatic' } });
    const storySource = await readFile(new URL('../src/admin/StoryAction.tsx', import.meta.url), 'utf8');
    const story = await transformWithOxc(storySource, 'StoryAction.tsx', { jsx: { runtime: 'automatic' } });
    const cardSource = await readFile(new URL('../src/admin/StoryButton.tsx', import.meta.url), 'utf8');
    const card = await transformWithOxc(cardSource, 'StoryButton.tsx', { jsx: { runtime: 'automatic' } });
    const cardModule = card.code.replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')));
    const storyModule = story.code.replace('"./StoryButton"', JSON.stringify('data:text/javascript,' + encodeURIComponent(cardModule))).replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')));
    const moduleText = code.replace('"./StoryAction"', JSON.stringify(`data:text/javascript,${encodeURIComponent(storyModule)}`)).replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace('"react/jsx-dev-runtime"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')));
    const sectionSource=await readFile(new URL('../src/admin/StorySection.tsx',import.meta.url),'utf8');
    const section=await transformWithOxc(sectionSource,'StorySection.tsx',{jsx:{runtime:'automatic'}});
    const sectionModule=section.code.replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
    const resolved = moduleText.replace('"@bis/integration"', JSON.stringify(import.meta.resolve('../../integration/src/core/game-continue.ts'))).replace('"./StorySection"',JSON.stringify(`data:text/javascript,${encodeURIComponent(sectionModule)}`));
    const { AdminPanel } = await import(`data:text/javascript,${encodeURIComponent(resolved)}`);
    return AdminPanel;
}

test('B1 stays enabled with the Account dialog open and retains payment guards', async () => {
  const AdminPanel = await loadAdmin();
  for (const accountOpen of [false, true]) {
    for (const [continueAvailable, continueBusy, disabled] of [[true, false, false], [true, true, true], [false, false, true]]) {
      const html = renderToStaticMarkup(createElement(AdminPanel, {
        accountOpen, continueAvailable, continueBusy, consoleOutput: '',
      }));
      const button = html.match(/<button\b[^>]*aria-label="B1\.[^"]*"[^>]*>/)?.[0];
      assert.ok(button, 'B1 is rendered');
      assert.equal(button.includes('disabled=""'), disabled, `accountOpen=${accountOpen}, available=${continueAvailable}, busy=${continueBusy}`);
    }
  }
});

test('C1 uses game wallet readiness and shows Awaiting Balance when unfunded',async()=>{
 const AdminPanel=await loadAdmin();
 for(const mintAvailable of [false,true])for(const playerActive of [false,true]) {
  const html=renderToStaticMarkup(createElement(AdminPanel,{mintAvailable,mintReason:mintAvailable?undefined:'Awaiting Balance',playerActive,accountOpen:true,assetBusy:false,consoleOutput:''}));
  const button=html.match(/<button\b[^>]*aria-label="C1\.[^"]*"[^>]*>/)?.[0];assert.ok(button);
  assert.equal(button.includes('disabled=""'),!mintAvailable);
  if(!mintAvailable)assert.match(html,/Mint Asset &amp; Send \(Awaiting Balance\)/);
 }
});

test('F1 keeps the recovery phrase and reports an import failure beside the form', async () => {
  const source = await readFile(new URL('../src/admin/GameWalletPanel.tsx', import.meta.url), 'utf8');
  const submit = source.slice(source.indexOf('<form onSubmit='), source.indexOf('</form>') + '</form>'.length);
  assert.match(submit, /role="alert"/, 'F1 needs an accessible inline failure result');
  assert.match(submit, /await controller\.importWallet\(input\)/, 'F1 still delegates import to the wallet controller');
  assert.ok(submit.indexOf("setPhrase('')") > submit.indexOf('await controller.importWallet(input)'), 'F1 must not erase the phrase before import succeeds');
});

test('Admin renders implemented asset stories and omits empty categories', async () => {
    const AdminPanel = await loadAdmin();
    const unexpected = () => { throw Error('Rendering must not invoke an action'); };
    const html = renderToStaticMarkup(createElement(AdminPanel, {
      selected: null, accountOpen: false, canReset: false, onSelect: unexpected, onReset: unexpected,
      canFund: false, funding: false, onFund: unexpected, onExplorer: unexpected,
      onMint: unexpected, mintAvailable:true, assetBusy: false, consoleOutput: '',
    }));
    assert.match(html, />A\. Account</);
    assert.match(html, />C\. Assets</);
    assert.match(html, /C1\. Mint Asset &amp; Send/);
    assert.doesNotMatch(html, /<span>C4<\/span>List Assets/);
    assert.doesNotMatch(html, /C6|Reward Player With Trophy After Level Complete/);
    assert.match(html, />B\. Pay-to-play</);
    assert.match(html, /&quot;Pay 1000 Sats To Continue&quot;/);
    assert.match(html, /aria-label="Console output"/);
});

test('D1/D2 and E1/E2 retain independent availability and exact action routing', async () => {
  const AdminPanel = await loadAdmin();
  const calls = [];
  const props = {
    selected: null, accountOpen: true, canReset: false, onSelect: id => calls.push(id), onReset() {},
    canFund: true, funding: false, onFund: () => calls.push('fund'), onExplorer: () => calls.push('explorer'),
    onMint() {}, assetBusy: true, consoleOutput: '',
    canShowToast: true, onShowToast: () => calls.push('toast'), onShowToastWithIcon: () => calls.push('toast-icon'),
  };
  function actions(element, found = new Map()) {
    if (!element || typeof element !== 'object') return found;
    if (Array.isArray(element)) { element.forEach(child => actions(child, found)); return found; }
    if (typeof element.type === 'function') {
      if (element.props.id) found.set(element.props.id, element.type(element.props).props.children);
      else actions(element.type(element.props), found);
    } else actions(element.props?.children, found);
    return found;
  }
  const enabled = actions(AdminPanel(props));
  for (const id of ['D1','D2','E1','E2']) {
    assert.equal(enabled.get(id).props.disabled, false);
    enabled.get(id).props.onClick();
  }
  assert.deepEqual(calls, ['toast','toast-icon','fund','explorer']);
  const markup = renderToStaticMarkup(createElement(AdminPanel, props));
  assert.match(markup, />D\. UI</); assert.match(markup, /D1\. Show Toast/);
  assert.match(markup, /D2\. Show Toast With Icon/);
  assert.match(markup, />E\. Admin Tools</);
  assert.match(markup, /E1\. Open Signet Faucet/);
  assert.match(markup, /E2\. Open On Mempool.space/);
  for (const options of [{canFund: false}, {funding: true}]) {
    const disabled = actions(AdminPanel({...props,...options}));
    assert.equal(disabled.get('E1').props.disabled, true);
    assert.equal(disabled.get('E2').props.disabled, true);
    assert.equal(disabled.get('D1').props.disabled, false);
    assert.equal(disabled.get('D2').props.disabled, false);
  }
  assert.equal(actions(AdminPanel({...props, canShowToast: false})).get('D1').props.disabled, true);
  assert.equal(actions(AdminPanel({...props, canShowToast: false})).get('D2').props.disabled, true);
});
