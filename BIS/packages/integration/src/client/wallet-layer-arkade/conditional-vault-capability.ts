import { RestArkProvider, RestIndexerProvider } from "@arkade-os/sdk";
import { hex } from "@scure/base";
import {
  testNetwork,
  type TestNetwork,
} from "../state-layer-core/test-network.ts";
import { inspectWalletNetworkPolicy } from "../state-layer-core/wallet-network-policy.ts";
import {
  compileConditionalVault,
  VAULT_PRINCIPAL,
} from "./conditional-vault-program.ts";

// Independently generated pins from the protected local service store. Neither
// network trusts the key advertised by the service it is about to fund.
export const VAULT_EMULATORS = Object.freeze({
  signet: Object.freeze({
    endpoint: "http://127.0.0.1:7074",
    key: "77862f1572d642245a4b965c98bd18059b0897353e90c20c18ac92e8d753e3d2",
  }),
  mutinynet: Object.freeze({
    endpoint: "http://127.0.0.1:7075",
    key: "c8d7311dbfcb52d2b53258c57e062590337ed7796145afed5bd432be6490571d",
  }),
});
export async function inspectVaultCapability(
  network: TestNetwork,
  creator: Uint8Array,
  dependencies = {
    ark: new RestArkProvider(testNetwork(network).operator),
    indexer: new RestIndexerProvider(testNetwork(network).operator),
    emulatorInfo: async () => {
      const response = await fetch(
        `${VAULT_EMULATORS[network].endpoint}/v1/info`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) throw Error("vault-capability-emulator-unavailable");
      return response.json() as Promise<{
        signerPubkey: string;
        version?: string;
      }>;
    },
  },
) {
  const info = await dependencies.ark.getInfo();
  const policy = inspectWalletNetworkPolicy(network, info);
  if (policy.reason !== "supported")
    throw Error(`vault-capability-${policy.reason}`);
  if (!/^(02|03)[0-9a-f]{64}$/.test(info.signerPubkey))
    throw Error("vault-capability-invalid-operator-key");
  const minimum = BigInt(info.vtxoMinAmount);
  const maximum = BigInt(info.vtxoMaxAmount);
  if (
    minimum > VAULT_PRINCIPAL ||
    minimum < 0n ||
    (maximum !== -1n && maximum < VAULT_PRINCIPAL)
  )
    throw Error("vault-capability-principal-outside-policy");
  // Live MutinyNet proof rejected a 100-sat P2TR output below its 330-sat dust
  // limit. Wallet.send's OP_RETURN carrier is not an equivalent covenant.
  if (BigInt(info.dust) > VAULT_PRINCIPAL)
    throw Error("vault-capability-principal-below-taproot-dust");
  const emulator = await dependencies.emulatorInfo();
  if (
    !/^(02|03)[0-9a-f]{64}$/.test(emulator.signerPubkey) ||
    emulator.signerPubkey.slice(2) !== VAULT_EMULATORS[network].key
  )
    throw Error("vault-capability-emulator-pin-mismatch");
  const parameters = {
    network,
    id: "0000",
    creatorKey: hex.encode(creator),
    creatorDestination: hex.encode(creator),
    serverKey: info.signerPubkey.slice(2),
    emulatorKey: VAULT_EMULATORS[network].key,
    deadline: 2_000_000_000,
    exitDelaySeconds: Number(info.unilateralExitDelay),
  };
  const compiled = compileConditionalVault(parameters);
  await dependencies.indexer.getVtxos({
    scripts: compiled.states.map((s) => s.pkScript),
    spendableOnly: true,
  });
  return Object.freeze({
    network,
    operator: testNetwork(network).operator,
    operatorKey: info.signerPubkey,
    emulatorEndpoint: VAULT_EMULATORS[network].endpoint,
    emulatorKey: emulator.signerPubkey,
    emulatorVersion: emulator.version,
    zeroFees: policy.zeroFees,
    policyFingerprint: policy.fingerprint,
    minimum: minimum.toString(),
    maximum: maximum.toString(),
    bitcoinDust: String(info.dust),
    states: compiled.states.map((s) => ({
      progress: s.progress,
      treeBytes: s.script.encode().length,
      leaves: s.functions.map((f) => ({
        name: f.name,
        tapscriptBytes: f.tapscript.length / 2,
        covenantBytes: (f.covenant?.length ?? 0) / 2,
      })),
    })),
    classification: "read-only-compatible" as const,
    execution: "unverified" as const,
    fundedAcceptance: false,
  });
}
