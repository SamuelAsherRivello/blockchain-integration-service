import { fail } from './errors.ts';

const consentCopy = 'Lock 1,000 sats from your selected Game Wallet on Signet for this treasure offer?';
const publicSignetIdentityUrl = 'https://bis-server-rho.vercel.app/api/bis/identity?network=signet';

async function readPublicSignetProfileId() {
  let response;
  try { response = await fetch(publicSignetIdentityUrl, { signal: AbortSignal.timeout(5000), cache: 'no-store' }); }
  catch { fail('treasure-server-identity-unavailable'); }
  if (!response.ok) fail('treasure-server-identity-unavailable');
  const identity = await response.json().catch(() => undefined);
  if (identity?.network !== 'signet' || !/^[a-f0-9]{64}$/.test(identity.profileId ?? '') ||
      !['sign', 'signMessage', 'signerSession'].every(capability => identity.capabilities?.includes(capability)))
    fail('treasure-server-identity-unavailable');
  return identity.profileId;
}

export function validateSignetTreasureConsent(consent: any, expected: { playerId: string; gameId: string; now?: number }) {
  const now = expected.now ?? Date.now();
  if (!consent || consent.status !== 'awaiting-consent' || consent.network !== 'signet' || consent.amountSats !== 1000 ||
      consent.playerId !== expected.playerId || consent.gameId !== expected.gameId || consent.gameSource !== 'server' ||
      !Number.isSafeInteger(consent.startedAt) || !Number.isSafeInteger(consent.expiresAt) ||
      consent.expiresAt !== (Math.floor(consent.startedAt / 1000) + 90) * 1000 || consent.expiresAt <= now + 5000 ||
      consent.fundingConsentOpen !== true || consent.visibleCopy !== consentCopy) fail('treasure-consent-not-approved-for-acceptance');
  return { network: 'signet', amountSats: 1000, remainingSeconds: Math.ceil((consent.expiresAt - now) / 1000) };
}

export async function acceptSignetTreasureConsent(owner) {
  let before = await owner.inspect();
  if (before.treasure?.status === 'unknown' || before.treasure?.status === 'no-offer')
    before = await owner.startGameForAcceptance();
  const { pair, player, game, application } = owner.registration;
  if (application.app !== 'game' || application.origin !== 'https://samuelasherrivello.github.io' || pair.network !== 'signet' ||
      before.network !== 'signet' || before.game?.source !== 'server' || before.treasure?.status !== 'awaiting-consent' ||
      before.treasure?.hasContract || !before.treasure?.fundingConsentOpen) fail('treasure-consent-context-unavailable');

  // The server's stable public profile ID is the game wallet identity; its
  // endpoint returns public metadata only and never a token or signing data.
  const expectedGameId = await readPublicSignetProfileId();
  const consent = await owner.page.evaluate(({ playerId, gameId }) => {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem('stealth-steel-treasure-session-v1') ?? 'null'); } catch {}
    const content = [...document.querySelectorAll('.treasure-content')].find(element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    });
    const visibleButton = [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Fund 1,000 sats' &&
      button.getClientRects().length > 0 && !button.disabled);
    return { status: saved?.status, network: saved?.network, amountSats: 1000, playerId: saved?.playerId, gameId: saved?.gameId,
      gameSource: saved?.gameSource, startedAt: saved?.startedAt, expiresAt: saved?.expiresAt,
      fundingConsentOpen: !!content && visibleButton,
      visibleCopy: content?.textContent?.includes(`Lock 1,000 sats from your selected Game Wallet on Signet for this treasure offer?`) ?
        'Lock 1,000 sats from your selected Game Wallet on Signet for this treasure offer?' : undefined,
      identityMatches: saved?.playerId === playerId && saved?.gameId === gameId };
  }, { playerId: player.profileId, gameId: expectedGameId });
  if (!consent.identityMatches) fail('treasure-consent-identity-mismatch');
  const budget = validateSignetTreasureConsent(consent, { playerId: player.profileId, gameId: expectedGameId });
  const button = owner.page.getByRole('button', { name: 'Fund 1,000 sats', exact: true });
  if (await button.count() !== 1 || !await button.isVisible() || !await button.isEnabled()) fail('treasure-consent-control-unavailable');

  // This is the one reviewed external action. A timeout never retries the click.
  await button.click();
  await owner.page.waitForFunction(() => {
    try { return JSON.parse(sessionStorage.getItem('stealth-steel-treasure-session-v1') ?? 'null')?.status !== 'awaiting-consent'; }
    catch { return false; }
  }, undefined, { timeout: 20000 }).catch(() => {});
  return { authorization: budget, result: await owner.inspect() };
}

export async function inspectSignetTreasureContracts(owner) {
  let before;
  try { before = await owner.inspect(); } catch { fail('treasure-contract-inspection-base-failed'); }
  if (owner.registration.application.app !== 'game' || owner.registration.pair.network !== 'signet' ||
      before.network !== 'signet' || before.game?.source !== 'server') fail('treasure-contract-inspection-context-unavailable');
  let view;
  try { view = before.screen === 'Contracts' ? before : await owner.navigate('Contracts'); }
  catch { fail('treasure-contract-inspection-navigation-failed'); }
  if (view.contracts?.unavailable) fail('treasure-contract-inspection-unavailable');
  try { await owner.page.locator('.bis-collection[aria-busy="false"]').waitFor({ timeout: 30000 }); }
  catch { fail('treasure-contract-inspection-list-failed'); }
  const items = owner.page.locator('.bis-collection-list > li > button.bis-collection-item');
  const count = await items.count();
  if (count !== 1) return { network: 'signet', rowCount: count, ambiguous: count > 1 };
  const rowText = (await items.first().innerText()).replace(/\s+/g, ' ').slice(0, 500);
  if (!rowText.includes('Signet') || !rowText.includes('1,000 sats')) fail('treasure-contract-row-mismatch');
  await items.first().click();
  await owner.page.getByRole('heading', { name: 'Contract Details', exact: true }).waitFor({ timeout: 10000 });
  let text;
  try { text = await owner.page.locator('.bis-card textarea[aria-label="Contract"]').inputValue(); }
  catch { fail('treasure-contract-inspection-report-failed'); }
  if (typeof text !== 'string' || text.length > 1_000_000) fail('treasure-contract-inspection-unavailable');
  const rows = text.trim() ? text.split('\n\n').map(block => {
    const field = key => block.split('\n').find(line => line.startsWith(`${key}: `))?.slice(key.length + 2);
    const amount = field('Amount')?.match(/^([0-9]+) sats$/)?.[1];
    const transactionId = field('Current transaction');
    return { id: field('Contract ID'), network: field('Network'), role: field('Role'), amountSats: amount ? Number(amount) : undefined,
      financial: field('Funds'), evidence: field('Evidence'), operationId: field('Operation'), transactionId };
  }) : [];
  const token = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value);
  const actions = await owner.page.evaluate(() => Object.fromEntries(['Claim', 'Reject'].map(name => {
    const button = [...document.querySelectorAll('.bis-card button')].find(element => element.textContent?.trim() === name);
    return [name.toLowerCase(), button ? !button.disabled : false];
  })));
  const safeRows = rows.filter(row => row.network === 'Signet' && token(row.id) &&
    ['player', 'game'].includes(row.role) && Number.isSafeInteger(row.amountSats) && row.amountSats > 0).map(row => ({
      id: row.id, role: row.role, amountSats: row.amountSats,
      financial: ['funding', 'funded', 'claiming', 'claimed', 'refunding', 'refunded', 'pending', 'failed', 'unknown'].includes(row.financial) ? row.financial : 'unverified',
      evidence: ['verified receipt', 'unverified', 'pending', 'none', 'unknown'].includes(row.evidence) ? row.evidence : 'unverified',
      operationId: token(row.operationId) ? row.operationId : undefined,
      transactionId: typeof row.transactionId === 'string' && /^[a-f0-9]{64}$/.test(row.transactionId) ? row.transactionId : undefined,
    }));
  const journal = safeRows.length === 1 ? await inspectSignetTreasureJournal(owner, safeRows[0].id) : undefined;
  return { network: 'signet', rows: safeRows, actions, ...(journal ? { journal } : {}) };
}

export async function inspectSignetTreasureJournal(owner, contractId) {
  if (typeof contractId !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(contractId) ||
      owner.registration.application.app !== 'game' || owner.registration.pair.network !== 'signet')
    fail('treasure-journal-inspection-context-unavailable');
  try {
    return await owner.page.evaluate(async id => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('bis-contract-recovery-signet-v1', 1);
        request.onerror = request.onblocked = () => reject(Error('database-unavailable'));
        request.onsuccess = () => resolve(request.result);
      });
      try {
        const envelope = await new Promise((resolve, reject) => {
          const transaction = database.transaction('recovery', 'readonly');
          const request = transaction.objectStore('recovery').get('current');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(Error('journal-unavailable'));
        });
        if (!envelope) return { available: true, found: false };
        if (envelope.version !== 1 || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1 ||
            !(envelope.key instanceof CryptoKey) || envelope.key.extractable) return { available: false };
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.iv,
          additionalData: new TextEncoder().encode(`bis-contract-recovery-signet-v1:${envelope.revision}`) }, envelope.key, envelope.encrypted);
        const document = JSON.parse(new TextDecoder().decode(plain));
        const record = document?.ledger?.contracts?.find(row => row.id === id);
        if (!record) return { available: true, found: false, revision: envelope.revision };
        const recovery = document.recovery?.[id];
        const journals = recovery?.treasureServerJournals;
        return {
          available: true, found: true, revision: envelope.revision,
          network: record.scope?.network, amountSats: record.amountSats, financial: record.financial,
          operation: { id: record.operation?.id, kind: record.operation?.kind,
            submission: record.operation?.submission, failure: record.operation?.failure },
          evidence: { spendPrepared: !!recovery?.spend, operatorSubmissionRecorded: !!recovery?.submission,
            finalizationRecorded: !!recovery?.finalization, fundingOutputRecorded: !!recovery?.fundingOutput,
            stagePhase: recovery?.treasureStage?.state?.phase,
            serverJournalCount: journals && typeof journals === 'object' ? Object.keys(journals).length : 0,
            serverRequests: journals && typeof journals === 'object' ? Object.values(journals).flatMap(journal =>
              Array.isArray(journal?.requests) ? journal.requests.map(request => ({ purpose: request.purpose, phase: request.phase })) : []) : [] },
        };
      } finally { database.close(); }
    }, contractId);
  } catch { fail('treasure-journal-inspection-unavailable'); }
}
