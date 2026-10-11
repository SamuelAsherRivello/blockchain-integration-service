import { createHash } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { browserEnvironment } from './browser-public.mjs';
import { verifiedInventory } from './inventory.mjs';
import { validatePrivatePath } from './vault.mjs';
import { assertOnboardingWindow } from './onboarding.mjs';
import { fail } from './errors.mjs';

const owners = new WeakMap();
export function onboardingProfileKey(intent) {
  return createHash('sha256').update(JSON.stringify([intent.id, intent.profileId, intent.generation,
    intent.network, intent.sourceOrigin])).digest('hex').slice(0, 32);
}

async function authorize(owner, operation) {
  await owner.validateRegistration();
  const intent = operation.intent, { player, pair, application } = owner.registration;
  if (owner.closed || owner.loggedOut || intent.kind !== 'onboard' || intent.percent !== 50 ||
      player.label !== intent.account || player.profileId !== intent.profileId || player.generation !== intent.generation ||
      pair.network !== intent.network || application.origin !== intent.sourceOrigin) fail('onboarding-context-mismatch');
  await owner.vault.transaction(async state => {
    await verifiedInventory(state);
    if (!state.applications?.some(row => row.app === 'onboarding' && row.origin === intent.sourceOrigin && row.path === '/onboarding/'))
      fail('onboarding-origin-not-registered');
  });
}

// Dedicated persistent profile: the prototype has an independent window lease,
// encrypted database and journals. Closing releases only our process ownership;
// it never resets the page, logs out, deletes profile files or moves databases.
export async function onboardingPage(owner, operation, adapters = {}) {
  await authorize(owner, operation);
  let entries = owners.get(owner);
  if (!entries) { entries = new Map(); owners.set(owner, entries); }
  const key = onboardingProfileKey(operation.intent);
  if (entries.has(key)) {
    const entry = await entries.get(key);
    if (entry.page.isClosed()) fail('onboarding-window-closed');
    assertOnboardingWindow(entry.page.url(), operation);
    return entry.page;
  }
  const pending = (async () => {
    const profile = join(owner.vault.root, 'profiles', `onboarding-${key}`);
    const lockPath = join(owner.vault.root, `onboarding-${key}.lock`);
    await validatePrivatePath(profile);
    await validatePrivatePath(lockPath);
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch { fail('onboarding-profile-already-owned'); }
    let context;
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, operation: operation.intent.id }));
      await lock.sync();
      await mkdir(profile, { recursive: true, mode: 0o700 });
      await owner.vault.protector.check(profile);
      for (const key of ['DEBUG', 'PWDEBUG', 'DEBUG_FILE']) delete process.env[key];
      const chromium = adapters.chromium ?? (await import('playwright')).chromium;
      context = await chromium.launchPersistentContext(profile, {
        headless: true, acceptDownloads: false, timeout: 20000,
        viewport: { width: 1280, height: 900 }, env: browserEnvironment(),
      });
      context.setDefaultTimeout(20000);
      const page = context.pages()[0] ?? await context.newPage();
      context.on('page', other => { if (other !== page) void other.close().catch(() => {}); });
      await context.route('**/*', async route => {
        const request = route.request();
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
          try { assertOnboardingWindow(request.url(), operation); }
          catch { await route.abort(); return; }
        }
        await route.continue();
      });
      await page.goto(`${operation.intent.sourceOrigin}/onboarding/?network=${operation.intent.network}&window=${operation.intent.id}`,
        { waitUntil: 'domcontentloaded' });
      await page.locator('#network').waitFor();
      await authorize(owner, operation);
      assertOnboardingWindow(page.url(), operation);
      return { context, page, lock, lockPath };
    } catch {
      if (context) {
        try { await context.close(); }
        catch { fail('onboarding-cleanup-unavailable'); } // Retain lock if a signer may remain alive.
      }
      await lock.close();
      await unlink(lockPath);
      fail('onboarding-window-unavailable');
    }
  })();
  entries.set(key, pending);
  try { return (await pending).page; }
  catch (error) { entries.delete(key); throw error; }
}

export async function closeOnboardingPages(owner) {
  const entries = owners.get(owner);
  if (!entries) return;
  for (const [key, pending] of entries) {
    let entry;
    try { entry = await pending; } catch { entries.delete(key); continue; }
    try { await entry.context.close(); } catch { fail('onboarding-cleanup-unavailable'); }
    await entry.lock.close();
    await unlink(entry.lockPath);
    entries.delete(key);
  }
  owners.delete(owner);
}
