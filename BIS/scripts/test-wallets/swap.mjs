import { MnemonicIdentity, ReadonlyWallet, RestArkProvider, RestIndexerProvider, InMemoryWalletRepository, InMemoryContractRepository } from '@arkade-os/sdk';
import { operatorFor, requireNetwork, withTemporaryWallet } from '../../packages/integration/src/client/wallet-layer-arkade/account.ts';
import { verifiedBoardingCommitment } from '../../packages/integration/src/client/state-layer-core/boarding-reconciliation.ts';
import { Operations } from './operations.mjs';
import { fail } from './errors.mjs';

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sats = value => Number.isSafeInteger(value) && value >= 0;
export async function readSwapState(page) {
  return page.evaluate(() => {
    const card=[...document.querySelectorAll('.bis-card')].at(-1);
    if(card?.querySelector('h2')?.textContent!=='Swap')return null;
    const button=name=>[...card.querySelectorAll('button')].find(el=>el.textContent===name);
    const status=[...card.querySelectorAll('.bis-transfer-status')].map(el=>el.textContent??'');
    const direction=card.querySelector('.bis-balance-direction')?.getAttribute('aria-label');
    return {direction:direction?.startsWith('Arkade → Bitcoin.')?'to-bitcoin':direction?.startsWith('Bitcoin → Arkade.')?'to-arkade':'unknown',
      reviewEnabled:button('Review Transfer')?.disabled===false,confirmEnabled:button('Confirm Transfer')?.disabled===false,
      checkStatusAvailable:!!button('Check Status'),
      availability:status.some(text=>text.startsWith('Operator policy verification'))?'policy-unavailable':
        status.some(text=>text.startsWith('No eligible unreserved funds'))?'insufficient-funds':
        status.some(text=>text.startsWith('Pending wallet operations reserve'))?'reserved-inputs':
        status.some(text=>text.startsWith('Amount exceeds'))?'amount-exceeds-available':'unknown'};
  });
}
export function validateSwap(request) {
  if (!request || Object.keys(request).some(key => !['command', 'scenario', 'operation', 'amountSats'].includes(key)) ||
      request.command !== 'run' || request.scenario !== 'swap-to-bitcoin' ||
      !/^[a-z][a-z0-9-]{0,47}$/.test(request.operation ?? '') || !sats(request.amountSats) || request.amountSats === 0)
    fail('invalid-swap-request');
}
export async function readSwapReview(page) {
  return page.locator('.bis-review').evaluate(element => {
    const rows = Object.fromEntries([...element.querySelectorAll('dl > div')].map(row => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent]));
    const sats = value => /^\d[\d,]* sats$/.test(value ?? '') ? Number(value.replaceAll(',', '').split(' ')[0]) : null;
    return { direction: element.querySelector('h3')?.textContent === 'Review: Arkade → Bitcoin' ? 'to-bitcoin' : null,
      amountSats: sats(rows.Amount), feeSats: sats(rows.Fee), netSats: sats(rows['Added to Bitcoin']),
      quoteFingerprint: element.getAttribute('data-bis-quote-fingerprint'),
      quoteExpiresAt: Number(element.getAttribute('data-bis-quote-expires-at')) };
  });
}
export function assertSwapReview(review, intent, now = Date.now()) {
  if (review?.direction !== 'to-bitcoin' || review.amountSats !== intent.amountSats || !sats(review.feeSats) ||
      review.feeSats !== intent.feeSats || !sats(review.netSats) || review.netSats === 0 ||
      review.netSats !== intent.netSats || review.amountSats !== review.feeSats + review.netSats ||
      !hex(review.quoteFingerprint) || review.quoteFingerprint !== intent.quoteFingerprint ||
      !sats(review.quoteExpiresAt) || review.quoteExpiresAt <= now || review.quoteExpiresAt !== intent.quoteExpiresAt)
    fail('swap-review-mismatch');
}

export async function publicBoardings(page, profileId, network) {
  try {
    const records = await page.evaluate(async ({ profileId, network }) => {
      const { readBoardingRecords } = await import('/BIS/packages/integration/src/client/state-layer-core/boarding-record.ts');
      const rows = readBoardingRecords(profileId, network);
      if (rows.length > 1000) return null;
      return rows.map(row => {
        if (!/^[A-Za-z0-9:_-]{1,300}$/.test(row.id) || (row.network ?? 'signet') !== network || row.inputs.length > 1000 ||
            (row.assetChange?.assets.length ?? 0) > 1000) throw Error('Invalid public transfer scope.');
        const q = row.quote;
        return { version: 1, id: row.id, profileId, network, status: row.status, phase: row.phase,
          bitcoinAddress: row.bitcoinAddress, commitmentTxid: row.commitmentTxid,
          inputs: row.inputs.map(({ txid, vout }) => ({ txid, vout })),
          quote: { profileId, direction: q.direction, amountSats: q.amountSats, feeSats: q.feeSats, netSats: q.netSats,
            maxSats: q.maxSats, inputSats: q.inputSats, bitcoinAfterSats: q.bitcoinAfterSats,
            arkadeAfterSats: q.arkadeAfterSats, totalAfterSats: q.totalAfterSats, expiresAt: q.expiresAt, fingerprint: q.fingerprint },
          ...(row.assetChange ? { assetChange: { script: row.assetChange.script, sats: row.assetChange.sats,
            assets: row.assetChange.assets.map(({ assetId, amount }) => ({ assetId, amount })) } } : {}) };
      });
    }, { profileId, network });
    if (!Array.isArray(records)) fail('swap-journal-unavailable');
    return records;
  } catch { fail('swap-journal-unavailable'); }
}
export function matchingSwap(rows, operation) {
  const i = operation.intent;
  const matches = rows.filter(row => row.profileId === i.profileId && row.network === i.network && row.bitcoinAddress === i.recipient &&
    row.quote.direction === 'to-bitcoin' && row.quote.amountSats === i.amountSats && row.quote.feeSats === i.feeSats &&
    row.quote.netSats === i.netSats && row.quote.fingerprint === i.quoteFingerprint && !i.priorOperationIds.includes(row.id) &&
    (operation.providerId === undefined || row.id === operation.providerId));
  if (matches.length > 1) fail('swap-journal-ambiguous');
  return matches[0];
}

// Read-only SDK capabilities only. The installed production receipt verifier
// requires consumed inputs, exact confirmed Bitcoin and exact Arkade/asset change.
export async function observeSwapReceipt(account, operation, rows) {
  const record = matchingSwap(rows, operation);
  if (!record || record.status === 'not-submitted' || record.phase === 'prepared') return undefined;
  const signal = AbortSignal.timeout(30000), network = operation.intent.network;
  const provider = new RestArkProvider(operatorFor(network)), indexer = new RestIndexerProvider(operatorFor(network));
  const getInfo = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const info = await getInfo(); requireNetwork(info.network, network); return info; };
  let healthy = true;
  const getVtxos = indexer.getVtxos.bind(indexer);
  indexer.getVtxos = async (...args) => { try { return await getVtxos(...args); } catch (error) { healthy = false; throw error; } };
  return withTemporaryWallet(ReadonlyWallet.create({
    identity: await MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }).toReadonly(),
    arkProvider: provider, indexerProvider: indexer, settlementConfig: false,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  }), signal, async wallet => {
    if (await wallet.getBoardingAddress() !== operation.intent.recipient) fail('swap-recipient-mismatch');
    const outpoints = [...new Map(rows.filter(row => row.status !== 'not-submitted' && row.quote.direction === 'to-bitcoin')
      .flatMap(row => row.inputs).map(coin => [`${coin.txid}:${coin.vout}`, coin])).values()];
    const [transactions, receipts, consumed] = await Promise.all([wallet.onchainProvider.getTransactions(record.bitcoinAddress),
      wallet.getVtxos(), indexer.getVtxos({ outpoints }).then(result => result.vtxos)]);
    signal.throwIfAborted();
    const connection = wallet.getProviderConnectionState();
    if (!healthy || connection.mode !== 'online' || connection.source !== 'live') return undefined;
    const commitment = verifiedBoardingCommitment(record, transactions, receipts, consumed, rows);
    return hex(commitment) ? { id: operation.intent.id, fingerprint: operation.fingerprint,
      providerId: record.id, outcome: 'settled', verified: true } : undefined;
  });
}

export async function runSwap(owner, request, adapters = {}) {
  validateSwap(request);
  if (owner.loggedOut) fail('owned-session-logged-out');
  await owner.inspect();
  const { player, pair, application } = owner.registration, recipient = owner.expected.player.bitcoinAddress;
  const ledger = new Operations(owner.vault), readRecords = adapters.records ?? publicBoardings, readReview = adapters.review ?? readSwapReview;
  let operation = (await ledger.list()).find(row => row.intent.id === request.operation);
  if (operation) {
    const i = operation.intent;
    if (i.kind !== 'swap-to-bitcoin' || i.account !== player.label || i.profileId !== player.profileId || i.generation !== player.generation ||
        i.network !== pair.network || i.recipient !== recipient || i.amountSats !== request.amountSats || i.sourceOrigin !== application.origin)
      fail('operation-intent-conflict');
  } else {
    const prior = await readRecords(owner.page, player.profileId, pair.network);
    if (prior.some(row => row.status === 'pending')) fail('swap-operation-unresolved');
    try { await owner.navigate('Swap'); } catch { fail('swap-navigation-unavailable'); }
    try { await owner.page.getByRole('button', { name: 'Bitcoin → Arkade. Toggle transfer direction', exact: true }).click(); }
    catch { fail('swap-direction-unavailable'); }
    try { await owner.page.getByLabel('Amount (sats)', { exact: true }).fill(String(request.amountSats)); }
    catch { fail('swap-amount-unavailable'); }
    try { await owner.page.getByRole('button', { name: 'Review Transfer', exact: true }).click(); }
    catch { fail('swap-review-control-unavailable'); }
    try { await owner.page.getByRole('heading', { name: 'Review: Arkade → Bitcoin', exact: true }).waitFor(); }
    catch { fail('swap-quote-unavailable'); }
    const review = await readReview(owner.page);
    assertSwapReview(review, { ...review, amountSats: request.amountSats });
    operation = await ledger.prepare({ id: request.operation, account: player.label, profileId: player.profileId,
      generation: player.generation, network: pair.network, kind: 'swap-to-bitcoin', recipient, amountSats: request.amountSats,
      feeSats: review.feeSats, netSats: review.netSats, quoteFingerprint: review.quoteFingerprint, quoteExpiresAt: review.quoteExpiresAt,
      sourceOrigin: application.origin, priorOperationIds: prior.map(row => row.id) });
  }
  if (operation.state === 'prepared') {
    if (!await owner.page.getByRole('heading', { name: 'Review: Arkade → Bitcoin', exact: true }).isVisible()) fail('swap-review-required');
    assertSwapReview(await readReview(owner.page), operation.intent);
    operation = await ledger.submit(request.operation, async record => {
      await owner.inspect();
      assertSwapReview(await readReview(owner.page), record.intent);
      const before = await readRecords(owner.page, player.profileId, pair.network);
      if (before.some(row => row.status === 'pending')) fail('swap-operation-unresolved');
      await owner.page.getByRole('button', { name: 'Confirm Transfer', exact: true }).click();
      const deadline = Date.now() + 30000;
      do {
        const match = matchingSwap(await readRecords(owner.page, player.profileId, pair.network), record);
        if (match && match.phase !== 'prepared') return { providerId: match.id };
        await owner.page.waitForTimeout(500);
      } while (Date.now() < deadline);
      fail('swap-acknowledgement-unavailable');
    });
  }
  if (['pending', 'unknown', 'submitting'].includes(operation.state)) {
    try {
      await owner.inspect();
      const rows = await readRecords(owner.page, player.profileId, pair.network), match = matchingSwap(rows, operation);
      if (match) {
        const observed = { ...operation, providerId: match.id };
        const evidence = await (adapters.receipt ?? observeSwapReceipt)({ ...player, network: pair.network }, observed, rows);
        operation = await ledger.reconcile(request.operation, async () => evidence ?? {
          id: operation.intent.id, fingerprint: operation.fingerprint, providerId: match.id, outcome: 'pending' });
      }
    } catch { /* Unknown is retained; never submit a replacement because a read failed. */ }
  }
  return { operation, readiness: operation.state === 'settled' ? 'bitcoin-swap-verified' : 'pending' };
}
