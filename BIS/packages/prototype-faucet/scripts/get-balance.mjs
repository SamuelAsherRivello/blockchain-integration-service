import { ArkAddress, RestArkProvider, RestIndexerProvider } from '@arkade-os/sdk';
import { pathToFileURL } from 'node:url';
import { decodeArkadeAddress, validateArkadeAddress } from '../src/shared/faucet-core.mjs';
import { networkDefinition, isNetwork } from '../src/shared/network-config.mjs';

function usageError(message) {
  const error = new Error(message);
  error.code = 'USAGE';
  return error;
}

export function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw usageError(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw usageError(`Missing value for --${name}.`);
    values.set(name, value);
    index += 1;
  }

  const address = String(values.get('address') ?? '').trim();
  const network = String(values.get('network') ?? '').trim().toLowerCase();
  if (!address) throw usageError('--address is required.');
  if (!network) throw usageError('--network is required.');
  if (!isNetwork(network)) throw usageError('--network must be signet or mutinynet.');
  return Object.freeze({ address, network });
}

export function addressScript(address) {
  const decoded = decodeArkadeAddress(address);
  return `5120${Buffer.from(decoded.vtxoTaprootKey).toString('hex')}`;
}

function amountOf(vtxo) {
  const amount = Number(vtxo?.value ?? vtxo?.amount ?? vtxo?.amountSats ?? 0);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

export async function queryBalance({ address, network }, providers = {}) {
  const definition = networkDefinition(network);
  const arkProvider = providers.arkProvider ?? new RestArkProvider(definition.operator);
  const indexerProvider = providers.indexerProvider ?? new RestIndexerProvider(definition.operator);
  const [infoResult, vtxoResult] = await Promise.all([
    arkProvider.getInfo().then(info => ({ info })),
    indexerProvider.getVtxos({ scripts: [addressScript(address)], spendableOnly: true }).then(result => ({ result })),
  ]);
  const { info } = infoResult;
  const { result } = vtxoResult;
  validateArkadeAddress(address, info, network);
  const vtxos = result.vtxos ?? [];
  const balanceSats = vtxos.reduce((total, vtxo) => total + amountOf(vtxo), 0);
  return Object.freeze({ network, address, balanceSats, vtxoCount: vtxos.length });
}

async function main() {
  try {
    console.log(JSON.stringify(await queryBalance(parseArgs(process.argv.slice(2)))));
  } catch (error) {
    console.error(`${error.code ?? 'UNAVAILABLE'}: ${error.message ?? 'The balance service is unavailable.'}`);
    process.exitCode = error.code === 'USAGE' ? 2 : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
