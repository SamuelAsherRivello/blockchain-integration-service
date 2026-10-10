import { createServer } from 'node:http';
import { configureEventSource, InMemoryContractRepository, InMemoryWalletRepository, MnemonicIdentity, Ramps, RestArkProvider, RestIndexerProvider, Wallet } from '@arkade-os/sdk';
import { createFaucetService, safeError } from '../shared/faucet-core.mjs';
import { NETWORKS, NETWORK_IDS } from '../shared/network-config.mjs';

const port = Number(process.env.FAUCET_PORT ?? 5190);
const maxBodyBytes = 16_384;

if (globalThis.EventSource) configureEventSource(url => new globalThis.EventSource(url));

function envName(network) { return network.toUpperCase(); }

function createLazyWallet(network) {
  let walletPromise;
  let preparationPromise;
  async function getWallet() {
    walletPromise ??= (async () => {
      const phrase = process.env[`FAUCET_${envName(network)}_MNEMONIC`];
      if (!phrase) return undefined;
      const provider = new RestArkProvider(NETWORKS[network].operator);
      const indexerProvider = new RestIndexerProvider(NETWORKS[network].operator);
      const identity = MnemonicIdentity.fromMnemonic(phrase, { isMainnet: false });
      return Wallet.create({ identity, arkProvider: provider, indexerProvider, settlementConfig: false, storage: { walletRepository: new InMemoryWalletRepository(), contractRepository: new InMemoryContractRepository() } });
    })();
    return walletPromise;
  }
  return {
    async prepare() {
      const wallet = await getWallet();
      if (!wallet) { const error = new Error('Funding is not configured for this network.'); error.code = 'UNAVAILABLE'; throw error; }
      const balance = await wallet.getBalance();
      if (Number(balance.available ?? 0) > 0 || Number(balance.boarding?.total ?? 0) <= 0) return balance;
      preparationPromise ??= (async () => {
        const info = await wallet.arkProvider.getInfo();
        const boarding = (await wallet.getBoardingUtxos()).filter(utxo => utxo.status?.confirmed === true);
        if (boarding.length === 0) { const error = new Error('No confirmed faucet funds are available for onboarding.'); error.code = 'UNAVAILABLE'; throw error; }
        await new Ramps(wallet).onboard(info.fees, boarding);
      })();
      try { await preparationPromise; } catch (error) { preparationPromise = undefined; throw error; }
      return wallet.getBalance();
    },
    async send({ address, amount }) {
      await this.prepare();
      const wallet = await getWallet();
      if (!wallet) { const error = new Error('Funding is not configured for this network.'); error.code = 'UNAVAILABLE'; throw error; }
      const transactionId = await wallet.send({ address, amount });
      return { operationId: transactionId, transactionId, status: 'pending' };
    },
    async balance() {
      const wallet = await getWallet();
      if (!wallet) { const error = new Error('Funding is not configured for this network.'); error.code = 'UNAVAILABLE'; throw error; }
      // Reading the faucet balance must not trigger onboarding or fee estimation.
      // A provider may be able to report wallet funds while settlement is
      // temporarily unavailable.
      const value = await wallet.getBalance();
      const sats = amount => Number(amount ?? 0n);
      return { total: sats(value.total), available: sats(value.available), settled: sats(value.settled), preconfirmed: sats(value.preconfirmed), recoverable: sats(value.recoverable) };
    },
    async addresses() {
      const wallet = await getWallet();
      if (!wallet) { const error = new Error('Funding is not configured for this network.'); error.code = 'UNAVAILABLE'; throw error; }
      return { bitcoinAddress: await wallet.getBoardingAddress(), arkadeAddress: await wallet.getAddress() };
    },
  };
}

const wallets = Object.fromEntries(NETWORK_IDS.map(network => [network, createLazyWallet(network)]));
const service = createFaucetService({
  wallets,
  infos: Object.fromEntries(NETWORK_IDS.map(network => [network, async () => new RestArkProvider(NETWORKS[network].operator).getInfo()])),
  limits: Object.fromEntries(NETWORK_IDS.map(network => [network, Number(process.env[`FAUCET_${envName(network)}_MAX_SATS`] ?? 200_000)])),
});

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5188');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let total = 0;
  const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBodyBytes) throw Object.assign(new Error('Request is too large.'), { code: 'AMOUNT_INVALID' });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Request body is invalid.'), { code: 'ADDRESS_INVALID' }); }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (request.method === 'OPTIONS') { response.statusCode = 204; response.end(); return; }
  if (request.method === 'GET' && url.pathname === '/api/faucet/health') return json(response, 200, { status: 'ok', networks: NETWORK_IDS });
  if (request.method === 'GET' && url.pathname === '/api/faucet/addresses') {
    const network = url.searchParams.get('network');
    if (!NETWORK_IDS.includes(network)) return json(response, 400, { code: 'NETWORK_INVALID', message: 'Choose Signet or Mutinynet.' });
    try { return json(response, 200, { network, ...(await wallets[network].addresses()) }); }
    catch (error) { console.error(`Faucet address lookup failed for ${network}:`, error?.stack ?? error); return json(response, 503, safeError(error)); }
  }
  if (request.method === 'GET' && url.pathname === '/api/faucet/balance') {
    const network = url.searchParams.get('network');
    if (!NETWORK_IDS.includes(network)) return json(response, 400, { code: 'NETWORK_INVALID', message: 'Choose Signet or Mutinynet.' });
    try { return json(response, 200, { network, ...(await wallets[network].balance()) }); }
    catch (error) { console.error(`Faucet balance preparation failed for ${network}:`, error?.stack ?? error); const result = safeError(error); if (result.code === 'UNAVAILABLE') result.message = 'Faucet funds are not currently spendable. Try refreshing the balance shortly.'; return json(response, 503, result); }
  }
  if (request.method === 'GET' && url.pathname.startsWith('/api/faucet/status/')) return json(response, 200, await service.status(decodeURIComponent(url.pathname.slice('/api/faucet/status/'.length))));
  if (request.method !== 'POST' || url.pathname !== '/api/faucet/request') return json(response, 404, { code: 'NOT_FOUND', message: 'Faucet endpoint not found.' });
  try {
    const body = await readJson(request);
    const result = await service.request({ ...body, clientKey: request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? 'local' });
    return json(response, 200, result);
  } catch (error) {
    const result = safeError(error);
    const status = result.code === 'RATE_LIMITED' ? 429 : result.code === 'UNAVAILABLE' ? 503 : 400;
    return json(response, status, result);
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Prototype faucet API listening at http://127.0.0.1:${port}`));
