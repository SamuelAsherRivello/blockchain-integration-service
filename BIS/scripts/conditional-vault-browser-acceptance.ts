import { chromium } from "playwright";
import assert from "node:assert/strict";
import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";
import { exportVaultDescriptor } from "../packages/integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts";
const origin =
  process.env.PROTOTYPE_SANDBOX_URL ?? "http://127.0.0.1:5174";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
try {
  for (const [network, run] of [
    ["signet", "cv-signet-canonical-a"],
    ["mutinynet", "cv-mutiny-canonical-e"],
  ] as const) {
    const { vault } = protectedConditionalVaultContext(network);
    const descriptor = await vault.transaction(
      (state) => state.conditionalVaultAcceptance[run].descriptor,
    );
    const context = await browser.newContext();
    const page = await context.newPage(),
      errors: string[] = [],
      writes: string[] = [];
    page.on("dialog", (dialog) => dialog.accept());
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.method() !== "OPTIONS")
        writes.push(request.method());
    });
    await page.goto(`${origin}/prototype-sandbox/demo-17/`, {
      waitUntil: "networkidle",
    });
    await page.locator("#network").selectOption(network);
    await page.locator(`#${network}-asset-id`).waitFor();
    await page.waitForTimeout(100);
    await page
      .locator("#vault-public-descriptor")
      .fill(await exportVaultDescriptor(descriptor));
    await page
      .getByRole("button", { name: "Execute", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Demo output"]',
          )
          ?.value.includes("Success:"),
      null,
      { timeout: 30000 },
    );
    const result = await page
      .locator('textarea[aria-label="Demo output"]')
      .inputValue();
    if (!result.endsWith("Success: true"))
      process.stdout.write(JSON.stringify({ network, result }) + "\n");
    assert.match(result, /Status: claimed/);
    assert.match(result, new RegExp(`Network: ${network}`));
    assert.equal(writes.length, 0);
    const publicOnly = await page.evaluate(
      () =>
        !Object.entries(localStorage).some(
          ([key, value]) => /mnemonic/.test(key) && value.trim(),
        ),
    );
    assert.equal(publicOnly, true);
    // A second clean tab can reconstruct the same contract from public data.
    const second = await context.newPage();
    await second.goto(`${origin}/prototype-sandbox/demo-17/`, {
      waitUntil: "networkidle",
    });
    await second
      .getByRole("button", { name: "Execute", exact: true })
      .click();
    // The dropdown ID need not equal an imported external ID. Explicitly importing
    // the exact descriptor avoids making a global discovery claim for the suffix.
    await second
      .locator("#vault-public-descriptor")
      .fill(await exportVaultDescriptor(descriptor));
    await second
      .getByRole("button", { name: "Execute", exact: true })
      .click();
    await second.waitForFunction(
      () =>
        document
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Demo output"]',
          )
          ?.value.endsWith("Success: true"),
      null,
      { timeout: 30000 },
    );
    await page.goto(`${origin}/prototype-sandbox/demo-14/`, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("tab", { name: "Smart Contract Builder", exact: true })
      .click();
    assert.match(
      await page.locator('[aria-label="Source code"]').innerText(),
      /compileConditionalVault/,
    );
    await page
      .getByRole("tab", { name: "TapScript / Compiled Artifact", exact: true })
      .click();
    assert.match(
      await page.locator('[aria-label="Source code"]').innerText(),
      /Create or import/,
    );
    assert.equal(errors.length, 0, JSON.stringify(errors));
    process.stdout.write(
      JSON.stringify({
        network,
        publicCheck: true,
        noMnemonic: true,
        noFinancialWrites: true,
        createTabs: true,
        errors: 0,
      }) + "\n",
    );
    await context.close();
  }
} finally {
  await browser.close();
}
