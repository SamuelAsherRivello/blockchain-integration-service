import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';

async function loadAdmin() {
    const source = await readFile(new URL('../../src/client/admin-layer/AdminPanel.tsx', import.meta.url), 'utf8');
    const { code } = await transformWithOxc(source, 'AdminPanel.tsx', { jsx: { runtime: 'automatic' } });
    const storySource = await readFile(new URL('../../src/client/admin-layer/StoryAction.tsx', import.meta.url), 'utf8');
    const story = await transformWithOxc(storySource, 'StoryAction.tsx', { jsx: { runtime: 'automatic' } });
    const cardSource = await readFile(new URL('../../src/client/admin-layer/StoryButton.tsx', import.meta.url), 'utf8');
    const card = await transformWithOxc(cardSource, 'StoryButton.tsx', { jsx: { runtime: 'automatic' } });
    const cardModule = card.code.replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')));
    const storyModule = story.code.replace('"./StoryButton"', JSON.stringify('data:text/javascript,' + encodeURIComponent(cardModule))).replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')));
    const moduleText = code.replace('"./StoryAction"', JSON.stringify(`data:text/javascript,${encodeURIComponent(storyModule)}`)).replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace('"react/jsx-dev-runtime"', JSON.stringify(import.meta.resolve('react/jsx-dev-runtime')));
    const sectionSource=await readFile(new URL('../../src/client/admin-layer/StorySection.tsx',import.meta.url),'utf8');
    const section=await transformWithOxc(sectionSource,'StorySection.tsx',{jsx:{runtime:'automatic'}});
    const sectionModule=section.code.replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
    const resolved = moduleText.replace('"@bis/integration"', JSON.stringify(import.meta.resolve('../../../integration/src/client/state-layer-core/game-continue.ts'))).replace('"./StorySection"',JSON.stringify(`data:text/javascript,${encodeURIComponent(sectionModule)}`)).replace('"./StoryButton"',JSON.stringify(`data:text/javascript,${encodeURIComponent(cardModule)}`));
    const { AdminPanelView } = await import(`data:text/javascript,${encodeURIComponent(resolved)}`);
    return AdminPanelView;
}

test('requested admin navigation controls use an arrow-only affordance', async () => {
  const AdminPanelView = await loadAdmin();
  const html = renderToStaticMarkup(createElement(AdminPanelView, {
    selected: null, accountOpen: false, canReset: false, onSelect() {}, onReset() {},
    canFund: true, funding: false, onFund() {}, onExplorer() {},
    onMint() {}, mintAvailable: true, assetBusy: false, consoleOutput: '',
    continueAvailable: true, canShowToast: true, onShowToast() {}, onShowToastWithIcon() {},
    playerActive: true, onOpenOnboarding() {},
  }));
  for (const id of ['A.P.1', 'A.P.4', 'B.P.1', 'B.P.8', 'C.G.1', 'E.P.1']) {
    assert.match(html, new RegExp(`<button\\b[^>]*aria-label="${id}\\.[^"]*"[^>]*>↗</button>`), `${id} is arrow-only`);
  }
  assert.match(html, /aria-label="F\.P\.1\. Show"[^>]*>Show</);
  assert.match(html, /aria-label="F\.P\.1\. Show With Icon"[^>]*>Show With Icon</);
  assert.doesNotMatch(html, /F\.P\.2/);

  const gameWalletSource = await readFile(new URL('../../src/client/admin-layer/GameWalletPanel.tsx', import.meta.url), 'utf8');
  assert.match(gameWalletSource, /<button aria-label="A.G.2\. Game Wallet \(User-facing\)" disabled=\{!controller \|\| !playerReady\} onClick=\{onOpenDeveloper\}>↗<\/button>/, 'A.G.2 is arrow-only');
});

test('B.P.1 stays enabled with the Account dialog open and retains payment guards', async () => {
  const AdminPanelView = await loadAdmin();
  for (const accountOpen of [false, true]) {
    for (const [continueAvailable, continueBusy, disabled] of [[true, false, false], [true, true, true], [false, false, true]]) {
      const html = renderToStaticMarkup(createElement(AdminPanelView, {
        accountOpen, continueAvailable, continueBusy, consoleOutput: '',
      }));
      const button = html.match(/<button\b[^>]*aria-label="B.P.1\.[^"]*"[^>]*>/)?.[0];
      assert.ok(button, 'B.P.1 is rendered');
      assert.equal(button.includes('disabled=""'), disabled, `accountOpen=${accountOpen}, available=${continueAvailable}, busy=${continueBusy}`);
    }
  }
});

test('C.G.1 uses game wallet readiness and shows Awaiting Balance when unfunded',async()=>{
 const AdminPanelView=await loadAdmin();
 for(const mintAvailable of [false,true])for(const playerActive of [false,true]) {
  const html=renderToStaticMarkup(createElement(AdminPanelView,{mintAvailable,mintReason:mintAvailable?undefined:'Awaiting Balance',playerActive,accountOpen:true,assetBusy:false,consoleOutput:''}));
  const button=html.match(/<button\b[^>]*aria-label="C.G.1\.[^"]*"[^>]*>/)?.[0];assert.ok(button);
  assert.equal(button.includes('disabled=""'),!mintAvailable);
  if(!mintAvailable)assert.match(html,/Mint Asset &amp; Send \(Awaiting Balance\)/);
 }
});

test('B.P.1 names the actual unavailable payment dependency', async () => {
  const AdminPanelView = await loadAdmin();
  const playerWallet = renderToStaticMarkup(createElement(AdminPanelView, { continueReason: 'Awaiting Player Wallet', continueAvailable: false, continueBusy: false, consoleOutput: '' }));
  assert.match(playerWallet, /role="tooltip">Disabled\. Player account must be logged in\.<\/span>/);
  const gameWallet = renderToStaticMarkup(createElement(AdminPanelView, { continueReason: 'Awaiting Game Wallet', continueAvailable: false, continueBusy: false, consoleOutput: '' }));
  assert.match(gameWallet, /role="tooltip">Disabled\. Game Wallet must be logged in and ready to receive the payment\.<\/span>/);
  assert.match(gameWallet, /aria-describedby="admin-disabled-reason-b-p-1"/);
  const busy = renderToStaticMarkup(createElement(AdminPanelView, { continueAvailable: true, continueBusy: true, consoleOutput: '' }));
  assert.doesNotMatch(busy, /admin-disabled-reason-b-p-1/);
});

test('A.G.1 keeps the recovery phrase and reports an import failure beside the form', async () => {
  const source = await readFile(new URL('../../src/client/admin-layer/GameWalletPanel.tsx', import.meta.url), 'utf8');
  const submit = source.slice(source.indexOf('<form onSubmit='), source.indexOf('</form>') + '</form>'.length);
  assert.match(submit, /role="alert"/, 'A.G.1 needs an accessible inline failure result');
  assert.match(submit, /await controller\.importWallet\(input\)/, 'A.G.1 still delegates import to the wallet controller');
  assert.ok(submit.indexOf("setPhrase('')") > submit.indexOf('await controller.importWallet(input)'), 'A.G.1 must not erase the phrase before import succeeds');
});

test('A.G.3 Details exposes separate Bitcoin and Arkade funding details', async () => {
  const source = await readFile(new URL('../../src/client/admin-layer/GameWalletPanel.tsx', import.meta.url), 'utf8');
  const details = source.slice(source.indexOf('async function details()'), source.indexOf('return <StorySection'));
  assert.match(details, /bitcoin:\s*\{[\s\S]*?balanceSats:\s*current\.balance\?\.bitcoinSats[\s\S]*?address:\s*current\.addresses\?\.bitcoinAddress/);
  assert.match(details, /arkade:\s*\{[\s\S]*?balanceSats:\s*current\.balance\?\.arkadeSats[\s\S]*?address:\s*current\.addresses\?\.arkadeAddress/);
  assert.match(source, /<button disabled=\{busy \|\| !state\.profileId\} onClick=\{\(\) => void details\(\)\}>Details<\/button>/);
  assert.match(details, /walletScope: controller\.getOperationScope\?\.\(\)/);
  assert.match(details, /availability/);
  assert.match(details, /boardingStatus/);
});

test('A.G.3 distinguishes provider live-read failure from wallet-read failure', async () => {
  const source = await readFile(new URL('../../src/client/admin-layer/GameWalletPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /category:'provider-read'/);
  assert.match(source, /Provider Status Unavailable/);
  assert.match(source, /readStatus:current\.message/);
  assert.match(source, /getOperationAvailability\?\.\(\)/);
});

test('Admin and Runtime Preview are composed with one Game Wallet controller', async () => {
  const source = await readFile(new URL('../../src/client/ui-layer-react/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /gameWallet = gameWalletFactory\(\{playerProfileId: \(\) => context\.getState\(\)\.profileId/);
  assert.match(source, /createBisUi\(context, \{gameWallet\}\)/);
  assert.match(source, /gameWallet=\{<AdminGameWalletView controller=\{gameWalletController\} mode="account"/);
  assert.match(source, /gameWalletBoard=\{<AdminGameWalletView controller=\{gameWalletController\} mode="board"/);
});

test('Game Wallet browser fixture covers unavailable-read recovery and safe category output', async () => {
  const fixture = await readFile(new URL('./game-wallet-panel-host.tsx', import.meta.url), 'utf8');
  const playerFixture = await readFile(new URL('./balance-host.tsx', import.meta.url), 'utf8');
  assert.match(playerFixture, /fail=true/);
  assert.match(playerFixture, /no stale values/);
  assert.match(fixture, /status: 'unavailable'/);
  assert.match(fixture, /Game wallet reads unavailable\. Use Details to retry\./);
  assert.match(fixture, /readStatus: 'wallet-read'/);
  assert.match(fixture, /button\('Details'\)\.click\(\)/);
  assert.match(fixture, /report\.readCategory !== undefined/);
});

test('Admin renders implemented asset stories and omits empty categories', async () => {
    const AdminPanelView = await loadAdmin();
    const unexpected = () => { throw Error('Rendering must not invoke an action'); };
    const html = renderToStaticMarkup(createElement(AdminPanelView, {
      selected: null, accountOpen: false, canReset: false, onSelect: unexpected, onReset: unexpected,
      canFund: false, funding: false, onFund: unexpected, onExplorer: unexpected,
      onMint: unexpected, mintAvailable:true, assetBusy: false, consoleOutput: '',
    }));
    assert.match(html, />A\. Accounts</);
    assert.match(html, />C\. Assets</);
    assert.match(html, /C.G.1\. Mint Asset &amp; Send/);
    assert.doesNotMatch(html, /<span>C4<\/span>List Assets/);
    assert.doesNotMatch(html, /C6|Reward Player With Trophy After Level Complete/);
    assert.match(html, />B\. Payments</);
    assert.match(html, /&quot;Pay 1000 Sats To Continue&quot;/);
    assert.match(html, /aria-label="Console output"/);
});

test('F.P.1 UI Toast subbuttons and B.P.8 retain availability and exact action routing', async () => {
  const AdminPanelView = await loadAdmin();
  const calls = [];
  const props = {
    selected: null, accountOpen: true, canReset: false, onSelect: id => calls.push(id), onReset() {},
    canFund: true, funding: false, onFund: () => calls.push('fund'), onExplorer: () => calls.push('explorer'),
    onMint() {}, assetBusy: true, consoleOutput: '', playerActive: true, onOpenOnboarding() {},
    canShowToast: true, onShowToast: () => calls.push('toast'), onShowToastWithIcon: () => calls.push('toast-icon'),
  };
  function buttons(element, found = []) {
    if (!element || typeof element !== 'object') return found;
    if (Array.isArray(element)) { element.forEach(child => buttons(child, found)); return found; }
    if (typeof element.type === 'function') buttons(element.type(element.props), found);
    else if (element.type === 'button') found.push(element);
    else buttons(element.props?.children, found);
    return found;
  }
  const enabled = buttons(AdminPanelView(props));
  const show = enabled.find(button => button.props['aria-label'] === 'F.P.1. Show');
  const showWithIcon = enabled.find(button => button.props['aria-label'] === 'F.P.1. Show With Icon');
  const onboarding = enabled.find(button => button.props['aria-label']?.startsWith('B.P.8.'));
  assert.equal(show?.props.disabled, false); show?.props.onClick();
  assert.equal(showWithIcon?.props.disabled, false); showWithIcon?.props.onClick();
  assert.equal(onboarding?.props.disabled, false);
  assert.deepEqual(calls, ['toast','toast-icon']);
  const markup = renderToStaticMarkup(createElement(AdminPanelView, props));
  assert.match(markup, />F\. Integrations</); assert.match(markup, /F\.P\.1\. UI Toast/);
  assert.match(markup, /aria-label="F\.P\.1\. Show"[^>]*>Show</);
  assert.match(markup, /aria-label="F\.P\.1\. Show With Icon"[^>]*>Show With Icon</);
  assert.doesNotMatch(markup, /F\.P\.2/);
  assert.match(markup, />X\. Appendix</);
  assert.match(markup, /B\.P\.8\. Open Onboarding/);
  assert.match(markup, /E\.P\.1\. View Activity/);
  assert.doesNotMatch(markup, /X\.N\.1\. Open Onboarding/);
  for (const options of [{canFund: false}, {funding: true}]) {
    const disabled = buttons(AdminPanelView({...props,...options}));
    assert.equal(disabled.find(button => button.props['aria-label'] === 'F.P.1. Show')?.props.disabled, false);
    assert.equal(disabled.find(button => button.props['aria-label'] === 'F.P.1. Show With Icon')?.props.disabled, false);
  }
  assert.equal(buttons(AdminPanelView({...props, canShowToast: false})).find(button => button.props['aria-label'] === 'F.P.1. Show')?.props.disabled, true);
  assert.equal(buttons(AdminPanelView({...props, canShowToast: false})).find(button => button.props['aria-label'] === 'F.P.1. Show With Icon')?.props.disabled, true);
});
