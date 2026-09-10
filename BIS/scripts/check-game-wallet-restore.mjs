import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({channel:'msedge', headless:true});
try {
  const page = await browser.newPage({viewport:{width:360,height:640}});
  await page.goto(`${process.env.GAME_WALLET_RESTORE_TEST_URL ?? 'http://127.0.0.1:5174'}/tests/game-wallet-restore-host.html`);
  await page.getByRole('button', {name:'Run Game Wallet restore checks', exact:true}).click();
  await page.waitForFunction(() => /^(PASS|FAIL):/.test(document.getElementById('result')?.textContent ?? ''));
  assert.match(await page.locator('#result').textContent(), /^PASS:/);
  console.log('PASS: shared compact Game Wallet recovery entry.');
} finally { await browser.close(); }
