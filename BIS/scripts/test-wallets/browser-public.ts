import { fail } from './errors.ts';

export const publicScreens = ['Account', 'Accounts Details', 'Developer', 'Game Wallet', 'Send', 'Swap', 'Receive', 'Assets', 'Asset Detail', 'Transactions', 'Transaction Detail', 'Contracts', 'Contract Details'];
export function browserEnvironment(env = process.env) {
  const keys = new Set(['SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'TEMP', 'TMP', 'PATH', 'PATHEXT',
    'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMDATA',
    'HOMEDRIVE', 'HOMEPATH', 'COMSPEC']);
  return Object.fromEntries(Object.entries(env).filter(([key]) => keys.has(key.toUpperCase())));
}
export function validatePayment(request) {
  const funding = request?.scenario === 'funding';
  if (!request || Object.keys(request).some(key => !['command', 'scenario', 'operation', 'amountSats', ...(funding ? ['recipientAccount'] : [])].includes(key)) ||
      request.command !== 'run' || !['payment', 'funding'].includes(request.scenario) ||
      (funding && !/^[a-z][a-z0-9-]{0,47}$/.test(request.recipientAccount ?? '')) ||
      !/^[a-z][a-z0-9-]{0,47}$/.test(request.operation ?? '') ||
      !Number.isSafeInteger(request.amountSats) || request.amountSats <= 0) fail('invalid-payment-request');
  return request;
}
export function validateLifecycle(request, scenario) {
  if (!request || request.command !== 'run' || request.scenario !== scenario ||
      !['reload', 'logout', 'restore'].includes(scenario) ||
      Object.keys(request).some(key => !['command', 'scenario'].includes(key))) fail('invalid-lifecycle-request');
}

export async function readLogoutCount(page) {
  try {
    // Use the production cleanup classifier, returning only its public count.
    // Do not export journals or reimplement its changing recovery semantics.
    const count = await page.evaluate(async () => {
      let pendingLogoutOperations;
      if (location.pathname === '/blockchain-stealth-and-steel-game/') {
        // Reuse the already loaded public package entry, not BIS repository
        // source paths or a second context that could restore signing state.
        const entries = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name))]
          .map(name => new URL(name)).filter(url => url.origin === location.origin &&
            (/\/node_modules\/\.vite\/deps\/@bis_integration\.js$/.test(url.pathname) ||
             /\/node_modules\/@bis\/integration\/src\/index\.ts$/.test(url.pathname)));
        if (entries.length !== 1) throw Error('Public package entry unavailable.');
        ({ pendingLogoutOperations } = await import(entries[0].href));
        if (typeof pendingLogoutOperations !== 'function') throw Error('Public classifier unavailable.');
      } else {
        ({ pendingLogoutOperations } = await import('/BIS/packages/integration/src/client/state-layer-core/logout-cleanup.ts'));
      }
      // Player logout clears all retained Game identities. Include those
      // journals in the classifier using a read-only view, without changing
      // any ownership marker or exposing stored values to the runner.
      const ownerPrefixes = ['boarding', 'send', 'mint', 'burn', 'delivery'].map(kind => `bis-game-wallet-${kind}-owner:`);
      const view = { get length() { return localStorage.length; }, key: index => localStorage.key(index),
        getItem: key => ownerPrefixes.some(prefix => key.startsWith(prefix)) ? null : localStorage.getItem(key) };
      return pendingLogoutOperations(view).count;
    });
    if (!Number.isSafeInteger(count) || count < 0) fail('logout-readiness-unavailable');
    return count;
  } catch { fail('logout-readiness-unavailable'); }
}
export function matchingSend(rows, operation) {
  const intent = operation.intent;
  const matches = rows.filter(row => row.profileId === intent.profileId && row.network === intent.network &&
    row.recipient === intent.recipient && row.amountSats === intent.amountSats && row.feeSats === intent.feeSats &&
    !intent.priorProviderIds.includes(row.transactionId));
  if (matches.length > 1) fail('payment-journal-ambiguous');
  return matches[0];
}
export async function readPaymentReview(page) {
  return page.locator('.bis-review').evaluate(element => {
    const rows = Object.fromEntries([...element.querySelectorAll('dl > div')].map(row => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent]));
    const sats = value => /^\d[\d,]* sats$/.test(value ?? '') ? Number(value.replaceAll(',', '').split(' ')[0]) : null;
    return { amountSats: sats(rows.Amount), feeSats: sats(rows.Fee), totalSats: sats(rows['Total deducted']),
      network: rows.Network, recipient: element.querySelector('.bis-send-address')?.textContent };
  });
}
export function assertPaymentReview(quote, intent) {
  if (quote.amountSats !== intent.amountSats || quote.recipient !== intent.recipient ||
      quote.network !== (intent.network === 'signet' ? 'Signet' : 'Mutinynet') ||
      !Number.isSafeInteger(quote.feeSats) || quote.feeSats < 0 || quote.feeSats !== intent.feeSats ||
      quote.totalSats !== intent.amountSats + intent.feeSats) fail('payment-review-mismatch');
}

// Deliberately scoped to public Send journals, never browser secret stores.
// Only the validated public projection leaves the browser; no storage dump.
export async function publicSends(page, profileId, network) {
  const records = await page.evaluate(({ profileId, network }) => {
    const root = `bis-${network}-send-operation-v1:${encodeURIComponent(profileId)}`;
    const keys = [root];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${root}:operation:`)) keys.push(key);
    }
    if (keys.length > 1000) return null;
    const result = [];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      let record;
      try { record = JSON.parse(raw); } catch { return null; }
      const q = record?.quote;
      if (record?.profileId !== profileId || (record.network ?? 'signet') !== network ||
          !['pending', 'succeeded'].includes(record.status) || !/^[a-f0-9]{64}$/.test(record.transactionId ?? '') ||
          q?.profileId !== profileId || !/^tark1[a-z0-9]{20,295}$/.test(q?.recipient ?? '') ||
          !Number.isSafeInteger(q.amountSats) || q.amountSats <= 0 || !Number.isSafeInteger(q.feeSats) || q.feeSats < 0) return null;
      result.push({ profileId, network, transactionId: record.transactionId, recipient: q.recipient,
        amountSats: q.amountSats, feeSats: q.feeSats, status: record.status });
    }
    return result;
  }, { profileId, network });
  if (!Array.isArray(records)) fail('payment-journal-unavailable');
  return records;
}

