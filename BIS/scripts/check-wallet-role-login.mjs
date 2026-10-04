import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:420,height:800}});
  await page.goto(new URL('/tests/wallet-role-login-host.html',process.env.BIS_DEMO_URL ?? 'http://127.0.0.1:5174/').href);
  await page.getByRole('button',{name:'Run wallet role login checks',exact:true}).click();
  await page.waitForFunction(()=>/^(PASS|FAIL):/.test(document.getElementById('result')?.textContent??''));
  assert.match(await page.locator('#result').textContent(),/^PASS:/);
  console.log('PASS: visible Player/Game Wallet role-conflict feedback.');
} finally {await browser.close();}
