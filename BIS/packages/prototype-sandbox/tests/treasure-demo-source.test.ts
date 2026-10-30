import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Treasure Hunt source has exactly the required executable sections and no browser-owned session state', async () => {
  const source = await readFile(new URL('../src/client/demos/treasure-hunt.ts', import.meta.url), 'utf8');
  const sections = [...source.matchAll(/^(\/{20,})\n\/\/ (Arrange|Act|Assert)\n\1$/gm)];
  assert.deepEqual(sections.map(match => match[2]), ['Arrange', 'Act', 'Assert']);
  assert.equal([...source.matchAll(/^\/{20,}$/gm)].length, 6);
  assert.match(source, /^\/{20,}\n\/\/ Arrange\n\/{20,}\nimport /m);
  assert.match(source, /demoGetInput\(network, 'wallet-2-mnemonic'\)/);
  assert.match(source, /demoCreateWallet\(network, \{ mnemonic/);
  assert.doesNotMatch(source, /@bis\/integration|BisService|restoreGameWalletAsync/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|demoRecoveryStorage/);
  assert.doesNotMatch(source, /validationMode:\s*['"]auto['"]/);
});

test('Treasure Hunt pages use the shared Execute/network control and never gate execution from UI state', async () => {
  const app = await readFile(new URL('../src/client/App.tsx', import.meta.url), 'utf8');
  const treasure = app.slice(app.indexOf('function DemoTreasureHunt'), app.indexOf('function LoadingPrompt'));
  assert.match(treasure, /function DemoTreasureHunt\(\{ network, step = 'create' \}\)/);
  assert.match(treasure, /const walletProfile = demoGetWalletProfile\(network\)/);
  assert.match(treasure, /htmlFor="treasure-wallet-1"/);
  assert.match(treasure, /value={maskMnemonic\(walletProfile\.mnemonic2\)}/);
  assert.doesNotMatch(treasure, /treasure-validation-mode|treasure-session-status/);
  assert.match(treasure, /onExecute={\(\) => execute\(\{ treasure:/);
  assert.doesNotMatch(treasure, /actionDisabled|canClaim|sessionMatchesNetwork|sessionMatchesProfiles/);
  assert.doesNotMatch(treasure, /Manage BIS Account|createTreasureDemoService/);
  assert.match(app, /check: \{ demoTitle: 'Check Treasure Hunt Offer'/);
  assert.match(app, /claim: \{ demoTitle: 'Claim Treasure'/);
  assert.match(app, /reject: \{ demoTitle: 'Reject Treasure Offer'/);
  const treasureDiagram = app.match(/treasureHunt: sequenceDiagram\(`([\s\S]*?)`\)/)?.[1] ?? '';
  assert.match(treasureDiagram, /Client->>Arkade: Start or inspect the Treasure Hunt offer/);
  assert.match(treasureDiagram, /Arkade-->>Client: Return contract state and operation evidence/);
  assert.doesNotMatch(treasureDiagram, /Client->>Client|Client-->>Client/);
  assert.match(app, /activeDemo === 14/);
  assert.match(app, /activeDemo === 17/);
  assert.match(app, /activeDemo === 23/);
  assert.match(app, /activeDemo === 24/);
  assert.match(app, /activeDemo === 25/);
});
