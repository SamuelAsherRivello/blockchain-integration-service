import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  SingleKey,
  CSVMultisigTapscript,
  buildOffchainTx,
  verifyTapscriptSignatures,
  Extension,
  asset,
  Transaction,
} from "@arkade-os/sdk";
const { Packet, AssetGroup, AssetId, AssetInput, AssetOutput } = asset;
import {
  compileConditionalVault,
  conditionalVaultProgram,
  type VaultParameters,
} from "../../src/client/wallet-layer-arkade/conditional-vault-program.ts";

// Public curve points only. These fixtures never fund or sign a transaction.
const G = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
const H = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const parameters: VaultParameters = {
  network: "signet",
  id: "0000",
  creatorKey: G,
  creatorDestination: H,
  serverKey: H,
  emulatorKey: G,
  deadline: 2_000_000_000,
  exitDelaySeconds: 2048,
};

test("version 5 exact tree and artifact fixtures cover all states on both networks", () => {
  const expected = {
    signet: [
      "f5ece4e5f9a8dd2951c60377f16aa7ce7ea83280835f5c63b0000c70fe25efc9",
      "fd2787edd375ed70b48994103b4c50cc5f5a0d9bf009484b4000fa539b8d40e9",
      "52440777beffb305ec32a57909b7038c292abd58424ba4cc6eaa61f1e418e47c",
      "2cc41a531abedebec7e8809874b2ea70b5794e01c6bc92b3539dfb6dbd1c2c36",
    ],
    mutinynet: [
      "41b35b5970512dbb2508a42e5553a6af28d2167837f2c59ff57253b487c8d1f8",
      "460845dc82d67f27363278c5c5f9fe9919b975189989ef709f741d4a3a458c57",
      "6da7157d4f808510371dca8994bb77a034b2dd4eddd32367d5364326d7ddd256",
      "1f53f584358852f99980376cbfdb73aad616017a9f9f1715bbd944c19ae95017",
    ],
  };
  for (const network of ["signet", "mutinynet"] as const) {
    const built = compileConditionalVault({ ...parameters, network });
    assert.deepEqual(
      built.states.map((s) =>
        createHash("sha256")
          .update(s.script.encode())
          .update(JSON.stringify(s.functions))
          .digest("hex"),
      ),
      expected[network],
    );
  }
});

test("all four states compile deterministically with constrained recovery and explicit emergency exit", () => {
  const first = compileConditionalVault(parameters);
  const second = compileConditionalVault(parameters);
  assert.deepEqual(
    first.states.map((s) => s.pkScript),
    second.states.map((s) => s.pkScript),
  );
  assert.equal(new Set(first.states.map((s) => s.pkScript)).size, 4);
  for (const s of first.states) {
    assert.deepEqual(Object.keys(s.program.functions), [
      s.progress === 3 ? "claim" : "increment",
      "recover",
      "exit",
    ]);
    assert.ok(s.script.encode().length < 10_000);
    assert.equal(s.script.functionByName("exit")?.arkadeScript, undefined);
    assert.deepEqual(s.program.functions.recover.tapscript.signers, [
      "$server",
      "$creator",
    ]);
  }
  assert.deepEqual(
    first.states[0].program.functions.increment.tapscript.signers,
    ["$server"],
  );
});

test("network, identity, ID, deadline and destination all change the committed state", () => {
  const original = compileConditionalVault(parameters).states[0].pkScript;
  for (const changed of [
    { network: "mutinynet" as const },
    { id: "0001" },
    { deadline: parameters.deadline + 1 },
    { creatorKey: H },
    { creatorDestination: G },
    { emulatorKey: H },
    { exitDelaySeconds: 2560 },
  ]) {
    assert.notEqual(
      compileConditionalVault({ ...parameters, ...changed }).states[0].pkScript,
      original,
    );
  }
  for (const changed of [
    { id: "free-text" },
    { deadline: 1.5 },
    { exitDelaySeconds: 1 },
    { creatorKey: "00" },
  ]) {
    assert.throws(() => compileConditionalVault({ ...parameters, ...changed }));
  }
  assert.throws(() => conditionalVaultProgram(4));
});

test("emitted covenant bytecode executes in the pinned upstream VM", () => {
  const executable = resolve(
    "output/tools/conditional-vault/emulator/conditional-vault-vm.exe",
  );
  assert.ok(
    existsSync(executable),
    "Build the pinned VM using BIS/tools/conditional-vault-vm first. Do not replace execution with string tests.",
  );
  const cases: Array<{
    script: string;
    inputAmount: number;
    inputs: number;
    outputs: Array<{ script: string; amount: number }>;
  }> = [];
  const expected: boolean[] = [];
  const assets = Buffer.from(
    Extension.create([
      Packet.create([
        AssetGroup.create(
          AssetId.create("ab".repeat(32), 0),
          null,
          [AssetInput.create(0, 1n)],
          [AssetOutput.create(0, 1n)],
          [],
        ),
      ]),
    ]).serialize(),
  ).toString("hex");
  const add = (
    script: string,
    destination: string,
    valid: boolean,
    change: Record<string, unknown> = {},
  ) => {
    cases.push({
      script,
      inputAmount: 1000,
      inputs: 1,
      outputs: [
        { script: destination, amount: 1000 },
        { script: "6a", amount: 0 },
        { script: "51024e73", amount: 0 },
      ],
      ...change,
    });
    expected.push(valid);
  };
  for (const network of ["signet", "mutinynet"] as const) {
    for (const expired of [false, true]) {
      const built = compileConditionalVault({
        ...parameters,
        network,
        deadline: expired ? 1_700_000_000 : 2_000_000_000,
      });
      for (const state of built.states) {
        const action = state.functions.find(
          (f) => f.name === (state.progress === 3 ? "claim" : "increment"),
        )!;
        const destination =
          state.progress === 3
            ? `5120${H}`
            : built.states[state.progress + 1].pkScript;
        add(action.covenant!, destination, !expired);
        add(action.covenant!, `0020${destination.slice(4)}`, false); // same program, wrong witness version
        add(action.covenant!, `5120${G}`, false);
        add(action.covenant!, destination, false, { inputAmount: 1001 });
        add(action.covenant!, destination, false, { inputs: 2 });
        add(action.covenant!, destination, false, {
          outputs: [
            { script: destination, amount: 1000 },
            { script: assets, amount: 0 },
            { script: "51024e73", amount: 0 },
          ],
        });
        add(action.covenant!, destination, false, {
          outputs: [
            { script: destination, amount: 999 },
            { script: "6a", amount: 0 },
            { script: "51024e73", amount: 0 },
          ],
        });
        add(action.covenant!, destination, false, {
          outputs: [
            { script: destination, amount: 1000 },
            { script: "6a", amount: 0 },
            { script: "51024e73", amount: 0 },
            { script: `5120${G}`, amount: 1 },
          ],
        });
        const recovery = state.functions.find((f) => f.name === "recover")!;
        add(recovery.covenant!, `5120${H}`, expired);
        add(recovery.covenant!, `5120${G}`, false);
        if (state.progress < 3)
          for (const other of built.states.filter(
            (s) => s.progress !== state.progress + 1,
          ))
            add(action.covenant!, other.pkScript, false);
      }
    }
  }
  const result = spawnSync(executable, [], {
    input: JSON.stringify(cases),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(result.stdout),
    expected,
    `Executed ${cases.length} bytecode fixtures. ${result.stderr.slice(0, 1500)}`,
  );
});

test("VM clock enforces before, exactly-at, after, stale-clock and restart boundaries", () => {
  const executable = resolve(
    "output/tools/conditional-vault/emulator/conditional-vault-vm-clock.exe",
  );
  assert.ok(
    existsSync(executable),
    "Build the pinned VM clock fixture test binary first.",
  );
  const cases: unknown[] = [];
  const expected: boolean[] = [];
  for (const network of ["signet", "mutinynet"] as const) {
    const built = compileConditionalVault({ ...parameters, network });
    for (const state of built.states)
      for (const now of [
        parameters.deadline - 1,
        parameters.deadline,
        parameters.deadline + 1,
        parameters.deadline + 120,
      ]) {
        for (const recovery of [false, true]) {
          const action = state.functions.find(
            (f) =>
              f.name ===
              (recovery
                ? "recover"
                : state.progress === 3
                  ? "claim"
                  : "increment"),
          )!;
          const destination =
            recovery || state.progress === 3
              ? `5120${H}`
              : built.states[state.progress + 1].pkScript;
          cases.push({
            script: action.covenant,
            inputAmount: 1000,
            inputs: 1,
            now,
            outputs: [
              { script: destination, amount: 1000 },
              { script: "6a", amount: 0 },
              { script: "51024e73", amount: 0 },
            ],
          });
          expected.push(
            recovery ? now >= parameters.deadline : now < parameters.deadline,
          );
        }
      }
  }
  // Run each vector twice in a fresh process. No previous evaluation resets the deadline.
  for (let restart = 0; restart < 2; restart++) {
    const result = spawnSync(
      executable,
      ["-test.run=^TestBISConditionalVaultClockFixtures$", "-test.v"],
      {
        input: JSON.stringify(cases),
        encoding: "utf8",
        windowsHide: true,
        timeout: 30_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const encoded = /BIS_RESULTS=(\[[^\r\n]+\])/.exec(result.stdout)?.[1];
    assert.ok(encoded, result.stdout);
    assert.deepEqual(JSON.parse(encoded), expected);
  }
});

test("real signature verification requires the creator on Claim and Recovery", async () => {
  const creator = SingleKey.fromHex("1".padStart(64, "0"));
  const other = SingleKey.fromHex("2".padStart(64, "0"));
  const compiled = compileConditionalVault(parameters);
  const unroll = CSVMultisigTapscript.encode({
    pubkeys: [Buffer.from(H, "hex")],
    timelock: { type: "seconds", value: 2048n },
  });
  for (const state of compiled.states)
    for (const name of [
      "recover",
      ...(state.progress === 3 ? ["claim"] : []),
    ]) {
      const fn = state.script.functionByName(name)!;
      const build = () =>
        buildOffchainTx(
          [
            {
              txid: "ab".repeat(32),
              vout: 0,
              value: 1000,
              tapLeafScript: fn.tapLeafScript,
              tapTree: state.script.encode(),
            },
          ],
          [{ script: Buffer.from(`5120${H}`, "hex"), amount: 1000n }],
          unroll,
        ).arkTx;
      const unsigned = build();
      assert.throws(() => verifyTapscriptSignatures(unsigned, 0, [G]));
      const signed = await creator.sign(build(), [0]);
      assert.doesNotThrow(() => verifyTapscriptSignatures(signed, 0, [G]));
      // The other key is the server in these public fixtures; its signature cannot replace the creator's.
      const wrong = await other.sign(build(), [0]);
      assert.throws(
        () => verifyTapscriptSignatures(wrong, 0, [G]),
        /Missing signatures/,
      );
      assert.throws(
        () => signed.updateOutput(0, { amount: 999n }),
        /Cannot change signed field/,
      );
    }
});

test("emergency exits execute Bitcoin CSV and creator signatures from every state", async () => {
  const executable = resolve(
    "output/tools/conditional-vault/emulator/conditional-vault-vm.exe",
  );
  const creator = SingleKey.fromHex("1".padStart(64, "0"));
  const cases: unknown[] = [],
    expected: boolean[] = [];
  for (const network of ["signet", "mutinynet"] as const)
    for (const legacyVersion of [undefined, 4] as const) {
      const built = compileConditionalVault(
        { ...parameters, network },
        { legacyVersion },
      );
      for (const state of built.states) {
        const fn = state.script.functionByName("exit")!;
        for (const [sequence, valid] of [
          [0x400004, true],
          [0x400003, false],
          [0x80000004, false],
          [4, false],
        ] as const) {
          const tx = new Transaction({ version: 2, allowUnknownOutputs: true });
          tx.addInput({
            txid: "ab".repeat(32),
            index: 0,
            sequence,
            witnessUtxo: {
              script: Buffer.from(state.pkScript, "hex"),
              amount: 1000n,
            },
            tapLeafScript: [fn.tapLeafScript],
          });
          tx.addOutput({
            script: Buffer.from(`5120${H}`, "hex"),
            amount: 330n,
          });
          const signed = await creator.sign(tx, [0]);
          signed.finalize();
          cases.push({
            bitcoinTx: Buffer.from(signed.extract()).toString("hex"),
            previousScript: state.pkScript,
            inputAmount: 1000,
          });
          expected.push(valid);
        }
      }
    }
  const result = spawnSync(executable, [], {
    input: JSON.stringify(cases),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), expected);
  // The 330-sat output leaves at most 670 sats for this fixture's own spend.
  // Actual VTXO unroll/anchor packages need separate fee inputs and chain maturity.
});
