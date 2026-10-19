import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { Transaction } from "@arkade-os/sdk";
import { base64, hex } from "@scure/base";
import { compileConditionalVault } from "../../integration/src/client/wallet-layer-arkade/conditional-vault-program.ts";
import { vaultDescriptorHash } from "../../integration/src/client/wallet-layer-arkade/conditional-vault-descriptor.ts";
import type { VaultPublicDescriptor } from "../../integration/src/client/state-layer-core/conditional-vault.ts";
import type { Page } from "playwright";
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin =
  process.env.PROTOTYPE_SANDBOX_URL ?? "http://127.0.0.1:5174";
const G = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const H = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
test('each demo retains its own output through scrolling and navigation without persisting it', { timeout: 30000 }, async (t) => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('network', 'mutinynet');
    localStorage.setItem('prototype-sandbox-visited', 'true');
  });
  const page = await context.newPage();
  await page.goto(`${origin}/prototype-sandbox/demo-14/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  const output = page.locator('textarea[aria-label="Demo output"]');
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.endsWith('Success: false'));
  const error = await output.inputValue();
  assert.match(error, /Error: Wallet2Mnemonic is required\./);
  await page.locator('#mutinynet-vault-id').selectOption('0001');
  await page.getByRole('tab', { name: 'Smart Contract (Tapscript)', exact: true }).click();
  await page.getByRole('tab', { name: 'Demo', exact: true }).click();
  assert.equal(await output.inputValue(), error);
  await page.goto(`${origin}/prototype-sandbox/demo-15/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.endsWith('Success: false'));
  const incrementError = await output.inputValue();
  assert.match(incrementError, /^Demo: Increment Conditional Vault\nError: VaultID 0001 does not exist\./);
  await page.locator('#mutinynet-vault-id').selectOption('0002');
  assert.equal(await output.inputValue(), incrementError);
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.includes('VaultID 0002 does not exist.'));
  assert.match(await output.inputValue(), /Success: false$/);
  const nextIncrementError = await output.inputValue();
  await output.hover();
  await page.mouse.wheel(0, 400);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await output.inputValue(), nextIncrementError);
  await page.mouse.move(20, 100);
  await page.mouse.wheel(0, -500);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await output.inputValue(), nextIncrementError);
  const navigate = async (id: number) => {
    await page.locator(`nav a[href="/prototype-sandbox/demo-${id}/"]`).last().click();
  };
  await navigate(14);
  // The earlier full navigation to Increment discarded the previous page's
  // memory. Execute here, then verify client-side navigation retains it.
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.endsWith('Success: false'));
  const createError = await output.inputValue();
  await navigate(15);
  assert.equal(await output.inputValue(), nextIncrementError);
  await navigate(14);
  assert.equal(await output.inputValue(), createError);
  await navigate(1);
  await page.locator('.sandbox-demo .sandbox-action-button').click();
  await page.waitForFunction(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Demo output"]')?.value.endsWith('Success: false'));
  const walletError = await output.inputValue();
  await navigate(15);
  assert.equal(await output.inputValue(), nextIncrementError);
  await navigate(1);
  assert.equal(await output.inputValue(), walletError);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await output.inputValue(), '');
});
async function storePublicFixture(page: Page, descriptor: VaultPublicDescriptor) {
  await page.evaluate((value) => {
    localStorage.setItem(`bis-conditional-vault-public-v5:${value.network}`, JSON.stringify([value]));
  }, descriptor);
}
async function fixture(network: "signet" | "mutinynet") {
  const parameters = {
    network,
    id: "0000",
    creatorKey: G,
    creatorDestination: H,
    serverKey: H,
    emulatorKey: G,
    deadline: 2_000_000_000,
    exitDelaySeconds: 2048,
  };
  const built = compileConditionalVault(parameters);
  const descriptor: VaultPublicDescriptor = {
    schemaVersion: 1,
    contractVersion: 5,
    network,
    id: "0000",
    creatorPublicKey: G,
    creatorDestination: `5120${H}`,
    operatorPublicKey: H,
    emulatorPublicKey: G,
    deadline: parameters.deadline,
    exitDelaySeconds: 2048,
    amountSats: 1000,
    target: 3,
    stateScripts: built.states.map((s) => s.pkScript),
    funding: { transactionId: "aa".repeat(32), outputIndex: 0 },
    hash: "",
  };
  return { ...descriptor, hash: await vaultDescriptorHash(descriptor) };
}

// These are deliberately unfunded public fixtures. Provider failures are
// synthetic and never count as live contract or financial acceptance.
for (const network of ["signet", "mutinynet"] as const)
  test(
    `${network}: public failures, exact artifacts, keyboard tabs and cross-tab journal exclusion`,
    { timeout: 60000 },
    async (t) => {
      const browser = await chromium.launch({
        headless: true,
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      });
      t.after(() => browser.close());
      const context = await browser.newContext();
      await context.addInitScript((selected) => {
        localStorage.setItem("network", selected);
        localStorage.setItem("prototype-sandbox-visited", "true");
      }, network);
      const writes: string[] = [];
      await context.route("**/*", async (route) => {
        const request = route.request();
        if (/arkade\.sh|127\.0\.0\.1:707[45]/.test(request.url())) {
          if (!["GET", "OPTIONS"].includes(request.method()))
            writes.push(request.method());
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"error":"isolated-test-unavailable"}',
            headers: { "access-control-allow-origin": "*" },
          });
        } else await route.continue();
      });
      const page = await context.newPage();
      await page.goto(`${origin}/prototype-sandbox/demo-14/`, {
        waitUntil: "networkidle",
      });
      const descriptor = await fixture(network);
      await storePublicFixture(page, descriptor);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.locator("#vault-public-descriptor").count(), 0);
      const demoTab = page.getByRole("tab", { name: "Demo", exact: true });
      await demoTab.focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page
          .getByRole("tab", { name: "Smart Contract (Tapscript)", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.keyboard.press("End");
      const artifactTab = page.getByRole("tab", {
        name: "Smart Contract (Compiled)",
        exact: true,
      });
      assert.equal(await artifactTab.getAttribute("aria-selected"), "true");
      const panel = page.locator("#conditional-vault-create-source-panel");
      assert.equal(
        await panel.getAttribute("aria-labelledby"),
        await artifactTab.getAttribute("id"),
      );
      const artifact = JSON.parse(
        (await panel.locator('[aria-label="Source code"]').textContent()) ??
          "{}",
      );
      assert.deepEqual(artifact.descriptor, descriptor);
      assert.deepEqual(
        artifact.stateScripts.map((s) => s.pkScript),
        descriptor.stateScripts,
      );
      await page.keyboard.press("Home");
      assert.equal(await demoTab.getAttribute("aria-selected"), "true");
      await page.goto(`${origin}/prototype-sandbox/demo-17/`, {
        waitUntil: "networkidle",
      });
      assert.equal(await page.locator("#vault-public-descriptor").count(), 0);
      await page
        .getByRole("button", { name: "Execute", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Demo output"]',
          )
          ?.value.endsWith("Success: false"),
      );
      const output = await page
        .locator('textarea[aria-label="Demo output"]')
        .inputValue();
      assert.match(output, /^Demo: Check Conditional Vault\n/);
      assert.doesNotMatch(output, /Status: claimed|Success: true/);
      await storePublicFixture(page, { ...descriptor, deadline: descriptor.deadline + 1 });
      await page
        .getByRole("button", {
          name: "Execute",
          exact: true,
        })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Demo output"]',
          )
          ?.value.includes("Error:"),
      );
      assert.equal(writes.length, 0);
      for (const route of [14, 15, 16, 17]) {
        await page.goto(`${origin}/prototype-sandbox/demo-${route}/`, { waitUntil: "networkidle" });
        assert.equal(await page.locator("#vault-public-descriptor").count(), 0);
        assert.equal(await page.getByRole("heading", { name: "Public vault descriptor" }).count(), 0);
        assert.equal(await page.getByRole("button", { name: "Execute", exact: true }).count(), 1);
        assert.equal(await page.getByRole('button', { name: 'Open on Explorer', exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: 'Recover', exact: true }).isDisabled(), true);
      }
      const second = await context.newPage();
      await second.goto(`${origin}/prototype-sandbox/demo-17/`, {
        waitUntil: "networkidle",
      });
      async function reserve(target: typeof page) {
        return target.evaluate(async (selected) => {
          const { createVaultJournal } = await import(
            "/BIS/packages/integration/src/client/state-layer-core/conditional-vault-journal.ts"
          );
          return createVaultJournal(selected).transaction(async (rows) => {
            if (
              rows.some((entry) => entry.operationId === "isolated-cross-tab")
            )
              return false;
            await new Promise((resolve) => setTimeout(resolve, 50));
            rows.push({
              operationId: "isolated-cross-tab",
              operation: "create",
              scope: "unfunded-browser-fixture",
              network: selected,
              createdAt: 1,
              phase: "prepared",
              recovery: [],
            });
            return true;
          });
        }, network);
      }
      const results = await Promise.all([reserve(page), reserve(second)]);
      assert.deepEqual(results.sort(), [false, true]);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await reserve(page), false);
      assert.equal(writes.length, 0);
      await context.close();
    },
  );

for (const network of ["signet", "mutinynet"] as const)
  test(
    `${network}: isolated pending evidence stays unsuccessful and selected-network changes clear it`,
    { timeout: 30000 },
    async (t) => {
      const browser = await chromium.launch({
        headless: true,
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      });
      t.after(() => browser.close());
      const context = await browser.newContext();
      await context.addInitScript((selected) => {
        localStorage.setItem("network", selected);
        localStorage.setItem("prototype-sandbox-visited", "true");
      }, network);
      let descriptor = await fixture(network);
      const funding = new Transaction({
        allowUnknownInputs: true,
        allowUnknownOutputs: true,
      });
      funding.addInput({ txid: "bb".repeat(32), index: 0 });
      funding.addOutput({
        script: hex.decode(descriptor.stateScripts[0]),
        amount: 1000n,
      });
      descriptor = {
        ...descriptor,
        funding: { transactionId: funding.id, outputIndex: 0 },
      };
      descriptor = {
        ...descriptor,
        hash: await vaultDescriptorHash(descriptor),
      };
      const writes: string[] = [];
      await context.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (!url.hostname.endsWith("arkade.sh")) return route.continue();
        if (!["GET", "OPTIONS"].includes(request.method()))
          writes.push(request.method());
        let body: unknown = {};
        if (url.pathname === "/v1/info") body = { network };
        else if (url.pathname.includes("/virtualTx/"))
          body = { txs: [base64.encode(funding.toPSBT())] };
        else if (url.pathname.includes("/vtxos"))
          body = {
            vtxos: [
              {
                outpoint: { txid: funding.id, vout: 0 },
                amount: "1000",
                script: descriptor.stateScripts[0],
                createdAt: "1",
                expiresAt: null,
                isPreconfirmed: true,
                isSwept: false,
                isUnrolled: false,
                isSpent: false,
                spentBy: "cc".repeat(32),
                commitmentTxids: [],
              },
            ],
          };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
          headers: { "access-control-allow-origin": "*" },
        });
      });
      const page = await context.newPage();
      page.on("dialog", (dialog) => dialog.accept());
      await page.goto(`${origin}/prototype-sandbox/demo-17/`, {
        waitUntil: "networkidle",
      });
      await storePublicFixture(page, descriptor);
      await page
        .getByRole("button", { name: "Execute", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Demo output"]',
          )
          ?.value.includes("Status: pending"),
      );
      const output = await page
        .locator('textarea[aria-label="Demo output"]')
        .inputValue();
      assert.match(output, /Success: false$/);
      assert.match(output, /Transaction fee: 0 sats/);
      assert.doesNotMatch(output, /nonzero fee policies are blocked/);
      assert.equal(await page.getByRole('button', { name: 'Recover', exact: true }).isDisabled(), true);
      const explorer = page.getByRole('button', { name: 'Open on Explorer', exact: true });
      assert.equal(await explorer.isEnabled(), true);
      await page.evaluate(() => { (window as any).__opened = []; window.open = ((url) => { (window as any).__opened.push(String(url)); return null; }) as typeof window.open; });
      await explorer.click();
      assert.deepEqual(await page.evaluate(() => (window as any).__opened), [`https://explorer.${network}.arkade.sh/tx/${funding.id}`]);
      if (network === 'signet') {
        const destination = resolve('output/screenshots/demo-explorer');
        await mkdir(destination, { recursive: true });
        for (const width of [1360, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.getByRole('region', { name: 'Output', exact: true }).screenshot({ path: resolve(destination, `output-${width}.png`) });
        }
      }
      await page
        .locator("#network")
        .selectOption(network === "signet" ? "mutinynet" : "signet");
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Demo output"]',
          )?.value === "",
      );
      assert.equal(await page.locator("#vault-public-descriptor").count(), 0);
      assert.equal(writes.length, 0);
      await context.close();
    },
  );
