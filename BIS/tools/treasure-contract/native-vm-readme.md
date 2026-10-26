# Treasure V4 native verification

Run `node BIS/tools/treasure-contract/authorized-vm-proof.ts` from the repository root with Node 24 and Go available. Set `BIS_GO_BINARY` to an explicit Go executable if necessary. `BIS_TREASURE_VM_SOURCE` may point to the upstream emulator's `pkg/arkade` directory. The default is the existing ignored checkout at `output/tools/conditional-vault/emulator/pkg/arkade`.

The source manifest pins all 42 top-level package Go files, go.mod and go.sum to upstream commit `7b830f6d7bd3998e1790f3d3e7737f34f40588f1`. The command checks canonical Git blob hashes, accepts Windows CRLF text, and copies only verified files into a fresh folder under `output/reports/treasure-contract/authorized-vm/`. It adds the tracked test helper and compiles a new binary. It never patches the upstream engine. Upstream testdata is not needed because only the named public fixture test runs.

Go uses workspace caches, the upstream Go 1.27.3 requirement, readonly module metadata, and checksum verification. The build may download its toolchain and dependencies. Reports retain source, binary and fixture hashes, compiler metadata, and original command output.

The 50 public fixtures exercise all four branches, deadline boundaries, missing expiry context, missing or changed actor proofs, proof order, amount and destination. Their identities are published trivial test scalars. The checkpoint forfeit key deliberately differs from the ordinary operator signing key, matching their separate provider roles. No wallet recovery material or provider is involved.

Passing proves local execution of the emitted bytecode under supplied VM clock and expiry context. Remote admission, real funding, delayed completion, network receipts and production deployment require their separate acceptance checks.
