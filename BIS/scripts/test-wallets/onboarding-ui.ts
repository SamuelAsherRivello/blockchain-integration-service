import { fail } from './errors.ts';

const promptMessage = 'Enter your seed phrase (12, 15, 18, 21, or 24 English words). It is stored encrypted in this browser.';
const confirmMessage = 'Are you sure you want to restart using the entered seed phrase? The steps will reset. The previous account and transfer will be archived locally. This does not move funds or cancel a submitted transfer.';
const idleMessage = 'No Bitcoin → Arkade transfer submitted. Step 4 starts automatically when funding is ready.';

// Only public controls and booleans cross this seam. Never read the recovery
// value, page HTML, arbitrary status/error text, databases or browser journals.
export async function onboardingControls(page) {
  try {
    return {
      url: page.url(), network: await page.locator('#network').inputValue(),
      percent: await page.locator('#transfer-percent').inputValue(),
      percentDisabled: await page.locator('#transfer-percent').isDisabled(),
      address: await page.locator('#address').inputValue(),
      idle: (await page.locator('#status').textContent()) === idleMessage,
      secretHidden: (await page.locator('#recovery-value').getAttribute('type')) === 'password' &&
        (await page.locator('#reveal-recovery').getAttribute('aria-pressed')) === 'false',
    };
  } catch { fail('onboarding-controls-unavailable'); }
}

function assertOnboardingURL(value, intent) {
  let url;
  try { url = new URL(value); } catch { fail('onboarding-context-mismatch'); }
  if (intent.kind !== 'onboard' || intent.percent !== 50 ||
      url.origin !== intent.sourceOrigin || url.pathname !== '/onboarding/' ||
      url.searchParams.get('network') !== intent.network) fail('onboarding-context-mismatch');
}

export function assertFreshOnboarding(controls, intent) {
  assertOnboardingURL(controls.url, intent);
  if (controls.network !== intent.network ||
      controls.percent !== '50' || controls.percentDisabled || !controls.secretHidden)
    fail('onboarding-context-mismatch');
  // This entry point is fresh-window-only. Never restart an existing identity,
  // change its network, or reset pending settlement to make restoration easier.
  if (controls.address !== 'No account created yet' || controls.idle !== true)
    fail('onboarding-window-not-empty');
}

// Caller derives recipient and captures eligible UTXOs through production reads,
// prepares an onboard intent, and supplies its private vault phrase internally.
// Operations.submit commits its reservation before invoking the UI callback.
// This is not a generic prompt responder or a joined-session action.
export async function restoreOnboardingUI(page, ledger, operation, phrase) {
  assertFreshOnboarding(await onboardingControls(page), operation.intent);
  return ledger.submit(operation.intent.id, async claimed => {
    assertFreshOnboarding(await onboardingControls(page), claimed.intent);
    let stage = 0, dialogFailed = false;
    const handler = async dialog => {
      try {
        // Native dialogs pause the page: do not evaluate DOM while one is open.
        // Controls were rechecked immediately before Restart; the exact modal
        // sequence cannot be interleaved with dropdown/account interaction.
        assertOnboardingURL(page.url(), claimed.intent);
        if (stage === 0 && dialog.type() === 'prompt' && dialog.message() === promptMessage) {
          stage = 1;
          await dialog.accept(phrase);
        } else if (stage === 1 && dialog.type() === 'confirm' && dialog.message() === confirmMessage) {
          stage = 2;
          await dialog.accept();
        } else {
          dialogFailed = true;
          await dialog.dismiss();
        }
      } catch {
        dialogFailed = true;
        await dialog.dismiss().catch(() => {});
      }
    };
    page.on('dialog', handler);
    try {
      await page.locator('#seed-mode').selectOption('manual');
      assertFreshOnboarding(await onboardingControls(page), claimed.intent);
      await page.locator('#create').click();
      await page.waitForFunction(expected => document.querySelector('#address')?.value === expected,
        claimed.intent.recipient, { timeout: 30000 });
      if (stage !== 2 || dialogFailed) fail('onboarding-private-restore-unavailable');
      const restored = await onboardingControls(page);
      const url = new URL(restored.url);
      if (url.origin !== claimed.intent.sourceOrigin || url.pathname !== '/onboarding/' ||
          url.searchParams.get('network') !== claimed.intent.network || restored.network !== claimed.intent.network ||
          restored.percent !== '50' || !restored.secretHidden || restored.address !== claimed.intent.recipient)
        fail('onboarding-restored-context-mismatch');
      // A restored account or a whole-input receipt is not settlement. Retain an
      // unknown reservation if registration is not yet publicly identifiable.
      const providerId = (await page.locator('#intent').textContent())?.trim();
      if (!/^[A-Za-z0-9:_-]{1,300}$/.test(providerId ?? '')) fail('onboarding-acknowledgement-unavailable');
      return { providerId };
    } catch { fail('onboarding-private-restore-unavailable'); }
    finally { page.off('dialog', handler); }
  });
}

