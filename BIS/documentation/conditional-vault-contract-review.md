# Conditional Vault contract documentation review

Reviewed 2026-10-19 against SDK 0.4.79. The live [documentation index](https://docs.arkadeos.com/llms.txt) lists nine Contracts pages and three linked experimental contract pages. All twelve pages were read, including their example code and caveats. This inventory records source constraints, not funded acceptance.

| Page | Constraint or implementation decision |
| --- | --- |
| [Setup](https://docs.arkadeos.com/contracts/setup) | Declare SDK and scure/base in the importing workspace. Use configured testnet providers and protected test identities instead of the mainnet endpoint and published example phrases. |
| [Deep dive](https://docs.arkadeos.com/contracts/deep-dive) | Cooperative paths include the operator; unilateral paths have CSV delay. Preserve exact input values, Taproot tree and Arkade PSBT fields. Submission and checkpoint finalization are separate steps. |
| [Escrow](https://docs.arkadeos.com/contracts/escrow) | Signature branches and a CLTV refund are supported examples. They do not enforce the vault counter or an upper-bound claim deadline. Some snippets need caller-supplied destination scripts. |
| [Hashlock](https://docs.arkadeos.com/contracts/hashlock) | Distinguish hash preimage verification from time policy. Its `info.exitDelay` example needs reconciliation with the pinned SDK's `unilateralExitDelay`. Never print a live preimage as the example does. |
| [Spilman channel](https://docs.arkadeos.com/contracts/spilman-channel) | Monotonic signed payment states are not a permissionless counter. Preserve both-party checkpoint signing and ordered exit/refund delays. |
| [Dryja-Poon channel](https://docs.arkadeos.com/contracts/dryja-poon-channel) | Revocation keys and relative delays are necessary channel mechanics; omitted derivations are not runnable production code. Do not copy its placeholder state construction into the vault. |
| [Lightning swaps](https://docs.arkadeos.com/contracts/lightning-swaps) | Boltz integration is retired and its service unavailable. Do not install it for this change. |
| [Lightning Channels](https://docs.arkadeos.com/contracts/lightning-channels) | Experimental; expiry must leave room for resolution. Its channel-factory construction is outside the vault scope. |
| [Chain swaps](https://docs.arkadeos.com/contracts/chain-swaps) | Retired Boltz path. Native boarding/offboarding replaces it; neither supplies a counter covenant. |
| [Compiler](https://docs.arkadeos.com/experimental/arkade-compiler) | Experimental, not recommended for production environments. Documentation artifact examples differ from the installed SDK's version-0 `Program` shape. Use pinned source and executable fixtures rather than assume compatibility. |
| [Functions](https://docs.arkadeos.com/experimental/arkade-functions) | Experimental function descriptions include lower-bound locktime checks, signatures and introspection. They do not establish the semantics of installed `CHECKTIME`; inspect and test the pinned VM. |
| [Non-interactive swaps](https://docs.arkadeos.com/experimental/non-interactive-swaps) | Illustrative expiry variant differs from the current non-expiring reference swap. Output inspection, cancellation and partial fills require complete code, not the omitted example branches. |

## Setup and verification boundary

The repository uses npm workspaces. Its SDK is pinned to 0.4.79, and the installed scure/base is 2.4.0. Provider selection must use BIS's Signet or MutinyNet configuration, verify the reported network, validate the compressed operator key before converting it, and round-trip the generated scripts. The setup smoke check must not submit or finalize transactions.

Successful setup establishes imports, encoding, script construction and network reads only. Contract execution, valid and forbidden spends, emulator compatibility, protected recovery and funded acceptance remain separate checks. This implementation targets production-quality application behavior on test networks; it must retain the experimental upstream status in its technical documentation.

## Setup checks performed

Run `node --test BIS/packages/integration/tests/client/contract-setup.test.ts` for script/PSBT round-trips and network/policy/key rejection tests. Run `node BIS/scripts/contract-setup.ts test-account-1` for read-only provider checks using the protected registered account. This command never signs, finalizes or funds a transaction and prints only allowlisted public check results.

On 2026-10-19 both live provider checks passed using the protected test account. Each network returned readable indexer results and a 114-byte two-path script round-trip. The reported unilateral exit delays were 172544 seconds on Signet and 2048 seconds on MutinyNet. A clean npm install passed in an isolated directory under `output/reports/conditional-vault-supported-networks/clean-install`; the running workspace was restored after its Vite-loaded native module prevented in-place cleanup. These are setup results, not contract-spend evidence.
