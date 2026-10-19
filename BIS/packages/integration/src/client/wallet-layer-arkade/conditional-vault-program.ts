import { arkade } from "@arkade-os/sdk";
import { hex } from "@scure/base";

export const VAULT_PROGRAM_VERSION = 5;
export const VAULT_PRINCIPAL = 1000n;
export const VAULT_TARGET = 3;

/** All values are public. The deadline is absolute and never renewed by a transition. */
export type VaultParameters = Readonly<{
  network: "signet" | "mutinynet";
  id: string;
  creatorKey: string;
  creatorDestination: string;
  serverKey: string;
  emulatorKey: string;
  deadline: number;
  exitDelaySeconds: number;
}>;

/**
 * Exact-spend covenant for the pinned SDK's zero-fee transaction layout:
 * output 0 = principal, output 1 = extension, output 2 = zero-value P2A.
 * Nonzero fees require a separately tested layout, not a reduced principal.
 */
export function conditionalVaultProgram(
  progress: number,
  legacyLayout = false,
): ConstructorParameters<typeof arkade.ArkadeProgramScript>[0] {
  if (!Number.isInteger(progress) || progress < 0 || progress > VAULT_TARGET)
    throw Error("vault-invalid-progress");
  const branch = (
    destination: string,
    recovery: boolean,
    creator: boolean,
  ) => ({
    inputs: [],
    tapscript: { signers: creator ? ["$server", "$creator"] : ["$server"] },
    arkadeScript: {
      asm: [
        "$scope",
        "DROP",
        "$progress",
        "DROP",
        "$deadline",
        "CHECKTIME",
        ...(recovery ? [] : ["NOT"]),
        "VERIFY",
        "INSPECTNUMINPUTS",
        1,
        "EQUALVERIFY",
        0,
        "INSPECTINPUTVALUE",
        "$amount",
        "EQUALVERIFY",
        "INSPECTNUMOUTPUTS",
        3,
        "EQUALVERIFY",
        // Asset packet type 0 must be absent. NUMASSETGROUPS errors when absent.
        0,
        "INSPECTPACKET",
        "NOT",
        "VERIFY",
        "DROP",
        0,
        "INSPECTOUTPUTSCRIPTPUBKEY",
        1,
        "EQUALVERIFY",
        destination,
        "EQUALVERIFY",
        0,
        "INSPECTOUTPUTVALUE",
        "$amount",
        "EQUALVERIFY",
        legacyLayout ? 1 : 2,
        "INSPECTOUTPUTSCRIPTPUBKEY",
        1,
        "EQUALVERIFY",
        new Uint8Array([0x4e, 0x73]),
        "EQUALVERIFY",
        legacyLayout ? 1 : 2,
        "INSPECTOUTPUTVALUE",
        0,
        "EQUALVERIFY",
        legacyLayout ? 2 : 1,
        "INSPECTOUTPUTVALUE",
        0,
        "EQUAL",
      ],
      witness: [],
    },
  });
  return {
    version: 0,
    name: `BISConditionalVaultV${VAULT_PROGRAM_VERSION}State${progress}`,
    params: [
      { name: "scope", type: "bytes" },
      { name: "progress", type: "int" },
      { name: "server", type: "pubkey" },
      { name: "creator", type: "pubkey" },
      { name: "creatorDestination", type: "bytes" },
      { name: "amount", type: "int" },
      { name: "deadline", type: "int" },
      { name: "exitDelay", type: "int" },
      ...(progress < VAULT_TARGET
        ? [{ name: "nextDestination", type: "bytes" as const }]
        : []),
    ],
    functions: {
      ...(progress < VAULT_TARGET
        ? { increment: branch("$nextDestination", false, false) }
        : { claim: branch("$creatorDestination", false, true) }),
      recover: branch("$creatorDestination", true, true),
      // Emergency Bitcoin exit, not a cooperative successful Claim.
      exit: {
        tapscript: {
          signers: ["$creator"],
          csv: { type: "seconds", value: "$exitDelay" },
        },
      },
    },
  };
}

function publicKey(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) throw Error("vault-invalid-public-key");
  return hex.decode(value);
}

/** Pure deterministic compilation, with no provider, storage, clock, or secret access. */
export function compileConditionalVault(
  parameters: VaultParameters,
  options: { legacyVersion?: 3 | 4 } = {},
) {
  const version = options.legacyVersion ?? VAULT_PROGRAM_VERSION;
  const principal = version === 3 ? 100n : VAULT_PRINCIPAL;
  if (!["signet", "mutinynet"].includes(parameters.network))
    throw Error("vault-invalid-network");
  if (!/^\d{4}$/.test(parameters.id)) throw Error("vault-invalid-id");
  if (
    !Number.isSafeInteger(parameters.deadline) ||
    parameters.deadline < 500_000_000 ||
    parameters.deadline > 0xffff_ffff
  )
    throw Error("vault-invalid-deadline");
  // SDK's BIP68 seconds encoding must not round down a requested emergency delay.
  if (
    !Number.isSafeInteger(parameters.exitDelaySeconds) ||
    parameters.exitDelaySeconds <= 0 ||
    parameters.exitDelaySeconds % 512 ||
    parameters.exitDelaySeconds > 65535 * 512
  )
    throw Error("vault-invalid-exit-delay");
  const creator = publicKey(parameters.creatorKey);
  const server = publicKey(parameters.serverKey);
  const emulator = publicKey(parameters.emulatorKey);
  const destination = publicKey(parameters.creatorDestination);
  const scope = new TextEncoder().encode(
    `bis:conditional-vault:${version}:${parameters.network}:${parameters.creatorKey}:${parameters.id}`,
  );
  const states = [];
  let nextDestination: Uint8Array | undefined;
  for (let progress = VAULT_TARGET; progress >= 0; progress--) {
    const program = conditionalVaultProgram(progress, version < 5);
    const args = {
      scope,
      progress: BigInt(progress),
      server,
      creator,
      creatorDestination: destination,
      amount: principal,
      deadline: BigInt(parameters.deadline),
      exitDelay: BigInt(parameters.exitDelaySeconds),
      ...(nextDestination ? { nextDestination } : {}),
    };
    const script = new arkade.ArkadeProgramScript(program, args, {
      serverKey: server,
      userKey: creator,
      emulatorKey: emulator,
    });
    states.unshift({
      progress,
      program,
      args,
      script,
      pkScript: hex.encode(script.pkScript),
      functions: script.compiled.map((fn) => ({
        name: fn.name,
        tapscript: hex.encode(fn.leafScript),
        covenant: fn.arkadeScript ? hex.encode(fn.arkadeScript) : undefined,
        assembly: fn.arkadeScript
          ? arkade.bytesToASM(fn.arkadeScript)
          : undefined,
      })),
    });
    nextDestination = script.tweakedPublicKey;
  }
  return { version, parameters: { ...parameters }, states };
}
