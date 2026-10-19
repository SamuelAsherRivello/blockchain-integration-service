import { chromium } from "playwright";
import { protectedConditionalVaultContext } from "./test-wallets/conditional-vault-context.ts";
import { verifiedInventory } from "./test-wallets/inventory.ts";
import { walletProfileStorageKey } from "../packages/prototype-sandbox/src/client/navigation.ts";
import type { TestNetwork } from "../packages/integration/src/client/state-layer-core/test-network.ts";

const [network, account, id, run, fault] = process.argv.slice(2);
if (
  ![6,7].includes(process.argv.length) ||
  (fault !== undefined && fault !== '--lose-claim-ack') ||
  !["signet", "mutinynet"].includes(network) ||
  !/^000[0-9]$/.test(id ?? "") ||
  !/^cv-[a-z0-9-]{1,30}$/.test(run ?? "")
)
  throw Error("vault-ui-invalid-arguments");
const selected = network as TestNetwork,
  { vault } = protectedConditionalVaultContext(selected);
const origin =
  process.env.PROTOTYPE_SANDBOX_URL ?? "http://127.0.0.1:5174";
const phrase = await vault.transaction(async (state) => {
  await verifiedInventory(state);
  const entry = state.accounts.find((a) => a.label === account);
  if (!entry?.grant?.active || !entry.grant.networks.includes(selected))
    throw Error("vault-ui-test-account-not-authorized");
  if (state.conditionalVaultUiAcceptance?.[run])
    throw Error("vault-ui-original-run-must-be-reconciled");
  state.conditionalVaultUiAcceptance ??= {};
  state.conditionalVaultUiAcceptance[run] = {
    network,
    account,
    id,
    faultRequested: fault ?? null,
    steps: [],
    privateEntries: [],
    complete: false,
  };
  return entry.phrase;
});
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
});
const context = await browser.newContext(),
  page = await context.newPage();
let stage = "setup";
let posts = 0;
let finishFault!: (verified: boolean) => void;
const faultCompleted = new Promise<boolean>(resolve => { finishFault = resolve; });
async function backup() {
  const entries = await page.evaluate(async (selected) => {
    const { createVaultJournal } = await import(
      "/BIS/packages/integration/src/client/state-layer-core/conditional-vault-journal.ts"
    );
    return createVaultJournal(selected).transaction((entries) =>
      structuredClone(entries),
    );
  }, selected);
  await vault.transaction((state) => {
    state.conditionalVaultUiAcceptance[run].privateEntries = entries;
  });
}
try {
  // The mnemonic exists only in this isolated browser context and the existing
  // protected fixture store. Never put it in logs, traces, screenshots or files.
  await context.addInitScript(
    ({ selected, key, phrase }) => {
      localStorage.setItem("network", selected);
      localStorage.setItem(key, phrase);
      localStorage.setItem("prototype-sandbox-visited", "true");
    },
    {
      selected,
      key: walletProfileStorageKey(selected, "wallet-2-mnemonic"),
      phrase,
    },
  );
  await context.route("**/v1/tx{,/**}", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await backup();
      if (fault && stage === 'claim' && /:707[45]\/v1\/tx$/.test(route.request().url())) {
        // Execute the real co-signer request, then deliberately lose ONLY the
        // response. Network receipts must recover the original Claim.
        try {
          const response = await route.fetch({ timeout: 30000 });
          await route.abort('connectionreset').catch(() => {});
          finishFault(response.ok());
        } catch {
          // A response timeout or navigation cancellation is itself an absent
          // acknowledgement. It counts only if the subsequent real receipt
          // and no-second-POST assertions also pass.
          await route.abort('connectionreset').catch(() => {});
          finishFault(true);
        }
        return;
      }
    }
    await route.continue();
  });
  async function execute(number: number, name: string) {
    stage = name;
    await page.goto(`${origin}/prototype-sandbox/demo-${number}/`, {
      waitUntil: "networkidle",
    });
    if (name === "create")
      await page.locator(`#${selected}-asset-id`).selectOption(id);
    await page
      .getByRole("button", {
        name: 'Execute',
        exact: true,
      })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Demo output"]',
          )
          ?.value.includes("Success:"),
      null,
      { timeout: 90000 },
    );
    const output = await page
      .locator('textarea[aria-label="Demo output"]')
      .inputValue();
    await backup();
    await vault.transaction((state) => {
      state.conditionalVaultUiAcceptance[run].steps.push({ name, output });
    });
    if (!output.endsWith("Success: true"))
      throw Error("vault-ui-operation-unverified");
    await page.waitForFunction(
      () =>
        document
          .querySelector<HTMLTextAreaElement>("#vault-public-descriptor")
          ?.value.startsWith("{"),
      null,
      { timeout: 5000 },
    );
    const descriptor = await page
      .locator("#vault-public-descriptor")
      .inputValue();
    await vault.transaction((state) => {
      state.conditionalVaultUiAcceptance[run].descriptor =
        JSON.parse(descriptor);
    });
    process.stdout.write(
      JSON.stringify({ network, run, step: name, verified: true }) + "\n",
    );
  }
  await execute(14, "create");
  for (let progress = 0; progress < 3; progress++) {
    await execute(15, "increment");
    // Full public-check parity is covered by the ordinary funded run. Keep
    // this focused transport fault within the same immutable two-minute limit.
    if (!fault) await execute(17, "check");
  }
  await execute(16, "claim");
  await execute(17, "check");
  if (fault) {
    let timer: ReturnType<typeof setTimeout>;
    const observed = await Promise.race([faultCompleted, new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 60000); })]);
    clearTimeout(timer!);
    if (!observed) throw Error('vault-ui-claim-acknowledgement-fault-unverified');
    const beforeRepeat = posts;
    await execute(16, 'claim');
    if (posts !== beforeRepeat) throw Error('vault-ui-duplicate-claim-submitted');
    await vault.transaction(state => { state.conditionalVaultUiAcceptance[run].lostClaimAcknowledgement = true; state.conditionalVaultUiAcceptance[run].duplicateClaimNoPost = true; });
  }
  await vault.transaction((state) => {
    state.conditionalVaultUiAcceptance[run].complete = true;
  });
  process.stdout.write(
    JSON.stringify({ network, run, complete: true, browserFundedFlow: true }) +
      "\n",
  );
} catch (error) {
  await backup().catch(() => {});
  await vault.transaction((state) => {
    state.conditionalVaultUiAcceptance[run].privateError = String(error);
  });
  process.stdout.write(
    JSON.stringify({
      network,
      run,
      stage,
      complete: false,
      reason: "vault-ui-operation-unverified",
      recoveryRetained: true,
    }) + "\n",
  );
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
