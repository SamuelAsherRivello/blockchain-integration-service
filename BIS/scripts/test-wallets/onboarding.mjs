import { MnemonicIdentity, ReadonlyWallet, RestArkProvider, RestIndexerProvider,
  InMemoryWalletRepository, InMemoryContractRepository, CSVMultisigTapscript, hasBoardingTxExpired } from '@arkade-os/sdk';
import { operatorFor, requireNetwork, withTemporaryWallet } from '../../packages/integration/src/client/wallet-layer-arkade/account.ts';
import { loadBalance } from '../../packages/integration/src/client/wallet-layer-arkade/balance.ts';
import { verifiedReceipt } from '../../packages/prototype-onboarding/src/client/operation-layer/model.js';
import { Operations } from './operations.mjs';
import { origin, network } from './arguments.mjs';
import { boundedObservation } from './readiness.mjs';
import { restoreOnboardingUI, onboardingControls, assertFreshOnboarding } from './onboarding-ui.mjs';
import { fail } from './errors.mjs';

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sats = value => Number.isSafeInteger(value) && value >= 0;
const terminal = new Set(['settled', 'failed', 'cancelled']);
export function validateOnboard(request) {
  if (!request || request.command !== 'run' || request.scenario !== 'onboard-half' ||
      Object.keys(request).some(key => !['command', 'scenario', 'operation'].includes(key)) ||
      !/^[a-z][a-z0-9-]{0,47}$/.test(request.operation ?? '')) fail('invalid-onboarding-request');
}

// Every call has its own bounded, read-only SDK lifetime. No shared browser
// repositories, journals, signer objects or recovery values cross this seam.
async function readWallet(account, signal, use) {
  const selectedNetwork = network(account.network), provider = new RestArkProvider(operatorFor(selectedNetwork));
  const info = provider.getInfo.bind(provider);
  provider.getInfo = async () => { const value = await info(); requireNetwork(value.network, selectedNetwork); return value; };
  const indexer = new RestIndexerProvider(operatorFor(selectedNetwork));
  let healthy = true;
  const getVtxos = indexer.getVtxos.bind(indexer);
  indexer.getVtxos = async (...args) => { try { return await getVtxos(...args); } catch (error) { healthy = false; throw error; } };
  return withTemporaryWallet(ReadonlyWallet.create({
    identity: await MnemonicIdentity.fromMnemonic(account.phrase, { isMainnet: false }).toReadonly(),
    arkProvider: provider, indexerProvider: indexer, settlementConfig: false,
    storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() },
  }), signal, async wallet => {
    await provider.getInfo();
    const result = await use(wallet);
    signal.throwIfAborted();
    const connection = wallet.getProviderConnectionState();
    if (!healthy || connection.mode !== 'online' || connection.source !== 'live') fail('onboarding-live-evidence-unavailable');
    return result;
  }, 30000);
}

export async function captureOnboardingInputs(account, signal) {
  return readWallet(account, signal, async wallet => {
    const [recipient, coins, tip, info] = await Promise.all([
      wallet.getBoardingAddress(), wallet.getBoardingUtxos(), wallet.onchainProvider.getChainTip(), wallet.arkProvider.getInfo(),
    ]);
    if (info.fees?.txFeeRate !== '0' || !info.fees?.intentFee ||
        Object.values(info.fees.intentFee).some(value => value !== '' && value !== '0')) fail('onboarding-fee-policy-unavailable');
    const exit = CSVMultisigTapscript.decode(Uint8Array.from(wallet.boardingTapscript.exitScript.match(/.{2}/g), value => parseInt(value, 16)));
    if (!Number.isSafeInteger(tip?.height) || tip.height < 0 || !Array.isArray(coins) || !coins.length ||
        coins.some(coin => coin.status?.confirmed !== true || !sats(coin.status.block_time) || coin.status.block_time === 0 ||
        exit.params.timelock.type === 'blocks' && (!sats(coin.status.block_height) || coin.status.block_height === 0) ||
        hasBoardingTxExpired(coin, exit.params.timelock, tip.height))) fail('onboarding-funding-not-eligible');
    return { network: account.network, profileId: account.profileId, recipient,
      inputs: coins.map(({ txid, vout, value }) => ({ txid, vout, value })) };
  });
}

export function assertOnboardingWindow(value, operation) {
  const url = new URL(value), intent = operation.intent;
  if (url.origin !== intent.sourceOrigin || url.pathname !== '/onboarding/' ||
      url.searchParams.get('network') !== intent.network || url.searchParams.get('window') !== intent.id ||
      [...url.searchParams.keys()].some(key => !['network', 'window', 'btcAddress'].includes(key) || url.searchParams.getAll(key).length !== 1) ||
      url.searchParams.has('btcAddress') && url.searchParams.get('btcAddress') !== intent.recipient ||
      url.hash || url.username || url.password) fail('onboarding-window-mismatch');
}

// Read only rendered public fields. Never inspect IndexedDB, browser storage,
// recovery input contents, serialized operation state or arbitrary page text.
export async function publicOnboardingSettlement(page, operation) {
  assertOnboardingWindow(page.url(), operation);
  const controls = await onboardingControls(page);
  if (controls.network !== operation.intent.network || controls.percent !== '50' ||
      controls.address !== operation.intent.recipient || !controls.secretHidden) fail('onboarding-context-mismatch');
  const amount = async selector => {
    const value = (await page.locator(selector).textContent())?.trim();
    if (!/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*) sats$/.test(value ?? '')) return undefined;
    const parsed = Number(value.replace(/,| sats/g, ''));
    return sats(parsed) ? parsed : undefined;
  };
  const cards = await page.locator('#settlement-transactions .transaction-card').evaluateAll(nodes => nodes.slice(0, 3).map(node => ({
    label: node.querySelector('strong')?.textContent,
    txid: node.querySelector('a.transaction-id')?.textContent,
  })));
  const providerId = (await page.locator('#intent').textContent())?.trim();
  return { network: controls.network, profileId: operation.intent.profileId, recipient: controls.address,
    target: await amount('#target'), fee: await amount('#fee'), change: await amount('#change'),
    ...(typeof providerId === 'string' && /^[A-Za-z0-9:_-]{1,300}$/.test(providerId) ? { providerId } : {}),
    boardingCommitment: cards.find(row => row.label === '1 · Bitcoin to Arkade')?.txid,
    commitment: cards.find(row => row.label === '2 · Bitcoin remainder returned')?.txid };
}

export function verifyOnboardingSettlement(operation, presentation, evidence) {
  const intent = operation.intent;
  if (intent.kind !== 'onboard' || intent.percent !== 50 || !presentation || !evidence ||
      [presentation, evidence].some(row => row.network !== intent.network || row.profileId !== intent.profileId || row.recipient !== intent.recipient) ||
      presentation.target !== intent.amountSats || presentation.fee !== 0 ||
      presentation.change !== intent.capturedInputs.reduce((sum, coin) => sum + coin.value, 0) - intent.amountSats ||
      !hex(presentation.boardingCommitment) || !hex(presentation.commitment) ||
      presentation.boardingCommitment === presentation.commitment || evidence.live !== true ||
      !Array.isArray(evidence.transactions) || !Array.isArray(evidence.receipts) ||
      [presentation.boardingCommitment, presentation.commitment].some(id => evidence.transactions.filter(tx => tx?.txid === id).length !== 1)) return undefined;
  try {
    const commitment = verifiedReceipt({ inputs: intent.capturedInputs, target: intent.amountSats,
      change: presentation.change, mode: 'board-then-return', boardingCommitment: presentation.boardingCommitment,
      commitment: presentation.commitment }, evidence.transactions, evidence.receipts, intent.recipient);
    return commitment === presentation.commitment ? commitment : undefined;
  } catch { return undefined; }
}

export async function observeOnboardingReceipt(account, operation, presentation, signal) {
  return readWallet(account, signal, async wallet => {
    const recipient = await wallet.getBoardingAddress();
    if (recipient !== operation.intent.recipient) fail('onboarding-recipient-mismatch');
    const [transactions, receipts] = await Promise.all([
      wallet.onchainProvider.getTransactions(recipient),
      wallet.getSpendableVtxos({ withRecoverable: false, withUnrolled: false }),
    ]);
    return { network: account.network, profileId: account.profileId, recipient, transactions, receipts, live: true };
  });
}

export async function runOnboard(owner, request, adapters = {}) {
  validateOnboard(request);
  const before = await owner.inspect();
  if (before.mode !== 'owned' || owner.loggedOut || owner.closed) fail('onboarding-owned-session-required');
  const { player, pair, application } = owner.registration;
  const selectedNetwork = network(pair.network), selectedOrigin = origin(application.origin);
  const account = { ...player, network: selectedNetwork }, ledger = new Operations(owner.vault);
  let operation = (await ledger.list()).find(row => row.intent.id === request.operation);
  if (operation) {
    const intent = operation.intent;
    if (intent.kind !== 'onboard' || intent.account !== player.label || intent.profileId !== player.profileId ||
        intent.generation !== player.generation || intent.network !== selectedNetwork || intent.sourceOrigin !== selectedOrigin)
      fail('operation-intent-conflict');
    if (terminal.has(operation.state)) return { operation, readiness: operation.state === 'settled' ? 'onboarding-verified' : 'incomplete' };
  } else {
    const signal = AbortSignal.timeout(30000);
    let captured;
    try { captured = await boundedObservation(() => (adapters.capture ?? captureOnboardingInputs)(account, signal), signal); }
    catch { return { readiness: 'unavailable', reason: 'onboarding-funding-unavailable' }; }
    if (captured?.network !== selectedNetwork || captured.profileId !== player.profileId ||
        captured.recipient !== owner.expected.player.bitcoinAddress || !Array.isArray(captured.inputs)) fail('onboarding-capture-mismatch');
    const total = captured.inputs.reduce((sum, coin) => sum + coin.value, 0);
    await owner.inspect();
    operation = await ledger.prepare({ id: request.operation, account: player.label, profileId: player.profileId,
      generation: player.generation, network: selectedNetwork, kind: 'onboard', recipient: captured.recipient,
      amountSats: Math.floor(total / 2), feeSats: 0, sourceOrigin: selectedOrigin, percent: 50, capturedInputs: captured.inputs });
  }
  let page;
  try { page = await (adapters.page ?? (record => owner.onboardingPage(record)))(operation); }
  catch { return { operation, readiness: operation.state === 'prepared' ? 'unavailable' : 'pending', reason: 'onboarding-window-unavailable' }; }
  assertOnboardingWindow(page.url(), operation);
  if (operation.state === 'prepared') {
    assertFreshOnboarding(await onboardingControls(page), operation.intent);
    // Capture once again immediately before granting the automatic route its
    // identity. Any changed input set requires a new explicit operation intent.
    const signal = AbortSignal.timeout(30000);
    let fresh;
    try { fresh = await boundedObservation(() => (adapters.capture ?? captureOnboardingInputs)(account, signal), signal); }
    catch { return { operation, readiness: 'unavailable', reason: 'onboarding-funding-unavailable' }; }
    const key = coins => JSON.stringify(coins.map(({ txid, vout, value }) => ({ txid, vout, value })).sort((a, b) => a.txid.localeCompare(b.txid) || a.vout - b.vout));
    if (fresh.network !== selectedNetwork || fresh.profileId !== player.profileId || fresh.recipient !== operation.intent.recipient ||
        !Array.isArray(fresh.inputs) || key(fresh.inputs) !== key(operation.intent.capturedInputs)) fail('onboarding-inputs-changed');
    await owner.inspect();
    operation = await (adapters.restore ?? restoreOnboardingUI)(page, ledger, operation, player.phrase);
  }
  try {
    const signal = AbortSignal.timeout(30000);
    await owner.inspect();
    const presentation = await boundedObservation(() => (adapters.presentation ?? publicOnboardingSettlement)(page, operation), signal);
    assertOnboardingWindow(page.url(), operation);
    const evidence = await boundedObservation(() => (adapters.receipt ?? observeOnboardingReceipt)(account, operation, presentation, signal), signal);
    if (!verifyOnboardingSettlement(operation, presentation, evidence)) return { operation, readiness: 'pending', reason: 'onboarding-settlement-unverified' };
    // Independent production BIS read, never the prototype's balance display.
    const balance = await boundedObservation(() => (adapters.balance ?? loadBalance)(account, signal), signal);
    if (!sats(balance?.availableArkadeSats) || balance.availableArkadeSats < operation.intent.amountSats ||
        !sats(balance.bitcoinSats) || balance.bitcoinSats < presentation.change)
      return { operation, readiness: 'pending', reason: 'bis-onboarding-readback-unavailable' };
    await owner.inspect();
    assertOnboardingWindow(page.url(), operation);
    const providerId = operation.providerId ?? presentation.providerId;
    if (!providerId) return { operation, readiness: 'pending', reason: 'onboarding-acknowledgement-unavailable' };
    operation = await ledger.reconcile(request.operation, async () => ({ id: operation.intent.id,
      fingerprint: operation.fingerprint, providerId, outcome: 'settled', verified: true, feeSats: 0 }));
    return { operation, readiness: 'onboarding-verified' };
  } catch { return { operation, readiness: 'pending', reason: 'onboarding-evidence-unavailable' }; }
}
