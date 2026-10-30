import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEMOS } from '../src/client/navigation.ts';
import { DEMO_FILES } from '../src/client/demo-files.ts';

const packageRoot = new URL('../', import.meta.url);
const appSource = await readFile(new URL('src/client/App.tsx', packageRoot), 'utf8');

test('each demo has a route, active render branch, and executable file', async () => {
  assert.equal(DEMOS.length, DEMO_FILES.length);

  for (const demo of DEMOS) {
    const directory = demo.path.replace('/prototype-sandbox/', '').replace(/\/$/, '');
    await access(new URL(`${directory}/index.html`, packageRoot));
    assert.match(appSource, new RegExp(`activeDemo === ${demo.number}`), demo.path);
    assert.ok(DEMO_FILES.some(entry => entry.number === demo.number), demo.path);
  }
});

test('history runtime output labels entries as activities', async () => {
  const runtime = await readFile(new URL('src/client/demo-runtime.ts', packageRoot), 'utf8');
  assert.match(runtime, /label = 'Activity'/);
  assert.match(runtime, /`\$\{label\} \$\{index \+ 1\}: \$\{getValue\(item\)\}`/);
});

test('public balance demo starts with its Overview section', () => {
  assert.match(appSource, /function DemoGetBalancePublic[\s\S]*?<LoadingPrompt open=\{running\} bodyText="Get balance for public address" \/>[\s\S]*?<OverviewSection[\s\S]*?DIAGRAMS\.publicBalance[\s\S]*?<section className="sandbox-demo-input/);
});

test('all demo pages use the shared Overview diagram catalog', () => {
  const diagramKeys = [
    'createWallet', 'privateBalance', 'publicBalance', 'onboard', 'offboard',
    'sendPayment', 'receivePayment', 'paymentHistory', 'mintAsset', 'sendAsset',
    'receiveAsset', 'privateAssetHistory', 'publicAssetHistory', 'assetUpgrade', 'vaultCreate',
    'vaultIncrement', 'vaultCheck', 'vaultClaim', 'treasureHunt', 'externalSend', 'externalReceive',
  ];
  for (const key of diagramKeys) assert.match(appSource, new RegExp(`${key}: sequenceDiagram`), key);
  assert.match(appSource, /Bitcoin<br\/>\(On-Chain L1\)/);
  assert.match(appSource, /Arkade Operator<br\/>\(Off-Chain L2\)/);
  assert.match(appSource, /Arkade Wallet<br\/>\(SDK L3\)/);
  assert.match(appSource, /Client<br\/>\(L3\)/);
  assert.match(appSource, /External Wallet<br\/>\(L3\)/);
  assert.match(appSource, /function OverviewSection\(\{ intro, diagram, docs \}\)/);
  assert.match(appSource, /label: 'Intro'/);
  assert.match(appSource, /label: 'Diagram'/);
  assert.match(appSource, /label: 'Docs'/);
});

test('all demo source panels resolve from the executable registry', () => {
  assert.match(appSource, /demoDefinition\(sourceId\)\.source/);
  assert.doesNotMatch(appSource, /const [A-Z_]+_SOURCE = `/);
});

test('external wallet demos request popup handoff and start with empty output', async () => {
  const paymentSource = await readFile(new URL('src/client/demos/external-wallet-payment.ts', packageRoot), 'utf8');
  const receiveSource = await readFile(new URL('src/client/demos/external-wallet-receive.ts', packageRoot), 'utf8');
  const runtimeSource = await readFile(new URL('src/client/external-wallet-payment-runtime.ts', packageRoot), 'utf8');
  assert.match(paymentSource, /demoExternalWalletPayment\(/);
  assert.match(receiveSource, /window\.open\(link, '_blank', 'popup/);
  assert.match(runtimeSource, /externalWalletPaymentResult\(search: string\)[\s\S]*?return '';/);
  assert.match(appSource, /output=\{output \|\| callbackResult\}/);
  assert.equal((appSource.match(/docsDescription="External Wallet\?"/g) || []).length, 2);
  assert.equal((appSource.match(/Everything shown in this prototype sandbox can be done with either an external wallet or an internal wallet\./g) || []).length, 2);
  assert.match(appSource, /sourceId="external-wallet-receive-source"[\s\S]*?output=\{output\}/);
  assert.match(appSource, /function LoadingPrompt\(\{ open, bodyText \}\)/);
});
