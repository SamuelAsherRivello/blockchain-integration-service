import { CSVMultisigTapscript, MultisigTapscript, RestArkProvider, RestIndexerProvider, Transaction, VtxoScript } from '@arkade-os/sdk';
import { base64, hex } from '@scure/base';
import { inspectWalletNetworkPolicy } from '../state-layer-core/wallet-network-policy.ts';
import { testNetwork, type TestNetwork } from '../state-layer-core/test-network.ts';

/** Public-only setup check. It cannot sign, fund, finalize, or expose an identity. */
export async function inspectContractSetup(network: TestNetwork, userKey: Uint8Array, providers = {
  ark: new RestArkProvider(testNetwork(network).operator),
  indexer: new RestIndexerProvider(testNetwork(network).operator),
}) {
  if (!(userKey instanceof Uint8Array) || userKey.length !== 32) throw Error('contract-setup-invalid-public-key');
  const info = await providers.ark.getInfo();
  const policy = inspectWalletNetworkPolicy(network, info);
  if (policy.reason !== 'supported') throw Error(`contract-setup-${policy.reason}`);
  if (!/^(02|03)[0-9a-f]{64}$/i.test(info.signerPubkey)) throw Error('contract-setup-invalid-operator-key');
  const serverKey = hex.decode(info.signerPubkey).slice(1);
  const delay = BigInt(info.unilateralExitDelay);
  if (delay <= 0n) throw Error('contract-setup-invalid-exit-delay');
  const cooperative = MultisigTapscript.encode({ pubkeys: [userKey, serverKey] }).script;
  const exit = CSVMultisigTapscript.encode({ pubkeys: [userKey], timelock: { type: 'seconds', value: delay } }).script;
  const script = new VtxoScript([cooperative, exit]);
  const encoded = script.encode();
  if (hex.encode(VtxoScript.decode(encoded).pkScript) !== hex.encode(script.pkScript)) throw Error('contract-setup-script-roundtrip');
  // Exercise SDK transaction/scure encoding without signing or transmitting anything.
  const transaction = new Transaction();
  transaction.addOutput({ script: script.pkScript, amount: 100n });
  const decoded = Transaction.fromPSBT(base64.decode(base64.encode(transaction.toPSBT())));
  if (decoded.outputsLength !== 1) throw Error('contract-setup-transaction-roundtrip');
  const outputs = await providers.indexer.getVtxos({ scripts: [hex.encode(script.pkScript)], spendableOnly: true });
  if (!Array.isArray(outputs.vtxos)) throw Error('contract-setup-indexer-unavailable');
  return Object.freeze({ network, operator: testNetwork(network).operator, policy: policy.reason,
    operatorKey: info.signerPubkey, exitDelaySeconds: delay.toString(), scriptBytes: encoded.length,
    pkScript: hex.encode(script.pkScript), indexerReadable: true, scriptRoundtrip: true,
    transactionRoundtrip: true, fundedAcceptance: false });
}
