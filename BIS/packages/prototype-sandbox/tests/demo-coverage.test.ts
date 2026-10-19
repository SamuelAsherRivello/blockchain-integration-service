import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEMOS } from '../src/client/navigation.ts';

const packageRoot = new URL('../', import.meta.url);
const appSource = await readFile(new URL('src/client/App.tsx', packageRoot), 'utf8');

const demoLogLabels = [
  'Create Wallet',
  'Get Balance - Private Wallet',
  'Get Balance - Public Address',
  'Onboard Bitcoin',
  'Offboard Bitcoin',
  'Send Payment',
  'Receive Payment',
  'Payment History',
  'Mint Asset',
  'Send Asset',
  'Receive Asset',
  'Asset History - Private Wallet',
  'Asset History - Public Address',
  'Create Conditional Vault',
  'Increment Conditional Vault',
  'Check Conditional Vault',
  'Claim Conditional Vault',
  'Send Payment from External Wallet',
  'Receive Payment to External Wallet',
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('each demo has a route, active render branch, and Demo console label', async () => {
  assert.equal(DEMOS.length, demoLogLabels.length);

  for (const [index, demo] of DEMOS.entries()) {
    const directory = demo.path.replace('/prototype-sandbox/', '').replace(/\/$/, '');
    await access(new URL(`${directory}/index.html`, packageRoot));
    assert.match(appSource, new RegExp(`activeDemo === ${demo.number}`), demo.path);
    if([14,15,16,17].includes(demo.number)) {
      assert.match(appSource,new RegExp(escapeRegExp(demoLogLabels[index])),demo.path);
      assert.match(appSource,/source=\{conditionalVaultDemoSource\(action\)\}/,demo.path);
    } else assert.match(appSource, new RegExp(`console\\.log\\('Demo: ${escapeRegExp(demoLogLabels[index])}'\\)`), demo.path);
  }
});

test('history runtime output labels entries as activities', () => {
  assert.match(appSource, /function numberedPreviews\(items, getValue, label = 'Activity'\)/);
  assert.match(appSource, /`\$\{label\} \$\{index \+ 1\}: \$\{getValue\(item\)\}`/);
});

test('public balance demo starts with its Overview section', () => {
  assert.match(appSource, /function DemoGetBalancePublic[\s\S]*?<LoadingPrompt open=\{running\} bodyText="Get balance for public address" \/>[\s\S]*?<OverviewSection[\s\S]*?DIAGRAMS\.publicBalance[\s\S]*?<section className="sandbox-demo-input/);
});

test('all demo pages use the shared Overview diagram catalog', () => {
  const diagramKeys = [
    'createWallet', 'privateBalance', 'publicBalance', 'onboard', 'offboard',
    'sendPayment', 'receivePayment', 'paymentHistory', 'mintAsset', 'sendAsset',
    'receiveAsset', 'privateAssetHistory', 'publicAssetHistory', 'vaultCreate',
    'vaultIncrement', 'vaultCheck', 'vaultClaim', 'externalSend', 'externalReceive',
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

test('non-contract demo sources use Arrange, Act, and Assert sections', () => {
  const sourceNames = [
    'BALANCE_SOURCE',
    'CREATE_WALLET_SOURCE',
    'PRIVATE_BALANCE_SOURCE',
    'SEND_PAYMENT_SOURCE',
    'EXTERNAL_WALLET_PAYMENT_SOURCE',
    'EXTERNAL_WALLET_RECEIVE_SOURCE',
    'ONBOARD_SOURCE',
    'OFFBOARD_SOURCE',
    'RECEIVE_PAYMENT_SOURCE',
    'PAYMENT_HISTORY_SOURCE',
    'MINT_ASSET_SOURCE',
    'SEND_ASSET_SOURCE',
    'RECEIVE_ASSET_SOURCE',
    'ASSET_HISTORY_SOURCE',
    'PUBLIC_ASSET_HISTORY_SOURCE',
  ];
  for (const name of sourceNames) {
    const sourceMatch = appSource.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`;'));
    assert.ok(sourceMatch, name);
    const source = sourceMatch[1];
    assert.match(source, /^\/\/ Arrange\n/);
    assert.equal((source.match(/^\/\/ Arrange$/gm) || []).length, 1, name);
    assert.equal((source.match(/^\/\/ Act$/gm) || []).length, 1, name);
    assert.equal((source.match(/^\/\/ Assert$/gm) || []).length, 1, name);
  }
});

test('external wallet demos request popup handoff and start with empty output', () => {
  assert.equal((appSource.match(/window\.open\(link, '_blank', 'popup/g) || []).length, 2);
  assert.match(appSource, /output=\{output \|\| callbackResult\}/);
  assert.equal((appSource.match(/docsDescription="External Wallet\?"/g) || []).length, 2);
  assert.equal((appSource.match(/Everything shown in this prototype sandbox can be done with either an external wallet or an internal wallet\./g) || []).length, 2);
  assert.match(appSource, /externalWalletPaymentResult\(search\)[\s\S]*?return '';/);
  assert.match(appSource, /sourceId="external-wallet-receive-source"[\s\S]*?output=\{output\}/);
  assert.match(appSource, /function LoadingPrompt\(\{ open, bodyText \}\)/);
});
