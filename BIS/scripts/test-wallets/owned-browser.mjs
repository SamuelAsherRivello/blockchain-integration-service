import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { loadAddresses } from '../../packages/integration/src/client/wallet-layer-arkade/addresses.ts';
import { verifiedInventory } from './inventory.mjs';
import { origin } from './arguments.mjs';
import { validatePrivatePath } from './vault.mjs';
import { fail } from './errors.mjs';
import { Operations } from './operations.mjs';
import { observeReceipt } from './funding.mjs';
import { runSwap, readSwapState } from './swap.mjs';
import { publicScreens, browserEnvironment, validatePayment, publicSends, matchingSend, readPaymentReview, assertPaymentReview,
  validateLifecycle, readLogoutCount } from './browser-public.mjs';
import { gameAdapter, gameUrl } from './game-adapter.mjs';

const paths = { admin: '/admin/', marketplace: '/marketplace/', onboarding: '/onboarding/', faucet: '/prototype-faucet/', game: gameAdapter.path };
export function ownedLaunchOptions(app, platform = process.platform) {
  // Verified Windows game smoke configuration. Keep ordinary BIS Chromium
  // defaults and never inherit arbitrary executable overrides or GPU flags.
  return app === 'game' && platform === 'win32' ? {
    channel: 'msedge', args: ['--enable-unsafe-webgpu', '--mute-audio'],
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
  } : {};
}
export function ownedProfileKey(pairLabel, network, selectedOrigin, app) {
  // Keep established Marketplace recovery paths; other apps own independent
  // browser storage even when hosted on the same loopback origin.
  const scope = `${pairLabel}:${network}:${selectedOrigin}${app === 'marketplace' ? '' : `:${app}`}`;
  return createHash('sha256').update(scope).digest('hex').slice(0, 24);
}
export async function configureApplications(vault, selectedOrigin) {
  const base = origin(selectedOrigin);
  return vault.transaction(state => {
    state.applications ??= [];
    for (const [app, path] of Object.entries(paths)) {
      if (!state.applications.some(x => x.app === app && x.origin === base)) {
        state.applications.push({ app, origin: base, path, ...(app === 'game' ? { search: gameAdapter.search, provenance: { ...gameAdapter.provenance } } : {}) });
      }
    }
  });
}

export class OwnedBrowser {
  constructor(vault, options) { this.vault = vault; this.options = options; this.sessionId = randomUUID(); this.closed = false; }
  async start() {
    const { pair: pairLabel, origin: inputOrigin, app } = this.options;
    const selectedOrigin = origin(inputOrigin);
    // An unsupported adapter must never receive decrypted fixture material.
    if (!['marketplace', 'admin', 'game'].includes(app)) fail('app-adapter-not-yet-implemented');
    this.registration = await this.vault.transaction(async state => {
      await verifiedInventory(state);
      const application = state.applications?.find(x => x.app === app && x.origin === selectedOrigin && x.path === paths[app] &&
        (app !== 'game' || x.search === gameAdapter.search && JSON.stringify(x.provenance) === JSON.stringify(gameAdapter.provenance)));
      if (!application) fail('origin-not-registered');
      const pair = state.pairs.find(x => x.label === pairLabel);
      if (!pair) fail('pair-not-registered');
      const player = state.accounts.find(x => x.label === pair.player), game = state.accounts.find(x => x.label === pair.game);
      for (const account of [player, game]) if (!account.grant?.active || !account.grant.networks.includes(pair.network)) fail('test-permission-unavailable');
      return { application, pair, player, game };
    });
    const { application, pair, player, game } = this.registration;
    const key = ownedProfileKey(pairLabel, pair.network, selectedOrigin, app);
    const profile = join(this.vault.root, 'profiles', key);
    await validatePrivatePath(profile);
    const lockPath = join(this.vault.root, `profile-${key}.lock`);
    try { this.lock = await open(lockPath, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') fail('profile-already-owned'); throw error; }
    this.lockPath = lockPath;
    let stage = 'profile';
    try {
      await this.lock.writeFile(JSON.stringify({ pid: process.pid, sessionId: this.sessionId }));
      await this.lock.sync();
      await this.validateRegistration();
      await mkdir(profile, { recursive: true, mode: 0o700 });
      await this.vault.protector.check(profile);
      // Disable runner-side Playwright debugging as well as filtering browser env.
      for (const key of ['DEBUG', 'PWDEBUG', 'DEBUG_FILE']) delete process.env[key];
      const { chromium } = await import('playwright');
      stage = 'launch';
      this.context = await chromium.launchPersistentContext(profile, { headless: true, acceptDownloads: false,
        viewport: { width: 1280, height: 900 }, timeout: 20000,
        ...ownedLaunchOptions(app),
        env: browserEnvironment(),
      });
      this.context.setDefaultTimeout(20000);
      // Do not forward console/pageerror/request bodies or enable tracing/video.
      this.page = this.context.pages()[0] ?? await this.context.newPage();
      this.context.on('page', page => { if (page !== this.page) void page.close().catch(() => {}); });
      await this.context.route('**/*', async route => {
        const request = route.request();
        const requestUrl = new URL(request.url());
        const expectedUrl = new URL(application.search ? `${selectedOrigin}${application.path}${application.search}` : `${selectedOrigin}${application.path}`);
        if (request.isNavigationRequest() && request.frame() === this.page.mainFrame() &&
            (requestUrl.origin !== expectedUrl.origin || requestUrl.pathname !== expectedUrl.pathname || requestUrl.search !== expectedUrl.search)) await route.abort();
        else await route.continue();
      });
      const deadline = AbortSignal.timeout(30000);
      stage = 'addresses';
      this.expected = {
        player: await loadAddresses({ ...player, network: pair.network }, deadline),
        game: await loadAddresses({ ...game, network: pair.network }, deadline),
      };
      stage = 'navigate';
      await this.page.goto(application.app === 'game' ? gameUrl(application) : `${selectedOrigin}${application.path}`, { waitUntil: 'domcontentloaded' });
      stage = 'restore';
      await this.restorePair();
      return this.inspect();
    } catch {
      await this.close();
      fail(`owned-browser-${this.restoreStage ?? stage}-unavailable`);
    }
  }
  async accountDialog() {
    if (!await this.page.locator('.bis-card').last().isVisible()) {
      if (this.registration.application.app === 'admin')
        await this.page.getByRole('button', { name: 'A.P.4. Account Dialog', exact: true }).click();
      else if (this.registration.application.app === 'game') {
        const account = this.page.getByRole('button', { name: '⚡ Account', exact: true });
        if (await account.count() && await account.isVisible()) await account.click();
        else {
          await this.page.getByRole('button', { name: 'Open settings', exact: true }).click();
          await this.page.getByRole('button', { name: '⚡ Account', exact: true }).click();
        }
      }
      else await this.page.getByRole('button', { name: 'Account', exact: true }).click();
    }
    await this.page.locator('.bis-card').last().waitFor({ state: 'visible' });
  }
  async accountMenu() {
    await this.accountDialog();
    for (let count = 0; count < 8; count++) {
      // Collection Back can close the dialog instead of opening its parent.
      await this.accountDialog();
      const heading = this.page.locator('.bis-card h2').last();
      const current = await heading.textContent();
      if (current === 'Account') return;
      if (!publicScreens.includes(current)) fail('private-surface-not-navigable');
      await this.page.locator('.bis-card').last().getByRole('button', { name: 'Back', exact: true }).last().click();
      await this.page.waitForFunction(previous => [...document.querySelectorAll('.bis-card h2')].at(-1)?.textContent !== previous, current);
    }
    fail('account-menu-unavailable');
  }
  async navigate(screen) {
    if (!['Account', 'Accounts Details', 'Developer', 'Game Wallet', 'Send', 'Swap', 'Receive', 'Assets', 'Transactions', 'Contracts'].includes(screen)) fail('unsupported-navigation');
    if (this.loggedOut && screen !== 'Account') fail('owned-session-logged-out');
    await this.inspect();
    await this.accountMenu();
    if (['Accounts Details', 'Developer', 'Game Wallet', 'Assets', 'Transactions', 'Contracts'].includes(screen))
      await this.page.getByRole('button', { name: 'Accounts Details', exact: true }).click();
    if (['Developer', 'Game Wallet'].includes(screen)) await this.page.getByRole('button', { name: 'Developer', exact: true }).click();
    const button = { 'Game Wallet': 'Game Wallet Login', Send: '⚡ Send', Swap: '⚡ Swap', Receive: '⚡ Receive', Assets: 'Assets', Transactions: 'Transactions', Contracts: 'Contracts' }[screen];
    if (button) await this.page.getByRole('button', { name: button, exact: true }).click();
    await this.page.waitForFunction(expected => [...document.querySelectorAll('.bis-card h2')].at(-1)?.textContent === expected, screen);
    return this.inspect();
  }
  async entry(phrase, buttonName) {
    // This is the only recovery-entry seam. It returns no DOM/error/capture data.
    const words = phrase.split(' ');
    try {
      for (let index = 0; index < 12; index++) await this.page.getByLabel(`Word ${index + 1}`, { exact: true }).fill(words[index]);
      await this.page.getByRole('button', { name: buttonName, exact: true }).click();
      await this.page.getByRole('group', { name: 'Private recovery phrase', exact: true }).waitFor({ state: 'detached' });
    } catch { fail('private-restore-unavailable'); }
  }
  async restorePair({ restoreMissing = true } = {}) {
    const { pair, player, game } = this.registration;
    this.restoreStage = 'account-dialog';
    await this.accountMenu();
    await this.page.getByRole('button', { name: /^(?:⚡ Restore Account|Accounts Details)$/ }).first().waitFor();
    const restore = this.page.getByRole('button', { name: '⚡ Restore Account', exact: true });
    if (await restore.isVisible()) {
      if (!restoreMissing) fail('player-not-connected');
      this.restoreStage = 'network-selection';
      await this.page.getByRole('button', { name: 'Network', exact: true }).click();
      await this.page.getByRole('option', { name: pair.network === 'signet' ? 'Signet' : 'Mutiny', exact: true }).click();
      await restore.click();
      this.restoreStage = 'player-restore';
      await this.entry(player.phrase, '⚡ Restore');
    }
    this.restoreStage = 'player-details';
    await this.page.getByRole('button', { name: 'Accounts Details', exact: true }).click();
    await this.page.getByLabel('Arkade address', { exact: true }).waitFor();
    await this.page.waitForFunction(expected => document.querySelector('input[aria-label="Arkade address"]')?.value === expected, this.expected.player.arkadeAddress);
    await this.verifyNetwork();
    this.restoreStage = 'game-menu';
    await this.page.getByRole('button', { name: 'Developer', exact: true }).click();
    await this.page.getByRole('button', { name: 'Game Wallet Login', exact: true }).click();
    await this.page.getByRole('button', { name: /^(?:⚡ Restore Wallet|Log Out Game Wallet)$/ }).first().waitFor();
    const restoreGame = this.page.getByRole('button', { name: '⚡ Restore Wallet', exact: true });
    if (await restoreGame.isVisible()) {
      if (!restoreMissing) fail('game-not-connected');
      this.restoreStage = 'game-restore'; await restoreGame.click(); await this.entry(game.phrase, '⚡ Restore Wallet');
    }
    this.restoreStage = 'game-identity';
    await this.page.waitForFunction(expected => document.querySelector('input[aria-label="Arkade address"]')?.value === expected, this.expected.game.arkadeAddress);
    this.restoreStage = 'game-network';
    await this.verifyNetwork();
    this.restoreStage = 'private-clear';
    if (await this.page.getByRole('group', { name: 'Private recovery phrase', exact: true }).count()) fail('private-input-still-present');
    this.restored = true;
    this.restoreStage = undefined;
  }
  async verifyNetwork() {
    const expected = this.registration.pair.network === 'signet' ? 'Signet' : 'Mutinynet';
    const marker = this.page.locator('.bis-layer[data-bis-network]').last();
    if (await marker.getAttribute('data-bis-network', { timeout: 5000 }) !== this.registration.pair.network) fail('browser-network-mismatch');
    const label = this.page.locator('.bis-network-text').last();
    if (await label.count() && await label.textContent() !== `Network: ${expected}`) fail('browser-network-mismatch');
    if (new URL(this.page.url()).origin !== this.registration.application.origin) fail('browser-origin-mismatch');
    if (new URL(this.page.url()).pathname !== this.registration.application.path) fail('browser-application-mismatch');
    if (this.registration.application.app === 'game' && new URL(this.page.url()).search !== this.registration.application.search) fail('browser-application-mismatch');
  }
  async inspect() {
    if (this.loggedOut) return this.inspectLoggedOut();
    if (!this.restored || this.closed) fail('session-unavailable');
    await this.verifyNetwork();
    await this.validateRegistration();
    if (await this.page.getByRole('group', { name: 'Private recovery phrase', exact: true }).count() ||
        await this.page.getByRole('heading', { name: /Recovery Phrase/ }).count()) fail('private-surface-not-inspectable');
    const { player, game, pair, application } = this.registration;
    const screen = await this.page.locator('.bis-card h2').last().textContent();
    if (!publicScreens.includes(screen)) fail('screen-not-yet-inspectable');
    const marker = this.page.locator('.bis-layer[data-bis-player-id]').last();
    const playerId = await marker.getAttribute('data-bis-player-id');
    if (playerId !== player.profileId) fail('session-identity-invalidated');
    const gameAddress = await marker.getAttribute('data-bis-game-address');
    if (gameAddress !== this.expected.game.arkadeAddress) fail('session-identity-invalidated');
    if (screen === 'Game Wallet' && await this.page.getByLabel('Arkade address', { exact: true }).inputValue() !== this.expected.game.arkadeAddress) fail('session-identity-invalidated');
    return { sessionId: this.sessionId, mode: 'owned', app: application.app, origin: application.origin, network: pair.network,
      player: { label: player.label, profileId: player.profileId, arkadeAddress: this.expected.player.arkadeAddress },
      game: { label: game.label, profileId: game.profileId, arkadeAddress: this.expected.game.arkadeAddress },
      screen, ...(screen === 'Swap' ? {swap:await readSwapState(this.page)} : {}),
    };
  }
  async validateRegistration() {
    if (this.closed || !this.registration) fail('session-unavailable');
    await this.vault.transaction(async state => {
      await verifiedInventory(state);
      const previousApplication = this.registration.application;
      if (!state.applications?.some(row => ['app', 'origin', 'path'].every(key => row[key] === previousApplication[key])))
        fail('session-application-invalidated');
      const previousPair = this.registration.pair, pair = state.pairs.find(row => row.label === previousPair.label);
      if (!pair || ['network', 'player', 'game'].some(key => pair[key] !== previousPair[key])) fail('session-identity-invalidated');
      for (const previous of [this.registration.player, this.registration.game]) {
        const current = state.accounts.find(x => x.label === previous.label);
        if (!current || current.profileId !== previous.profileId || current.generation !== previous.generation || !current.grant?.active ||
            !current.grant.networks?.includes(this.registration.pair.network)) fail('session-identity-invalidated');
      }
    });
  }
  async inspectLoggedOut() {
    await this.validateRegistration();
    await this.accountDialog();
    await this.verifyNetwork();
    await this.page.getByRole('button', { name: '⚡ Restore Account', exact: true }).waitFor();
    const connected = await this.page.locator('.bis-layer[data-bis-player-id]').last().getAttribute('data-bis-player-id');
    if (connected) fail('unexpected-player-after-logout');
    const { application, pair, player, game } = this.registration;
    return { sessionId: this.sessionId, mode: 'owned', app: application.app, origin: application.origin, network: pair.network,
      player: { label: player.label, state: 'logged-out' }, game: { label: game.label, state: 'not-verified-after-player-logout' }, screen: 'Account' };
  }
  async reload(request = { command: 'run', scenario: 'reload' }) {
    validateLifecycle(request, 'reload');
    await this.inspect();
    this.restored = false;
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    if (this.loggedOut) return this.inspectLoggedOut();
    await this.restorePair({ restoreMissing: false });
    return this.inspect();
  }
  async logout(request) {
    validateLifecycle(request, 'logout');
    if (this.loggedOut) return this.inspectLoggedOut();
    await this.inspect();
    const { player, game, pair } = this.registration;
    await this.vault.transaction(state => {
      if ([player, game].some(previous => state.accounts.find(account => account.label === previous.label)?.reportedPending?.[pair.network]))
        fail('external-onboarding-unreconciled');
    });
    const pending = (await new Operations(this.vault).list()).some(row => row.intent.network === pair.network &&
      [player.profileId, game.profileId].includes(row.intent.profileId) && !['settled', 'failed', 'cancelled'].includes(row.state));
    if (pending) fail('logout-operation-unresolved');
    if (await readLogoutCount(this.page) !== 0)
      fail('logout-operation-unresolved');
    await this.accountMenu();
    await this.page.getByRole('button', { name: 'Log Out', exact: true }).click();
    await this.page.getByRole('heading', { name: 'Account Log Out', exact: true }).waitFor();
    // Do not acknowledge destruction of pending work, even if the product
    // intentionally allows it. Recheck immediately before its normal boundary.
    if (await readLogoutCount(this.page) !== 0) {
      await this.page.locator('.bis-card').last().getByRole('button', { name: 'Back', exact: true }).click();
      fail('logout-operation-unresolved');
    }
    await this.page.getByRole('checkbox', { name: 'I have backed up my wallet', exact: true }).check();
    const gameNotice = this.page.getByRole('checkbox', { name: 'I understand the separate Game Wallet remains saved in this browser.', exact: true });
    if (await gameNotice.count()) await gameNotice.check();
    // Backup is the encrypted fixture vault; never reveal/copy from the app.
    this.loggedOut = true; this.restored = false;
    try {
      await this.page.getByRole('button', { name: 'Log Out', exact: true }).click();
      return await this.inspectLoggedOut();
    } catch {
      // An uncertain cleanup boundary must not become an automatic restore.
      await this.close();
      fail('logout-result-unavailable');
    }
  }
  async restore(request) {
    validateLifecycle(request, 'restore');
    if (!this.loggedOut) return this.inspect();
    await this.inspectLoggedOut();
    try {
      await this.restorePair({ restoreMissing: true });
      this.loggedOut = false;
      return await this.inspect();
    } catch {
      // Preserve a partially restored profile, but release this unusable
      // session. An explicit open can verify it again; never reset it.
      await this.close();
      fail('explicit-restore-unavailable');
    }
  }
  async payment(request) {
    validatePayment(request);
    if (this.loggedOut) fail('owned-session-logged-out');
    await this.inspect();
    const { player, game, pair, application } = this.registration;
    const ledger = new Operations(this.vault);
    let recipient = game, recipientAddress = this.expected.game.arkadeAddress, target;
    if (request.scenario === 'funding') {
      recipient = await this.vault.transaction(async state => {
        await verifiedInventory(state);
        const account = state.accounts.find(row => row.label === request.recipientAccount);
        if (!account) fail('recipient-not-registered');
        if (account.profileId === player.profileId) fail('self-funding-not-supported');
        if (!account.grant?.active || !account.grant.networks?.includes(pair.network)) fail('test-target-grant-unavailable');
        return account;
      });
      recipientAddress = (await loadAddresses({ ...recipient, network: pair.network }, AbortSignal.timeout(30000))).arkadeAddress;
      target = { account: recipient.label, profileId: recipient.profileId, generation: recipient.generation };
    }
    let operation = (await ledger.list()).find(row => row.intent.id === request.operation);
    if (operation) {
      const intent = operation.intent;
      if (intent.kind !== 'arkade-send' || intent.profileId !== player.profileId || intent.generation !== player.generation ||
          intent.network !== pair.network || intent.recipient !== recipientAddress ||
          JSON.stringify(intent.target) !== JSON.stringify(target) ||
          intent.amountSats !== request.amountSats || intent.sourceOrigin !== application.origin) fail('operation-intent-conflict');
    } else {
      await this.navigate('Send');
      await this.page.getByLabel('Recipient address', { exact: true }).fill(recipientAddress);
      await this.page.getByLabel('Amount (sats)', { exact: true }).fill(String(request.amountSats));
      await this.page.getByRole('button', { name: '⚡ Review Send', exact: true }).click();
      await this.page.getByRole('heading', { name: 'Review Send', exact: true }).waitFor();
      const quote = await readPaymentReview(this.page);
      assertPaymentReview(quote, { amountSats: request.amountSats, recipient: recipientAddress, network: pair.network, feeSats: quote.feeSats });
      const prior = await publicSends(this.page, player.profileId, pair.network);
      operation = await ledger.prepare({ id: request.operation, account: player.label, profileId: player.profileId,
        generation: player.generation, network: pair.network, kind: 'arkade-send', recipient: quote.recipient,
        amountSats: quote.amountSats, feeSats: quote.feeSats, sourceOrigin: application.origin,
        priorProviderIds: prior.map(row => row.transactionId), ...(target ? { target } : {}) });
    }
    if (operation.state === 'prepared') {
      // A restarted session must not silently confirm a different or expired quote.
      if (!await this.page.getByRole('heading', { name: 'Review Send', exact: true }).isVisible()) fail('payment-review-required');
      operation = await ledger.submit(request.operation, async record => {
        await this.inspect();
        assertPaymentReview(await readPaymentReview(this.page), record.intent);
        await this.page.getByRole('button', { name: '⚡ Confirm Send', exact: true }).click();
        await this.page.waitForFunction(({ profileId, network, prior }) => {
          const root = `bis-${network}-send-operation-v1:${encodeURIComponent(profileId)}`;
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key !== root && !key?.startsWith(`${root}:operation:`)) continue;
            try { const row = JSON.parse(localStorage.getItem(key)); if (/^[a-f0-9]{64}$/.test(row?.transactionId ?? '') && !prior.includes(row.transactionId)) return true; } catch { return false; }
          }
          return false;
        }, { profileId: player.profileId, network: pair.network, prior: record.intent.priorProviderIds }, { timeout: 30000 });
        const sent = matchingSend(await publicSends(this.page, player.profileId, pair.network), record);
        if (!sent) fail('payment-journal-unavailable');
        return { providerId: sent.transactionId };
      });
    }
    if (['pending', 'unknown', 'submitting'].includes(operation.state)) {
      const sent = matchingSend(await publicSends(this.page, player.profileId, pair.network), operation);
      if (sent) {
        const evidenceRecord = { ...operation, providerId: sent.transactionId };
        const evidence = await observeReceipt({ ...recipient, network: pair.network }, evidenceRecord).catch(() => undefined);
        if (evidence) operation = await ledger.reconcile(request.operation, async () => evidence);
      }
    }
    return { operation, readiness: operation.state === 'settled' ? request.scenario === 'funding' ? 'funding-verified' : 'payment-verified' : 'pending' };
  }
  async swap(request) { return runSwap(this, request); }
  async onboardingPage(operation) {
    this.onboardingWindows = true;
    return (await import('./onboarding-browser.mjs')).onboardingPage(this, operation);
  }
  async close() {
    this.closed = true;
    if (this.onboardingWindows) await (await import('./onboarding-browser.mjs')).closeOnboardingPages(this);
    await this.context?.close().catch(() => {});
    if (this.lock) { await this.lock.close(); await unlink(this.lockPath); this.lock = undefined; }
    this.registration = undefined; this.expected = undefined;
  }
}
