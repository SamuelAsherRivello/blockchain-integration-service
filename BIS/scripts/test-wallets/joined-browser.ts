import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { origin } from './arguments.ts';
import { repositoryRoot } from './vault.ts';
import { fail } from './errors.ts';

const screens = ['Account', 'Accounts Details', 'Receive', 'Assets', 'Transactions'];
const path = '/marketplace/';

export function joinedRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) fail('joined-action-denied');
  const keys = Object.keys(request);
  if (request.command === 'inspect' && keys.length === 1) return 'inspect';
  if (request.command === 'detach' && keys.length === 1) return 'detach';
  if (request.command === 'action' && request.type === 'navigate' && screens.includes(request.screen) &&
      keys.length === 3 && keys.every(key => ['command', 'type', 'screen'].includes(key))) return 'navigate';
  fail('joined-action-denied');
}

function validateDestination(url, expectedOrigin) {
  let parsed;
  try { parsed = new URL(url); } catch { fail('joined-context-invalidated'); }
  if (parsed.origin !== expectedOrigin || parsed.pathname !== path || parsed.search || parsed.hash || parsed.username || parsed.password)
    fail('joined-context-invalidated');
}

// No vault, fixture lookup, secret reader, wallet factory or grant upgrade. A
// matching registered public identity still has only this session's authority.
export class JoinedBrowser {
  constructor(options, { connect } = {}) {
    this.options = options; this.connect = connect; this.sessionId = randomUUID(); this.detached = false;
  }
  async start() {
    const { app, page: targetId, api } = this.options;
    this.origin = origin(this.options.origin);
    if (app !== 'marketplace' || !/^[a-fA-F0-9]{32}$/.test(targetId ?? '')) fail('joined-connection-invalid');
    const endpoint = origin(api);
    // Do not search personal profiles, start a browser, discover open ports or
    // navigate to the requested app to fabricate an existing user session.
    try {
      for (const key of ['DEBUG', 'PWDEBUG', 'DEBUG_FILE']) delete process.env[key];
      const artifactsDir = join(repositoryRoot, 'output', 'browser', 'agent-test-wallets', 'joined-transport');
      await mkdir(artifactsDir, { recursive: true });
      const chromium = this.connect ? undefined : (await import('playwright')).chromium;
      const connect = this.connect ?? chromium.connectOverCDP.bind(chromium);
      this.browser = await connect(endpoint, { timeout: 10000, noDefaults: true, artifactsDir });
      const root = await this.browser.newBrowserCDPSession();
      try {
        const { targetInfo } = await root.send('Target.getTargetInfo', { targetId });
        if (targetInfo.type !== 'page') fail('joined-page-unavailable');
        validateDestination(targetInfo.url, this.origin);
      } finally { await root.detach(); }
      for (const context of this.browser.contexts()) for (const page of context.pages()) {
        // Inspect protocol identity, not page contents, and only for candidate
        // URLs. A URL alone is insufficient when two tabs share the destination.
        if (page.url() !== `${this.origin}${path}`) continue;
        const session = await context.newCDPSession(page);
        try {
          const { targetInfo } = await session.send('Target.getTargetInfo');
          if (targetInfo.targetId === targetId) this.page = page;
        } finally { await session.detach(); }
      }
      if (!this.page) fail('joined-page-unavailable');
      const observed = await this.readPublic();
      this.binding = { network: observed.network, playerId: observed.playerId, gameAddress: observed.gameAddress };
      return this.inspect();
    } catch {
      await this.detach();
      fail('joined-attachment-unavailable');
    }
  }
  async readPublic() {
    if (this.detached || !this.page || this.page.isClosed()) fail('joined-session-unavailable');
    validateDestination(this.page.url(), this.origin);
    // One synchronous public projection avoids mixing identity fields from
    // different renders. Never return arbitrary text, attributes or HTML.
    let result;
    try {
      result = await this.page.evaluate(() => {
        const card = [...document.querySelectorAll('.bis-card')].at(-1);
        const screen = card?.querySelector('h2')?.textContent;
        if (!['Account', 'Accounts Details', 'Receive', 'Assets', 'Transactions'].includes(screen) ||
            document.querySelector('[role="group"][aria-label="Private recovery phrase"]')) return null;
        const strip = document.querySelector('section[aria-label="Marketplace wallets and instructions"]');
        const ids = strip?.querySelectorAll('code[title]');
        const playerId = ids?.[0]?.getAttribute('title');
        const gameAddress = ids?.length > 1 ? ids[ids.length - 1].getAttribute('title') : null;
        const label = [...document.querySelectorAll('.bis-network-text')].at(-1)?.textContent;
        const network = label === 'Network: Signet' ? 'signet' : label === 'Network: Mutinynet' ? 'mutinynet' : null;
        if (!/^[a-f0-9]{64}$/.test(playerId ?? '') || !network ||
            gameAddress !== null && !/^tark1[a-z0-9]{20,200}$/.test(gameAddress)) return null;
        const balances = {};
        for (const [field, label] of [['totalSats', 'Total balance'], ['bitcoinSats', 'Bitcoin balance'], ['arkadeSats', 'Arkade balance']]) {
          const value = card.querySelector(`input[aria-label="${label}"]`)?.value;
          const parsed = /^\d[\d,]* sats$/.test(value ?? '') ? Number(value.replaceAll(',', '').split(' ')[0]) : null;
          balances[field] = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
        }
        return { screen, network, playerId, gameAddress, balances };
      });
    } catch { fail('joined-public-read-unavailable'); }
    if (!result) fail('joined-public-context-unavailable');
    return result;
  }
  async inspect() {
    if (this.detached) fail('joined-session-unavailable');
    if (this.invalidated) fail('joined-context-invalidated');
    let result;
    try { result = await this.readPublic(); }
    catch (error) { this.invalidated = true; throw error; }
    if (!this.binding || ['network', 'playerId', 'gameAddress'].some(key => result[key] !== this.binding[key])) {
      this.invalidated = true;
      fail('joined-context-invalidated');
    }
    if (this.invalidated) fail('joined-context-invalidated');
    return { sessionId: this.sessionId, mode: 'joined', app: 'marketplace', origin: this.origin,
      freshness: 'displayed-ui-only', ...result };
  }
  async clickPublic(screen, name) {
    // Check scope and activate the fixed, known public control in the same JS
    // turn. A locator waiting across a human account/view change must not end
    // up clicking a similarly named button in a different, private view.
    const activated = await this.page.evaluate(({ origin, binding, screen, name }) => {
      const card = [...document.querySelectorAll('.bis-card')].at(-1);
      const ids = document.querySelectorAll('section[aria-label="Marketplace wallets and instructions"] code[title]');
      const network = [...document.querySelectorAll('.bis-network-text')].at(-1)?.textContent;
      if (location.origin !== origin || location.pathname !== '/marketplace/' || location.search || location.hash ||
          card?.querySelector('h2')?.textContent !== screen || ids[0]?.getAttribute('title') !== binding.playerId ||
          (ids.length > 1 ? ids[ids.length - 1].getAttribute('title') : null) !== binding.gameAddress ||
          network !== `Network: ${binding.network === 'signet' ? 'Signet' : 'Mutinynet'}` ||
          document.querySelector('[role="group"][aria-label="Private recovery phrase"]')) return false;
      const buttons = [...card.querySelectorAll('button')].filter(button => button.textContent.trim() === name &&
        !button.disabled && button.getClientRects().length);
      if (buttons.length !== 1) return false;
      buttons[0].click();
      return true;
    }, { origin: this.origin, binding: this.binding, screen, name });
    if (!activated) { this.invalidated = true; fail('joined-context-invalidated'); }
  }
  async navigate(screen) {
    joinedRequest({ command: 'action', type: 'navigate', screen });
    let current = await this.inspect();
    for (let count = 0; current.screen !== 'Account' && count < 3; count++) {
      await this.inspect();
      await this.clickPublic(current.screen, 'Back');
      await this.page.waitForFunction(previous => [...document.querySelectorAll('.bis-card h2')].at(-1)?.textContent !== previous,
        current.screen, { timeout: 5000 });
      current = await this.inspect();
    }
    if (current.screen !== 'Account') fail('joined-navigation-unavailable');
    const buttons = screen === 'Receive' ? ['⚡ Receive'] : screen === 'Account' ? [] :
      screen === 'Accounts Details' ? ['Accounts Details'] : ['Accounts Details', screen];
    for (const name of buttons) {
      const before = await this.inspect();
      await this.clickPublic(before.screen, name);
      const expected = name === '⚡ Receive' ? 'Receive' : name;
      await this.page.waitForFunction(screen => [...document.querySelectorAll('.bis-card h2')].at(-1)?.textContent === screen,
        expected, { timeout: 5000 });
    }
    return this.inspect();
  }
  async request(request) {
    const action = joinedRequest(request);
    if (action === 'detach') { await this.detach(); return { detached: true, mode: 'joined' }; }
    return action === 'inspect' ? this.inspect() : this.navigate(request.screen);
  }
  async detach() {
    this.detached = true;
    const browser = this.browser;
    this.page = undefined; this.binding = undefined;
    // For connectOverCDP the installed library's browserProcess.close closes
    // only the transport. Never call page.close/context.close or Browser.close
    // through CDP. Isolated Chromium acceptance verifies the original survives.
    if (browser) {
      try { await browser.close(); }
      catch { if (browser.isConnected?.() !== false) fail('joined-detach-unavailable'); }
    }
    this.browser = undefined;
  }
  async close() { await this.detach(); }
}

